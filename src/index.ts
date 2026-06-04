import {
  World, PanelUI, PanelDocument, UIKitDocument, Follower, FollowBehavior, ScreenSpace,
  Mesh, Group, BoxGeometry, SphereGeometry, CylinderGeometry, PlaneGeometry,
  ConeGeometry, TorusGeometry, RingGeometry,
  MeshStandardMaterial, MeshBasicMaterial, LineBasicMaterial,
  Color, Vector3, Quaternion, Euler,
  Fog, AmbientLight, PointLight, DirectionalLight, SpotLight,
  BufferGeometry, Float32BufferAttribute,
  EdgesGeometry, LineSegments, Line,
  AdditiveBlending, DoubleSide, FrontSide,
  InputComponent,
} from '@iwsdk/core';

// ─── Types & Constants ───────────────────────────────────────────

type GameState = 'title' | 'modeselect' | 'levelselect' | 'ammo' |
  'countdown' | 'aiming' | 'charging' | 'firing' | 'impact' |
  'levelcomplete' | 'gameover' | 'achievements' | 'settings' | 'help' | 'stats' | 'pause';

type GameMode = 'campaign' | 'arcade' | 'freeplay' | 'timeattack' | 'daily';

interface AmmoType {
  name: string; desc: string; damage: number; speed: number;
  color: string; emissive: string; radius: number;
  explosive: boolean; explosionRadius: number;
  bounces: number; cluster: number; unlockLevel: number;
}

interface BlockDef {
  type: 'wood' | 'stone' | 'metal' | 'crystal' | 'tnt';
  x: number; y: number; z: number;
  w?: number; h?: number; d?: number;
}

interface LevelDef {
  name: string; zone: number; shots: number;
  blocks: BlockDef[]; targetX?: number; targetZ?: number;
}

interface BlockInstance {
  mesh: Mesh; edges: LineSegments; type: string;
  hp: number; maxHp: number; points: number;
  x: number; y: number; z: number;
  w: number; h: number; d: number;
  destroyed: boolean; falling: boolean; vy: number;
}

interface Projectile {
  mesh: Mesh; glow: Mesh; trail: Mesh[];
  vx: number; vy: number; vz: number;
  active: boolean; bounces: number; ammoType: number;
}

interface Theme {
  name: string; ground: string; grid: string; accent: string;
  fog: string; sky: string; glow: string; cannon: string;
}

interface Achievement {
  id: string; name: string; desc: string; icon: string;
  check: () => boolean;
}

// ─── Ammo Data ───────────────────────────────────────────────────

const AMMO_TYPES: AmmoType[] = [
  { name: 'CANNONBALL', desc: 'Standard iron shot', damage: 1, speed: 1.0, color: '#ff6600', emissive: '#441100', radius: 0.12, explosive: false, explosionRadius: 0, bounces: 0, cluster: 0, unlockLevel: 0 },
  { name: 'FIREBALL', desc: 'Explodes on impact', damage: 1, speed: 1.0, color: '#ff3300', emissive: '#660000', radius: 0.15, explosive: true, explosionRadius: 1.5, bounces: 0, cluster: 0, unlockLevel: 3 },
  { name: 'BOUNCER', desc: 'Bounces off surfaces', damage: 1, speed: 1.1, color: '#44ff44', emissive: '#004400', radius: 0.1, explosive: false, explosionRadius: 0, bounces: 2, cluster: 0, unlockLevel: 6 },
  { name: 'CLUSTER', desc: 'Splits into 3 on impact', damage: 0.5, speed: 0.9, color: '#aa44ff', emissive: '#220044', radius: 0.1, explosive: false, explosionRadius: 0, bounces: 0, cluster: 3, unlockLevel: 10 },
  { name: 'HEAVY SHOT', desc: 'Massive damage, slow arc', damage: 3, speed: 0.6, color: '#cccccc', emissive: '#222222', radius: 0.2, explosive: false, explosionRadius: 0, bounces: 0, cluster: 0, unlockLevel: 15 },
];

// ─── Block Properties ────────────────────────────────────────────

const BLOCK_PROPS: Record<string, { hp: number; color: string; emissive: string; points: number; edge: string }> = {
  wood:    { hp: 1, color: '#885522', emissive: '#221100', points: 100, edge: '#aa6633' },
  stone:   { hp: 2, color: '#667788', emissive: '#112233', points: 200, edge: '#8899aa' },
  metal:   { hp: 3, color: '#aabbcc', emissive: '#334455', points: 300, edge: '#ccddee' },
  crystal: { hp: 1, color: '#00ffff', emissive: '#004444', points: 500, edge: '#44ffff' },
  tnt:     { hp: 1, color: '#ff2200', emissive: '#440000', points: 150, edge: '#ff4433' },
};

// ─── Themes ──────────────────────────────────────────────────────

const THEMES: Theme[] = [
  { name: 'NEON GRID', ground: '#111122', grid: '#ff4400', accent: '#ff6600', fog: '#0a0005', sky: '#050010', glow: '#ff3300', cannon: '#ff6600' },
  { name: 'CRIMSON FORGE', ground: '#1a0808', grid: '#ff2200', accent: '#ff3300', fog: '#100005', sky: '#080002', glow: '#ff0000', cannon: '#ff3333' },
  { name: 'CYAN CIRCUIT', ground: '#081118', grid: '#00aacc', accent: '#00cccc', fog: '#000510', sky: '#000208', glow: '#00aaff', cannon: '#00cccc' },
  { name: 'GOLD NEXUS', ground: '#181408', grid: '#ccaa00', accent: '#ffcc00', fog: '#0a0800', sky: '#080500', glow: '#ffaa00', cannon: '#ffcc00' },
  { name: 'VOID MATRIX', ground: '#0a000a', grid: '#8800cc', accent: '#aa44ff', fog: '#050008', sky: '#020005', glow: '#9900ff', cannon: '#aa44ff' },
];

// ─── Level Definitions ───────────────────────────────────────────

