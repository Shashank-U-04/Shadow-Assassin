# Shadow Relay

An original, browser-first 1v1 sci-fi stealth prototype. The **Runner** must collect three signal shards and reach extraction; the **Warden** wins if the Runner is caught or the relay timer expires. Autonomous sentries and the sector-wide alarm are shared hazards.

## Run locally

```powershell
npm install
npm run dev
```

Open `http://localhost:5173` in two browser windows (or a desktop and phone on the same network using the Vite LAN URL). Create a relay in one window and enter its four-character code in the other. The first player is Runner; the second is Warden. Press **Start Round** once both are connected.

Controls: WASD or arrow keys; touch directional controls appear on compact screens.

The Node/Socket.IO server runs on port 3001 and owns movement simulation, sentry patrol/detection, shard collection, alarm progression, and win states. The Phaser client only submits directional input and renders synchronized snapshots.
