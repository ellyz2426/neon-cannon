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
  'levelcomplete' | 'gameover' | 'achievements' | 'settings' | 'help' | 'stats' | 'pause' |
  'waveclear';

type GameMode = 'campaign' | 'arcade' | 'freeplay' | 'timeattack' | 'daily' | 'survival';

interface AmmoType {
  name: string; desc: string; damage: number; speed: number;
  color: string; emissive: string; radius: number;
  explosive: boolean; explosionRadius: number;
  bounces: number; cluster: number; unlockLevel: number;
}

type BlockDef = {
  type: 'wood' | 'stone' | 'metal' | 'crystal' | 'tnt' | 'ice' | 'rubber' | 'plasma';
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
  { name: 'LASER', desc: 'Pierces through blocks', damage: 1, speed: 1.8, color: '#00ffaa', emissive: '#004422', radius: 0.06, explosive: false, explosionRadius: 0, bounces: 0, cluster: 0, unlockLevel: 20 },
  { name: 'GRAVITY BOMB', desc: 'Pulls blocks inward', damage: 1, speed: 0.8, color: '#6600ff', emissive: '#220066', radius: 0.18, explosive: true, explosionRadius: 2.5, bounces: 0, cluster: 0, unlockLevel: 28 },
  { name: 'LIGHTNING', desc: 'Chains to nearby blocks', damage: 0.8, speed: 1.3, color: '#ffff00', emissive: '#666600', radius: 0.08, explosive: false, explosionRadius: 0, bounces: 0, cluster: 0, unlockLevel: 35 },
];

// ─── Block Properties ────────────────────────────────────────────

const BLOCK_PROPS: Record<string, { hp: number; color: string; emissive: string; points: number; edge: string }> = {
  wood:    { hp: 1, color: '#885522', emissive: '#221100', points: 100, edge: '#aa6633' },
  stone:   { hp: 2, color: '#667788', emissive: '#112233', points: 200, edge: '#8899aa' },
  metal:   { hp: 3, color: '#aabbcc', emissive: '#334455', points: 300, edge: '#ccddee' },
  crystal: { hp: 1, color: '#00ffff', emissive: '#004444', points: 500, edge: '#44ffff' },
  tnt:     { hp: 1, color: '#ff2200', emissive: '#440000', points: 150, edge: '#ff4433' },
  ice:     { hp: 1, color: '#aaeeff', emissive: '#224466', points: 250, edge: '#ccffff' },
  rubber:  { hp: 2, color: '#ff88cc', emissive: '#441133', points: 180, edge: '#ffaadd' },
  plasma:  { hp: 4, color: '#ff00ff', emissive: '#440044', points: 600, edge: '#ff44ff' },
};

// ─── Themes ──────────────────────────────────────────────────────