function generateLevels(): LevelDef[] {
  const levels: LevelDef[] = [];

  // Zone 1: Neon Grid (levels 1-6) — simple structures
  levels.push({ name: 'First Strike', zone: 0, shots: 5, blocks: [
    { type: 'wood', x: 0, y: 0.25, z: -8 }, { type: 'wood', x: 0.5, y: 0.25, z: -8 },
    { type: 'wood', x: 0.25, y: 0.75, z: -8 },
  ]});
  levels.push({ name: 'Stack Up', zone: 0, shots: 5, blocks: [
    { type: 'wood', x: 0, y: 0.25, z: -8 }, { type: 'wood', x: 0, y: 0.75, z: -8 },
    { type: 'wood', x: 0, y: 1.25, z: -8 }, { type: 'crystal', x: 0, y: 1.75, z: -8 },
  ]});
  levels.push({ name: 'Twin Towers', zone: 0, shots: 5, blocks: [
    { type: 'wood', x: -1, y: 0.25, z: -8 }, { type: 'wood', x: -1, y: 0.75, z: -8 },
    { type: 'wood', x: 1, y: 0.25, z: -8 }, { type: 'wood', x: 1, y: 0.75, z: -8 },
    { type: 'crystal', x: -1, y: 1.25, z: -8 }, { type: 'crystal', x: 1, y: 1.25, z: -8 },
  ]});
  levels.push({ name: 'Wall Breach', zone: 0, shots: 4, blocks: [
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'stone' as const, x: -0.75 + i * 0.5, y: 0.25, z: -8 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'wood' as const, x: -0.75 + i * 0.5, y: 0.75, z: -8 })),
  ]});
  levels.push({ name: 'TNT Surprise', zone: 0, shots: 3, blocks: [
    { type: 'wood', x: -0.5, y: 0.25, z: -8 }, { type: 'tnt', x: 0, y: 0.25, z: -8 },
    { type: 'wood', x: 0.5, y: 0.25, z: -8 }, { type: 'wood', x: -0.5, y: 0.75, z: -8 },
    { type: 'wood', x: 0, y: 0.75, z: -8 }, { type: 'wood', x: 0.5, y: 0.75, z: -8 },
  ]});
  levels.push({ name: 'Pyramid', zone: 0, shots: 5, blocks: [
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'wood' as const, x: -1 + i * 0.5, y: 0.25, z: -8 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'stone' as const, x: -0.5 + i * 0.5, y: 0.75, z: -8 })),
    { type: 'crystal', x: 0, y: 1.25, z: -8 },
  ]});

  // Zone 2: Crimson Forge (levels 7-12) — stone + metal
  levels.push({ name: 'Iron Gate', zone: 1, shots: 5, blocks: [
    { type: 'metal', x: -0.5, y: 0.25, z: -9 }, { type: 'metal', x: 0.5, y: 0.25, z: -9 },
    { type: 'metal', x: -0.5, y: 0.75, z: -9 }, { type: 'metal', x: 0.5, y: 0.75, z: -9 },
    { type: 'stone', x: 0, y: 0.25, z: -9 }, { type: 'stone', x: 0, y: 0.75, z: -9 },
    { type: 'crystal', x: 0, y: 1.25, z: -9 },
  ]});
  levels.push({ name: 'Fortress', zone: 1, shots: 6, blocks: [
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'stone' as const, x: -1 + i * 0.5, y: 0.25, z: -9 })),
    { type: 'metal', x: -1, y: 0.75, z: -9 }, { type: 'metal', x: 1, y: 0.75, z: -9 },
    { type: 'wood', x: -0.5, y: 0.75, z: -9 }, { type: 'wood', x: 0, y: 0.75, z: -9 }, { type: 'wood', x: 0.5, y: 0.75, z: -9 },
    { type: 'tnt', x: 0, y: 1.25, z: -9 },
  ]});
  levels.push({ name: 'Deep Wall', zone: 1, shots: 6, blocks: [
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'metal' as const, x: -0.75 + i * 0.5, y: 0.25, z: -9 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'stone' as const, x: -0.75 + i * 0.5, y: 0.75, z: -9 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'wood' as const, x: -0.75 + i * 0.5, y: 1.25, z: -9 })),
  ]});
  levels.push({ name: 'Chain Blast', zone: 1, shots: 3, blocks: [
    { type: 'tnt', x: -1, y: 0.25, z: -9 }, { type: 'wood', x: -0.5, y: 0.25, z: -9 },
    { type: 'tnt', x: 0, y: 0.25, z: -9 }, { type: 'wood', x: 0.5, y: 0.25, z: -9 },
    { type: 'tnt', x: 1, y: 0.25, z: -9 },
    { type: 'stone', x: -0.5, y: 0.75, z: -9 }, { type: 'stone', x: 0, y: 0.75, z: -9 }, { type: 'stone', x: 0.5, y: 0.75, z: -9 },
  ]});
  levels.push({ name: 'Barricade', zone: 1, shots: 6, blocks: [
    ...Array.from({ length: 6 }, (_, i) => ({ type: 'stone' as const, x: -1.25 + i * 0.5, y: 0.25, z: -9 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'metal' as const, x: -0.75 + i * 0.5, y: 0.75, z: -9 })),
    { type: 'crystal', x: -0.25, y: 1.25, z: -9 }, { type: 'crystal', x: 0.25, y: 1.25, z: -9 },
  ]});
  levels.push({ name: 'Archway', zone: 1, shots: 5, blocks: [
    { type: 'metal', x: -1, y: 0.25, z: -9 }, { type: 'metal', x: -1, y: 0.75, z: -9 }, { type: 'metal', x: -1, y: 1.25, z: -9 },
    { type: 'metal', x: 1, y: 0.25, z: -9 }, { type: 'metal', x: 1, y: 0.75, z: -9 }, { type: 'metal', x: 1, y: 1.25, z: -9 },
    { type: 'stone', x: -0.5, y: 1.25, z: -9 }, { type: 'stone', x: 0, y: 1.25, z: -9 }, { type: 'stone', x: 0.5, y: 1.25, z: -9 },
    { type: 'crystal', x: 0, y: 0.75, z: -9 },
  ]});

  // Zone 3: Cyan Circuit (levels 13-18)
  levels.push({ name: 'Circuit Board', zone: 2, shots: 5, blocks: [
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'metal' as const, x: -1.5, y: 0.25 + i * 0.5, z: -10 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'metal' as const, x: 1.5, y: 0.25 + i * 0.5, z: -10 })),
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'crystal' as const, x: -1 + i * 0.5, y: 0.25, z: -10 })),
    { type: 'tnt', x: 0, y: 0.75, z: -10 },
  ]});
  levels.push({ name: 'Data Core', zone: 2, shots: 6, blocks: [
    ...Array.from({ length: 3 }, (_, r) =>
      Array.from({ length: 3 }, (_, c) => ({ type: (r === 1 && c === 1 ? 'crystal' : 'stone') as BlockDef['type'], x: -0.5 + c * 0.5, y: 0.25 + r * 0.5, z: -10 }))
    ).flat(),
  ]});
  levels.push({ name: 'Hex Shield', zone: 2, shots: 5, blocks: [
    { type: 'metal', x: 0, y: 0.25, z: -10 },
    { type: 'stone', x: -0.5, y: 0.75, z: -10 }, { type: 'stone', x: 0.5, y: 0.75, z: -10 },
    { type: 'wood', x: -1, y: 0.25, z: -10 }, { type: 'wood', x: 1, y: 0.25, z: -10 },
    { type: 'tnt', x: 0, y: 1.25, z: -10 },
    { type: 'crystal', x: -0.5, y: 1.25, z: -10 }, { type: 'crystal', x: 0.5, y: 1.25, z: -10 },
  ]});
  levels.push({ name: 'Firewall', zone: 2, shots: 4, blocks: [
    ...Array.from({ length: 6 }, (_, i) => ({ type: 'metal' as const, x: -1.25 + i * 0.5, y: 0.25, z: -10 })),
    { type: 'tnt', x: -1, y: 0.75, z: -10 }, { type: 'tnt', x: 0, y: 0.75, z: -10 }, { type: 'tnt', x: 1, y: 0.75, z: -10 },
  ]});
  levels.push({ name: 'Processor', zone: 2, shots: 7, blocks: [
    ...Array.from({ length: 4 }, (_, r) =>
      Array.from({ length: 4 }, (_, c) => ({ type: ((r + c) % 2 === 0 ? 'stone' : 'wood') as BlockDef['type'], x: -0.75 + c * 0.5, y: 0.25 + r * 0.5, z: -10 }))
    ).flat(),
  ]});
  levels.push({ name: 'Server Rack', zone: 2, shots: 6, blocks: [
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'metal' as const, x: -1, y: 0.25 + i * 0.5, z: -10 })),
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'metal' as const, x: 1, y: 0.25 + i * 0.5, z: -10 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'crystal' as const, x: 0, y: 0.25 + i * 0.5, z: -10 })),
  ]});

  // Zone 4: Gold Nexus (levels 19-24)
  for (let i = 0; i < 6; i++) {
    const rows = 3 + Math.floor(i / 2);
    const cols = 3 + (i % 3);
    const blocks: BlockDef[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const types: BlockDef['type'][] = ['wood', 'stone', 'metal', 'crystal', 'tnt'];
        const t = (r === 0 && i > 2) ? 'metal' : (r === rows - 1 && c === Math.floor(cols / 2)) ? 'crystal' : types[Math.floor(Math.random() * 3)];
        blocks.push({ type: t, x: -(cols - 1) * 0.25 + c * 0.5, y: 0.25 + r * 0.5, z: -11 });
      }
    }
    if (i % 2 === 0) blocks.push({ type: 'tnt', x: 0, y: 0.25 + rows * 0.5, z: -11 });
    levels.push({ name: ['Gold Rush', 'Vault Door', 'Treasury', 'Gilded Cage', 'Crown Jewels', 'Royal Guard'][i], zone: 3, shots: 5 + i, blocks });
  }

  // Zone 5: Void Matrix (levels 25-30)
  for (let i = 0; i < 6; i++) {
    const rows = 4 + Math.floor(i / 2);
    const cols = 4 + (i % 2);
    const blocks: BlockDef[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t: BlockDef['type'] = (r < 2) ? 'metal' : (r === rows - 1) ? 'crystal' : ((r + c) % 3 === 0) ? 'tnt' : 'stone';
        blocks.push({ type: t, x: -(cols - 1) * 0.25 + c * 0.5, y: 0.25 + r * 0.5, z: -12 });
      }
    }
    levels.push({ name: ['Void Gate', 'Singularity', 'Event Horizon', 'Dark Matter', 'Quantum Lock', 'Final Stand'][i], zone: 4, shots: 6 + i, blocks });
  }

  return levels;
}

// ─── Audio Manager ───────────────────────────────────────────────

class AudioManager {
  ctx: AudioContext | null = null;
  sfxVol = 1; musicVol = 1;
  musicOsc: OscillatorNode | null = null;
  musicGain: GainNode | null = null;

  init() { if (!this.ctx) this.ctx = new AudioContext(); }

