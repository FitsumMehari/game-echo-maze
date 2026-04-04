import * as THREE from "three";
import {
  EYE_HEIGHT,
  EXIT_RADIUS,
  PING_STRENGTH,
  RESONANCE_HARMONIC_COST,
  RESONANCE_HARMONIC_THRESHOLD,
  SILENCE_BONUS_RESONANCE,
  SILENCE_DEBT_GATE,
  SILENCE_STREAK_SECONDS,
  STEP_DISTANCE,
  STEP_STRENGTH,
  STEALTH_STEP_MULT,
  THROW_STRENGTH,
  ENEMY_CATCH_RADIUS,
} from "./constants";
import { getCell, gridCenterWorld, parseLevel, worldToGrid, Cell, type ParsedLevel } from "./level";
import { generateEchoMaze } from "./levelGenerator";
import { buildEchoSphere, buildWorldMeshes } from "./worldGeometry";
import { worldFragmentShader, worldVertexShader } from "./shaders/worldShader";
import { createPulseUniforms, PulseSystem } from "./pulseSystem";
import { resolveEnemyCollision, resolvePlayerCollision } from "./collision";
import type { AudioEngine } from "./audioEngine";

const ENEMY_RADIUS = 0.28;
const ENEMY_SPEED = 2.35;
const ENEMY_KIND = 9;
const PROJ_RADIUS = 0.12;
const PROJ_SPEED = 14;
const PROJ_KIND = 10;
const MAX_PROJECTILES = 5;
const MOUSE_SENS = 0.002;
const MAX_DT = 0.05;

export type GamePhase = "menu" | "playing" | "paused" | "won" | "lost";

interface Projectile {
  x: number;
  z: number;
  vx: number;
  vz: number;
  bounces: number;
  age: number;
}

interface Enemy {
  x: number;
  z: number;
}

export interface RunStats {
  timeSec: number;
  pings: number;
  throws: number;
  harmonics: number;
  echoDebt: number;
  silenceBonuses: number;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly pulseSystem = new PulseSystem();
  readonly material: THREE.RawShaderMaterial;

  level: ParsedLevel;
  mesh: THREE.Mesh;
  private readonly enemyMeshes: THREE.Mesh[] = [];
  private readonly projectileMeshes: THREE.Mesh[] = [];
  private readonly enemyGeometry: THREE.BufferGeometry;
  private readonly projectileGeometry: THREE.BufferGeometry;

  phase: GamePhase = "menu";
  doorOpen = false;
  switchHeld = false;

  playerX = 0;
  playerZ = 0;
  spawnX = 0;
  spawnZ = 0;
  yaw = 0;
  pitch = 0;

  stepDistAccum = 0;
  pingCooldown = 0;

  /** Simulation time in seconds; advances only while `phase === "playing"`. */
  simulationTime = 0;
  pingCount = 0;
  throwCount = 0;

  /** Mouse sensitivity multiplier (from settings). */
  mouseLookMul = 1;

  /** Populated when a run ends (win or loss); cleared when a new run starts. */
  lastRunSummary: RunStats | null = null;

  /** 0–100: stand still / stealth charges; spent on harmonic pings. */
  resonance = 0;
  /** 0–1: loud play heats hunters (movement + ping debt). */
  echoDebt = 0;
  hasEchoKey = false;
  harmonicPingCount = 0;
  private exitDenyCooldown = 0;

