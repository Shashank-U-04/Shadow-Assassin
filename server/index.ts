import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import type { GameState, Player, Sentry, Vec } from '../src/protocol.js';

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*' } });
const PORT = Number(process.env.PORT || 3001);
const WORLD = { w: 1600, h: 900 };
type Room = { state: GameState; inputs: Map<string, Vec>; last: number };
const rooms = new Map<string, Room>();
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));
const code=()=>Math.random().toString(36).slice(2,6).toUpperCase();
const dist=(a:Vec,b:Vec)=>Math.hypot(a.x-b.x,a.y-b.y);
function makeRoom(id:string):Room {
  const routes: Vec[][] = [ [{x:420,y:190},{x:760,y:190},{x:760,y:370},{x:420,y:370}], [{x:1050,y:230},{x:1370,y:230},{x:1370,y:570},{x:1050,y:570}], [{x:460,y:650},{x:820,y:650},{x:820,y:780},{x:460,y:780}] ];
  return { inputs:new Map(), last:Date.now(), state:{ room:id, phase:'lobby', players:[], alarm:0, timeLeft:180, extraction:{x:1480,y:790}, shards:[{id:0,x:610,y:280,taken:false},{id:1,x:1180,y:430,taken:false},{id:2,x:660,y:735,taken:false}], sentries:routes.map((patrol,id)=>({id,x:patrol[0].x,y:patrol[0].y,facing:0,patrol,target:1,alert:0})) } };
}
function join(socketId:string, roomId:string, name:string) {
  const room=rooms.get(roomId) || (()=>{const r=makeRoom(roomId); rooms.set(roomId,r); return r;})();
  if(room.state.players.length>=2 || room.state.phase==='ended') return {error:'Room unavailable'};
  const role=room.state.players.length===0?'runner':'warden';
  room.state.players.push({id:socketId,name:name.slice(0,14)||'Operative',role,x:role==='runner'?120:240,y:role==='runner'?120:760,facing:0,shards:0,extracted:false,caught:false,color:role==='runner'?'#7cf7d4':'#ff5e78'});
  return {room};
}
function step(room:Room, dt:number) {
  const s=room.state; if(s.phase!=='active') return;
  s.timeLeft=Math.max(0,s.timeLeft-dt/1000);
  for(const p of s.players) { const input=room.inputs.get(p.id)||{x:0,y:0}; const mag=Math.hypot(input.x,input.y)||1; const speed=p.caught?0:230; p.x=clamp(p.x+(input.x/mag)*speed*dt/1000,35,WORLD.w-35); p.y=clamp(p.y+(input.y/mag)*speed*dt/1000,35,WORLD.h-35); if(input.x||input.y) p.facing=Math.atan2(input.y,input.x); }
  for(const sentry of s.sentries) { const target=sentry.patrol[sentry.target]; const dx=target.x-sentry.x,dy=target.y-sentry.y,d=Math.hypot(dx,dy); if(d<4) sentry.target=(sentry.target+1)%sentry.patrol.length; else { sentry.x+=dx/d*85*dt/1000; sentry.y+=dy/d*85*dt/1000; sentry.facing=Math.atan2(dy,dx); } sentry.alert=Math.max(0,sentry.alert-dt/1000); for(const p of s.players) if(!p.caught && dist(p,sentry)<155) { const angle=Math.abs(Math.atan2(Math.sin(Math.atan2(p.y-sentry.y,p.x-sentry.x)-sentry.facing),Math.cos(Math.atan2(p.y-sentry.y,p.x-sentry.x)-sentry.facing))); if(angle<1.15) { s.alarm=Math.min(100,s.alarm+26*dt/1000); sentry.alert=1; if(s.alarm>85) p.caught=true; } } }
  for(const shard of s.shards) for(const p of s.players) if(!shard.taken && dist(p,shard)<35) { shard.taken=true; p.shards++; s.alarm=Math.min(100,s.alarm+7); }
  const runner=s.players.find(p=>p.role==='runner'); const warden=s.players.find(p=>p.role==='warden');
  if(runner && dist(runner,s.extraction)<55 && runner.shards===s.shards.length) { runner.extracted=true; s.phase='ended'; s.winner=`${runner.name} escaped the relay`; }
  if((runner?.caught || s.timeLeft<=0) && s.phase==='active') { s.phase='ended'; s.winner=`${warden?.name || 'Warden'} sealed the sector`; }
}
io.on('connection', socket=>{
  socket.on('room:create',({name}:{name:string}, cb)=>{let id=code();while(rooms.has(id))id=code(); const result=join(socket.id,id,name); socket.join(id); cb({ok:true,room:id,role:result.room!.state.players[0].role}); io.to(id).emit('state',result.room!.state);});
  socket.on('room:join',({room,name}:{room:string,name:string},cb)=>{const result=join(socket.id,room.toUpperCase(),name); if('error' in result)return cb({ok:false,error:result.error}); socket.join(room.toUpperCase()); cb({ok:true,room:room.toUpperCase(),role:result.room!.state.players.at(-1)!.role}); io.to(room.toUpperCase()).emit('state',result.room!.state);});
  socket.on('game:start',({room}:{room:string})=>{const r=rooms.get(room);if(r&&r.state.players.length===2&&r.state.phase==='lobby'){r.state.phase='active';io.to(room).emit('state',r.state);}});
  socket.on('input',({room,x,y}:{room:string,x:number,y:number})=>{const r=rooms.get(room);if(r)r.inputs.set(socket.id,{x:clamp(x,-1,1),y:clamp(y,-1,1)});});
  socket.on('disconnect',()=>{for(const [id,r] of rooms){r.state.players=r.state.players.filter(p=>p.id!==socket.id);r.inputs.delete(socket.id); if(!r.state.players.length)rooms.delete(id); else {r.state.phase='lobby';io.to(id).emit('state',r.state);}}});
});
setInterval(()=>{const now=Date.now();for(const r of rooms.values()){const dt=Math.min(60,now-r.last);r.last=now;step(r,dt);io.to(r.state.room).emit('state',r.state);}},50);
app.get('/health',(_,res)=>res.json({ok:true,rooms:rooms.size}));
http.listen(PORT,()=>console.log(`Shadow Relay server on :${PORT}`));
