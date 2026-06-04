# Neon Cannon VR

A holodeck-style VR artillery arcade built with [IWSDK](https://iwsdk.dev) 0.4.1.

**[Play Now](https://ellyz2426.github.io/neon-cannon/)**

## Features

- **Physics-Based Cannon** — Aim, charge power, and fire projectiles with parabolic arc trajectories
- **30 Campaign Levels** — 5 zones of increasing difficulty (Neon Grid, Crimson Forge, Cyan Circuit, Gold Nexus, Void Matrix)
- **5 Ammo Types** — Cannonball, Fireball (explosive AoE), Bouncer (ricochets), Cluster (splits into 3), Heavy Shot (3x damage)
- **5 Block Types** — Wood (1 HP), Stone (2 HP), Metal (3 HP), Crystal (bonus points), TNT (chain explosions)
- **5 Game Modes** — Campaign, Arcade (endless), Free Play, Time Attack, Daily Challenge
- **30 Achievements** — Destruction, combo, score, and progression milestones
- **Star Rating** — 1-3 stars per level based on shots efficiency
- **Combo System** — Chain block destructions for score multipliers
- **TNT Chain Reactions** — Strategic explosive chains
- **Trajectory Preview** — Aim assist with dotted trajectory line
- **Career Stats** — Lifetime tracking of shots, blocks, combos, and more
- **5 Themed Arenas** — Each zone has unique colors and atmosphere
- **Procedural Audio** — 10+ SFX types, ambient drone soundtrack
- **Visual Effects** — Particles, charge ring, muzzle flash, block destruction

## Controls

### VR (XR Controllers)
- **Trigger** — Charge + fire cannon
- **Thumbstick** — Aim cannon (elevation & rotation)
- **B Button** — Pause

### Browser (Keyboard)
- **Space** — Charge + fire (hold to charge, release to fire)
- **Up/Down** — Aim elevation
- **Left/Right** — Aim rotation
- **1-5** — Select ammo type
- **Escape** — Pause
- **WASD** — Move

## Tech

- Built with [IWSDK](https://iwsdk.dev) 0.4.1 (dual-runtime: VR + browser)
- **15 PanelUI templates** (`.uikitml`) — zero HTML DOM overlays
- All UI renders spatially in XR via IWSDK's built-in PanelUI system
- Physics-based projectile simulation (gravity, collision, bouncing)
- Procedural Web Audio API (no audio file dependencies)
- localStorage persistence for all progress

## Development

```bash
npm install
npm run dev
```

## License

MIT
