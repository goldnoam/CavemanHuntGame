
export enum GameState {
  START = 'START',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY'
}

export enum GameMode {
  STORY = 'STORY',
  BOSS_RUSH = 'BOSS_RUSH'
}

export type EntityType = 'player' | 'mammoth' | 'trex' | 'tiger' | 'sabertooth' | 'rhino' | 'raptor' | 'scorpion' | 'pterodactyl' | 'club_hitbox' | 'powerup' | 'hazard' | 'artifact' | 'food';
export type PowerUpType = 'speed' | 'strength' | 'poison';

export interface ActiveEffect {
  type: PowerUpType;
  timeLeft: number;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  type: EntityType;
  hp: number;
  maxHp: number;
  facing: 1 | -1; // 1 right, -1 left
  isAttacking?: boolean;
  attackCooldown?: number;
  sprite: string;
  // Power-up specific
  powerUpType?: PowerUpType;
  activeEffects?: ActiveEffect[];
  // Combat mechanics
  isBlocking?: boolean;
  parryTimer?: number;    // How long the parry window is active
  parryCooldown?: number; // Time until next parry allowed
  stunTimer?: number;     // How long the entity is stunned
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

export interface NarratorMessage {
  text: string;
  type: 'info' | 'danger' | 'victory' | 'defeat' | 'powerup' | 'parry' | 'score';
}