  play(type: 'fire' | 'hit' | 'destroy' | 'explode' | 'bounce' | 'complete' | 'select' | 'charge' | 'combo') {
    this.init();
    const c = this.ctx!;
    const g = c.createGain();
    g.gain.value = this.sfxVol * 0.3;
    g.connect(c.destination);
    const o = c.createOscillator();
    const now = c.currentTime;

    switch (type) {
      case 'fire':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(200, now);
        o.frequency.exponentialRampToValueAtTime(80, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.4); o.stop(now + 0.4); break;
      case 'hit':
        o.type = 'square'; o.frequency.setValueAtTime(300, now);
        o.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2); o.stop(now + 0.2); break;
      case 'destroy':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(500, now);
        o.frequency.exponentialRampToValueAtTime(50, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.35); o.stop(now + 0.35); break;
      case 'explode':
        o.type = 'sawtooth'; o.frequency.setValueAtTime(100, now);
        o.frequency.setValueAtTime(60, now + 0.1);
        g.gain.value = this.sfxVol * 0.5;
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.5); o.stop(now + 0.5); break;
      case 'bounce':
        o.type = 'sine'; o.frequency.setValueAtTime(600, now);
        o.frequency.exponentialRampToValueAtTime(400, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.15); o.stop(now + 0.15); break;
      case 'complete':
        o.type = 'sine'; o.frequency.setValueAtTime(400, now);
        o.frequency.setValueAtTime(500, now + 0.1); o.frequency.setValueAtTime(600, now + 0.2);
        o.frequency.setValueAtTime(800, now + 0.3);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.5); o.stop(now + 0.5); break;
      case 'select':
        o.type = 'sine'; o.frequency.setValueAtTime(500, now);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.1); o.stop(now + 0.1); break;
      case 'charge':
        o.type = 'sine'; o.frequency.setValueAtTime(100, now);
        o.frequency.exponentialRampToValueAtTime(800, now + 0.5);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.6); o.stop(now + 0.6); break;
      case 'combo':
        o.type = 'sine'; o.frequency.setValueAtTime(600, now);
        o.frequency.setValueAtTime(800, now + 0.05); o.frequency.setValueAtTime(1000, now + 0.1);
        g.gain.exponentialRampToValueAtTime(0.01, now + 0.2); o.stop(now + 0.2); break;
    }
    o.connect(g); o.start(now);
  }

  startMusic() {
    this.init();
    if (this.musicOsc) return;
    const c = this.ctx!;
    this.musicGain = c.createGain();
    this.musicGain.gain.value = this.musicVol * 0.06;
    this.musicGain.connect(c.destination);
    this.musicOsc = c.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.setValueAtTime(55, c.currentTime);
    this.musicOsc.connect(this.musicGain);
    this.musicOsc.start();
  }

  stopMusic() {
    if (this.musicOsc) { this.musicOsc.stop(); this.musicOsc = null; this.musicGain = null; }
  }
}

// ─── Particle System ─────────────────────────────────────────────

interface Particle { mesh: Mesh; vx: number; vy: number; vz: number; life: number; maxLife: number; }

class ParticleSystem {
  particles: Particle[] = [];
  constructor(private scene: any) {}

  emit(pos: Vector3, count: number, color: string, speed: number = 2, life: number = 1) {
    for (let i = 0; i < count; i++) {
      const mesh = new Mesh(
        new SphereGeometry(0.03, 4, 4),
        new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity: 0.8, blending: AdditiveBlending })
      );
      mesh.position.copy(pos);
      this.scene.add(mesh);
      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.3) * Math.PI;
      const s = speed * (0.5 + Math.random());
      this.particles.push({
        mesh, life,  maxLife: life,
        vx: Math.cos(angle) * Math.cos(elev) * s,
        vy: Math.sin(elev) * s + 1,
        vz: Math.sin(angle) * Math.cos(elev) * s,
      });
    }
  }

  update(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.vy -= 3 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      const mat = p.mesh.material as MeshBasicMaterial;
      mat.opacity = 0.8 * (p.life / p.maxLife);
      p.mesh.scale.setScalar(p.life / p.maxLife);
    }
  }
}

// ─── Main Game ───────────────────────────────────────────────────