  /** Seconds Echo heat has stayed at/below `SILENCE_DEBT_GATE` (streak resets if hotter). */
  silenceStreakSec = 0;
  /** How many silence dividends paid this run (low heat sustained). */
  silenceBonusCount = 0;

  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];

  private readonly tmpVec = new THREE.Vector3();
  private readonly exitWorld = { x: 0, z: 0 };
  private readonly audio: AudioEngine;

  constructor(audio: AudioEngine) {
    this.audio = audio;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000008, 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.07, 260);
    this.scene.fog = new THREE.FogExp2(0x020208, 0.011);

    this.level = parseLevel(generateEchoMaze(90210));
    const { merged, bounds } = buildWorldMeshes(this.level);
    const uniforms = createPulseUniforms();
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: worldVertexShader,
      fragmentShader: worldFragmentShader,
      uniforms,
      side: THREE.FrontSide,
    });

    this.mesh = new THREE.Mesh(merged, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    this.enemyGeometry = buildEchoSphere(ENEMY_RADIUS, ENEMY_KIND);
    this.projectileGeometry = buildEchoSphere(PROJ_RADIUS, PROJ_KIND);

    const ex = gridCenterWorld(this.level.exit.ix, this.level.exit.iz);
    this.exitWorld.x = ex.x;
    this.exitWorld.z = ex.z;

    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    for (let i = 0; i < MAX_PROJECTILES; i++) {
      const m = new THREE.Mesh(this.projectileGeometry, this.material);
      m.frustumCulled = false;
      m.visible = false;
      this.scene.add(m);
      this.projectileMeshes.push(m);
    }

    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);

    void bounds;
  }

  private rebuildEnemyMeshes(): void {
    for (const m of this.enemyMeshes) {
      this.scene.remove(m);
    }
    this.enemyMeshes.length = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      const m = new THREE.Mesh(this.enemyGeometry, this.material);
      m.frustumCulled = false;
      m.position.set(e.x, ENEMY_RADIUS + 0.02, e.z);
      this.scene.add(m);
      this.enemyMeshes.push(m);
    }
  }

  /** Dispose merged geometry and rebuild from `this.level` — call after regenerating the maze. */
  rebuildWorldFromLevel(): void {
    const ex = gridCenterWorld(this.level.exit.ix, this.level.exit.iz);
    this.exitWorld.x = ex.x;
    this.exitWorld.z = ex.z;
    this.mesh.geometry.dispose();
    const { merged } = buildWorldMeshes(this.level);
    this.mesh.geometry = merged;
  }

  syncSpawnFromLevel(): void {
    const p = gridCenterWorld(this.level.playerIx, this.level.playerIz);
    this.spawnX = p.x;
    this.spawnZ = p.z;
    this.playerX = p.x;
    this.playerZ = p.z;
    this.enemies = this.level.enemies.map((e) => {
      const w = gridCenterWorld(e.ix, e.iz);
      return { x: w.x, z: w.z };
    });
  }

  resize(w: number, h: number): void {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  startPlaying(): void {
    this.phase = "playing";
    this.lastRunSummary = null;
    this.doorOpen = false;
    this.switchHeld = false;
    this.simulationTime = 0;
    this.pingCount = 0;
    this.throwCount = 0;
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.level = parseLevel(generateEchoMaze((Math.random() * 0x7fffffff) | 0));
    this.rebuildWorldFromLevel();
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = 0;
    this.pitch = 0;
    this.stepDistAccum = 0;
    this.pingCooldown = 0;
    this.resonance = 0;
    this.echoDebt = 0;
    this.hasEchoKey = false;
    this.harmonicPingCount = 0;
    this.exitDenyCooldown = 0;
    this.silenceStreakSec = 0;
    this.silenceBonusCount = 0;
    this.emitPulse(this.playerX, 0.35, this.playerZ, 0.42, 10, 0.55);
  }

  resetLevel(): void {
    this.startPlaying();
  }

  /** Return to title: resets maze actors and clears echoes for a calm menu. */
  goToMenu(): void {
    this.phase = "menu";
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.simulationTime = 0;
    this.doorOpen = false;
    this.switchHeld = false;
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = 0;
    this.pitch = 0;
    this.resonance = 0;
    this.echoDebt = 0;
    this.hasEchoKey = false;
    this.harmonicPingCount = 0;
    this.exitDenyCooldown = 0;
    this.silenceStreakSec = 0;
    this.silenceBonusCount = 0;
  }

  emitPulse(x: number, y: number, z: number, strength: number, speed = 11, decay = 0.52): void {
    this.tmpVec.set(x, y, z);
    this.pulseSystem.addPulse(this.tmpVec, strength, speed, decay, this.simulationTime);
    this.pulseSystem.registerNoise(this.tmpVec, strength);
  }

  private snapshotRun(): RunStats {
    return {
      timeSec: this.simulationTime,
      pings: this.pingCount,
      throws: this.throwCount,
      harmonics: this.harmonicPingCount,
      echoDebt: this.echoDebt,
      silenceBonuses: this.silenceBonusCount,
    };
  }

  /**
   * Full simulation tick: hazards, switch, movement, entities, win/lose.
   */
  tick(
    dtRaw: number,
    forward: boolean,
    back: boolean,
    left: boolean,
    right: boolean,
    stealth: boolean,
  ): void {
    const dt = Math.min(MAX_DT, Math.max(0, dtRaw));
    if (this.phase !== "playing") return;

    this.simulationTime += dt;

    this.pingCooldown = Math.max(0, this.pingCooldown - dt);
    this.exitDenyCooldown = Math.max(0, this.exitDenyCooldown - dt);
    this.pulseSystem.updateNoise(dt);

    const g = worldToGrid(this.playerX, this.playerZ);
    const cellUnder = getCell(this.level, g.ix, g.iz);

    const keyCenter = gridCenterWorld(g.ix, g.iz);
    if (
      cellUnder === Cell.Key &&
      !this.hasEchoKey &&
      this.level.keyPositions.length > 0 &&
      Math.hypot(this.playerX - keyCenter.x, this.playerZ - keyCenter.z) < 0.44
    ) {
      this.hasEchoKey = true;
      void this.audio.playKeyPickup();
      this.emitPulse(this.playerX, 0.35, this.playerZ, 0.55, 11, 0.5);
    }

    if (cellUnder === Cell.Hazard) {
      this.playerX = this.spawnX;
      this.playerZ = this.spawnZ;
      void this.audio.playHazard();
      this.emitPulse(this.playerX, 0.4, this.playerZ, 0.55, 9, 0.6);
    }

    const center = gridCenterWorld(g.ix, g.iz);
    const onSwitch = cellUnder === Cell.Switch && Math.hypot(this.playerX - center.x, this.playerZ - center.z) < 0.48;
    if (onSwitch && !this.switchHeld) {
      this.doorOpen = true;
      void this.audio.playSwitch();
    }
    this.switchHeld = onSwitch;

    const dtClamped = dt;
    const moveSpeed = stealth ? 3.35 : 6.15;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = 0;
    let mz = 0;
    if (forward) {
      mx -= sin;
      mz -= cos;
    }
    if (back) {
      mx += sin;
      mz += cos;
    }
    if (left) {
      mx -= cos;
      mz += sin;
    }
    if (right) {
      mx += cos;
      mz -= sin;
    }
    const len = Math.hypot(mx, mz);
    if (len > 1e-6) {
      mx = (mx / len) * moveSpeed * dtClamped;
      mz = (mz / len) * moveSpeed * dtClamped;
    } else {
      mx = 0;
      mz = 0;
    }

    let nx = this.playerX + mx;
    let nz = this.playerZ + mz;
    nx = resolvePlayerCollision(this.level, nx, this.playerZ, this.doorOpen).x;
    nz = resolvePlayerCollision(this.level, this.playerX, nz, this.doorOpen).z;
    const r2 = resolvePlayerCollision(this.level, nx, nz, this.doorOpen);
    nx = r2.x;
    nz = r2.z;

    const moved = Math.hypot(nx - this.playerX, nz - this.playerZ);
    this.playerX = nx;
    this.playerZ = nz;

    const gStep = worldToGrid(this.playerX, this.playerZ);
    const cellStep = getCell(this.level, gStep.ix, gStep.iz);

    const speed = moved / Math.max(dtClamped, 1e-5);
    let chargeRate = 7;
    if (speed < 0.14) chargeRate = 34;
    else if (stealth && speed >= 0.14) chargeRate = 23;

    this.resonance = Math.min(100, Math.max(0, this.resonance + chargeRate * dtClamped));

    this.echoDebt = Math.max(0, this.echoDebt - 0.042 * dtClamped);
    if (stealth) this.echoDebt = Math.max(0, this.echoDebt - 0.065 * dtClamped);

    if (moved > 1e-5) {
      this.stepDistAccum += moved;
      if (this.stepDistAccum >= STEP_DISTANCE) {
        this.stepDistAccum = 0;
        const mult = stealth ? STEALTH_STEP_MULT : 1;
        let stepBoost = 1.0;
        if (cellStep === Cell.Resonant) stepBoost = 1.55;
        this.emitPulse(this.playerX, 0.15, this.playerZ, STEP_STRENGTH * mult * stepBoost, 10, 0.58);
        void this.audio.playFootstep(stealth);
        if (!stealth) this.echoDebt = Math.min(1, this.echoDebt + 0.03);
      }
    }

    if (this.echoDebt <= SILENCE_DEBT_GATE) {
      this.silenceStreakSec += dtClamped;
      if (this.silenceStreakSec >= SILENCE_STREAK_SECONDS) {
        this.silenceStreakSec = 0;
        this.resonance = Math.min(100, this.resonance + SILENCE_BONUS_RESONANCE);
        this.silenceBonusCount += 1;
        void this.audio.playSilenceBonus();
      }
    } else {
      this.silenceStreakSec = 0;
    }

    this.updateEnemies(dtClamped);
    this.updateProjectiles(dtClamped);

    const dx = this.playerX - this.exitWorld.x;
    const dz = this.playerZ - this.exitWorld.z;
    const atExit = Math.hypot(dx, dz) < EXIT_RADIUS;
    const needsKey = this.level.keyPositions.length > 0;
    if (atExit) {
      if (needsKey && !this.hasEchoKey) {
        if (this.exitDenyCooldown <= 0) {
          this.exitDenyCooldown = 0.62;
          void this.audio.playSealDenied();
        }
      } else {
        this.lastRunSummary = this.snapshotRun();
        this.phase = "won";
        void this.audio.playWin();
      }
    }

    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.playerX, e.z - this.playerZ) < ENEMY_CATCH_RADIUS) {
        this.lastRunSummary = this.snapshotRun();
        this.phase = "lost";
        void this.audio.playLose();
        break;
      }
    }
  }

  private syncProjectileMeshes(): void {
    for (let i = 0; i < this.projectileMeshes.length; i++) {
      const m = this.projectileMeshes[i]!;
      const p = this.projectiles[i];
      if (p) {
        m.visible = true;
        m.position.set(p.x, PROJ_RADIUS + 0.02, p.z);
      } else {
        m.visible = false;
      }
    }
  }

  private updateEnemies(dt: number): void {
    const noise = this.pulseSystem.noiseIntensity;
    const tx = this.pulseSystem.lastNoisePos.x;
    const tz = this.pulseSystem.lastNoisePos.z;

    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      let ex = e.x;
      let ez = e.z;
      const dx = tx - ex;
      const dz = tz - ez;
      const dist = Math.hypot(dx, dz);
      if (noise > 0.08 && dist > 0.15) {
        const debtMul = 1 + this.echoDebt * 0.48;
        const sp = ENEMY_SPEED * debtMul * (0.85 + Math.min(0.35, noise));
        ex += (dx / dist) * sp * dt;
        ez += (dz / dist) * sp * dt;
      }
      const r = resolveEnemyCollision(this.level, ex, ez, ENEMY_RADIUS, this.doorOpen);
      e.x = r.x;
      e.z = r.z;

      const em = this.enemyMeshes[i];
      if (em) {
        em.position.set(e.x, ENEMY_RADIUS + 0.02, e.z);
      }
    }
  }

  private updateProjectiles(dt: number): void {
    const next: Projectile[] = [];
    for (const p of this.projectiles) {
      p.age += dt;

      let vx = p.vx;
      let vz = p.vz;
      let x = p.x;
      let z = p.z;

      const candX = x + vx * dt;
      const rx = resolveEnemyCollision(this.level, candX, z, PROJ_RADIUS, this.doorOpen).x;
      if (Math.abs(rx - candX) > 1e-5) {
        vx *= -0.72;
        x = rx;
        p.bounces += 1;
        this.emitPulse(x, 0.22, z, THROW_STRENGTH * 0.85, 11, 0.55);
        void this.audio.playPing(THROW_STRENGTH * 0.35);
      } else {
        x = candX;
      }

      const candZ = z + vz * dt;
      const rz = resolveEnemyCollision(this.level, x, candZ, PROJ_RADIUS, this.doorOpen).z;
      if (Math.abs(rz - candZ) > 1e-5) {
        vz *= -0.72;
        z = rz;
        p.bounces += 1;
        this.emitPulse(x, 0.22, z, THROW_STRENGTH * 0.85, 11, 0.55);
        void this.audio.playPing(THROW_STRENGTH * 0.35);
      } else {
        z = candZ;
      }

      p.x = x;
      p.z = z;
      p.vx = vx;
      p.vz = vz;

      if (p.bounces > 8 || p.age > 4.5) continue;
      next.push(p);
    }
    this.projectiles = next;
  }

  tryPing(): void {
    if (this.phase !== "playing" || this.pingCooldown > 0) return;
    this.pingCount += 1;
    this.echoDebt = Math.min(1, this.echoDebt + 0.12);

    if (this.resonance >= RESONANCE_HARMONIC_THRESHOLD) {
      this.resonance -= RESONANCE_HARMONIC_COST;
      this.harmonicPingCount += 1;
      this.pingCooldown = 0.48;
      this.emitPulse(this.playerX, 0.42, this.playerZ, 1.05, 13.8, 0.43);
      this.emitPulse(this.playerX, 0.36, this.playerZ, 0.58, 7.4, 0.33);
      void this.audio.playHarmonicPing();
    } else {
      this.pingCooldown = 0.35;
      this.emitPulse(this.playerX, 0.4, this.playerZ, PING_STRENGTH, 12, 0.48);
      void this.audio.playPing(PING_STRENGTH, 0);
      this.resonance = Math.max(0, this.resonance - 9);
    }
  }

  tryThrow(dirX: number, dirZ: number): void {
    if (this.phase !== "playing") return;
    if (this.projectiles.length >= MAX_PROJECTILES) return;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-5) return;
    const nx = dirX / len;
    const nz = dirZ / len;
    this.throwCount += 1;
    this.echoDebt = Math.min(1, this.echoDebt + 0.078);
    this.projectiles.push({
      x: this.playerX + nx * 0.45,
      z: this.playerZ + nz * 0.45,
      vx: nx * PROJ_SPEED,
      vz: nz * PROJ_SPEED,
      bounces: 0,
      age: 0,
    });
    void this.audio.playThrow();
    this.emitPulse(this.playerX, 0.2, this.playerZ, 0.25, 9, 0.65);
  }

  addMouseLook(dx: number, dy: number): void {
    if (this.phase !== "playing") return;
    const s = MOUSE_SENS * this.mouseLookMul;
    this.yaw -= dx * s;
    this.pitch -= dy * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch));
  }

  getForwardDirection(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  /** Grid coordinates for HUD / debugging */
  getPlayerGrid(): { ix: number; iz: number } {
    return worldToGrid(this.playerX, this.playerZ);
  }

  render(): void {
    this.material.uniforms.uCameraPos.value.copy(this.camera.position);
    this.pulseSystem.applyToMaterial(this.material, this.simulationTime);

    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);
    const euler = new THREE.Euler(this.pitch, this.yaw, 0, "YXZ");
    this.camera.quaternion.setFromEuler(euler);

    this.renderer.render(this.scene, this.camera);
    this.syncProjectileMeshes();
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.enemyGeometry.dispose();
    this.projectileGeometry.dispose();
    this.material.dispose();
    this.renderer.dispose();
  }
}
