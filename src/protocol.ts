export type Vec = { x: number; y: number };
export type Player = { id: string; name: string; role: 'runner' | 'warden'; x: number; y: number; facing: number; shards: number; extracted: boolean; caught: boolean; color: string };
export type Sentry = { id: number; x: number; y: number; facing: number; patrol: Vec[]; target: number; alert: number };
export type Shard = Vec & { id: number; taken: boolean };
export type GameState = { room: string; phase: 'lobby' | 'active' | 'ended'; players: Player[]; sentries: Sentry[]; shards: Shard[]; alarm: number; timeLeft: number; winner?: string; extraction: Vec };
