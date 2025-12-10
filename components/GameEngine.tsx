import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, GameMode, Entity, Particle, NarratorMessage } from '../types';
import { 
  GRAVITY, FRICTION, JUMP_FORCE, FLOOR_Y, 
  CANVAS_WIDTH, CANVAS_HEIGHT, PLAYER_WIDTH, PLAYER_HEIGHT,
  SPRITE_PLAYER, SPRITE_MAMMOTH, SPRITE_TREX, SPRITE_TIGER, SPRITE_SABERTOOTH, SPRITE_RHINO, SPRITE_RAPTOR, 
  SPRITE_SCORPION, SPRITE_PTERODACTYL, SPRITE_CLUB,
  SPRITE_POWERUP_SPEED, SPRITE_POWERUP_STRENGTH, SPRITE_SHIELD, SPRITE_STUNNED, SPRITE_ROCK, SPRITE_POISON,
  SPRITE_ARTIFACT, SPRITE_FOOD,
  PARRY_DURATION, PARRY_COOLDOWN, STUN_DURATION, ARENA_START_X,
  SCORE_KILL_SMALL, SCORE_KILL_MEDIUM, SCORE_KILL_LARGE, SCORE_ARTIFACT, SCORE_FOOD, SCORE_MAMMOTH
} from '../constants';
import { generateNarration } from '../services/narratorService';

interface GameEngineProps {
  gameState: GameState;
  gameMode: GameMode;
  setGameState: (state: GameState) => void;
  setNarratorMessage: (msg: NarratorMessage) => void;
}