const THEMES: Theme[] = [
  { name: 'NEON GRID', ground: '#111122', grid: '#ff4400', accent: '#ff6600', fog: '#0a0005', sky: '#050010', glow: '#ff3300', cannon: '#ff6600' },
  { name: 'CRIMSON FORGE', ground: '#1a0808', grid: '#ff2200', accent: '#ff3300', fog: '#100005', sky: '#080002', glow: '#ff0000', cannon: '#ff3333' },
  { name: 'CYAN CIRCUIT', ground: '#081118', grid: '#00aacc', accent: '#00cccc', fog: '#000510', sky: '#000208', glow: '#00aaff', cannon: '#00cccc' },
  { name: 'GOLD NEXUS', ground: '#181408', grid: '#ccaa00', accent: '#ffcc00', fog: '#0a0800', sky: '#080500', glow: '#ffaa00', cannon: '#ffcc00' },
  { name: 'VOID MATRIX', ground: '#0a000a', grid: '#8800cc', accent: '#aa44ff', fog: '#050008', sky: '#020005', glow: '#9900ff', cannon: '#aa44ff' },
  { name: 'PLASMA DEPTHS', ground: '#0a0818', grid: '#ff00aa', accent: '#ff44cc', fog: '#080010', sky: '#040008', glow: '#ff0088', cannon: '#ff44aa' },
  { name: 'EMERALD LATTICE', ground: '#081a08', grid: '#00ff44', accent: '#44ff66', fog: '#001005', sky: '#000802', glow: '#00ff33', cannon: '#22ff44' },
  { name: 'QUANTUM STORM', ground: '#101018', grid: '#4488ff', accent: '#6699ff', fog: '#050510', sky: '#020208', glow: '#3366ff', cannon: '#4488ff' },
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

  // Zone 6: Plasma Depths (levels 31-36) — ice + plasma blocks
  levels.push({ name: 'Frozen Core', zone: 5, shots: 5, blocks: [
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'ice' as const, x: -1 + i * 0.5, y: 0.25, z: -10 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'ice' as const, x: -0.5 + i * 0.5, y: 0.75, z: -10 })),
    { type: 'crystal' as const, x: 0, y: 1.25, z: -10 },
  ]});
  levels.push({ name: 'Plasma Forge', zone: 5, shots: 7, blocks: [
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'plasma' as const, x: -0.75 + i * 0.5, y: 0.25, z: -10 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'ice' as const, x: -0.75 + i * 0.5, y: 0.75, z: -10 })),
    { type: 'tnt' as const, x: -0.25, y: 1.25, z: -10 }, { type: 'tnt' as const, x: 0.25, y: 1.25, z: -10 },
  ]});
  levels.push({ name: 'Cryo Chamber', zone: 5, shots: 5, blocks: [
    { type: 'metal' as const, x: -1.5, y: 0.25, z: -11 }, { type: 'metal' as const, x: 1.5, y: 0.25, z: -11 },
    { type: 'metal' as const, x: -1.5, y: 0.75, z: -11 }, { type: 'metal' as const, x: 1.5, y: 0.75, z: -11 },
    ...Array.from({ length: 5 }, (_, i) => ({ type: 'ice' as const, x: -1 + i * 0.5, y: 0.25, z: -11 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'ice' as const, x: -0.5 + i * 0.5, y: 0.75, z: -11 })),
    { type: 'plasma' as const, x: 0, y: 1.25, z: -11 },
  ]});
  levels.push({ name: 'Thermal Vent', zone: 5, shots: 4, blocks: [
    ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
      type: (r === 0 ? 'rubber' : c % 2 === 0 ? 'ice' : 'tnt') as BlockDef['type'],
      x: -1 + c * 0.5, y: 0.25 + r * 0.5, z: -10,
    }))).flat(),
  ]});
  levels.push({ name: 'Deep Freeze', zone: 5, shots: 6, blocks: [
    ...Array.from({ length: 4 }, (_, r) => Array.from({ length: 4 }, (_, c) => ({
      type: (r === 0 ? 'metal' : (r + c) % 2 === 0 ? 'ice' : 'plasma') as BlockDef['type'],
      x: -0.75 + c * 0.5, y: 0.25 + r * 0.5, z: -11,
    }))).flat(),
  ]});
  levels.push({ name: 'Plasma Boss', zone: 5, shots: 8, blocks: [
    // Boss structure: thick walls with plasma core
    ...Array.from({ length: 5 }, (_, r) => ({ type: 'metal' as const, x: -1.5, y: 0.25 + r * 0.5, z: -11 })),
    ...Array.from({ length: 5 }, (_, r) => ({ type: 'metal' as const, x: 1.5, y: 0.25 + r * 0.5, z: -11 })),
    ...Array.from({ length: 3 }, (_, r) => ({ type: 'plasma' as const, x: 0, y: 0.25 + r * 0.5, z: -11 })),
    ...Array.from({ length: 5 }, (_, c) => ({ type: 'stone' as const, x: -1 + c * 0.5, y: 2.75, z: -11 })),
    { type: 'tnt' as const, x: -0.5, y: 0.75, z: -11 }, { type: 'tnt' as const, x: 0.5, y: 0.75, z: -11 },
    { type: 'crystal' as const, x: 0, y: 1.75, z: -11 },
    { type: 'ice' as const, x: -1, y: 0.25, z: -11 }, { type: 'ice' as const, x: 1, y: 0.25, z: -11 },
  ]});

  // Zone 7: Emerald Lattice (levels 37-42) — rubber blocks + complex structures
  levels.push({ name: 'Bounce Hall', zone: 6, shots: 5, blocks: [
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'rubber' as const, x: -0.5 + i * 0.5, y: 0.25, z: -9 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'wood' as const, x: -0.5 + i * 0.5, y: 0.75, z: -9 })),
    { type: 'crystal' as const, x: 0, y: 1.25, z: -9 },
  ]});
  levels.push({ name: 'Spring Trap', zone: 6, shots: 6, blocks: [
    { type: 'rubber' as const, x: -1, y: 0.25, z: -10 }, { type: 'rubber' as const, x: 1, y: 0.25, z: -10 },
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'stone' as const, x: -0.75 + i * 0.5, y: 0.25, z: -10 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'wood' as const, x: -0.75 + i * 0.5, y: 0.75, z: -10 })),
    { type: 'tnt' as const, x: 0, y: 1.25, z: -10 },
  ]});
  levels.push({ name: 'Lattice Grid', zone: 6, shots: 7, blocks: [
    ...Array.from({ length: 4 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
      type: ((r + c) % 3 === 0 ? 'rubber' : (r + c) % 3 === 1 ? 'wood' : 'stone') as BlockDef['type'],
      x: -1 + c * 0.5, y: 0.25 + r * 0.5, z: -10,
    }))).flat(),
  ]});
  levels.push({ name: 'Emerald Spire', zone: 6, shots: 6, blocks: [
    ...Array.from({ length: 6 }, (_, r) => ({ type: (r < 2 ? 'metal' : r < 4 ? 'stone' : 'crystal') as BlockDef['type'], x: 0, y: 0.25 + r * 0.5, z: -10 })),
    { type: 'rubber' as const, x: -0.5, y: 0.25, z: -10 }, { type: 'rubber' as const, x: 0.5, y: 0.25, z: -10 },
    { type: 'rubber' as const, x: -0.5, y: 0.75, z: -10 }, { type: 'rubber' as const, x: 0.5, y: 0.75, z: -10 },
    { type: 'tnt' as const, x: -0.5, y: 1.25, z: -10 }, { type: 'tnt' as const, x: 0.5, y: 1.25, z: -10 },
  ]});
  levels.push({ name: 'Vine Wall', zone: 6, shots: 7, blocks: [
    ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
      type: (r === 0 || r === 4 ? 'metal' : c === 0 || c === 4 ? 'rubber' : 'wood') as BlockDef['type'],
      x: -1 + c * 0.5, y: 0.25 + r * 0.5, z: -10,
    }))).flat(),
  ]});
  levels.push({ name: 'Lattice Boss', zone: 6, shots: 9, blocks: [
    // Boss: cross-shaped fortress with rubber shields
    ...Array.from({ length: 6 }, (_, r) => ({ type: 'metal' as const, x: 0, y: 0.25 + r * 0.5, z: -11 })),
    ...Array.from({ length: 4 }, (_, c) => ({ type: 'metal' as const, x: -1.5 + c, y: 1.25, z: -11 })),
    { type: 'rubber' as const, x: -2, y: 1.25, z: -11 }, { type: 'rubber' as const, x: 2, y: 1.25, z: -11 },
    { type: 'rubber' as const, x: 0, y: 3.25, z: -11 },
    { type: 'plasma' as const, x: 0, y: 1.75, z: -11 }, { type: 'plasma' as const, x: 0, y: 0.75, z: -11 },
    { type: 'tnt' as const, x: -0.5, y: 0.25, z: -11 }, { type: 'tnt' as const, x: 0.5, y: 0.25, z: -11 },
    { type: 'crystal' as const, x: -1, y: 0.75, z: -11 }, { type: 'crystal' as const, x: 1, y: 0.75, z: -11 },
  ]});

  // Zone 8: Quantum Storm (levels 43-48) — mixed chaos with all block types
  levels.push({ name: 'Storm Front', zone: 7, shots: 6, blocks: [
    ...Array.from({ length: 3 }, (_, r) => Array.from({ length: 6 }, (_, c) => ({
      type: (['wood', 'stone', 'ice', 'rubber', 'crystal', 'tnt'] as const)[c],
      x: -1.25 + c * 0.5, y: 0.25 + r * 0.5, z: -11,
    }))).flat(),
  ]});
  levels.push({ name: 'Thunder Wall', zone: 7, shots: 7, blocks: [
    ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
      type: (r === 0 ? 'plasma' : (r + c) % 4 === 0 ? 'tnt' : (r + c) % 3 === 0 ? 'ice' : 'metal') as BlockDef['type'],
      x: -1 + c * 0.5, y: 0.25 + r * 0.5, z: -12,
    }))).flat(),
  ]});
  levels.push({ name: 'Eye of Storm', zone: 7, shots: 6, blocks: [
    // Ring shape with open center
    ...Array.from({ length: 3 }, (_, i) => [
      { type: 'metal' as const, x: -1, y: 0.25 + i * 0.5, z: -11 },
      { type: 'metal' as const, x: 1, y: 0.25 + i * 0.5, z: -11 },
    ]).flat(),
    ...Array.from({ length: 3 }, (_, c) => ({ type: 'stone' as const, x: -0.5 + c * 0.5, y: 1.75, z: -11 })),
    ...Array.from({ length: 3 }, (_, c) => ({ type: 'ice' as const, x: -0.5 + c * 0.5, y: 0.25, z: -11 })),
    { type: 'plasma' as const, x: 0, y: 0.75, z: -11 },
  ]});
  levels.push({ name: 'Static Field', zone: 7, shots: 8, blocks: [
    ...Array.from({ length: 5 }, (_, r) => Array.from({ length: 6 }, (_, c) => ({
      type: ((r * 6 + c) % 5 === 0 ? 'tnt' : (r * 6 + c) % 4 === 0 ? 'plasma' : (r * 6 + c) % 3 === 0 ? 'rubber' : 'stone') as BlockDef['type'],
      x: -1.25 + c * 0.5, y: 0.25 + r * 0.5, z: -12,
    }))).flat(),
  ]});
  levels.push({ name: 'Quantum Cage', zone: 7, shots: 8, blocks: [
    // Full enclosure
    ...Array.from({ length: 5 }, (_, r) => [
      { type: 'metal' as const, x: -1.5, y: 0.25 + r * 0.5, z: -11 },
      { type: 'metal' as const, x: 1.5, y: 0.25 + r * 0.5, z: -11 },
    ]).flat(),
    ...Array.from({ length: 5 }, (_, c) => ({ type: 'metal' as const, x: -1 + c * 0.5, y: 2.75, z: -11 })),
    ...Array.from({ length: 5 }, (_, c) => ({ type: 'ice' as const, x: -1 + c * 0.5, y: 0.25, z: -11 })),
    { type: 'plasma' as const, x: 0, y: 1.25, z: -11 }, { type: 'crystal' as const, x: -0.5, y: 1.25, z: -11 },
    { type: 'crystal' as const, x: 0.5, y: 1.25, z: -11 },
    { type: 'tnt' as const, x: 0, y: 0.75, z: -11 },
  ]});
  levels.push({ name: 'Storm Boss', zone: 7, shots: 10, blocks: [
    // Boss: multi-layer fortress with all block types
    ...Array.from({ length: 6 }, (_, r) => [
      { type: 'metal' as const, x: -2, y: 0.25 + r * 0.5, z: -12 },
      { type: 'metal' as const, x: 2, y: 0.25 + r * 0.5, z: -12 },
    ]).flat(),
    ...Array.from({ length: 7 }, (_, c) => ({ type: 'stone' as const, x: -1.5 + c * 0.5, y: 3.25, z: -12 })),
    ...Array.from({ length: 2 }, (_, r) => Array.from({ length: 5 }, (_, c) => ({
      type: (c === 2 ? 'plasma' : r === 0 ? 'rubber' : 'ice') as BlockDef['type'],
      x: -1 + c * 0.5, y: 0.25 + r * 0.5, z: -12,
    }))).flat(),
    { type: 'plasma' as const, x: 0, y: 1.75, z: -12 }, { type: 'plasma' as const, x: 0, y: 2.25, z: -12 },
    { type: 'tnt' as const, x: -1, y: 1.25, z: -12 }, { type: 'tnt' as const, x: 1, y: 1.25, z: -12 },
    { type: 'crystal' as const, x: 0, y: 2.75, z: -12 },
  ]});

  // Zone 9: OMEGA (levels 49-54) — final endgame zone
  for (let i = 0; i < 6; i++) {
    const rows = 5 + Math.floor(i / 2);
    const cols = 5 + (i % 2);
    const bk: BlockDef[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const allTypes: BlockDef['type'][] = ['metal', 'stone', 'plasma', 'ice', 'rubber', 'crystal', 'tnt', 'wood'];
        const t = r < 2 ? 'plasma' : r === rows - 1 ? 'crystal' : (r + c) % 4 === 0 ? 'tnt' : allTypes[(r * cols + c) % allTypes.length];
        bk.push({ type: t, x: -(cols - 1) * 0.25 + c * 0.5, y: 0.25 + r * 0.5, z: -13 });
      }
    }
    levels.push({ name: ['Omega Gate', 'Omega Vault', 'Omega Spire', 'Omega Core', 'Omega Citadel', 'OMEGA FINAL'][i], zone: 4, shots: 8 + i, blocks: bk });
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

    // Arpeggiator-style background music
    const notes = [55, 73.42, 82.41, 110, 130.81, 146.83, 164.81, 110];
    let noteIdx = 0;

    this.musicOsc = c.createOscillator();
    this.musicOsc.type = 'sine';
    this.musicOsc.frequency.setValueAtTime(notes[0], c.currentTime);
    this.musicOsc.connect(this.musicGain);
    this.musicOsc.start();

    // Schedule note changes for arpeggio pattern
    const scheduleArp = () => {
      if (!this.musicOsc || !this.ctx) return;
      const now = this.ctx.currentTime;
      for (let i = 0; i < 32; i++) {
        const idx = (noteIdx + i) % notes.length;
        this.musicOsc.frequency.setValueAtTime(notes[idx], now + i * 0.25);
      }
      noteIdx = (noteIdx + 32) % notes.length;
      this._arpInterval = setTimeout(scheduleArp, 7500);
    };
    scheduleArp();
  }

  _arpInterval: any = null;

  stopMusic() {
    if (this.musicOsc) { this.musicOsc.stop(); this.musicOsc = null; this.musicGain = null; }
    if (this._arpInterval) { clearTimeout(this._arpInterval); this._arpInterval = null; }
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

  // Wind system
  let windX = 0;
  let windZ = 0;
  let windStrength = 0;
  let windChangeTimer = 0;

  function randomizeWind() {
    const angle = Math.random() * Math.PI * 2;
    windStrength = 0.5 + Math.random() * 3.5; // 0.5–4 m/s
    windX = Math.cos(angle) * windStrength;
    windZ = Math.sin(angle) * windStrength;
    windChangeTimer = 8 + Math.random() * 12; // changes every 8-20s
  }
  randomizeWind();

  // Slow-motion system
  let slowMoTimer = 0;
  let slowMoFactor = 1;

  function triggerSlowMo(duration: number = 0.5, factor: number = 0.25) {
    slowMoTimer = duration;
    slowMoFactor = factor;
  }

  // Muzzle flash
  let muzzleFlashTimer = 0;
  const muzzleFlashMesh = new Mesh(
    new SphereGeometry(0.15, 8, 8),
    new MeshBasicMaterial({ color: new Color('#ffaa00'), transparent: true, opacity: 0, blending: AdditiveBlending })
  );

  // Survival mode state
  let survivalWave = 0;
  let survivalTotalScore = 0;
  let survivalBestWave = 0;

  // Persistent stats (localStorage)
  interface SaveData {
    levelStars: number[]; highScore: number; totalShots: number;
    totalBlocks: number; levelsClear: number; totalStars: number;
    bestCombo: number; gamesPlayed: number; playTimeMin: number;
    unlockedAmmo: number[]; achievements: string[];
    xp: number; level: number; prestige: number;
    cannonSkin: number; unlockedSkins: number[];
    totalScore: number; perfectLevels: number;
    survivalBestWave: number; survivalBestScore: number;
  }

  function defaultSave(): SaveData {
    return {
      levelStars: Array(54).fill(0), highScore: 0, totalShots: 0,
      totalBlocks: 0, levelsClear: 0, totalStars: 0,
      bestCombo: 0, gamesPlayed: 0, playTimeMin: 0,
      unlockedAmmo: [0], achievements: [],
      xp: 0, level: 1, prestige: 0,
      cannonSkin: 0, unlockedSkins: [0],
      totalScore: 0, perfectLevels: 0,
      survivalBestWave: 0, survivalBestScore: 0,
    };
  }

  let save: SaveData = defaultSave();
  try { const s = localStorage.getItem('neon-cannon-save'); if (s) { const parsed = JSON.parse(s); save = { ...defaultSave(), ...parsed, levelStars: [...defaultSave().levelStars] }; if (parsed.levelStars) { for (let i = 0; i < Math.min(parsed.levelStars.length, save.levelStars.length); i++) save.levelStars[i] = parsed.levelStars[i]; } } } catch {}
  function persist() { try { localStorage.setItem('neon-cannon-save', JSON.stringify(save)); } catch {} }

  // ─── XP & Prestige System ───────────────────────────────────

  const XP_PER_LEVEL = 500;
  const PRESTIGE_LEVEL = 50;

  function addXP(amount: number) {
    save.xp += amount;
    const needed = XP_PER_LEVEL * save.level;
    while (save.xp >= needed) {
      save.xp -= needed;
      save.level++;
      showToast(`LEVEL UP: ${save.level}!`);
      audio.play('complete');
      // Unlock cannon skins at certain levels
      if (save.level >= 10 && !save.unlockedSkins.includes(1)) { save.unlockedSkins.push(1); showToast('SKIN UNLOCKED: Chrome'); }
      if (save.level >= 20 && !save.unlockedSkins.includes(2)) { save.unlockedSkins.push(2); showToast('SKIN UNLOCKED: Gold'); }
      if (save.level >= 30 && !save.unlockedSkins.includes(3)) { save.unlockedSkins.push(3); showToast('SKIN UNLOCKED: Plasma'); }
      if (save.level >= 40 && !save.unlockedSkins.includes(4)) { save.unlockedSkins.push(4); showToast('SKIN UNLOCKED: Rainbow'); }
    }
    if (save.level >= PRESTIGE_LEVEL) {
      save.prestige++;
      save.level = 1;
      save.xp = 0;
      showToast(`PRESTIGE ${save.prestige}!`);
    }
    persist();
  }

  // ─── Cannon Skins ────────────────────────────────────────────

  const CANNON_SKINS = [
    { name: 'CLASSIC', color: '#ff6600', glow: '#ff3300' },
    { name: 'CHROME', color: '#ddddee', glow: '#aabbcc' },
    { name: 'GOLD', color: '#ffcc00', glow: '#ffaa00' },
    { name: 'PLASMA', color: '#ff00ff', glow: '#cc00cc' },
    { name: 'RAINBOW', color: '#ff0000', glow: '#00ff00' },
  ];

  // ─── Screen Shake ────────────────────────────────────────────

  let shakeIntensity = 0;
  let shakeDecay = 0;

  function triggerShake(intensity: number, duration: number = 0.3) {
    shakeIntensity = intensity;
    shakeDecay = duration;
  }

  function updateShake(dt: number) {
    if (shakeIntensity <= 0) return;
    shakeDecay -= dt;
    if (shakeDecay <= 0) { shakeIntensity = 0; world.camera.position.x = 0; world.camera.position.y = 1.6; return; }
    const s = shakeIntensity * (shakeDecay / 0.3);
    world.camera.position.x += (Math.random() - 0.5) * s * 0.1;
    world.camera.position.y += 1.6 + (Math.random() - 0.5) * s * 0.05;
  }

  // ─── Score Multiplier ────────────────────────────────────────

  let scoreMultiplier = 1;
  let multiplierTimer = 0;

  function activateMultiplier(mult: number, duration: number) {
    scoreMultiplier = mult;
    multiplierTimer = duration;
    showToast(`${mult}x MULTIPLIER!`);
  }

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

  // Muzzle flash
  muzzleFlashMesh.position.z = -1.3;
  cannonPivot.add(muzzleFlashMesh);

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
      // Wind affects preview too
      vx += windX * dt * 0.8;
      vz += windZ * dt * 0.8;
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
    const blockScore = b.points * (1 + combo * 0.2) * scoreMultiplier;
    score += blockScore;
    save.totalScore += Math.floor(blockScore);
    combo++;
    if (combo > maxCombo) maxCombo = combo;

    audio.play('destroy');
    particles.emit(new Vector3(b.x, b.y, b.z), 8, BLOCK_PROPS[b.type].color, 2, 0.8);

    // XP from destroying blocks
    addXP(Math.floor(b.points / 10));

    if (combo > 2) {
      audio.play('combo');
      showToast(`${combo}x COMBO!`);
      triggerSlowMo(0.4, 0.3); // Slow-mo on combos
    }

    // Combo-based multiplier bonuses
    if (combo === 5) activateMultiplier(2, 5);
    if (combo === 10) activateMultiplier(3, 5);
    if (combo === 20) activateMultiplier(5, 5);

    // Ice block shatters: bonus score + extra particles
    if (b.type === 'ice') {
      particles.emit(new Vector3(b.x, b.y, b.z), 15, '#aaeeff', 3, 1);
      score += 100 * scoreMultiplier; // Ice shatter bonus
    }

    if (b.type === 'tnt') {
      audio.play('explode');
      particles.emit(new Vector3(b.x, b.y, b.z), 20, '#ff4400', 4, 1.2);
      triggerShake(0.4);
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
    // Muzzle flash
    muzzleFlashTimer = 0.15;
    (muzzleFlashMesh.material as MeshBasicMaterial).opacity = 0.9;
    muzzleFlashMesh.scale.setScalar(1 + chargePower);
    triggerShake(0.1 + chargePower * 0.15);
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
      // Wind affects trajectory
      p.vx += windX * dt * 0.8;
      p.vz += windZ * dt * 0.8;
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
      let hitBlock = false;
      for (const b of blocks) {
        if (b.destroyed) continue;
        const dx = Math.abs(p.mesh.position.x - b.x);
        const dy = Math.abs(p.mesh.position.y - b.y);
        const dz = Math.abs(p.mesh.position.z - b.z);
        if (dx < (b.w / 2 + ammo.radius) && dy < (b.h / 2 + ammo.radius) && dz < (b.d / 2 + ammo.radius)) {
          // Rubber blocks deflect projectiles (unless it's a heavy shot)
          if (b.type === 'rubber' && ammo.damage < 3) {
            audio.play('bounce');
            particles.emit(new Vector3(b.x, b.y, b.z), 6, '#ff88cc', 2, 0.5);
            p.vx = -p.vx * 0.8;
            p.vz = -p.vz * 0.8;
            p.vy = Math.abs(p.vy) * 0.6 + 2;
            b.hp -= 0.5;
            if (b.hp <= 0) destroyBlock(b);
            continue;
          }

          // Hit!
          b.hp -= ammo.damage;
          if (b.hp <= 0) {
            destroyBlock(b);
          } else {
            audio.play('hit');
            particles.emit(new Vector3(b.x, b.y, b.z), 4, BLOCK_PROPS[b.type].color, 1.5);
            const mat = b.mesh.material as MeshStandardMaterial;
            mat.emissiveIntensity = 0.8;
            setTimeout(() => { mat.emissiveIntensity = 0.15; }, 150);
          }

          if (ammo.explosive) {
            audio.play('explode');
            triggerShake(0.3);
            particles.emit(p.mesh.position.clone(), 25, ammo.color, 5, 1);
            // Gravity bomb pulls blocks toward impact
            const isGravBomb = ammo.name === 'GRAVITY BOMB';
            for (const ob of blocks) {
              if (ob.destroyed) continue;
              const d = p.mesh.position.distanceTo(new Vector3(ob.x, ob.y, ob.z));
              if (d < ammo.explosionRadius) {
                ob.hp -= 1;
                if (isGravBomb) {
                  // Pull block toward center
                  const pullStr = 0.3;
                  ob.x += (p.mesh.position.x - ob.x) * pullStr;
                  ob.y += (p.mesh.position.y - ob.y) * pullStr;
                  ob.mesh.position.set(ob.x, ob.y, ob.z);
                  ob.edges.position.set(ob.x, ob.y, ob.z);
                  ob.falling = true;
                  ob.vy = -1;
                }
                if (ob.hp <= 0) destroyBlock(ob);
              }
            }
          }

          // Lightning chains to nearby blocks
          if (ammo.name === 'LIGHTNING') {
            let chainCount = 0;
            const chainedBlocks = new Set<BlockInstance>();
            chainedBlocks.add(b);
            let lastPos = new Vector3(b.x, b.y, b.z);
            while (chainCount < 4) {
              let nearest: BlockInstance | null = null;
              let nearestDist = 2.0;
              for (const ob of blocks) {
                if (ob.destroyed || chainedBlocks.has(ob)) continue;
                const d = lastPos.distanceTo(new Vector3(ob.x, ob.y, ob.z));
                if (d < nearestDist) { nearestDist = d; nearest = ob; }
              }
              if (!nearest) break;
              chainedBlocks.add(nearest);
              nearest.hp -= ammo.damage * 0.6;
              particles.emit(new Vector3(nearest.x, nearest.y, nearest.z), 6, '#ffff00', 2, 0.4);
              if (nearest.hp <= 0) destroyBlock(nearest);
              lastPos = new Vector3(nearest.x, nearest.y, nearest.z);
              chainCount++;
            }
            if (chainCount > 0) showToast(`CHAIN ${chainCount + 1}!`);
          }

          if (ammo.cluster > 0) {
            spawnClusterProjectiles(p.mesh.position.clone(), p.vx * 0.5, p.vz * 0.5);
          }

          // Laser pierces through (don't stop on hit)
          if (ammo.name === 'LASER') {
            hitBlock = true;
            continue; // Don't break, keep going through
          }

          handleProjectileImpact(p);
          hitBlock = true;
          break;
        }
      }
      // For laser, check if it went through everything and went off-screen
      if (hitBlock && ammo.name === 'LASER' && (p.mesh.position.z < -20 || p.mesh.position.y < -2)) {
        handleProjectileImpact(p);
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
  createHUDPanel('wind', '/ui/wind.json', 0.12, 0.08, [-0.2, -0.02, -0.5]);
  createHUDPanel('survival', '/ui/survival.json', 0.25, 0.15, [0.25, -0.1, -0.5]);

  // World-space panels for survival
  createWorldPanel('waveclear', '/ui/waveclear.json', 0.8, 0.9, [0, 1.5, -2.5]);

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
    const el = doc.getElementById(id) as any;
    if (el && el.text) el.text.value = text;
  }

  function setBtn(doc: UIKitDocument | null, id: string, cb: () => void) {
    if (!doc) return;
    const el = doc.getElementById(id);
    if (el) el.addEventListener('click', cb);
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
      case 'aiming':
        if (mode === 'survival') showPanels('survival', 'power', 'wind');
        else showPanels('hud', 'power', 'wind');
        cannonGroup.visible = true; updateHUD(); break;
      case 'levelcomplete': showPanels('levelcomplete'); updateLevelComplete(); break;
      case 'gameover': showPanels('gameover'); updateGameOver(); break;
      case 'waveclear': showPanels('waveclear'); updateWaveClear(); break;
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
    const arcadeBlockDefs: BlockDef[] = [];
    const types: BlockDef['type'][] = ['wood', 'stone', 'metal', 'crystal', 'tnt'];
    for (let i = 0; i < blockCount; i++) {
      const col = Math.floor(i % 5);
      const row = Math.floor(i / 5);
      arcadeBlockDefs.push({
        type: types[Math.floor(Math.random() * types.length)],
        x: -1 + col * 0.5, y: 0.25 + row * 0.5, z: -9
      });
    }
    const def: LevelDef = { name: 'Arcade', zone: Math.floor(Math.random() * 5), shots: Math.ceil(blockCount * 0.6), blocks: arcadeBlockDefs };
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
      if (mode === 'survival') {
        checkSurvivalWaveEnd();
        return;
      }
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
      // Perfect level bonus
      if (stars === 3) {
        save.perfectLevels++;
        addXP(200);
      }
      addXP(100 + Math.floor(score / 100)); // Level completion XP
      persist();

      audio.play('complete');
      audio.stopMusic();
      // Victory fireworks
      const fireworkColors = ['#ff4400', '#ffcc00', '#00ffaa', '#ff00ff', '#4488ff', '#ff6600'];
      for (let fw = 0; fw < 8; fw++) {
        setTimeout(() => {
          const fwPos = new Vector3((Math.random() - 0.5) * 6, 2 + Math.random() * 4, -8 + (Math.random() - 0.5) * 4);
          const col = fireworkColors[Math.floor(Math.random() * fireworkColors.length)];
          particles.emit(fwPos, 20, col, 4, 1.5);
        }, fw * 200);
      }
      goToState('levelcomplete');
    } else if (shotsLeft <= 0 && mode !== 'freeplay') {
      save.totalShots += shotsFired;
      save.totalBlocks += blocksDestroyed;
      persist();
      audio.stopMusic();
      if (mode === 'survival') {
        // Survival game over
        if (survivalTotalScore > save.survivalBestScore) save.survivalBestScore = survivalTotalScore;
        if (survivalWave > save.survivalBestWave) save.survivalBestWave = survivalWave;
        persist();
      }
      goToState('gameover');
    } else {
      state = 'aiming';
      if (mode === 'survival') showPanels('survival', 'power', 'wind');
      else showPanels('hud', 'power', 'wind');
    }
  }

  // ─── Survival Mode ──────────────────────────────────────────

  function startSurvivalMode() {
    survivalWave = 1;
    survivalTotalScore = 0;
    shotsLeft = 10;
    shotsFired = 0;
    score = 0;
    combo = 0;
    maxCombo = 0;
    blocksDestroyed = 0;
    currentThemeIdx = 0;
    cannonYaw = 0;
    cannonPitch = 0.3;
    chargePower = 0;
    charging = false;
    cleanupProjectiles();
    spawnSurvivalWave(1);
    goToState('countdown');
    audio.startMusic();
    save.gamesPlayed++;
    persist();
  }

  function spawnSurvivalWave(wave: number) {
    clearBlocks();
    const blockCount = 4 + wave * 2 + Math.floor(wave / 3);
    const cols = Math.min(6, 3 + Math.floor(wave / 2));
    const types: BlockDef['type'][] = ['wood', 'stone'];
    if (wave >= 2) types.push('metal');
    if (wave >= 3) types.push('crystal', 'tnt');
    if (wave >= 5) types.push('ice');
    if (wave >= 7) types.push('rubber');
    if (wave >= 10) types.push('plasma');

    const blockDefs: BlockDef[] = [];
    for (let i = 0; i < blockCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const t = types[Math.floor(Math.random() * types.length)];
      blockDefs.push({
        type: t,
        x: -(cols - 1) * 0.25 + col * 0.5,
        y: 0.25 + row * 0.5,
        z: -8 - Math.floor(wave / 4),
      });
    }

    // Boss block every 5 waves
    if (wave % 5 === 0) {
      blockDefs.push({ type: 'plasma', x: 0, y: 0.25 + Math.ceil(blockCount / cols) * 0.5, z: -9 });
      blockDefs.push({ type: 'plasma', x: -0.5, y: 0.25 + Math.ceil(blockCount / cols) * 0.5, z: -9 });
      blockDefs.push({ type: 'plasma', x: 0.5, y: 0.25 + Math.ceil(blockCount / cols) * 0.5, z: -9 });
    }

    totalBlocks = blockDefs.length;
    currentThemeIdx = wave % THEMES.length;

    for (const bd of blockDefs) {
      const props = BLOCK_PROPS[bd.type];
      const w = 0.45, h = 0.45, d = 0.45;
      const geo = new BoxGeometry(w, h, d);
      const mat = new MeshStandardMaterial({
        color: new Color(props.color), emissive: new Color(props.emissive),
        emissiveIntensity: bd.type === 'crystal' ? 0.5 : bd.type === 'tnt' ? 0.4 : 0.15,
        metalness: bd.type === 'metal' ? 0.7 : 0.3, roughness: bd.type === 'metal' ? 0.2 : 0.5,
      });
      const mesh = new Mesh(geo, mat);
      mesh.position.set(bd.x, bd.y, bd.z);
      world.scene.add(mesh);
      const edges = new LineSegments(new EdgesGeometry(geo), new LineBasicMaterial({ color: new Color(props.edge), transparent: true, opacity: 0.6 }));
      edges.position.copy(mesh.position);
      world.scene.add(edges);
      blocks.push({ mesh, edges, type: bd.type, hp: props.hp, maxHp: props.hp, points: props.points, x: bd.x, y: bd.y, z: bd.z, w, h, d, destroyed: false, falling: false, vy: 0 });
    }
  }

  function checkSurvivalWaveEnd() {
    const allDestroyed = blocks.every(b => b.destroyed);
    if (allDestroyed) {
      survivalTotalScore += score;
      // Bonus shots for clearing wave
      const bonus = 3 + Math.floor(survivalWave / 3);
      goToState('waveclear');
      return true;
    }
    return false;
  }

  function updateSurvivalHUD() {
    const doc = getDoc('survival');
    setText(doc, 'surv-wave', `${survivalWave}`);
    setText(doc, 'surv-score', `${Math.floor(score)}`);
    setText(doc, 'surv-shots', `${shotsLeft}`);
    const remaining = blocks.filter(b => !b.destroyed).length;
    setText(doc, 'surv-blocks', `${remaining}`);
  }

  function updateWaveClear() {
    const doc = getDoc('waveclear');
    const bonus = 3 + Math.floor(survivalWave / 3);
    setText(doc, 'wc-title', survivalWave % 5 === 0 ? 'BOSS DEFEATED!' : 'WAVE CLEAR!');
    setText(doc, 'wc-wave', `Wave ${survivalWave} Complete`);
    setText(doc, 'wc-score', `Score: ${Math.floor(survivalTotalScore + score)}`);
    setText(doc, 'wc-bonus', `Bonus Shots: +${bonus}`);
    setBtn(doc, 'btn-next-wave', () => {
      audio.play('select');
      const bonusShots = 3 + Math.floor(survivalWave / 3);
      survivalTotalScore += score;
      survivalWave++;
      shotsLeft += bonusShots;
      score = 0;
      combo = 0;
      maxCombo = 0;
      blocksDestroyed = 0;
      shotsFired = 0;
      cannonYaw = 0;
      cannonPitch = 0.3;
      chargePower = 0;
      charging = false;
      cleanupProjectiles();
      randomizeWind();
      spawnSurvivalWave(survivalWave);
      goToState('countdown');
    });
    setBtn(doc, 'btn-surv-menu', () => {
      audio.play('select');
      audio.stopMusic();
      if (survivalTotalScore + score > save.survivalBestScore) save.survivalBestScore = survivalTotalScore + score;
      if (survivalWave > save.survivalBestWave) save.survivalBestWave = survivalWave;
      persist();
      goToState('title');
    });
  }

  // ─── UI Update Functions ─────────────────────────────────────

  function updateHUD() {
    const doc = getDoc('hud');
    const modeNames: Record<string, string> = { campaign: 'CAMPAIGN', arcade: 'ARCADE', freeplay: 'FREE PLAY', timeattack: 'TIME ATTACK', daily: 'DAILY', survival: 'SURVIVAL' };
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

    // Wind indicator
    updateWindDisplay();
    // Survival HUD
    if (mode === 'survival') updateSurvivalHUD();
  }

  function updateWindDisplay() {
    const wdoc = getDoc('wind');
    if (!wdoc) return;
    const arrows = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘'];
    const angle = Math.atan2(-windZ, windX);
    const idx = Math.round(((angle + Math.PI) / (Math.PI * 2)) * 8) % 8;
    setText(wdoc, 'wind-dir', arrows[idx]);
    setText(wdoc, 'wind-speed', `${windStrength.toFixed(1)} m/s`);
  }

  function updateLevelSelect() {
    const doc = getDoc('levelselect');
    if (!doc) return;
    const zoneNames = ['ZONE 1: NEON GRID', 'ZONE 2: CRIMSON FORGE', 'ZONE 3: CYAN CIRCUIT', 'ZONE 4: GOLD NEXUS', 'ZONE 5: VOID MATRIX', 'ZONE 6: PLASMA DEPTHS', 'ZONE 7: EMERALD LATTICE', 'ZONE 8: QUANTUM STORM', 'ZONE 9: OMEGA'];
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
    setBtn(doc, 'btn-next-zone', () => { if (levelZone < 8) { levelZone++; audio.play('select'); updateLevelSelect(); } });
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
    setText(doc, 'stat-level', `LV ${save.level}${save.prestige > 0 ? ` P${save.prestige}` : ''}`);
    setText(doc, 'stat-xp', `${save.xp}/${XP_PER_LEVEL * save.level}`);
    setText(doc, 'stat-score', `${save.totalScore}`);
    // Survival stats shown in existing fields if available
    setBtn(doc, 'btn-back', () => { audio.play('select'); goToState('title'); });
  }

  // ─── Achievements ────────────────────────────────────────────

  const ACHIEVEMENTS: Achievement[] = [
    // Original achievements (30)
    { id: 'first_shot', name: 'FIRST SHOT', desc: 'Fire your first cannonball', icon: '🎯', check: () => save.totalShots >= 1 },
    { id: 'demolition', name: 'DEMOLITION', desc: 'Destroy 10 blocks', icon: '💥', check: () => save.totalBlocks >= 10 },
    { id: 'wrecking_ball', name: 'WRECKING BALL', desc: 'Destroy 100 blocks', icon: '🔨', check: () => save.totalBlocks >= 100 },
    { id: 'destroyer', name: 'DESTROYER', desc: 'Destroy 500 blocks', icon: '💣', check: () => save.totalBlocks >= 500 },
    { id: 'sharpshooter', name: 'SHARPSHOOTER', desc: 'Get 3 stars on any level', icon: '⭐', check: () => save.levelStars.some(s => s === 3) },
    { id: 'perfectionist', name: 'PERFECTIONIST', desc: 'Get 3 stars on 5 levels', icon: '🌟', check: () => save.levelStars.filter(s => s === 3).length >= 5 },
    { id: 'zone_clear_1', name: 'GRID MASTER', desc: 'Clear Zone 1', icon: '🏅', check: () => save.levelStars.slice(0, 6).every(s => s > 0) },
    { id: 'zone_clear_2', name: 'FORGE MASTER', desc: 'Clear Zone 2', icon: '🏅', check: () => save.levelStars.slice(6, 12).every(s => s > 0) },
    { id: 'zone_clear_3', name: 'CIRCUIT MASTER', desc: 'Clear Zone 3', icon: '🏅', check: () => save.levelStars.slice(12, 18).every(s => s > 0) },
    { id: 'zone_clear_4', name: 'NEXUS MASTER', desc: 'Clear Zone 4', icon: '🏅', check: () => save.levelStars.slice(18, 24).every(s => s > 0) },
    { id: 'zone_clear_5', name: 'VOID MASTER', desc: 'Clear Zone 5', icon: '🏅', check: () => save.levelStars.slice(24, 30).every(s => s > 0) },
    { id: 'combo_3', name: 'TRIPLE THREAT', desc: 'Get a 3x combo', icon: '🔥', check: () => save.bestCombo >= 3 },
    { id: 'combo_5', name: 'COMBO KING', desc: 'Get a 5x combo', icon: '🔥', check: () => save.bestCombo >= 5 },
    { id: 'combo_10', name: 'CHAIN MASTER', desc: 'Get a 10x combo', icon: '⚡', check: () => save.bestCombo >= 10 },
    { id: 'highscore_1k', name: 'SCOREKEEPER', desc: 'Score 1,000 in a level', icon: '📊', check: () => save.highScore >= 1000 },
    { id: 'highscore_5k', name: 'HIGH ROLLER', desc: 'Score 5,000 in a level', icon: '📊', check: () => save.highScore >= 5000 },
    { id: 'highscore_10k', name: 'LEGENDARY', desc: 'Score 10,000 in a level', icon: '👑', check: () => save.highScore >= 10000 },
    { id: 'games_10', name: 'REGULAR', desc: 'Play 10 games', icon: '🎮', check: () => save.gamesPlayed >= 10 },
    { id: 'games_50', name: 'VETERAN', desc: 'Play 50 games', icon: '🎖️', check: () => save.gamesPlayed >= 50 },
    { id: 'all_clear_30', name: 'CONQUEROR', desc: 'Clear first 30 levels', icon: '🏆', check: () => save.levelStars.slice(0, 30).filter(s => s > 0).length >= 30 },
    { id: 'ammo_fireball', name: 'PYRO', desc: 'Unlock Fireball ammo', icon: '🔥', check: () => save.unlockedAmmo.includes(1) },
    { id: 'ammo_bouncer', name: 'RICOCHET', desc: 'Unlock Bouncer ammo', icon: '🏀', check: () => save.unlockedAmmo.includes(2) },
    { id: 'ammo_cluster', name: 'CLUSTER BOMB', desc: 'Unlock Cluster ammo', icon: '💠', check: () => save.unlockedAmmo.includes(3) },
    { id: 'ammo_heavy', name: 'BIG GUNS', desc: 'Unlock Heavy Shot', icon: '🎳', check: () => save.unlockedAmmo.includes(4) },
    { id: 'full_stars_z1', name: 'PERFECT GRID', desc: '3 stars on all Zone 1', icon: '✨', check: () => save.levelStars.slice(0, 6).every(s => s === 3) },
    { id: 'shots_100', name: 'CENTURION', desc: 'Fire 100 shots total', icon: '💫', check: () => save.totalShots >= 100 },
    { id: 'shots_500', name: 'ARTILLERY', desc: 'Fire 500 shots total', icon: '🎆', check: () => save.totalShots >= 500 },
    { id: 'blocks_1000', name: 'OBLITERATOR', desc: 'Destroy 1,000 blocks', icon: '☄️', check: () => save.totalBlocks >= 1000 },
    { id: 'score_10k', name: 'SCORE HUNTER', desc: 'Earn 10,000 total score', icon: '💰', check: () => save.totalScore >= 10000 },
    { id: 'final_boss_30', name: 'FINAL BOSS', desc: 'Beat level 30', icon: '🏴', check: () => (save.levelStars[29] || 0) > 0 },
    // New achievements (32 more = 62 total)
    { id: 'zone_clear_6', name: 'PLASMA MASTER', desc: 'Clear Zone 6', icon: '🏅', check: () => save.levelStars.slice(30, 36).every(s => s > 0) },
    { id: 'zone_clear_7', name: 'LATTICE MASTER', desc: 'Clear Zone 7', icon: '🏅', check: () => save.levelStars.slice(36, 42).every(s => s > 0) },
    { id: 'zone_clear_8', name: 'STORM MASTER', desc: 'Clear Zone 8', icon: '🏅', check: () => save.levelStars.slice(42, 48).every(s => s > 0) },
    { id: 'zone_clear_9', name: 'OMEGA MASTER', desc: 'Clear Omega Zone', icon: '👑', check: () => save.levelStars.slice(48, 54).every(s => s > 0) },
    { id: 'all_clear_54', name: 'GRAND CHAMPION', desc: 'Clear all 54 levels', icon: '🏆', check: () => save.levelStars.filter(s => s > 0).length >= 54 },
    { id: 'all_perfect', name: 'ABSOLUTE PERFECTION', desc: '3 stars on all 54 levels', icon: '💎', check: () => save.levelStars.every(s => s === 3) },
    { id: 'ammo_laser', name: 'BEAM RIDER', desc: 'Unlock Laser ammo', icon: '🔫', check: () => save.unlockedAmmo.includes(5) },
    { id: 'ammo_gravity', name: 'SINGULARITY', desc: 'Unlock Gravity Bomb', icon: '🕳️', check: () => save.unlockedAmmo.includes(6) },
    { id: 'ammo_lightning', name: 'THUNDER GOD', desc: 'Unlock Lightning ammo', icon: '⚡', check: () => save.unlockedAmmo.includes(7) },
    { id: 'combo_15', name: 'UNSTOPPABLE', desc: 'Get a 15x combo', icon: '🔥', check: () => save.bestCombo >= 15 },
    { id: 'combo_20', name: 'CHAIN REACTION', desc: 'Get a 20x combo', icon: '⚡', check: () => save.bestCombo >= 20 },
    { id: 'highscore_25k', name: 'SCORE LORD', desc: 'Score 25,000 in a level', icon: '👑', check: () => save.highScore >= 25000 },
    { id: 'highscore_50k', name: 'TRANSCENDENT', desc: 'Score 50,000 in a level', icon: '✨', check: () => save.highScore >= 50000 },
    { id: 'score_50k', name: 'FORTUNE', desc: 'Earn 50,000 total score', icon: '💰', check: () => save.totalScore >= 50000 },
    { id: 'score_100k', name: 'MOGUL', desc: 'Earn 100,000 total score', icon: '💎', check: () => save.totalScore >= 100000 },
    { id: 'games_100', name: 'DEDICATED', desc: 'Play 100 games', icon: '🏆', check: () => save.gamesPlayed >= 100 },
    { id: 'shots_1000', name: 'GUNNER', desc: 'Fire 1,000 shots', icon: '💥', check: () => save.totalShots >= 1000 },
    { id: 'blocks_5000', name: 'ANNIHILATOR', desc: 'Destroy 5,000 blocks', icon: '☄️', check: () => save.totalBlocks >= 5000 },
    { id: 'xp_level_10', name: 'RISING STAR', desc: 'Reach level 10', icon: '⬆️', check: () => save.level >= 10 || save.prestige > 0 },
    { id: 'xp_level_25', name: 'VETERAN CANNON', desc: 'Reach level 25', icon: '⬆️', check: () => save.level >= 25 || save.prestige > 0 },
    { id: 'xp_level_50', name: 'ELITE', desc: 'Reach level 50', icon: '💫', check: () => save.level >= 50 || save.prestige > 0 },
    { id: 'prestige_1', name: 'PRESTIGE I', desc: 'Prestige once', icon: '🌀', check: () => save.prestige >= 1 },
    { id: 'prestige_3', name: 'PRESTIGE III', desc: 'Prestige three times', icon: '🌀', check: () => save.prestige >= 3 },
    { id: 'skin_chrome', name: 'SILVER CANNON', desc: 'Unlock Chrome skin', icon: '🔧', check: () => save.unlockedSkins.includes(1) },
    { id: 'skin_gold', name: 'GOLDEN CANNON', desc: 'Unlock Gold skin', icon: '🥇', check: () => save.unlockedSkins.includes(2) },
    { id: 'skin_plasma', name: 'PLASMA CANNON', desc: 'Unlock Plasma skin', icon: '🟣', check: () => save.unlockedSkins.includes(3) },
    { id: 'skin_rainbow', name: 'RAINBOW CANNON', desc: 'Unlock Rainbow skin', icon: '🌈', check: () => save.unlockedSkins.includes(4) },
    { id: 'perfect_10', name: 'PERFECT TEN', desc: '3 stars on 10 levels', icon: '⭐', check: () => save.levelStars.filter(s => s === 3).length >= 10 },
    { id: 'perfect_30', name: 'STAR COLLECTOR', desc: '3 stars on 30 levels', icon: '⭐', check: () => save.levelStars.filter(s => s === 3).length >= 30 },
    { id: 'full_stars_z2', name: 'PERFECT FORGE', desc: '3 stars on all Zone 2', icon: '✨', check: () => save.levelStars.slice(6, 12).every(s => s === 3) },
    { id: 'full_stars_z3', name: 'PERFECT CIRCUIT', desc: '3 stars on all Zone 3', icon: '✨', check: () => save.levelStars.slice(12, 18).every(s => s === 3) },
    { id: 'boss_slayer', name: 'BOSS SLAYER', desc: 'Beat all 3 boss levels', icon: '🗡️', check: () => (save.levelStars[35] || 0) > 0 && (save.levelStars[41] || 0) > 0 && (save.levelStars[47] || 0) > 0 },
    // Survival mode achievements (20 more = 82 total)
    { id: 'survival_start', name: 'SURVIVOR', desc: 'Play Survival mode', icon: '💀', check: () => save.survivalBestWave >= 1 },
    { id: 'survival_w3', name: 'WAVE RIDER', desc: 'Reach wave 3 in Survival', icon: '🌊', check: () => save.survivalBestWave >= 3 },
    { id: 'survival_w5', name: 'IRON WILL', desc: 'Reach wave 5 in Survival', icon: '🛡️', check: () => save.survivalBestWave >= 5 },
    { id: 'survival_w10', name: 'ENDURANCE', desc: 'Reach wave 10 in Survival', icon: '⚔️', check: () => save.survivalBestWave >= 10 },
    { id: 'survival_w15', name: 'UNSTOPPABLE FORCE', desc: 'Reach wave 15 in Survival', icon: '💪', check: () => save.survivalBestWave >= 15 },
    { id: 'survival_w20', name: 'LEGENDARY SURVIVOR', desc: 'Reach wave 20 in Survival', icon: '👑', check: () => save.survivalBestWave >= 20 },
    { id: 'survival_1k', name: 'SURVIVOR SCORE', desc: 'Score 1,000 in Survival', icon: '📊', check: () => save.survivalBestScore >= 1000 },
    { id: 'survival_5k', name: 'SURVIVOR ELITE', desc: 'Score 5,000 in Survival', icon: '📊', check: () => save.survivalBestScore >= 5000 },
    { id: 'survival_10k', name: 'SURVIVAL LEGEND', desc: 'Score 10,000 in Survival', icon: '🏆', check: () => save.survivalBestScore >= 10000 },
    { id: 'survival_boss', name: 'BOSS HUNTER', desc: 'Beat a Survival boss wave', icon: '🗡️', check: () => save.survivalBestWave >= 6 },
    // Wind mastery achievements
    { id: 'wind_master', name: 'WIND DANCER', desc: 'Get 3 stars with wind active', icon: '💨', check: () => save.levelStars.filter(s => s === 3).length >= 1 },
    // Extended milestones (20 more = 102 total)
    { id: 'blocks_10000', name: 'EXTINCTION EVENT', desc: 'Destroy 10,000 blocks', icon: '☄️', check: () => save.totalBlocks >= 10000 },
    { id: 'shots_2500', name: 'BOMBARDIER', desc: 'Fire 2,500 shots', icon: '🎆', check: () => save.totalShots >= 2500 },
    { id: 'shots_5000', name: 'SIEGE MASTER', desc: 'Fire 5,000 shots', icon: '🏰', check: () => save.totalShots >= 5000 },
    { id: 'score_250k', name: 'QUARTER MILLION', desc: 'Earn 250,000 total score', icon: '💰', check: () => save.totalScore >= 250000 },
    { id: 'score_500k', name: 'HALF MILLION', desc: 'Earn 500,000 total score', icon: '💰', check: () => save.totalScore >= 500000 },
    { id: 'score_1m', name: 'MILLIONAIRE', desc: 'Earn 1,000,000 total score', icon: '👑', check: () => save.totalScore >= 1000000 },
    { id: 'games_200', name: 'OBSESSED', desc: 'Play 200 games', icon: '🎮', check: () => save.gamesPlayed >= 200 },
    { id: 'games_500', name: 'ADDICTED', desc: 'Play 500 games', icon: '🤩', check: () => save.gamesPlayed >= 500 },
    { id: 'prestige_5', name: 'PRESTIGE V', desc: 'Prestige five times', icon: '🌀', check: () => save.prestige >= 5 },
    { id: 'prestige_10', name: 'PRESTIGE X', desc: 'Prestige ten times', icon: '🔥', check: () => save.prestige >= 10 },
    { id: 'combo_30', name: 'NUCLEAR CHAIN', desc: 'Get a 30x combo', icon: '☢️', check: () => save.bestCombo >= 30 },
    { id: 'combo_50', name: 'INFINITE COMBO', desc: 'Get a 50x combo', icon: '♾️', check: () => save.bestCombo >= 50 },
    { id: 'perfect_50', name: 'STAR MASTER', desc: '3 stars on 50 levels', icon: '⭐', check: () => save.levelStars.filter(s => s === 3).length >= 50 },
    { id: 'highscore_100k', name: 'GOD MODE', desc: 'Score 100,000 in a level', icon: '✨', check: () => save.highScore >= 100000 },
    { id: 'full_stars_z4', name: 'PERFECT NEXUS', desc: '3 stars on all Zone 4', icon: '✨', check: () => save.levelStars.slice(18, 24).every(s => s === 3) },
    { id: 'full_stars_z5', name: 'PERFECT VOID', desc: '3 stars on all Zone 5', icon: '✨', check: () => save.levelStars.slice(24, 30).every(s => s === 3) },
    { id: 'full_stars_z6', name: 'PERFECT PLASMA', desc: '3 stars on all Zone 6', icon: '✨', check: () => save.levelStars.slice(30, 36).every(s => s === 3) },
    { id: 'full_stars_z7', name: 'PERFECT LATTICE', desc: '3 stars on all Zone 7', icon: '✨', check: () => save.levelStars.slice(36, 42).every(s => s === 3) },
    { id: 'full_stars_z8', name: 'PERFECT STORM', desc: '3 stars on all Zone 8', icon: '✨', check: () => save.levelStars.slice(42, 48).every(s => s === 3) },
    { id: 'full_stars_z9', name: 'PERFECT OMEGA', desc: '3 stars on all Omega', icon: '💎', check: () => save.levelStars.slice(48, 54).every(s => s === 3) },
    { id: 'all_ammo', name: 'FULL ARSENAL', desc: 'Unlock all 8 ammo types', icon: '🎯', check: () => save.unlockedAmmo.length >= 8 },
    { id: 'all_skins', name: 'FASHIONISTA', desc: 'Unlock all cannon skins', icon: '🎨', check: () => save.unlockedSkins.length >= 5 },
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
    setBtn(doc, 'btn-survival', () => { audio.play('select'); mode = 'survival'; startSurvivalMode(); });
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

  const _origWorldUpdate = world.update.bind(world);
  (world as any).update = (delta: number, time: number) => {
    _origWorldUpdate(delta, time);
    gameUpdate(delta);
  };

  function gameUpdate(rawDt: number) {
    // Slow-motion effect
    if (slowMoTimer > 0) {
      slowMoTimer -= rawDt;
      if (slowMoTimer <= 0) slowMoFactor = 1;
    }
    const dt = rawDt * slowMoFactor;

    // Wire panels once docs are ready
    if (!titleWired) titleWired = wireTitle();
    if (!modeWired) modeWired = wireModeSelect();
    if (!pauseWired) pauseWired = wirePause();
    if (!helpWired) helpWired = wireHelp();

    particles.update(dt);
    updateShake(dt);

    // Muzzle flash decay
    if (muzzleFlashTimer > 0) {
      muzzleFlashTimer -= rawDt;
      const flashOpacity = Math.max(0, muzzleFlashTimer / 0.15) * 0.9;
      (muzzleFlashMesh.material as MeshBasicMaterial).opacity = flashOpacity;
      if (muzzleFlashTimer <= 0) {
        (muzzleFlashMesh.material as MeshBasicMaterial).opacity = 0;
      }
    }

    // Wind system update
    windChangeTimer -= rawDt;
    if (windChangeTimer <= 0) randomizeWind();

    // Multiplier timer
    if (multiplierTimer > 0) {
      multiplierTimer -= dt;
      if (multiplierTimer <= 0) { scoreMultiplier = 1; }
    }

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
    const kb = (world.input as any).keyboard;

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

      // Ammo selection keys (1-8)
      for (let i = 1; i <= 8; i++) {
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
  }
}

main().catch(console.error);