async function main() {
  const container = document.getElementById('app') as HTMLDivElement;
  const world = await World.create(container, {
    xr: { offer: 'once' },
    features: { grabbing: false, locomotion: { browserControls: true } as any, physics: false, spatialUI: true },
    render: { near: 0.01, far: 200 },
  } as any);

  const audio = new AudioManager();
  const particles = new ParticleSystem(world.scene);
  const LEVELS = generateLevels();

  // ─── Game State ──────────────────────────────────────────────

  let state: GameState = 'title';
  let mode: GameMode = 'campaign';
  let currentLevel = 0;
  let currentAmmo = 0;
  let currentThemeIdx = 0;
  let cannonYaw = 0;
  let cannonPitch = 0.3; // radians up from horizontal
  let chargePower = 0;
  let charging = false;
  let shotsLeft = 5;
  let shotsFired = 0;
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let blocksDestroyed = 0;
  let totalBlocks = 0;
  let countdownTimer = 3;
  let impactTimer = 0;
  let timeAttackTimer = 60;
  let showTrajectory = true;
  let levelZone = 0;
  let toastTimer = 0;

  // Persistent stats (localStorage)
  interface SaveData {
    levelStars: number[]; highScore: number; totalShots: number;
    totalBlocks: number; levelsClear: number; totalStars: number;
    bestCombo: number; gamesPlayed: number; playTimeMin: number;
    unlockedAmmo: number[]; achievements: string[];
  }

  function defaultSave(): SaveData {
    return {
      levelStars: Array(30).fill(0), highScore: 0, totalShots: 0,
      totalBlocks: 0, levelsClear: 0, totalStars: 0,
      bestCombo: 0, gamesPlayed: 0, playTimeMin: 0,
      unlockedAmmo: [0], achievements: [],
    };
  }

  let save: SaveData = defaultSave();
  try { const s = localStorage.getItem('neon-cannon-save'); if (s) save = { ...defaultSave(), ...JSON.parse(s) }; } catch {}
  function persist() { try { localStorage.setItem('neon-cannon-save', JSON.stringify(save)); } catch {} }

  // ─── Environment ─────────────────────────────────────────────

  const decorations: Mesh[] = [];
  const ambientDots: Mesh[] = [];
  let groundMesh: Mesh;
  let groundGrid: Line[] = [];

  function buildEnvironment() {
    const t = THEMES[currentThemeIdx];
    world.scene.fog = new Fog(t.fog, 8, 50);
    world.scene.background = new Color(t.sky);

    const ambient = new AmbientLight(0x333344, 0.5);
    world.scene.add(ambient);
    const dirLight = new DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(5, 15, 5);
    world.scene.add(dirLight);

    // Ground plane
    const groundGeo = new PlaneGeometry(60, 60);
    const groundMat = new MeshStandardMaterial({ color: new Color(t.ground), metalness: 0.3, roughness: 0.6 });
    groundMesh = new Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = 0;
    world.scene.add(groundMesh);

    // Grid lines
    const gridMat = new LineBasicMaterial({ color: new Color(t.grid), transparent: true, opacity: 0.2 });
    for (let i = -30; i <= 30; i += 2) {
      const g1 = new BufferGeometry().setFromPoints([new Vector3(i, 0.01, -30), new Vector3(i, 0.01, 30)]);
      const g2 = new BufferGeometry().setFromPoints([new Vector3(-30, 0.01, i), new Vector3(30, 0.01, i)]);
      const l1 = new Line(g1, gridMat); const l2 = new Line(g2, gridMat);
      world.scene.add(l1); world.scene.add(l2);
      groundGrid.push(l1, l2);
    }

    // Accent lights
    const colors = [t.accent, t.glow, t.cannon];
    colors.forEach((c, i) => {
      const light = new PointLight(new Color(c), 0.6, 20);
      light.position.set(-6 + i * 6, 5, -8);
      world.scene.add(light);
    });

    // Spotlight on target area
    const spot = new SpotLight(new Color(t.accent), 0.5, 30, Math.PI / 5);
    spot.position.set(0, 12, -10);
    spot.target.position.set(0, 0, -10);
    world.scene.add(spot);
    world.scene.add(spot.target);

    // Floating decorations
    const decoMat = new MeshBasicMaterial({ color: new Color(t.accent), wireframe: true, transparent: true, opacity: 0.12 });
    const geos = [new TorusGeometry(0.6, 0.2, 8, 16), new BoxGeometry(0.7, 0.7, 0.7), new SphereGeometry(0.5, 8, 8), new ConeGeometry(0.4, 0.9, 6)];
    for (let i = 0; i < 16; i++) {
      const m = new Mesh(geos[i % 4], decoMat);
      m.position.set((Math.random() - 0.5) * 40, 4 + Math.random() * 6, -5 + (Math.random() - 0.5) * 30);
      world.scene.add(m);
      decorations.push(m);
    }

    // Ambient dots
    const dotMat = new MeshBasicMaterial({ color: new Color(t.accent), transparent: true, opacity: 0.35, blending: AdditiveBlending });
    for (let i = 0; i < 50; i++) {
      const dot = new Mesh(new SphereGeometry(0.025, 4, 4), dotMat.clone());
      dot.position.set((Math.random() - 0.5) * 40, 0.5 + Math.random() * 8, -5 + (Math.random() - 0.5) * 30);
      world.scene.add(dot);
      ambientDots.push(dot);
    }
  }

  buildEnvironment();

  // ─── Cannon 3D ───────────────────────────────────────────────

  const cannonGroup = new Group();
  const cannonBase = new Mesh(
    new CylinderGeometry(0.4, 0.5, 0.3, 12),
    new MeshStandardMaterial({ color: new Color(THEMES[currentThemeIdx].cannon), emissive: new Color(THEMES[currentThemeIdx].cannon), emissiveIntensity: 0.2, metalness: 0.7, roughness: 0.3 })
  );
  cannonBase.position.y = 0.15;
  cannonGroup.add(cannonBase);

  const cannonPivot = new Group();
  cannonPivot.position.y = 0.3;
  cannonGroup.add(cannonPivot);

  const barrel = new Mesh(
    new CylinderGeometry(0.08, 0.12, 1.2, 8),
    new MeshStandardMaterial({ color: new Color(THEMES[currentThemeIdx].cannon), emissive: new Color(THEMES[currentThemeIdx].glow), emissiveIntensity: 0.15, metalness: 0.8, roughness: 0.2 })
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -0.6;
  cannonPivot.add(barrel);

  // Barrel edge glow
  const barrelEdge = new LineSegments(
    new EdgesGeometry(new CylinderGeometry(0.085, 0.125, 1.2, 8)),
    new LineBasicMaterial({ color: new Color(THEMES[currentThemeIdx].accent), transparent: true, opacity: 0.5 })
  );
  barrelEdge.rotation.x = Math.PI / 2;
  barrelEdge.position.z = -0.6;
  cannonPivot.add(barrelEdge);

  // Muzzle ring
  const muzzleRing = new Mesh(
    new TorusGeometry(0.1, 0.02, 8, 16),
    new MeshBasicMaterial({ color: new Color(THEMES[currentThemeIdx].accent), transparent: true, opacity: 0.6, blending: AdditiveBlending })
  );
  muzzleRing.position.z = -1.2;
  cannonPivot.add(muzzleRing);

  cannonGroup.position.set(0, 0.5, 0);
  world.scene.add(cannonGroup);

  // Charge ring on ground
  const chargeRing = new Mesh(
    new RingGeometry(0.5, 0.55, 32),
    new MeshBasicMaterial({ color: new Color(THEMES[currentThemeIdx].accent), transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide })
  );
  chargeRing.rotation.x = -Math.PI / 2;
  chargeRing.position.set(0, 0.02, 0);
  world.scene.add(chargeRing);

  // ─── Trajectory Preview ──────────────────────────────────────

  const trajectoryDots: Mesh[] = [];
  const trajMat = new MeshBasicMaterial({ color: new Color(THEMES[currentThemeIdx].accent), transparent: true, opacity: 0.4, blending: AdditiveBlending });
  for (let i = 0; i < 30; i++) {
    const dot = new Mesh(new SphereGeometry(0.02, 4, 4), trajMat.clone());
    dot.visible = false;
    world.scene.add(dot);
    trajectoryDots.push(dot);
  }

  function updateTrajectory() {
    if (!showTrajectory || state !== 'aiming') {
      trajectoryDots.forEach(d => d.visible = false);
      return;
    }
    const power = 8 + chargePower * 12;
    const dir = getFireDirection();
    const ammo = AMMO_TYPES[currentAmmo];
    const spd = power * ammo.speed;
    let px = cannonGroup.position.x, py = cannonGroup.position.y + 0.3, pz = cannonGroup.position.z;
    let vx = dir.x * spd, vy = dir.y * spd, vz = dir.z * spd;
    const dt = 0.05;
    for (let i = 0; i < trajectoryDots.length; i++) {
      px += vx * dt; py += vy * dt; pz += vz * dt;
      vy -= 9.8 * dt;
      trajectoryDots[i].position.set(px, py, pz);
      trajectoryDots[i].visible = py > 0;
      (trajectoryDots[i].material as MeshBasicMaterial).opacity = 0.4 * (1 - i / trajectoryDots.length);
    }
  }

  // ─── Blocks ──────────────────────────────────────────────────

  let blocks: BlockInstance[] = [];

  function spawnBlocks(levelDef: LevelDef) {
    clearBlocks();
    totalBlocks = levelDef.blocks.length;
    for (const bd of levelDef.blocks) {
      const props = BLOCK_PROPS[bd.type];
      const w = bd.w || 0.45, h = bd.h || 0.45, d = bd.d || 0.45;
      const geo = new BoxGeometry(w, h, d);
      const mat = new MeshStandardMaterial({
        color: new Color(props.color),
        emissive: new Color(props.emissive),
        emissiveIntensity: bd.type === 'crystal' ? 0.5 : bd.type === 'tnt' ? 0.4 : 0.15,
        metalness: bd.type === 'metal' ? 0.7 : 0.3,
        roughness: bd.type === 'metal' ? 0.2 : 0.5,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(bd.x, bd.y, bd.z);
      world.scene.add(mesh);

      const edgeMat = new LineBasicMaterial({ color: new Color(props.edge), transparent: true, opacity: 0.6 });
      const edges = new LineSegments(new EdgesGeometry(geo), edgeMat);
      edges.position.copy(mesh.position);
      world.scene.add(edges);

      blocks.push({
        mesh, edges, type: bd.type,
        hp: props.hp, maxHp: props.hp, points: props.points,
        x: bd.x, y: bd.y, z: bd.z,
        w, h, d, destroyed: false, falling: false, vy: 0,
      });
    }
  }

  function clearBlocks() {
    blocks.forEach(b => { world.scene.remove(b.mesh); world.scene.remove(b.edges); });
    blocks = [];
  }

  function destroyBlock(b: BlockInstance) {
    if (b.destroyed) return;
    b.destroyed = true;
    b.mesh.visible = false;
    b.edges.visible = false;
    blocksDestroyed++;
    score += b.points * (1 + combo * 0.2);
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    audio.play('destroy');
    particles.emit(new Vector3(b.x, b.y, b.z), 8, BLOCK_PROPS[b.type].color, 2, 0.8);

    if (combo > 2) {
      audio.play('combo');
      showToast(`${combo}x COMBO!`);
    }

    if (b.type === 'tnt') {
      audio.play('explode');
      particles.emit(new Vector3(b.x, b.y, b.z), 20, '#ff4400', 4, 1.2);
      // Chain explosion
      for (const ob of blocks) {
        if (ob.destroyed) continue;
        const dx = ob.x - b.x, dy = ob.y - b.y, dz = ob.z - b.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < 1.5) {
          ob.hp -= 2;
          if (ob.hp <= 0) destroyBlock(ob);
          else {
            audio.play('hit');
            particles.emit(new Vector3(ob.x, ob.y, ob.z), 4, BLOCK_PROPS[ob.type].color);
          }
        }
      }
    }

    // Check for floating blocks → make them fall
    for (const ob of blocks) {
      if (ob.destroyed || ob.y <= 0.3) continue;
      // Check if any block is below supporting this one
      const hasSupport = blocks.some(sb => !sb.destroyed && sb !== ob &&
        Math.abs(sb.x - ob.x) < 0.3 && Math.abs(sb.z - ob.z) < 0.3 &&
        sb.y < ob.y && ob.y - sb.y < 0.6);
      if (!hasSupport && ob.y > 0.3) {
        ob.falling = true;
        ob.vy = 0;
      }
    }
  }

  // ─── Projectile System ──────────────────────────────────────

  const projectiles: Projectile[] = [];

  function getFireDirection(): Vector3 {
    const dir = new Vector3(0, Math.sin(cannonPitch), -Math.cos(cannonPitch));
    dir.applyAxisAngle(new Vector3(0, 1, 0), cannonYaw);
    return dir.normalize();
  }

  function fireProjectile() {
    const ammo = AMMO_TYPES[currentAmmo];
    const power = 8 + chargePower * 12;
    const spd = power * ammo.speed;
    const dir = getFireDirection();

    const mesh = new Mesh(
      new SphereGeometry(ammo.radius, 8, 8),
      new MeshStandardMaterial({ color: new Color(ammo.color), emissive: new Color(ammo.emissive), emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 })
    );
    const muzzlePos = new Vector3(0, 0.8, 0).add(dir.clone().multiplyScalar(1.3));
    muzzlePos.add(cannonGroup.position);
    mesh.position.copy(muzzlePos);
    world.scene.add(mesh);

    const glow = new Mesh(
      new SphereGeometry(ammo.radius * 2, 8, 8),
      new MeshBasicMaterial({ color: new Color(ammo.color), transparent: true, opacity: 0.25, blending: AdditiveBlending })
    );
    glow.position.copy(muzzlePos);
    world.scene.add(glow);

    projectiles.push({
      mesh, glow, trail: [],
      vx: dir.x * spd, vy: dir.y * spd, vz: dir.z * spd,
      active: true, bounces: ammo.bounces, ammoType: currentAmmo,
    });

    shotsFired++;
    shotsLeft--;
    combo = 0;
    audio.play('fire');
    particles.emit(muzzlePos, 10, ammo.color, 3, 0.5);
    state = 'firing';
  }

  function spawnClusterProjectiles(pos: Vector3, baseVx: number, baseVz: number) {
    const ammo = AMMO_TYPES[currentAmmo];
    for (let i = 0; i < 3; i++) {
      const angle = ((i - 1) * Math.PI / 6);
      const cos = Math.cos(angle), sin = Math.sin(angle);
      const vx = baseVx * cos - baseVz * sin;
      const vz = baseVx * sin + baseVz * cos;
      const mesh = new Mesh(
        new SphereGeometry(ammo.radius * 0.6, 6, 6),
        new MeshStandardMaterial({ color: new Color(ammo.color), emissive: new Color(ammo.emissive), emissiveIntensity: 0.5 })
      );
      mesh.position.copy(pos);
      world.scene.add(mesh);
      const glow = new Mesh(
        new SphereGeometry(ammo.radius, 6, 6),
        new MeshBasicMaterial({ color: new Color(ammo.color), transparent: true, opacity: 0.2, blending: AdditiveBlending })
      );
      glow.position.copy(pos);
      world.scene.add(glow);
      projectiles.push({ mesh, glow, trail: [], vx, vy: 2, vz, active: true, bounces: 0, ammoType: currentAmmo });
    }
  }

  function updateProjectiles(dt: number) {
    for (const p of projectiles) {
      if (!p.active) continue;

      p.vy -= 9.8 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.glow.position.copy(p.mesh.position);

      // Ground collision
      if (p.mesh.position.y <= 0.05) {
        if (p.bounces > 0) {
          p.bounces--;
          p.vy = Math.abs(p.vy) * 0.7;
          p.mesh.position.y = 0.05;
          audio.play('bounce');
          particles.emit(p.mesh.position.clone(), 5, AMMO_TYPES[p.ammoType].color, 1, 0.4);
        } else {
          handleProjectileImpact(p);
          continue;
        }
      }

      // Off-screen check
      if (p.mesh.position.z < -20 || p.mesh.position.y < -2 ||
          Math.abs(p.mesh.position.x) > 15) {
        handleProjectileImpact(p);
        continue;
      }

      // Block collision
      const ammo = AMMO_TYPES[p.ammoType];
      for (const b of blocks) {
        if (b.destroyed) continue;
        const dx = Math.abs(p.mesh.position.x - b.x);
        const dy = Math.abs(p.mesh.position.y - b.y);
        const dz = Math.abs(p.mesh.position.z - b.z);
        if (dx < (b.w / 2 + ammo.radius) && dy < (b.h / 2 + ammo.radius) && dz < (b.d / 2 + ammo.radius)) {
          // Hit!
          b.hp -= ammo.damage;
          if (b.hp <= 0) {
            destroyBlock(b);
          } else {
            audio.play('hit');
            particles.emit(new Vector3(b.x, b.y, b.z), 4, BLOCK_PROPS[b.type].color, 1.5);
            // Flash
            const mat = b.mesh.material as MeshStandardMaterial;
            mat.emissiveIntensity = 0.8;
            setTimeout(() => { mat.emissiveIntensity = 0.15; }, 150);
          }

          if (ammo.explosive) {
            audio.play('explode');
            particles.emit(p.mesh.position.clone(), 25, ammo.color, 5, 1);
            for (const ob of blocks) {
              if (ob.destroyed) continue;
              const d = p.mesh.position.distanceTo(new Vector3(ob.x, ob.y, ob.z));
              if (d < ammo.explosionRadius) {
                ob.hp -= 1;
                if (ob.hp <= 0) destroyBlock(ob);
              }
            }
          }

          if (ammo.cluster > 0) {
            spawnClusterProjectiles(p.mesh.position.clone(), p.vx * 0.5, p.vz * 0.5);
          }

          handleProjectileImpact(p);
          break;
        }
      }
    }
  }

  function handleProjectileImpact(p: Projectile) {
    p.active = false;
    world.scene.remove(p.mesh);
    world.scene.remove(p.glow);
    p.trail.forEach(t => world.scene.remove(t));

    // Check if all projectiles are done
    const anyActive = projectiles.some(pp => pp.active);
    if (!anyActive) {
      impactTimer = 1.0; // wait a beat for chains
      state = 'impact';
    }
  }

  function cleanupProjectiles() {
    projectiles.forEach(p => {
      if (p.active) { world.scene.remove(p.mesh); world.scene.remove(p.glow); }
      p.trail.forEach(t => world.scene.remove(t));
    });
    projectiles.length = 0;
  }

  // ─── UI Panels ───────────────────────────────────────────────

  interface PanelRef { entity: any; doc: UIKitDocument | null; }
  const panels: Record<string, PanelRef> = {};

  function createWorldPanel(name: string, config: string, w: number, h: number, pos: [number, number, number]): PanelRef {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.object3D!.position.set(...pos);
    e.addComponent(PanelUI, { config, maxWidth: w, maxHeight: h });
    const ref: PanelRef = { entity: e, doc: null };
    panels[name] = ref;
    return ref;
  }

  function createHUDPanel(name: string, config: string, w: number, h: number, offset: [number, number, number]): PanelRef {
    const e = world.createTransformEntity(undefined, { persistent: true });
    e.addComponent(PanelUI, { config, maxWidth: w, maxHeight: h });
    e.addComponent(Follower, { target: (world as any).player?.head, offsetPosition: offset, behavior: FollowBehavior.PivotY, speed: 5, tolerance: 0.3 });
    const ref: PanelRef = { entity: e, doc: null };
    panels[name] = ref;
    return ref;
  }

  // World-space panels
  createWorldPanel('title', '/ui/title.json', 0.9, 1.0, [0, 1.5, -2.5]);
  createWorldPanel('modeselect', '/ui/modeselect.json', 0.9, 1.2, [0, 1.5, -2.5]);
  createWorldPanel('levelselect', '/ui/levelselect.json', 1.0, 1.2, [0, 1.5, -2.5]);
  createWorldPanel('ammo', '/ui/ammo.json', 0.9, 1.4, [0, 1.5, -2.5]);
  createWorldPanel('levelcomplete', '/ui/levelcomplete.json', 0.8, 0.9, [0, 1.5, -2.5]);
  createWorldPanel('gameover', '/ui/gameover.json', 0.7, 0.7, [0, 1.5, -2.5]);
  createWorldPanel('pause', '/ui/pause.json', 0.6, 0.5, [0, 1.6, -2]);
  createWorldPanel('achievements', '/ui/achievements.json', 0.9, 1.2, [0, 1.5, -2.5]);
  createWorldPanel('settings', '/ui/settings.json', 0.8, 1.0, [0, 1.5, -2.5]);
  createWorldPanel('help', '/ui/help.json', 0.9, 1.2, [0, 1.5, -2.5]);
  createWorldPanel('stats', '/ui/stats.json', 0.8, 1.0, [0, 1.5, -2.5]);

  // HUD panels (Follower head-locked)
  createHUDPanel('hud', '/ui/hud.json', 0.3, 0.15, [0.25, -0.1, -0.5]);
  createHUDPanel('power', '/ui/power.json', 0.15, 0.08, [-0.2, -0.12, -0.5]);
  createHUDPanel('toast', '/ui/toast.json', 0.35, 0.06, [0, 0.2, -0.5]);
  createHUDPanel('countdown', '/ui/countdown.json', 0.2, 0.12, [0, 0, -0.5]);

  // ─── Panel Helpers ───────────────────────────────────────────

  function getDoc(name: string): UIKitDocument | null {
    if (panels[name].doc) return panels[name].doc;
    const d = panels[name].entity.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
    if (d) panels[name].doc = d;
    return d || null;
  }

  const allPanelNames = Object.keys(panels);

  function showPanels(...names: string[]) {
    for (const n of allPanelNames) {
      const e = panels[n].entity;
      if (e.object3D) e.object3D.visible = names.includes(n);
    }
  }

  function setText(doc: UIKitDocument | null, id: string, text: string) {
    if (!doc) return;
    const el = doc.getElementById(id);
    if (el) el.textContent = text;
  }

  function setBtn(doc: UIKitDocument | null, id: string, cb: () => void) {
    if (!doc) return;
    const el = doc.getElementById(id);
    if (el) el.onclick = cb;
  }

  // ─── Toast System ────────────────────────────────────────────

  function showToast(msg: string, dur: number = 2) {
    const doc = getDoc('toast');
    setText(doc, 'toast-text', msg);
    toastTimer = dur;
    if (panels['toast'].entity.object3D) panels['toast'].entity.object3D.visible = true;
  }

  // ─── Game Flow ───────────────────────────────────────────────

  function goToState(s: GameState) {
    state = s;
    switch (s) {
      case 'title': showPanels('title'); cannonGroup.visible = false; clearBlocks(); cleanupProjectiles(); break;
      case 'modeselect': showPanels('modeselect'); break;
      case 'levelselect': showPanels('levelselect'); updateLevelSelect(); break;
      case 'ammo': showPanels('ammo'); updateAmmoPanel(); break;
      case 'countdown': showPanels('countdown'); countdownTimer = 3; break;
      case 'aiming': showPanels('hud', 'power'); cannonGroup.visible = true; updateHUD(); break;
      case 'levelcomplete': showPanels('levelcomplete'); updateLevelComplete(); break;
      case 'gameover': showPanels('gameover'); updateGameOver(); break;
      case 'achievements': showPanels('achievements'); updateAchievements(); break;
      case 'settings': showPanels('settings'); updateSettings(); break;
      case 'help': showPanels('help'); break;
      case 'stats': showPanels('stats'); updateStats(); break;
      case 'pause': showPanels('pause'); break;
      default: break;
    }
  }

  function startLevel(lvl: number) {
    currentLevel = lvl;
    const def = LEVELS[lvl];
    currentThemeIdx = def.zone;
    shotsLeft = mode === 'freeplay' ? 99 : def.shots;
    shotsFired = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    blocksDestroyed = 0;
    cannonYaw = 0;
    cannonPitch = 0.3;
    chargePower = 0;
    charging = false;
    cleanupProjectiles();
    spawnBlocks(def);
    goToState('countdown');
    audio.startMusic();
    save.gamesPlayed++;
    persist();
  }

  function startArcadeLevel() {
    // Generate a random level
    const blockCount = 8 + Math.floor(Math.random() * 12);
    const blocks: BlockDef[] = [];
    const types: BlockDef['type'][] = ['wood', 'stone', 'metal', 'crystal', 'tnt'];
    for (let i = 0; i < blockCount; i++) {
      const col = Math.floor(i % 5);
      const row = Math.floor(i / 5);
      blocks.push({
        type: types[Math.floor(Math.random() * types.length)],
        x: -1 + col * 0.5, y: 0.25 + row * 0.5, z: -9
      });
    }
    const def: LevelDef = { name: 'Arcade', zone: Math.floor(Math.random() * 5), shots: Math.ceil(blockCount * 0.6), blocks };
    currentThemeIdx = def.zone;
    shotsLeft = def.shots;
    shotsFired = 0; score = 0; combo = 0; maxCombo = 0; blocksDestroyed = 0;
    cannonYaw = 0; cannonPitch = 0.3; chargePower = 0; charging = false;
    cleanupProjectiles();
    totalBlocks = def.blocks.length;
    clearBlocks();
    for (const bd of def.blocks) {
      const props = BLOCK_PROPS[bd.type];
      const w = 0.45, h = 0.45, d = 0.45;
      const geo = new BoxGeometry(w, h, d);
      const mat = new MeshStandardMaterial({ color: new Color(props.color), emissive: new Color(props.emissive), emissiveIntensity: 0.15, metalness: 0.3, roughness: 0.5 });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(bd.x, bd.y, bd.z);
      world.scene.add(mesh);
      const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: new Color(props.edge), transparent: true, opacity: 0.6 }));
      edges.position.copy(mesh.position);
      world.scene.add(edges);
      blocks.push({ mesh, edges, type: bd.type, hp: props.hp, maxHp: props.hp, points: props.points, x: bd.x, y: bd.y, z: bd.z, w, h, d, destroyed: false, falling: false, vy: 0 });
    }
    goToState('countdown');
    audio.startMusic();
  }

  function checkLevelEnd() {
    const allDestroyed = blocks.every(b => b.destroyed);
    if (allDestroyed) {
      // Level complete!
      const def = LEVELS[currentLevel] || { shots: shotsLeft + shotsFired };
      const shotsUsed = shotsFired;
      const maxShots = def.shots;
      let stars = 1;
      if (shotsUsed <= maxShots * 0.6) stars = 3;
      else if (shotsUsed <= maxShots * 0.8) stars = 2;

      if (mode === 'campaign' && currentLevel < save.levelStars.length) {
        if (stars > save.levelStars[currentLevel]) save.levelStars[currentLevel] = stars;
        save.levelsClear = save.levelStars.filter(s => s > 0).length;
        save.totalStars = save.levelStars.reduce((a, b) => a + b, 0);
      }
      save.totalShots += shotsFired;
      save.totalBlocks += blocksDestroyed;
      if (score > save.highScore) save.highScore = score;
      if (maxCombo > save.bestCombo) save.bestCombo = maxCombo;
      persist();

      audio.play('complete');
      audio.stopMusic();
      goToState('levelcomplete');
    } else if (shotsLeft <= 0 && mode !== 'freeplay') {
      save.totalShots += shotsFired;
      save.totalBlocks += blocksDestroyed;
      persist();
      audio.stopMusic();
      goToState('gameover');
    } else {
      state = 'aiming';
      showPanels('hud', 'power');
    }
  }

  // ─── UI Update Functions ─────────────────────────────────────

  function updateHUD() {
    const doc = getDoc('hud');
    const modeNames: Record<string, string> = { campaign: 'CAMPAIGN', arcade: 'ARCADE', freeplay: 'FREE PLAY', timeattack: 'TIME ATTACK', daily: 'DAILY' };
    setText(doc, 'hud-mode', modeNames[mode] || 'CAMPAIGN');
    setText(doc, 'hud-level', `${currentLevel + 1}`);
    setText(doc, 'hud-score', `${Math.floor(score)}`);
    setText(doc, 'hud-shots', `${shotsLeft}`);
    const remaining = blocks.filter(b => !b.destroyed).length;
    setText(doc, 'hud-targets', `${remaining}`);
    setText(doc, 'hud-combo', combo > 1 ? `${combo}x` : '');

    const pdoc = getDoc('power');
    setText(pdoc, 'power-value', `${Math.floor(chargePower * 100)}%`);
    setText(pdoc, 'ammo-type', AMMO_TYPES[currentAmmo].name);
  }

  function updateLevelSelect() {
    const doc = getDoc('levelselect');
    if (!doc) return;
    const zoneNames = ['ZONE 1: NEON GRID', 'ZONE 2: CRIMSON FORGE', 'ZONE 3: CYAN CIRCUIT', 'ZONE 4: GOLD NEXUS', 'ZONE 5: VOID MATRIX'];
    setText(doc, 'zone-name', zoneNames[levelZone] || zoneNames[0]);

    for (let i = 1; i <= 10; i++) {
      const lvlIdx = levelZone * 6 + (i - 1);
      const starCount = lvlIdx < save.levelStars.length ? save.levelStars[lvlIdx] : 0;
      setText(doc, `stars-${i}`, starCount > 0 ? '★'.repeat(starCount) : '');
      setBtn(doc, `lvl-${i}`, () => {
        if (lvlIdx < LEVELS.length) {
          audio.play('select');
          mode = 'campaign';
          startLevel(lvlIdx);
        }
      });
    }

    setBtn(doc, 'btn-prev-zone', () => { if (levelZone > 0) { levelZone--; audio.play('select'); updateLevelSelect(); } });
    setBtn(doc, 'btn-next-zone', () => { if (levelZone < 4) { levelZone++; audio.play('select'); updateLevelSelect(); } });
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  function updateLevelComplete() {
    const doc = getDoc('levelcomplete');
    const def = LEVELS[currentLevel] || { shots: shotsFired };
    const shotsUsed = shotsFired;
    let stars = 1;
    if (shotsUsed <= def.shots * 0.6) stars = 3;
    else if (shotsUsed <= def.shots * 0.8) stars = 2;
    setText(doc, 'lc-stars', '★'.repeat(stars) + '☆'.repeat(3 - stars));
    setText(doc, 'lc-score', `${Math.floor(score)}`);
    setText(doc, 'lc-blocks', `${blocksDestroyed}`);
    setText(doc, 'lc-shots', `${shotsFired}`);
    const best = save.levelStars[currentLevel] || 0;
    setText(doc, 'lc-best', best > 0 ? '★'.repeat(best) : '-');

    setBtn(doc, 'btn-next', () => {
      audio.play('select');
      if (mode === 'arcade') { startArcadeLevel(); }
      else if (currentLevel + 1 < LEVELS.length) startLevel(currentLevel + 1);
      else goToState('title');
    });
    setBtn(doc, 'btn-retry', () => { audio.play('select'); startLevel(currentLevel); });
    setBtn(doc, 'btn-menu', () => { audio.play('select'); goToState('title'); });
  }

  function updateGameOver() {
    const doc = getDoc('gameover');
    setText(doc, 'go-score', `${Math.floor(score)}`);
    setText(doc, 'go-blocks', `${blocksDestroyed}`);
    const remaining = blocks.filter(b => !b.destroyed).length;
    setText(doc, 'go-remaining', `${remaining}`);
    setBtn(doc, 'btn-retry', () => {
      audio.play('select');
      if (mode === 'arcade') startArcadeLevel();
      else startLevel(currentLevel);
    });
    setBtn(doc, 'btn-menu', () => { audio.play('select'); goToState('title'); });
  }

  function updateAmmoPanel() {
    const doc = getDoc('ammo');
    if (!doc) return;
    for (let i = 0; i < AMMO_TYPES.length; i++) {
      setBtn(doc, `ammo-${i}`, () => {
        if (save.unlockedAmmo.includes(i) || i === 0) {
          currentAmmo = i;
          audio.play('select');
          updateAmmoPanel();
        }
      });
    }
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  function updateSettings() {
    const doc = getDoc('settings');
    setText(doc, 'sfx-val', `${Math.round(audio.sfxVol * 100)}%`);
    setText(doc, 'music-val', `${Math.round(audio.musicVol * 100)}%`);
    setText(doc, 'trajectory-val', showTrajectory ? 'ON' : 'OFF');
    setText(doc, 'theme-val', THEMES[currentThemeIdx].name);

    setBtn(doc, 'btn-sfx', () => { audio.sfxVol = (audio.sfxVol + 0.25) % 1.25; audio.play('select'); updateSettings(); });
    setBtn(doc, 'btn-music', () => { audio.musicVol = (audio.musicVol + 0.25) % 1.25; updateSettings(); });
    setBtn(doc, 'btn-trajectory', () => { showTrajectory = !showTrajectory; audio.play('select'); updateSettings(); });
    setBtn(doc, 'btn-theme', () => { currentThemeIdx = (currentThemeIdx + 1) % THEMES.length; audio.play('select'); updateSettings(); });
    setBtn(doc, 'btn-reset', () => { save = defaultSave(); persist(); audio.play('select'); showToast('PROGRESS RESET'); updateSettings(); });
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  function updateStats() {
    const doc = getDoc('stats');
    setText(doc, 'stat-shots', `${save.totalShots}`);
    setText(doc, 'stat-blocks', `${save.totalBlocks}`);
    setText(doc, 'stat-cleared', `${save.levelsClear}`);
    setText(doc, 'stat-stars', `${save.totalStars}`);
    setText(doc, 'stat-highscore', `${save.highScore}`);
    setText(doc, 'stat-combo', `${save.bestCombo}`);
    setText(doc, 'stat-games', `${save.gamesPlayed}`);
    setText(doc, 'stat-time', `${save.playTimeMin}m`);
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  // ─── Achievements ────────────────────────────────────────────

  const ACHIEVEMENTS: Achievement[] = [
    { id: 'first_shot', name: 'FIRST SHOT', desc: 'Fire your first cannonball', icon: '*', check: () => save.totalShots >= 1 },
    { id: 'demolition', name: 'DEMOLITION', desc: 'Destroy 10 blocks', icon: '*', check: () => save.totalBlocks >= 10 },
    { id: 'wrecking_ball', name: 'WRECKING BALL', desc: 'Destroy 100 blocks', icon: '*', check: () => save.totalBlocks >= 100 },
    { id: 'destroyer', name: 'DESTROYER', desc: 'Destroy 500 blocks', icon: '*', check: () => save.totalBlocks >= 500 },
    { id: 'sharpshooter', name: 'SHARPSHOOTER', desc: 'Complete a level with 1 shot', icon: '*', check: () => save.levelStars.some(s => s === 3) },
    { id: 'perfectionist', name: 'PERFECTIONIST', desc: 'Get 3 stars on 5 levels', icon: '*', check: () => save.levelStars.filter(s => s === 3).length >= 5 },
    { id: 'zone_clear_1', name: 'GRID MASTER', desc: 'Clear Zone 1', icon: '*', check: () => save.levelStars.slice(0, 6).every(s => s > 0) },
    { id: 'zone_clear_2', name: 'FORGE MASTER', desc: 'Clear Zone 2', icon: '*', check: () => save.levelStars.slice(6, 12).every(s => s > 0) },
    { id: 'zone_clear_3', name: 'CIRCUIT MASTER', desc: 'Clear Zone 3', icon: '*', check: () => save.levelStars.slice(12, 18).every(s => s > 0) },
    { id: 'zone_clear_4', name: 'NEXUS MASTER', desc: 'Clear Zone 4', icon: '*', check: () => save.levelStars.slice(18, 24).every(s => s > 0) },
    { id: 'zone_clear_5', name: 'VOID MASTER', desc: 'Clear Zone 5', icon: '*', check: () => save.levelStars.slice(24, 30).every(s => s > 0) },
    { id: 'combo_3', name: 'TRIPLE THREAT', desc: 'Get a 3x combo', icon: '*', check: () => save.bestCombo >= 3 },
    { id: 'combo_5', name: 'COMBO KING', desc: 'Get a 5x combo', icon: '*', check: () => save.bestCombo >= 5 },
    { id: 'combo_10', name: 'CHAIN MASTER', desc: 'Get a 10x combo', icon: '*', check: () => save.bestCombo >= 10 },
    { id: 'highscore_1k', name: 'SCOREKEEPER', desc: 'Score 1,000 in a level', icon: '*', check: () => save.highScore >= 1000 },
    { id: 'highscore_5k', name: 'HIGH ROLLER', desc: 'Score 5,000 in a level', icon: '*', check: () => save.highScore >= 5000 },
    { id: 'highscore_10k', name: 'LEGENDARY', desc: 'Score 10,000 in a level', icon: '*', check: () => save.highScore >= 10000 },
    { id: 'games_10', name: 'REGULAR', desc: 'Play 10 games', icon: '*', check: () => save.gamesPlayed >= 10 },
    { id: 'games_50', name: 'VETERAN', desc: 'Play 50 games', icon: '*', check: () => save.gamesPlayed >= 50 },
    { id: 'all_clear', name: 'CONQUEROR', desc: 'Clear all 30 levels', icon: '*', check: () => save.levelsClear >= 30 },
    { id: 'ammo_fireball', name: 'PYRO', desc: 'Unlock Fireball ammo', icon: '*', check: () => save.unlockedAmmo.includes(1) },
    { id: 'ammo_bouncer', name: 'RICOCHET', desc: 'Unlock Bouncer ammo', icon: '*', check: () => save.unlockedAmmo.includes(2) },
    { id: 'ammo_cluster', name: 'CLUSTER BOMB', desc: 'Unlock Cluster ammo', icon: '*', check: () => save.unlockedAmmo.includes(3) },
    { id: 'ammo_heavy', name: 'BIG GUNS', desc: 'Unlock Heavy Shot', icon: '*', check: () => save.unlockedAmmo.includes(4) },
    { id: 'full_stars_z1', name: 'PERFECT GRID', desc: '3 stars on all Zone 1', icon: '*', check: () => save.levelStars.slice(0, 6).every(s => s === 3) },
    { id: 'shots_100', name: 'CENTURION', desc: 'Fire 100 shots total', icon: '*', check: () => save.totalShots >= 100 },
    { id: 'shots_500', name: 'ARTILLERY', desc: 'Fire 500 shots total', icon: '*', check: () => save.totalShots >= 500 },
    { id: 'blocks_1000', name: 'OBLITERATOR', desc: 'Destroy 1,000 blocks', icon: '*', check: () => save.totalBlocks >= 1000 },
    { id: 'crystal_collector', name: 'CRYSTAL COLLECTOR', desc: 'Earn 10,000 total score', icon: '*', check: () => save.highScore >= 10000 },
    { id: 'final_boss', name: 'FINAL BOSS', desc: 'Beat level 30', icon: '*', check: () => (save.levelStars[29] || 0) > 0 },
  ];

  function checkAchievements() {
    let newAchievement = false;
    for (const a of ACHIEVEMENTS) {
      if (!save.achievements.includes(a.id) && a.check()) {
        save.achievements.push(a.id);
        newAchievement = true;
        showToast(`ACHIEVEMENT: ${a.name}!`);
      }
    }
    // Check ammo unlocks based on levels cleared
    for (const ammo of AMMO_TYPES) {
      if (save.levelsClear >= ammo.unlockLevel && !save.unlockedAmmo.includes(AMMO_TYPES.indexOf(ammo))) {
        save.unlockedAmmo.push(AMMO_TYPES.indexOf(ammo));
        showToast(`AMMO UNLOCKED: ${ammo.name}!`);
      }
    }
    if (newAchievement) persist();
  }

  function updateAchievements() {
    const doc = getDoc('achievements');
    if (!doc) return;
    const unlocked = save.achievements.length;
    setText(doc, 'achieve-progress', `${unlocked} / ${ACHIEVEMENTS.length} Unlocked`);
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  // ─── Title Button Wiring ─────────────────────────────────────

  function wireTitle() {
    const doc = getDoc('title');
    if (!doc) return false;
    setBtn(doc, 'btn-play', () => { audio.play('select'); goToState('modeselect'); });
    setBtn(doc, 'btn-levels', () => { audio.play('select'); goToState('levelselect'); });
    setBtn(doc, 'btn-ammo', () => { audio.play('select'); goToState('ammo'); });
    setBtn(doc, 'btn-achievements', () => { audio.play('select'); goToState('achievements'); });
    setBtn(doc, 'btn-stats', () => { audio.play('select'); goToState('stats'); });
    setBtn(doc, 'btn-settings', () => { audio.play('select'); goToState('settings'); });
    setBtn(doc, 'btn-help', () => { audio.play('select'); goToState('help'); });
    return true;
  }

  function wireModeSelect() {
    const doc = getDoc('modeselect');
    if (!doc) return false;
    setBtn(doc, 'btn-campaign', () => { audio.play('select'); mode = 'campaign'; startLevel(0); });
    setBtn(doc, 'btn-arcade', () => { audio.play('select'); mode = 'arcade'; startArcadeLevel(); });
    setBtn(doc, 'btn-freeplay', () => { audio.play('select'); mode = 'freeplay'; startLevel(0); });
    setBtn(doc, 'btn-timeattack', () => { audio.play('select'); mode = 'timeattack'; timeAttackTimer = 60; startLevel(0); });
    setBtn(doc, 'btn-daily', () => { audio.play('select'); mode = 'daily'; startLevel(new Date().getDate() % LEVELS.length); });
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
    return true;
  }

  function wirePause() {
    const doc = getDoc('pause');
    if (!doc) return false;
    setBtn(doc, 'btn-resume', () => { audio.play('select'); state = 'aiming'; showPanels('hud', 'power'); });
    setBtn(doc, 'btn-retry', () => { audio.play('select'); if (mode === 'arcade') startArcadeLevel(); else startLevel(currentLevel); });
    setBtn(doc, 'btn-menu', () => { audio.play('select'); audio.stopMusic(); goToState('title'); });
    return true;
  }

  function wireHelp() {
    const doc = getDoc('help');
    if (!doc) return false;
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
    return true;
  }

  let titleWired = false, modeWired = false, pauseWired = false, helpWired = false;

  // ─── Game Loop ───────────────────────────────────────────────

  goToState('title');

  world.onUpdate((dt: number) => {
    // Wire panels once docs are ready
    if (!titleWired) titleWired = wireTitle();
    if (!modeWired) modeWired = wireModeSelect();
    if (!pauseWired) pauseWired = wirePause();
    if (!helpWired) helpWired = wireHelp();

    particles.update(dt);

    // Animate decorations
    const time = performance.now() * 0.001;
    decorations.forEach((d, i) => {
      d.rotation.x += dt * 0.1 * (i % 2 === 0 ? 1 : -1);
      d.rotation.y += dt * 0.15;
      d.position.y += Math.sin(time + i) * dt * 0.1;
    });

    // Ambient dots float
    ambientDots.forEach((d, i) => {
      d.position.y += Math.sin(time * 0.5 + i * 0.7) * dt * 0.15;
    });

    // Toast timer
    if (toastTimer > 0) {
      toastTimer -= dt;
      if (toastTimer <= 0 && panels['toast'].entity.object3D) {
        panels['toast'].entity.object3D.visible = false;
      }
    }

    // Cannon aiming visual
    cannonPivot.rotation.x = -cannonPitch;
    cannonGroup.rotation.y = cannonYaw;

    // Charge ring visual
    if (charging && (state === 'aiming' || state === 'charging')) {
      (chargeRing.material as MeshBasicMaterial).opacity = chargePower * 0.6;
      chargeRing.scale.setScalar(0.8 + chargePower * 0.4);
    } else {
      (chargeRing.material as MeshBasicMaterial).opacity = 0;
    }

    // Falling blocks
    for (const b of blocks) {
      if (!b.falling || b.destroyed) continue;
      b.vy -= 9.8 * dt;
      b.y += b.vy * dt;
      b.mesh.position.y = b.y;
      b.edges.position.y = b.y;
      if (b.y <= 0.25) {
        b.y = 0.25;
        b.mesh.position.y = 0.25;
        b.edges.position.y = 0.25;
        b.falling = false;
        b.vy = 0;
      }
    }

    // Keyboard input
    const kb = world.input.keyboard;

    // State-specific logic
    if (state === 'countdown') {
      countdownTimer -= dt;
      const doc = getDoc('countdown');
      const n = Math.ceil(countdownTimer);
      setText(doc, 'cd-num', n > 0 ? `${n}` : 'GO!');
      setText(doc, 'cd-label', n > 0 ? 'GET READY' : 'FIRE!');
      if (countdownTimer <= -0.5) {
        goToState('aiming');
      }
    }

    if (state === 'aiming' || state === 'charging') {
      // Keyboard aiming
      if (kb.getKeyPressed('ArrowUp')) cannonPitch = Math.min(cannonPitch + 1.2 * dt, Math.PI / 2.2);
      if (kb.getKeyPressed('ArrowDown')) cannonPitch = Math.max(cannonPitch - 1.2 * dt, 0.05);
      if (kb.getKeyPressed('ArrowLeft')) cannonYaw += 1.0 * dt;
      if (kb.getKeyPressed('ArrowRight')) cannonYaw -= 1.0 * dt;
      cannonYaw = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cannonYaw));

      // Ammo selection keys
      for (let i = 1; i <= 5; i++) {
        if (kb.getKeyDown(`Digit${i}`) && save.unlockedAmmo.includes(i - 1)) {
          currentAmmo = i - 1;
          audio.play('select');
        }
      }

      // Charging
      if (kb.getKeyDown('Space') && !charging && shotsLeft > 0) {
        charging = true;
        chargePower = 0;
        state = 'charging';
        audio.play('charge');
      }
      if (charging) {
        chargePower = Math.min(chargePower + dt * 0.8, 1);
      }
      if (kb.getKeyUp('Space') && charging) {
        charging = false;
        fireProjectile();
      }

      // Pause
      if (kb.getKeyDown('Escape')) {
        goToState('pause');
      }

      updateTrajectory();
      updateHUD();
    }

    if (state === 'firing') {
      updateProjectiles(dt);
      updateHUD();
    }

    if (state === 'impact') {
      impactTimer -= dt;
      if (impactTimer <= 0) {
        checkLevelEnd();
        checkAchievements();
      }
    }

    if (state === 'aiming' && mode === 'timeattack') {
      timeAttackTimer -= dt;
      if (timeAttackTimer <= 0) {
        goToState('gameover');
      }
    }

    // XR Controller input
    const rightGP = (world.input as any).xr?.gamepads?.right;
    if (rightGP) {
      const triggerDown = rightGP.getButtonDown?.(InputComponent.Trigger);
      const triggerPressed = rightGP.getButtonPressed?.(InputComponent.Trigger);
      const triggerUp = rightGP.getButtonUp?.(InputComponent.Trigger);
      const bDown = rightGP.getButtonDown?.(InputComponent.B_Button);
      const thumbstick = rightGP.getAxis?.(InputComponent.Thumbstick);

      if ((state === 'aiming' || state === 'charging') && bDown) {
        goToState('pause');
      }

      if (state === 'aiming' || state === 'charging') {
        // Thumbstick aiming
        if (thumbstick) {
          cannonYaw -= thumbstick.x * 1.5 * dt;
          cannonPitch += thumbstick.y * 1.0 * dt;
          cannonYaw = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, cannonYaw));
          cannonPitch = Math.max(0.05, Math.min(Math.PI / 2.2, cannonPitch));
        }

        if (triggerDown && !charging && shotsLeft > 0) {
          charging = true;
          chargePower = 0;
          state = 'charging';
          audio.play('charge');
        }
        if (triggerUp && charging) {
          charging = false;
          fireProjectile();
        }
      }
    }
  });
}

main().catch(console.error);