const GameEngine: React.FC<GameEngineProps> = ({ gameState, gameMode, setGameState, setNarratorMessage }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  
  // Audio
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false); // Ref for sync access in game loop
  
  // Game Logic State
  const [score, setScore] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  // Mutable Game State
  const playerRef = useRef<Entity>({
    id: 'p1', x: 50, y: FLOOR_Y - PLAYER_HEIGHT, width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
    vx: 0, vy: 0, type: 'player', hp: 5, maxHp: 5, facing: 1, sprite: SPRITE_PLAYER, 
    attackCooldown: 0, activeEffects: [], parryTimer: 0, parryCooldown: 0
  });
  
  const enemiesRef = useRef<Entity[]>([]);
  const hazardsRef = useRef<Entity[]>([]);
  const collectiblesRef = useRef<Entity[]>([]); // Merged powerups and new items
  const particlesRef = useRef<Particle[]>([]);
  const cameraXRef = useRef(0);
  const spawnTimerRef = useRef(0);
  const hazardTimerRef = useRef(0);
  const screenShakeRef = useRef(0);
  const parryFlashRef = useRef(0);

  // Boss Rush State
  const bossRushWaveRef = useRef(0);
  const bossRushDelayTimerRef = useRef(0);
  
  // Input State
  const keys = useRef<{ [key: string]: boolean }>({});

  // Sync state with ref
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Sound Engine
  const playSound = useCallback((type: 'jump' | 'attack' | 'hit' | 'block' | 'powerup' | 'damage' | 'victory' | 'collect' | 'poison') => {
    if (isMutedRef.current) return;

    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    switch (type) {
      case 'jump':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'attack':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
        break;
      case 'hit':
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'damage':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(100, now);
        osc.frequency.linearRampToValueAtTime(20, now + 0.3);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'poison':
        osc.type = 'square';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.linearRampToValueAtTime(300, now + 0.2);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.2);
        osc.start(now);
        osc.stop(now + 0.2);
        break;
      case 'block':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.setValueAtTime(1200, now + 0.05);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'powerup':
        osc.type = 'sine';
        gain.gain.value = 0.1;
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.1); // C#
        osc.frequency.setValueAtTime(659, now + 0.2); // E
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
        break;
      case 'collect':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(1800, now + 0.1);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
      case 'victory':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554, now + 0.2);
        osc.frequency.setValueAtTime(659, now + 0.4);
        osc.frequency.setValueAtTime(880, now + 0.6);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.linearRampToValueAtTime(0, now + 2);
        osc.start(now);
        osc.stop(now + 2);
        break;
    }
  }, []);

  const initGame = useCallback(() => {
    setScore(0);
    setIsPaused(false);
    
    // Reset Player
    playerRef.current = {
      id: 'p1', x: 50, y: FLOOR_Y - PLAYER_HEIGHT, width: PLAYER_WIDTH, height: PLAYER_HEIGHT,
      vx: 0, vy: 0, type: 'player', hp: 5, maxHp: 5, facing: 1, sprite: SPRITE_PLAYER, 
      attackCooldown: 0, activeEffects: [], parryTimer: 0, parryCooldown: 0
    };
    
    hazardsRef.current = [];
    particlesRef.current = [];
    cameraXRef.current = 0;
    spawnTimerRef.current = 0;
    hazardTimerRef.current = 0;
    screenShakeRef.current = 0;
    parryFlashRef.current = 0;
    keys.current = {}; 
    bossRushWaveRef.current = 0;
    bossRushDelayTimerRef.current = 0;

    if (gameMode === GameMode.STORY) {
        // Standard Story Mode Initialization
        enemiesRef.current = [
          { id: 'rap1', x: 500, y: FLOOR_Y - 50, width: 50, height: 50, vx: 0, vy: 0, type: 'raptor', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_RAPTOR, stunTimer: 0 },
          { id: 'sc1', x: 700, y: FLOOR_Y - 40, width: 60, height: 40, vx: 0, vy: 0, type: 'scorpion', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_SCORPION, stunTimer: 0 },
          { id: 'rh1', x: 900, y: FLOOR_Y - 70, width: 90, height: 60, vx: 0, vy: 0, type: 'rhino', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_RHINO, stunTimer: 0 },
          { id: 's1', x: 1300, y: FLOOR_Y - 80, width: 90, height: 80, vx: 0, vy: 0, type: 'sabertooth', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_SABERTOOTH, stunTimer: 0 },
          { id: 'pt1', x: 1500, y: FLOOR_Y - 250, width: 70, height: 50, vx: 0, vy: 0, type: 'pterodactyl', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_PTERODACTYL, stunTimer: 0 },
          { id: 'rap2', x: 1700, y: FLOOR_Y - 50, width: 50, height: 50, vx: 0, vy: 0, type: 'raptor', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_RAPTOR, stunTimer: 0 },
          { id: 't1', x: 1900, y: FLOOR_Y - 70, width: 80, height: 70, vx: 0, vy: 0, type: 'tiger', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_TIGER, stunTimer: 0 },
          { id: 'rh2', x: 2300, y: FLOOR_Y - 70, width: 90, height: 60, vx: 0, vy: 0, type: 'rhino', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_RHINO, stunTimer: 0 },
          { id: 'r1', x: 2500, y: FLOOR_Y - 100, width: 100, height: 100, vx: 0, vy: 0, type: 'trex', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_TREX, stunTimer: 0 },
          { id: 'm1', x: 3000, y: FLOOR_Y - 120, width: 150, height: 120, vx: 0, vy: 0, type: 'mammoth', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_MAMMOTH, stunTimer: 0 }
        ];

        collectiblesRef.current = [
          { id: 'pu1', x: 750, y: FLOOR_Y - 50, width: 40, height: 40, vx: 0, vy: 0, type: 'powerup', powerUpType: 'speed', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_POWERUP_SPEED },
          { id: 'pu2', x: 2100, y: FLOOR_Y - 50, width: 40, height: 40, vx: 0, vy: 0, type: 'powerup', powerUpType: 'strength', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_POWERUP_STRENGTH },
          { id: 'art1', x: 1400, y: FLOOR_Y - 40, width: 40, height: 40, vx: 0, vy: 0, type: 'artifact', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_ARTIFACT },
        ];
    } else {
        // Boss Rush Initialization
        enemiesRef.current = [];
        collectiblesRef.current = [];
        // Give player a starter pack for boss rush
        playerRef.current.hp = 8; // More HP for boss rush
        playerRef.current.maxHp = 8;
        playerRef.current.x = 200; // Start slightly in
        
        // Spawn Wave 1 immediately handled in update
    }

  }, [gameMode]);

  useEffect(() => {
    // Reset game when switching to PLAYING (Start or Restart)
    if (gameState === GameState.START || gameState === GameState.PLAYING) {
      initGame();
    }
  }, [gameState, initGame]);

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        id: Math.random().toString(),
        x, y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.0,
        color,
        size: Math.random() * 5 + 2
      });
    }
  }, []);

  const checkCollision = (r1: Entity, r2: Entity) => {
    return (
      r1.x < r2.x + r2.width &&
      r1.x + r1.width > r2.x &&
      r1.y < r2.y + r2.height &&
      r1.y + r1.height > r2.y
    );
  };

  const handleInput = useCallback(() => {
    const player = playerRef.current;
    
    // Check Active Effects
    const hasSpeed = player.activeEffects?.some(e => e.type === 'speed');
    const speedMultiplier = hasSpeed ? 1.8 : 1.0;

    // Movement (Arrow Keys + WASD)
    const isRight = keys.current['ArrowRight'] || keys.current['d'] || keys.current['D'];
    const isLeft = keys.current['ArrowLeft'] || keys.current['a'] || keys.current['A'];
    const isJump = keys.current['ArrowUp'] || keys.current['w'] || keys.current['W'];
    const isBlock = keys.current['ArrowDown'] || keys.current['s'] || keys.current['S'];

    if (isRight) {
      player.vx += 1 * speedMultiplier;
      player.facing = 1;
    }
    if (isLeft) {
      player.vx -= 1 * speedMultiplier;
      player.facing = -1;
    }

    // Jump
    if (isJump && Math.abs(player.vy) < 0.1 && player.y + player.height >= FLOOR_Y - 1) {
      player.vy = JUMP_FORCE;
      playSound('jump');
    }

    // Parry / Block
    if (isBlock && (player.parryCooldown || 0) <= 0 && (player.parryTimer || 0) <= 0) {
        player.isBlocking = true;
        player.parryTimer = PARRY_DURATION;
        player.parryCooldown = PARRY_COOLDOWN;
    }

    // Attack
    // Added Enter as attack key
    const isAttack = keys.current[' '] || keys.current['Enter'];

    if (isAttack && (player.attackCooldown || 0) <= 0 && !player.isBlocking) {
      player.isAttacking = true;
      player.attackCooldown = hasSpeed ? 10 : 20;
      playSound('attack');
      
      // Attack Hitbox logic immediately
      const attackRange = 80;
      const hitX = player.facing === 1 ? player.x + player.width : player.x - attackRange;
      const hitBox = { ...player, x: hitX, width: attackRange };

      const hasStrength = player.activeEffects?.some(e => e.type === 'strength');
      const damage = hasStrength ? 3 : 1;

      enemiesRef.current.forEach(enemy => {
        if (checkCollision(hitBox, enemy)) {
          enemy.hp -= damage;
          enemy.vx = player.facing * (hasStrength ? 15 : 10); // Knockback
          enemy.vy = -5;
          playSound('hit');
          spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, '#ff0000', 10);
          
          if (enemy.hp <= 0) {
             let scoreAdd = SCORE_KILL_SMALL;
             if (enemy.type === 'sabertooth' || enemy.type === 'rhino' || enemy.type === 'pterodactyl') scoreAdd = SCORE_KILL_MEDIUM;
             if (enemy.type === 'trex') scoreAdd = SCORE_KILL_LARGE;
             if (enemy.type === 'mammoth') scoreAdd = SCORE_MAMMOTH;
             
             setScore(s => s + scoreAdd);
             
             // Victory condition for Story Mode
             if (gameMode === GameMode.STORY && enemy.type === 'mammoth') {
                playSound('victory');
                setGameState(GameState.VICTORY);
                generateNarration("האדם הקדמון ניצח את הממותה הגדולה בעזרת הנבוט!").then(text => setNarratorMessage({ text, type: 'victory' }));
             } else if (gameMode === GameMode.STORY) {
                spawnParticles(enemy.x, enemy.y, '#555', 20);
             } else {
                 // Boss Rush Death FX
                 spawnParticles(enemy.x, enemy.y, '#555', 40);
             }
          } else {
             // If enemy survives, briefly interrupt them if they aren't boss
             if (enemy.type !== 'mammoth') enemy.vx += player.facing * 5;
          }
        }
      });
    }
  }, [gameMode, playSound, setGameState, setNarratorMessage, spawnParticles]);

  const triggerGameOver = useCallback(() => {
    setGameState(GameState.GAME_OVER);
    generateNarration("האדם הקדמון נרמס על ידי חיות פרא. עצוב מאוד.").then(text => setNarratorMessage({ text, type: 'defeat' }));
  }, [setGameState, setNarratorMessage]);

  const collectItem = useCallback((item: Entity) => {
    const player = playerRef.current;
    
    if (item.type === 'powerup') {
        const duration = 600; // 10 seconds at 60fps
        // Add effect
        if (!player.activeEffects) player.activeEffects = [];
        // Remove existing of same type to refresh
        player.activeEffects = player.activeEffects.filter(e => e.type !== item.powerUpType);
        player.activeEffects.push({ type: item.powerUpType!, timeLeft: duration });
        
        playSound('powerup');
        spawnParticles(player.x, player.y, item.powerUpType === 'speed' ? '#FFFF00' : '#FF5555', 20);
        
        if (item.powerUpType === 'speed') {
            setNarratorMessage({ text: "כוח הברק! רץ מהר!", type: 'powerup' });
        } else {
            setNarratorMessage({ text: "בשר כוח! נבוט חזק!", type: 'powerup' });
        }
    } else if (item.type === 'artifact') {
        playSound('collect');
        setScore(s => s + SCORE_ARTIFACT);
        spawnParticles(player.x, player.y, '#00FFFF', 20);
        setNarratorMessage({ text: "אוצר קדום! כבוד לשבט!", type: 'score' });
    } else if (item.type === 'food') {
        playSound('collect');
        setScore(s => s + SCORE_FOOD);
        player.hp = Math.min(player.hp + 1, player.maxHp);
        spawnParticles(player.x, player.y, '#00FF00', 15);
        setNarratorMessage({ text: "אוכל טעים! כוח חוזר!", type: 'powerup' });
    }
  }, [playSound, setNarratorMessage, spawnParticles]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    ctx.save();
    
    // Screen Shake
    if (screenShakeRef.current > 0) {
        const dx = (Math.random() - 0.5) * screenShakeRef.current * 2;
        const dy = (Math.random() - 0.5) * screenShakeRef.current * 2;
        ctx.translate(dx, dy);
    }

    // Dynamic Background
    const arenaTransitionStart = ARENA_START_X - 400;
    const transitionProgress = gameMode === GameMode.BOSS_RUSH ? 1 : Math.min(1, Math.max(0, (cameraXRef.current - arenaTransitionStart) / 400));
    
    const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    if (transitionProgress === 0) {
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#E0F7FA');
    } else {
        if (transitionProgress < 1) {
            gradient.addColorStop(0, `rgb(${135 - 100*transitionProgress}, ${206 - 180*transitionProgress}, ${235 - 200*transitionProgress})`);
            gradient.addColorStop(1, `rgb(${224 - 100*transitionProgress}, ${247 - 200*transitionProgress}, ${250 - 200*transitionProgress})`);
        } else {
            gradient.addColorStop(0, '#2d1b2e');
            gradient.addColorStop(1, '#5c1e1e');
        }
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Camera Transform
    ctx.translate(-cameraXRef.current, 0);

    // Draw Floor
    if (gameMode === GameMode.BOSS_RUSH) {
        ctx.fillStyle = '#222222';
        ctx.fillRect(0, FLOOR_Y, 2000, CANVAS_HEIGHT - FLOOR_Y);
        ctx.fillStyle = '#441111';
        ctx.fillRect(0, FLOOR_Y, 2000, 20);
        // Boss Rush decor
        ctx.font = '100px Arial';
        ctx.fillText('🌋', 100, FLOOR_Y);
        ctx.fillText('☠️', 400, FLOOR_Y);
        ctx.fillText('🌋', 700, FLOOR_Y);
    } else {
        ctx.fillStyle = '#5D4037';
        ctx.fillRect(0, FLOOR_Y, ARENA_START_X, CANVAS_HEIGHT - FLOOR_Y);
        ctx.fillStyle = '#388E3C';
        ctx.fillRect(0, FLOOR_Y, ARENA_START_X, 20);

        ctx.fillStyle = '#222222';
        ctx.fillRect(ARENA_START_X, FLOOR_Y, 4000, CANVAS_HEIGHT - FLOOR_Y);
        ctx.fillStyle = '#441111';
        ctx.fillRect(ARENA_START_X, FLOOR_Y, 4000, 20);

        // Draw Decor
        ctx.font = '100px Arial';
        ctx.fillText('🌲', 200, FLOOR_Y);
        ctx.fillText('⛰️', 800, FLOOR_Y);
        ctx.fillText('🌋', 1500, FLOOR_Y);
        ctx.fillText('🦴', 2200, FLOOR_Y);
        
        ctx.fillText('🌋', 2700, FLOOR_Y);
        ctx.fillText('☠️', 3200, FLOOR_Y);
        ctx.fillText('🌋', 3500, FLOOR_Y);
    }

    // Draw Entities
    const drawEntity = (e: Entity) => {
        ctx.save();
        ctx.translate(e.x + e.width/2, e.y + e.height/2);
        
        if (e.type === 'player' && e.activeEffects?.some(ef => ef.type === 'strength')) {
            ctx.shadowColor = 'red';
            ctx.shadowBlur = 20;
        }
        if (e.type === 'player' && e.activeEffects?.some(ef => ef.type === 'speed')) {
             ctx.shadowColor = 'yellow';
             ctx.shadowBlur = 20;
        }
        if (e.type === 'player' && e.activeEffects?.some(ef => ef.type === 'poison')) {
             ctx.shadowColor = '#8800FF';
             ctx.shadowBlur = 20;
        }
        
        // Mega Mammoth Effect
        if (gameMode === GameMode.BOSS_RUSH && e.type === 'mammoth' && e.maxHp > 8) {
             ctx.shadowColor = '#FF0000';
             ctx.shadowBlur = 30;
             const scale = 1.0 + Math.sin(Date.now() / 200) * 0.05;
             ctx.scale(scale, scale);
        }

        ctx.scale(e.facing, 1);
        
        let yOffset = 0;
        if (e.type === 'powerup' || e.type === 'artifact' || e.type === 'food') {
            yOffset = Math.sin(Date.now() / 200) * 5;
        }

        ctx.font = `${Math.max(e.width, e.height)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.sprite, 0, yOffset);
        
        if (e.stunTimer && e.stunTimer > 0) {
            ctx.font = '40px Arial';
            ctx.fillText(SPRITE_STUNNED, 0, -e.height/2 - 20 + Math.sin(Date.now()/100)*10);
        }

        if (e.type === 'player' && e.isBlocking) {
            ctx.font = '60px Arial';
            ctx.fillText(SPRITE_SHIELD, 30, 0); 
        }

        if (e.type === 'player' && e.isAttacking) {
            ctx.rotate(Math.PI / 4);
            const hasStrength = e.activeEffects?.some(ef => ef.type === 'strength');
            const clubScale = hasStrength ? 1.5 : 1;
            ctx.scale(clubScale, clubScale);
            ctx.fillText(SPRITE_CLUB, 40, -20);
        }
        ctx.restore();

        // Health Bar Logic
        if (e.type !== 'powerup' && e.type !== 'artifact' && e.type !== 'food' && e.type !== 'hazard') {
            const barWidth = e.width;
            const barHeight = 8;
            const barX = e.x;
            const barY = e.y - 15;

            // Background (gray/black container)
            ctx.fillStyle = '#444444'; 
            ctx.fillRect(barX, barY, barWidth, barHeight);

            // Health Color (Green for Player, Red for Enemies)
            const healthColor = e.type === 'player' ? '#22c55e' : '#ef4444'; 
            
            // Draw current health
            const healthWidth = Math.max(0, (e.hp / e.maxHp) * barWidth);
            ctx.fillStyle = healthColor;
            ctx.fillRect(barX, barY, healthWidth, barHeight);
            
            // Border for clarity
            ctx.strokeStyle = '#222';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    };

    collectiblesRef.current.forEach(drawEntity);
    hazardsRef.current.forEach(drawEntity);
    enemiesRef.current.forEach(drawEntity);
    drawEntity(playerRef.current);

    // Draw Particles
    particlesRef.current.forEach(p => {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fillRect(p.x, p.y, p.size, p.size);
        ctx.globalAlpha = 1;
    });

    ctx.restore();

    // Parry Flash Overlay
    if (parryFlashRef.current > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${parryFlashRef.current / 10})`; // Adjusted opacity
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        ctx.fillStyle = 'yellow';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText("BLOCK!", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
    
    // Wave Overlay for Boss Rush
    if (gameMode === GameMode.BOSS_RUSH && bossRushDelayTimerRef.current > 0 && bossRushDelayTimerRef.current < 100) {
         ctx.fillStyle = 'rgba(0,0,0,0.5)';
         ctx.fillRect(0, CANVAS_HEIGHT/2 - 60, CANVAS_WIDTH, 120);
         ctx.fillStyle = '#ff4444';
         ctx.font = 'bold 60px sans-serif';
         ctx.textAlign = 'center';
         ctx.textBaseline = 'middle';
         ctx.fillText(`גל ${bossRushWaveRef.current + 1}`, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    }
  }, [gameMode]);

  const update = useCallback(() => {
    // Loop stop conditions
    if (gameState !== GameState.PLAYING) return;
    if (isPaused) {
        // Even if paused, we draw to keep the screen visible
        draw(); 
        requestRef.current = requestAnimationFrame(update);
        return;
    }

    const player = playerRef.current;
    
    handleInput();

    // Spawn Logic
    if (gameMode === GameMode.STORY) {
        // Dynamic Spawning for Story Mode
        spawnTimerRef.current++;
        if (spawnTimerRef.current > 120 && enemiesRef.current.length < 15) {
            spawnTimerRef.current = 0;
            const playerX = player.x;
            const spawnX = playerX + CANVAS_WIDTH + (Math.random() * 200);
            
            if (spawnX < ARENA_START_X) {
                const rand = Math.random();
                const id = `spawn_${Date.now()}_${Math.random()}`;
                
                if (rand < 0.20) {
                     enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 70, width: 80, height: 70, vx: 0, vy: 0, type: 'tiger', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_TIGER, stunTimer: 0 });
                } else if (rand < 0.40) {
                     enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 80, width: 90, height: 80, vx: 0, vy: 0, type: 'sabertooth', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_SABERTOOTH, stunTimer: 0 });
                } else if (rand < 0.55) {
                    enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 70, width: 90, height: 60, vx: 0, vy: 0, type: 'rhino', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_RHINO, stunTimer: 0 });
                } else if (rand < 0.70) {
                     enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 40, width: 60, height: 40, vx: 0, vy: 0, type: 'scorpion', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_SCORPION, stunTimer: 0 });
                } else if (rand < 0.85) {
                     enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 200 - Math.random() * 100, width: 70, height: 50, vx: 0, vy: 0, type: 'pterodactyl', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_PTERODACTYL, stunTimer: 0 });
                } else {
                     enemiesRef.current.push({ id, x: spawnX, y: FLOOR_Y - 50, width: 50, height: 50, vx: 0, vy: 0, type: 'raptor', hp: 1, maxHp: 1, facing: -1, sprite: SPRITE_RAPTOR, stunTimer: 0 });
                }

                if (Math.random() < 0.3) {
                     const itemRand = Math.random();
                     const itemId = `item_${Date.now()}`;
                     if (itemRand < 0.4) {
                        collectiblesRef.current.push({ id: itemId, x: spawnX + 50, y: FLOOR_Y - 50, width: 40, height: 40, vx: 0, vy: 0, type: 'powerup', powerUpType: 'speed', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_POWERUP_SPEED });
                     } else if (itemRand < 0.7) {
                        collectiblesRef.current.push({ id: itemId, x: spawnX + 80, y: FLOOR_Y - 50, width: 40, height: 40, vx: 0, vy: 0, type: 'powerup', powerUpType: 'strength', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_POWERUP_STRENGTH });
                     } else if (itemRand < 0.9) {
                        collectiblesRef.current.push({ id: itemId, x: spawnX + 100, y: FLOOR_Y - 40, width: 40, height: 40, vx: 0, vy: 0, type: 'food', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_FOOD });
                     } else {
                        collectiblesRef.current.push({ id: itemId, x: spawnX + 100, y: FLOOR_Y - 40, width: 40, height: 40, vx: 0, vy: 0, type: 'artifact', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_ARTIFACT });
                     }
                }
            }
        }
    } else {
        // BOSS RUSH Logic
        if (enemiesRef.current.length === 0) {
            bossRushDelayTimerRef.current++;
            // 2 seconds delay between waves
            if (bossRushDelayTimerRef.current > 120) {
                 bossRushDelayTimerRef.current = 0;
                 bossRushWaveRef.current++;
                 
                 const spawnX = CANVAS_WIDTH - 150; // Spawn on right side of arena
                 const wave = bossRushWaveRef.current;
                 
                 setNarratorMessage({ text: `גל ${wave} מתחיל!`, type: 'info' });
                 playSound('jump'); // reuse sound for wave start

                 if (wave === 1) {
                     enemiesRef.current.push({ id: 'w1_t1', x: spawnX, y: FLOOR_Y - 100, width: 100, height: 100, vx: 0, vy: 0, type: 'trex', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_TREX, stunTimer: 0 });
                 } else if (wave === 2) {
                     enemiesRef.current.push({ id: 'w2_m1', x: spawnX, y: FLOOR_Y - 120, width: 150, height: 120, vx: 0, vy: 0, type: 'mammoth', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_MAMMOTH, stunTimer: 0 });
                 } else if (wave === 3) {
                     enemiesRef.current.push({ id: 'w3_t1', x: spawnX, y: FLOOR_Y - 100, width: 100, height: 100, vx: 0, vy: 0, type: 'trex', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_TREX, stunTimer: 0 });
                     enemiesRef.current.push({ id: 'w3_t2', x: spawnX + 150, y: FLOOR_Y - 100, width: 100, height: 100, vx: 0, vy: 0, type: 'trex', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_TREX, stunTimer: 0 });
                 } else if (wave === 4) {
                     enemiesRef.current.push({ id: 'w4_m1', x: spawnX, y: FLOOR_Y - 120, width: 150, height: 120, vx: 0, vy: 0, type: 'mammoth', hp: 3, maxHp: 3, facing: -1, sprite: SPRITE_MAMMOTH, stunTimer: 0 });
                     enemiesRef.current.push({ id: 'w4_s1', x: spawnX + 180, y: FLOOR_Y - 80, width: 90, height: 80, vx: 0, vy: 0, type: 'sabertooth', hp: 2, maxHp: 2, facing: -1, sprite: SPRITE_SABERTOOTH, stunTimer: 0 });
                 } else if (wave === 5) {
                     // Mega Mammoth
                     enemiesRef.current.push({ id: 'w5_mega', x: spawnX, y: FLOOR_Y - 150, width: 200, height: 160, vx: 0, vy: 0, type: 'mammoth', hp: 10, maxHp: 10, facing: -1, sprite: SPRITE_MAMMOTH, stunTimer: 0 });
                     setNarratorMessage({ text: "מגה-ממותה הגיעה! הזהר!", type: 'danger' });
                 } else if (wave > 5) {
                     setGameState(GameState.VICTORY);
                     generateNarration("האדם הקדמון ניצח את הממותה הגדולה בעזרת הנבוט!").then(text => setNarratorMessage({ text, type: 'victory' }));
                 }

                 // Drop some health/powerups between waves
                 if (wave > 1 && wave < 6) {
                     collectiblesRef.current.push({ id: `w${wave}_food`, x: player.x, y: FLOOR_Y - 40, width: 40, height: 40, vx: 0, vy: 0, type: 'food', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_FOOD });
                     if (wave === 3) {
                         collectiblesRef.current.push({ id: `w${wave}_str`, x: player.x + 50, y: FLOOR_Y - 40, width: 40, height: 40, vx: 0, vy: 0, type: 'powerup', powerUpType: 'strength', hp: 0, maxHp: 0, facing: 1, sprite: SPRITE_POWERUP_STRENGTH });
                     }
                 }
            }
        }
    }

    // Spawn Hazards (Falling Rocks) in Arena OR Boss Rush
    const isInArena = (gameMode === GameMode.STORY && player.x > ARENA_START_X - 100) || gameMode === GameMode.BOSS_RUSH;
    if (isInArena) {
        hazardTimerRef.current++;
        const spawnRate = gameMode === GameMode.BOSS_RUSH ? 90 : 60; // Slightly easier rocks in Boss Rush to focus on bosses
        if (hazardTimerRef.current > spawnRate) {
            hazardTimerRef.current = 0;
            // In Boss Rush, camera doesn't move much, so random across canvas
            const baseSpawnX = gameMode === GameMode.BOSS_RUSH ? 0 : cameraXRef.current;
            const spawnX = baseSpawnX + Math.random() * CANVAS_WIDTH;
            hazardsRef.current.push({
                id: `hazard_${Date.now()}_${Math.random()}`,
                x: spawnX, y: -50, width: 40, height: 40, vx: 0, vy: 0,
                type: 'hazard', hp: 1, maxHp: 1, facing: 1, sprite: SPRITE_ROCK
            });
        }
    }

    // Player Physics
    player.vx *= FRICTION;
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // Floor Collision
    if (player.y + player.height > FLOOR_Y) {
      player.y = FLOOR_Y - player.height;
      player.vy = 0;
    }
    
    // Bounds Check
    if (player.x < 0) player.x = 0;
    if (gameMode === GameMode.BOSS_RUSH && player.x > CANVAS_WIDTH - player.width) {
        player.x = CANVAS_WIDTH - player.width;
    }

    // Cooldowns and Timers
    if (player.attackCooldown && player.attackCooldown > 0) player.attackCooldown--;
    if (player.attackCooldown === 10) player.isAttacking = false; 

    // Parry timers
    if (player.parryTimer && player.parryTimer > 0) {
        player.parryTimer--;
        if (player.parryTimer <= 0) player.isBlocking = false;
    }
    if (player.parryCooldown && player.parryCooldown > 0) {
        player.parryCooldown--;
    }

    // Visual Effects Timers
    if (screenShakeRef.current > 0) screenShakeRef.current--;
    if (parryFlashRef.current > 0) parryFlashRef.current--;

    // Active Effects Update
    if (player.activeEffects) {
        player.activeEffects.forEach(e => {
            e.timeLeft--;
            // Poison Damage Tick
            if (e.type === 'poison') {
                if (e.timeLeft % 60 === 0) { // Damage every second
                    player.hp -= 1;
                    playSound('poison');
                    spawnParticles(player.x + player.width/2, player.y, '#8800FF', 8);
                    if (player.hp <= 0) triggerGameOver();
                }
            }
        });
        player.activeEffects = player.activeEffects.filter(e => e.timeLeft > 0);
    }

    // Hazards Update
    hazardsRef.current.forEach(h => {
        h.vy += GRAVITY;
        h.y += h.vy;
        if (h.y + h.height > FLOOR_Y) {
            h.hp = 0; 
            spawnParticles(h.x + h.width/2, FLOOR_Y, '#555555', 5);
        }
        if (checkCollision(h, player)) {
            h.hp = 0;
            if (player.isBlocking) {
                playSound('block');
                spawnParticles(player.x + player.width/2, player.y, '#FFFFFF', 10);
                parryFlashRef.current = 5;
            } else {
                player.hp -= 1;
                playSound('damage');
                player.vx = (Math.random() - 0.5) * 20;
                screenShakeRef.current = 10;
                spawnParticles(player.x, player.y, '#ffaaaa', 10);
                if (player.hp <= 0) triggerGameOver();
            }
        }
    });
    hazardsRef.current = hazardsRef.current.filter(h => h.hp > 0);

    // Enemies Logic
    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);
    
    enemiesRef.current.forEach(enemy => {
      // Manage Stun
      if (enemy.stunTimer && enemy.stunTimer > 0) {
          enemy.stunTimer--;
          // Apply heavy gravity/friction while stunned
          enemy.vy += GRAVITY;
          enemy.y += enemy.vy;
          if (enemy.y + enemy.height > FLOOR_Y) {
            enemy.y = FLOOR_Y - enemy.height;
            enemy.vy = 0;
          }
          enemy.vx *= FRICTION;
          enemy.x += enemy.vx;
          return; 
      }

      const dist = player.x - enemy.x;
      const range = 600; 

      if (enemy.type === 'pterodactyl') {
          // Pterodactyl AI (Flight)
          if (Math.abs(dist) < range) {
              enemy.facing = dist > 0 ? 1 : -1;
              
              // Fly towards player X
              enemy.vx += (dist > 0 ? 0.2 : -0.2);
              if (enemy.vx > 6) enemy.vx = 6;
              if (enemy.vx < -6) enemy.vx = -6;

              // Swoop logic
              const heightDiff = enemy.y - player.y;
              if (Math.abs(dist) < 200 && heightDiff < 200) {
                  // Swoop down
                  enemy.vy += 0.4; 
              } else if (enemy.y > FLOOR_Y - 150) {
                  // Pull up to avoid floor
                  enemy.vy -= 0.5;
              } else {
                  // Cruise altitude
                  enemy.vy *= 0.95;
              }
              
              enemy.x += enemy.vx;
              enemy.y += enemy.vy;

              // Floor prevention
              if (enemy.y + enemy.height > FLOOR_Y) {
                  enemy.y = FLOOR_Y - enemy.height;
                  enemy.vy = -5; // Bounce up
              }
          }
      } else {
          // Ground Enemies AI
          enemy.vy += GRAVITY;
          enemy.y += enemy.vy;
          
          if (enemy.y + enemy.height > FLOOR_Y) {
            if (enemy.vy > 2) {
                spawnParticles(enemy.x + enemy.width/2, FLOOR_Y, '#777777', 5);
            }
            enemy.y = FLOOR_Y - enemy.height;
            enemy.vy = 0;
          }
          
          enemy.vx *= FRICTION;
          enemy.x += enemy.vx;

          if (Math.abs(dist) < range) {
            
            if (enemy.type === 'rhino') {
                 const isFacingPlayer = (dist > 0 && enemy.facing === 1) || (dist < 0 && enemy.facing === -1);
                 if (Math.abs(dist) < 400 && isFacingPlayer) {
                     const chargeSpeed = 0.5;
                     enemy.vx += (dist > 0 ? 1 : -1) * chargeSpeed;
                     if (Math.abs(enemy.vx) > 10) enemy.vx = (dist > 0 ? 1 : -1) * 10;
                 } else {
                     enemy.vx = enemy.facing * 1.5;
                     if (Math.random() < 0.01) enemy.facing *= -1;
                 }

            } else if (enemy.type === 'raptor') {
                enemy.facing = dist > 0 ? 1 : -1;
                enemy.vx = enemy.facing * 5; 
                if (Math.abs(dist) < 150 && enemy.y + enemy.height >= FLOOR_Y - 1) {
                     if (Math.random() < 0.05) {
                         enemy.vy = -12;
                     }
                }

            } else if (enemy.type === 'sabertooth') {
                const speed = 2.5;
                if (dist > 0) enemy.vx += 0.4;
                else enemy.vx -= 0.4;
                if (enemy.vx > 7) enemy.vx = 7;
                if (enemy.vx < -7) enemy.vx = -7;
                enemy.facing = dist > 0 ? 1 : -1;

                if (Math.abs(dist) < 200 && Math.abs(dist) > 50 && enemy.y + enemy.height >= FLOOR_Y - 1) {
                    if (Math.random() < 0.03) {
                         enemy.vy = -12; 
                         enemy.vx = (dist > 0 ? 1 : -1) * 10;
                         spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height, '#e0e0e0', 5);
                    }
                }
            } else if (enemy.type === 'scorpion') {
                enemy.vx = enemy.facing * 2;
                if (Math.random() < 0.02) enemy.facing *= -1;
                // Turn towards player if very close
                if (Math.abs(dist) < 100) enemy.facing = dist > 0 ? 1 : -1;
            } else if (enemy.type === 'mammoth') {
                if (Math.abs(dist) < 200 && Math.random() < 0.02) {
                    enemy.vx = (dist > 0 ? 1 : -1) * 8;
                }
                enemy.facing = dist > 0 ? 1 : -1;
            } else {
                if (dist > 0) enemy.vx += 0.2;
                else enemy.vx -= 0.2;
                enemy.facing = dist > 0 ? 1 : -1;
            }
          }
      }

      // Player collision damage check
      if (checkCollision(player, enemy)) {
        if (player.isBlocking) {
            // PARRY SUCCESS
            enemy.vx = (player.x < enemy.x ? 1 : -1) * 20; // Massive knockback
            enemy.vy = -8;
            enemy.stunTimer = STUN_DURATION;
            
            player.isBlocking = false; 
            player.parryTimer = 0;
            
            playSound('block');
            setScore(s => s + 50); 
            
            // FX
            screenShakeRef.current = 15;
            parryFlashRef.current = 10;
            spawnParticles(player.x + player.width/2, player.y + player.height/2, '#FFFFFF', 40); 
            spawnParticles(enemy.x + enemy.width/2, enemy.y, '#FFFF00', 15);
            
            setNarratorMessage({ 
                text: ["חסימה!", "בזמן!", "החיה מסוחררת!", "חסום!"][Math.floor(Math.random()*4)], 
                type: 'parry' 
            });

        } else {
            // Player HIT
            player.vx = (player.x < enemy.x ? -10 : 10);
            player.vy = -5;
            player.hp -= 1;
            playSound('damage');
            screenShakeRef.current = 10;
            spawnParticles(player.x, player.y, '#ffaaaa', 5);

            // Special Attack: Scorpion Poison
            if (enemy.type === 'scorpion' && player.hp > 0) {
                 if (!player.activeEffects?.some(e => e.type === 'poison')) {
                     if (!player.activeEffects) player.activeEffects = [];
                     player.activeEffects.push({ type: 'poison', timeLeft: 300 }); // 5 seconds
                     setNarratorMessage({ text: "הרעל מתפשט!", type: 'danger' });
                 }
            }

            if (player.hp <= 0) {
                triggerGameOver();
            }
        }
      }
    });

    // Collectibles Logic
    collectiblesRef.current = collectiblesRef.current.filter(p => {
        if (checkCollision(player, p)) {
            collectItem(p);
            return false;
        }
        return true;
    });

    // Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.1;
      p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);

    // Camera follow
    let targetCamX = 0;
    if (gameMode === GameMode.STORY) {
        targetCamX = player.x - CANVAS_WIDTH / 3;
    } else {
        // Boss Rush Camera: Fixed centered or bounded 0
        targetCamX = 0;
    }
    
    cameraXRef.current += (targetCamX - cameraXRef.current) * 0.1;
    if (cameraXRef.current < 0) cameraXRef.current = 0;

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [gameMode, isPaused, gameState, draw, handleInput, triggerGameOver, collectItem, spawnParticles, playSound, setNarratorMessage, setGameState]);

  const handleTouchStart = (key: string) => {
      keys.current[key] = true;
  };
  const handleTouchEnd = (key: string) => {
      keys.current[key] = false;
  };

  // Event Listeners - Run once on mount!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'KeyP') {
            setIsPaused(prev => !prev);
        }
        if(e.code === 'Space' || e.code === 'ArrowDown' || e.code === 'ArrowUp') e.preventDefault(); 
        keys.current[e.key] = true;
        keys.current[e.code] = true; 
    };
    const handleKeyUp = (e: KeyboardEvent) => {
        keys.current[e.key] = false;
        keys.current[e.code] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
        window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Game Loop
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
        requestRef.current = requestAnimationFrame(update);
    } else {
        draw(); 
    }

    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, isPaused, update, draw]); 

  return (
    <div className="relative border-4 border-stone-700 rounded-lg overflow-hidden shadow-2xl bg-black">
      <canvas 
        ref={canvasRef} 
        width={CANVAS_WIDTH} 
        height={CANVAS_HEIGHT}
        className="block bg-blue-300 w-full h-auto max-w-[800px]"
      />
      
      {/* HUD - Health & Active Effects */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none z-30">
        
        {/* Score Display */}
        <div className="text-white font-stone text-2xl drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            SCORE: {score.toString().padStart(6, '0')}
        </div>
        
        {/* Boss Rush Wave Indicator */}
        {gameMode === GameMode.BOSS_RUSH && (
             <div className="text-red-500 font-bold text-xl drop-shadow-md">
                 WAVE: {bossRushWaveRef.current}/5
             </div>
        )}

        <div className="flex gap-2">
            {Array.from({length: playerRef.current.maxHp}).map((_, i) => (
                <span key={i} className={`text-3xl ${i < playerRef.current.hp ? 'opacity-100' : 'opacity-20 grayscale'}`}>❤️</span>
            ))}
        </div>
        
        {/* Effect Icons */}
        <div className="flex gap-2 min-h-[40px]">
            {playerRef.current.activeEffects?.some(e => e.type === 'speed') && (
                <div className="bg-yellow-500 text-black px-2 py-1 rounded-full font-bold animate-pulse">
                    {SPRITE_POWERUP_SPEED} SPEED
                </div>
            )}
            {playerRef.current.activeEffects?.some(e => e.type === 'strength') && (
                <div className="bg-red-600 text-white px-2 py-1 rounded-full font-bold animate-pulse">
                    {SPRITE_POWERUP_STRENGTH} POWER
                </div>
            )}
            {playerRef.current.activeEffects?.some(e => e.type === 'poison') && (
                <div className="bg-purple-600 text-white px-2 py-1 rounded-full font-bold animate-pulse border-2 border-purple-300">
                    {SPRITE_POISON} POISON
                </div>
            )}
        </div>
      </div>

      {/* Pause Button */}
      <div className="absolute top-4 right-16 z-30">
           <button
              onClick={() => setIsPaused(!isPaused)}
              className="bg-stone-800/80 hover:bg-stone-700 text-white p-2 rounded-full border-2 border-stone-500 transition-colors w-10 h-10 flex items-center justify-center font-bold"
              title="Pause Game (P)"
          >
              {isPaused ? "▶" : "⏸"}
          </button>
      </div>

      {/* Mute Button */}
      <div className="absolute top-4 right-4 z-30">
          <button
              onClick={() => setIsMuted(!isMuted)}
              className="bg-stone-800/80 hover:bg-stone-700 text-white p-2 rounded-full border-2 border-stone-500 transition-colors w-10 h-10 flex items-center justify-center"
              title={isMuted ? "Unmute" : "Mute"}
          >
              {isMuted ? "🔇" : "🔊"}
          </button>
      </div>
      
      {/* Pause Overlay */}
      {isPaused && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-40 flex flex-col items-center justify-center">
            <h2 className="text-6xl font-stone text-white mb-8 drop-shadow-lg">PAUSED</h2>
            <button 
                onClick={() => setIsPaused(false)}
                className="bg-amber-600 hover:bg-amber-500 text-white font-stone text-2xl py-3 px-8 rounded-full shadow-lg border-2 border-amber-400"
            >
                RESUME
            </button>
        </div>
      )}

      {/* Mobile Controls Overlay */}
      {gameState === GameState.PLAYING && !isPaused && (
          <div className="absolute inset-0 pointer-events-none flex flex-col justify-end pb-2 px-2 z-20">
              <div className="flex justify-between w-full pointer-events-auto opacity-70">
                  {/* Left Hand: Movement */}
                  <div className="flex gap-4 items-end">
                      <button 
                          className="w-16 h-16 bg-stone-800/50 rounded-full text-3xl border-2 border-stone-500 text-white backdrop-blur-sm active:bg-stone-600/80 select-none touch-none flex items-center justify-center"
                          onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowLeft'); }}
                          onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowLeft'); }}
                          onMouseDown={() => handleTouchStart('ArrowLeft')}
                          onMouseUp={() => handleTouchEnd('ArrowLeft')}
                          onMouseLeave={() => handleTouchEnd('ArrowLeft')}
                      >⬅️</button>
                      <button 
                          className="w-16 h-16 bg-stone-800/50 rounded-full text-3xl border-2 border-stone-500 text-white backdrop-blur-sm active:bg-stone-600/80 select-none touch-none flex items-center justify-center"
                          onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowRight'); }}
                          onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowRight'); }}
                          onMouseDown={() => handleTouchStart('ArrowRight')}
                          onMouseUp={() => handleTouchEnd('ArrowRight')}
                          onMouseLeave={() => handleTouchEnd('ArrowRight')}
                      >➡️</button>
                  </div>

                  {/* Right Hand: Actions */}
                  <div className="flex gap-4 items-end">
                      {/* Shield Button */}
                      <button 
                          className="w-16 h-16 bg-yellow-900/50 rounded-full text-2xl border-2 border-yellow-500 text-white backdrop-blur-sm active:bg-yellow-700/80 select-none touch-none flex items-center justify-center mb-0"
                          onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowDown'); }}
                          onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowDown'); }}
                          onMouseDown={() => handleTouchStart('ArrowDown')}
                          onMouseUp={() => handleTouchEnd('ArrowDown')}
                          onMouseLeave={() => handleTouchEnd('ArrowDown')}
                      >🛡️</button>

                      {/* Attack Button */}
                      <button 
                          className="w-20 h-20 bg-red-900/50 rounded-full text-3xl border-2 border-red-500 text-white backdrop-blur-sm active:bg-red-700/80 select-none touch-none flex items-center justify-center"
                          onTouchStart={(e) => { e.preventDefault(); handleTouchStart(' '); }}
                          onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd(' '); }}
                          onMouseDown={() => handleTouchStart(' ')}
                          onMouseUp={() => handleTouchEnd(' ')}
                          onMouseLeave={() => handleTouchEnd(' ')}
                      >⚔️</button>

                      {/* Jump Button */}
                      <button 
                          className="w-16 h-16 bg-blue-900/50 rounded-full text-3xl border-2 border-blue-500 text-white backdrop-blur-sm active:bg-blue-700/80 select-none touch-none flex items-center justify-center mb-8"
                          onTouchStart={(e) => { e.preventDefault(); handleTouchStart('ArrowUp'); }}
                          onTouchEnd={(e) => { e.preventDefault(); handleTouchEnd('ArrowUp'); }}
                          onMouseDown={() => handleTouchStart('ArrowUp')}
                          onMouseUp={() => handleTouchEnd('ArrowUp')}
                          onMouseLeave={() => handleTouchEnd('ArrowUp')}
                      >⬆️</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default GameEngine;