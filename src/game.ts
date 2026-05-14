import * as THREE from "three";
import {
  ENEMY_CATCH_RADIUS,
  EXIT_RADIUS,
  EYE_HEIGHT,
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
} from "./constants";
import { resolveEnemyCollision, resolvePlayerCollision } from "./collision";
import type { AudioEngine } from "./audioEngine";
import { getMissionConfig } from "./campaign";
import { generateEchoMaze } from "./levelGenerator";
import { buildEchoSphere, buildWorldMeshes } from "./worldGeometry";
import { Cell, getCell, gridCenterWorld, parseLevel, worldToGrid, type ParsedLevel } from "./level";
import { createPulseUniforms, PulseSystem } from "./pulseSystem";
import { worldFragmentShader, worldVertexShader } from "./shaders/worldShader";
import type { Beacon, Enemy, GamePhase, Projectile, RadarSnapshot, RemotePeerState, RunStats } from "./gameTypes";
import type { ThemeId } from "./settings";
const ENEMY_RADIUS = 0.28;
const ENEMY_SPEED = 2.35;
const PROJ_RADIUS = 0.12;
const PROJ_SPEED = 14;
const BEACON_RADIUS = 0.16;
const MAX_PROJECTILES = 5;
const MAX_BEACONS = 3;
const MOUSE_SENS = 0.002;
const MAX_DT = 0.05;
const THEME_MODE: Record<ThemeId, number> = { abyss: 0, neon: 1, ember: 2, contrast: 3 };
export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly pulseSystem = new PulseSystem();
  readonly material: THREE.RawShaderMaterial;
  level: ParsedLevel;
  mesh: THREE.Mesh;
  phase: GamePhase = "menu";
  missionLevel = 1; missionTitle = "Mission 1/33"; missionBriefing = "";
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
  focusCooldown = 0;
  simulationTime = 0;
  pingCount = 0;
  throwCount = 0;
  harmonicPingCount = 0;
  focusCount = 0;
  beaconCount = 0;
  mouseLookMul = 1;
  lastRunSummary: RunStats | null = null;
  resonance = 0;
  echoDebt = 0;
  hasEchoKey = false;
  silenceStreakSec = 0;
  silenceBonusCount = 0;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  beacons: Beacon[] = [];
  private exitDenyCooldown = 0;
  private readonly enemyMeshes: THREE.Mesh[] = [];
  private readonly projectileMeshes: THREE.Mesh[] = [];
  private readonly beaconMeshes: THREE.Mesh[] = [];
  private readonly ghostMeshes = new Map<string, THREE.Mesh>();
  private readonly remotePeers = new Map<string, RemotePeerState>();
  private readonly enemyGeometry = buildEchoSphere(ENEMY_RADIUS, 9);
  private readonly projectileGeometry = buildEchoSphere(PROJ_RADIUS, 10);
  private readonly ghostGeometry = buildEchoSphere(0.22, 13);
  private readonly beaconGeometry = buildEchoSphere(BEACON_RADIUS, 14);
  private readonly tmpVec = new THREE.Vector3();
  private readonly exitWorld = { x: 0, z: 0 };
  private readonly audio: AudioEngine;
  constructor(audio: AudioEngine) {
    this.audio = audio;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000008, 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.07, 260);
    this.scene.fog = new THREE.FogExp2(0x020208, 0.011);
    const firstMission = getMissionConfig(1);
    this.missionTitle = firstMission.title;
    this.missionBriefing = firstMission.briefing;
    this.level = parseLevel(generateEchoMaze(firstMission));
    const { merged } = buildWorldMeshes(this.level);
    this.material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: worldVertexShader,
      fragmentShader: worldFragmentShader,
      uniforms: createPulseUniforms(),
      side: THREE.FrontSide,
    });
    this.mesh = new THREE.Mesh(merged, this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
    this.syncExit();
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    for (let i = 0; i < MAX_PROJECTILES; i++) this.projectileMeshes.push(this.addSphere(this.projectileGeometry, false));
    for (let i = 0; i < MAX_BEACONS; i++) this.beaconMeshes.push(this.addSphere(this.beaconGeometry, false));
    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);
  }
  private addSphere(geometry: THREE.BufferGeometry, visible = true): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.frustumCulled = false;
    mesh.visible = visible;
    this.scene.add(mesh);
    return mesh;
  }
  setVisuals(theme: ThemeId, assist: boolean): void {
    this.material.uniforms.uThemeMode.value = THEME_MODE[theme];
    this.material.uniforms.uVisualAssist.value = assist ? 1 : 0;
  }
  private syncExit(): void {
    const ex = gridCenterWorld(this.level.exit.ix, this.level.exit.iz);
    this.exitWorld.x = ex.x;
    this.exitWorld.z = ex.z;
  }
  private rebuildEnemyMeshes(): void {
    this.enemyMeshes.forEach((m) => this.scene.remove(m));
    this.enemyMeshes.length = 0;
    this.enemies.forEach((e) => {
      const m = this.addSphere(this.enemyGeometry);
      m.position.set(e.x, ENEMY_RADIUS + 0.02, e.z);
      this.enemyMeshes.push(m);
    });
  }
  rebuildWorldFromLevel(): void {
    this.syncExit();
    this.mesh.geometry.dispose();
    this.mesh.geometry = buildWorldMeshes(this.level).merged;
  }
  syncSpawnFromLevel(): void {
    const p = gridCenterWorld(this.level.playerIx, this.level.playerIz);
    this.spawnX = p.x;
    this.spawnZ = p.z;
    this.playerX = p.x;
    this.playerZ = p.z;
    this.enemies = this.level.enemies.map((e) => gridCenterWorld(e.ix, e.iz));
  }
  resize(w: number, h: number): void {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }
  startPlaying(level = this.missionLevel): void {
    const mission = getMissionConfig(level);
    this.missionLevel = mission.level;
    this.missionTitle = mission.title;
    this.missionBriefing = mission.briefing;
    this.phase = "playing";
    this.lastRunSummary = null;
    this.doorOpen = false;
    this.switchHeld = false;
    this.simulationTime = 0;
    this.pingCount = this.throwCount = this.harmonicPingCount = this.focusCount = this.beaconCount = 0;
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.beacons = [];
    this.level = parseLevel(generateEchoMaze(mission));
    this.rebuildWorldFromLevel();
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = this.pitch = this.stepDistAccum = this.pingCooldown = this.focusCooldown = 0;
    this.resonance = this.echoDebt = this.silenceStreakSec = 0;
    this.hasEchoKey = false;
    this.exitDenyCooldown = 0;
    this.silenceBonusCount = 0;
    this.emitPulse(this.playerX, 0.35, this.playerZ, 0.42, 10, 0.55, false);
  }
  resetLevel(): void { this.startPlaying(); }
  goToMenu(): void {
    this.phase = "menu";
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.beacons = [];
    this.simulationTime = 0;
    this.doorOpen = this.switchHeld = this.hasEchoKey = false;
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = this.pitch = this.resonance = this.echoDebt = this.silenceStreakSec = 0;
    this.harmonicPingCount = this.focusCount = this.beaconCount = this.silenceBonusCount = 0;
  }
  emitPulse(x: number, y: number, z: number, strength: number, speed = 11, decay = 0.52, noise = true): void {
    this.tmpVec.set(x, y, z);
    this.pulseSystem.addPulse(this.tmpVec, strength, speed, decay, this.simulationTime);
    if (noise) this.pulseSystem.registerNoise(this.tmpVec, strength);
  }
  tick(dtRaw: number, forward: boolean, back: boolean, left: boolean, right: boolean, stealth: boolean): void {
    const dt = Math.min(MAX_DT, Math.max(0, dtRaw));
    if (this.phase !== "playing") return;
    this.simulationTime += dt;
    this.pingCooldown = Math.max(0, this.pingCooldown - dt);
    this.focusCooldown = Math.max(0, this.focusCooldown - dt);
    this.exitDenyCooldown = Math.max(0, this.exitDenyCooldown - dt);
    this.pulseSystem.updateNoise(dt);
    this.handleTileInteractions();
    this.movePlayer(dt, forward, back, left, right, stealth);
    this.updateQuietEconomy(dt, stealth);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateBeacons(dt);
    this.checkEndConditions();
  }
  private handleTileInteractions(): void {
    const g = worldToGrid(this.playerX, this.playerZ);
    const cell = getCell(this.level, g.ix, g.iz);
    const center = gridCenterWorld(g.ix, g.iz);
    if (cell === Cell.Key && !this.hasEchoKey && Math.hypot(this.playerX - center.x, this.playerZ - center.z) < 0.44) {
      this.hasEchoKey = true;
      this.audio.playKeyPickup();
      this.emitPulse(this.playerX, 0.35, this.playerZ, 0.55, 11, 0.5, false);
    }
    if (cell === Cell.Hazard) {
      this.playerX = this.spawnX;
      this.playerZ = this.spawnZ;
      this.audio.playHazard();
      this.emitPulse(this.playerX, 0.4, this.playerZ, 0.55, 9, 0.6);
    }
    const onSwitch = cell === Cell.Switch && Math.hypot(this.playerX - center.x, this.playerZ - center.z) < 0.48;
    if (onSwitch && !this.switchHeld) {
      this.doorOpen = true;
      this.audio.playSwitch();
    }
    this.switchHeld = onSwitch;
  }
  private movePlayer(dt: number, forward: boolean, back: boolean, left: boolean, right: boolean, stealth: boolean): void {
    const moveSpeed = stealth ? 3.35 : 6.15;
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (forward) { mx -= sin; mz -= cos; }
    if (back) { mx += sin; mz += cos; }
    if (left) { mx -= cos; mz += sin; }
    if (right) { mx += cos; mz -= sin; }
    const len = Math.hypot(mx, mz);
    if (len > 1e-6) { mx = (mx / len) * moveSpeed * dt; mz = (mz / len) * moveSpeed * dt; } else { mx = 0; mz = 0; }
    let nx = resolvePlayerCollision(this.level, this.playerX + mx, this.playerZ, this.doorOpen).x;
    let nz = resolvePlayerCollision(this.level, this.playerX, this.playerZ + mz, this.doorOpen).z;
    const r2 = resolvePlayerCollision(this.level, nx, nz, this.doorOpen);
    nx = r2.x; nz = r2.z;
    const moved = Math.hypot(nx - this.playerX, nz - this.playerZ);
    this.playerX = nx; this.playerZ = nz;
    this.handleFootsteps(dt, moved, stealth);
  }
  private handleFootsteps(dt: number, moved: number, stealth: boolean): void {
    const speed = moved / Math.max(dt, 1e-5);
    let chargeRate = speed < 0.14 ? 34 : stealth ? 23 : 7;
    const g = worldToGrid(this.playerX, this.playerZ);
    const cell = getCell(this.level, g.ix, g.iz);
    if (cell === Cell.Resonant) chargeRate += 6;
    this.resonance = Math.min(100, this.resonance + chargeRate * dt);
    this.echoDebt = Math.max(0, this.echoDebt - (stealth ? 0.107 : 0.042) * dt);
    if (moved <= 1e-5) return;
    this.stepDistAccum += moved;
    if (this.stepDistAccum < STEP_DISTANCE) return;
    this.stepDistAccum = 0;
    const mult = stealth ? STEALTH_STEP_MULT : 1;
    const stepBoost = cell === Cell.Resonant ? 1.55 : 1.0;
    this.emitPulse(this.playerX, 0.15, this.playerZ, STEP_STRENGTH * mult * stepBoost, 10, 0.58);
    this.audio.playFootstep(stealth);
    if (!stealth) this.echoDebt = Math.min(1, this.echoDebt + 0.03);
  }
  private updateQuietEconomy(dt: number, stealth: boolean): void {
    if (this.echoDebt <= SILENCE_DEBT_GATE) {
      this.silenceStreakSec += dt;
      if (this.silenceStreakSec >= SILENCE_STREAK_SECONDS) {
        this.silenceStreakSec = 0;
        this.resonance = Math.min(100, this.resonance + SILENCE_BONUS_RESONANCE + (stealth ? 4 : 0));
        this.silenceBonusCount += 1;
        this.audio.playSilenceBonus();
      }
    } else this.silenceStreakSec = 0;
  }
  private updateEnemies(dt: number): void {
    const tx = this.pulseSystem.lastNoisePos.x;
    const tz = this.pulseSystem.lastNoisePos.z;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      let ex = e.x, ez = e.z;
      const dist = Math.hypot(tx - ex, tz - ez);
      if (this.pulseSystem.noiseIntensity > 0.08 && dist > 0.15) {
        const sp = ENEMY_SPEED * (1 + this.echoDebt * 0.48) * (0.85 + Math.min(0.35, this.pulseSystem.noiseIntensity));
        ex += ((tx - ex) / dist) * sp * dt;
        ez += ((tz - ez) / dist) * sp * dt;
      }
      const r = resolveEnemyCollision(this.level, ex, ez, ENEMY_RADIUS, this.doorOpen);
      e.x = r.x; e.z = r.z;
      this.enemyMeshes[i]?.position.set(e.x, ENEMY_RADIUS + 0.02, e.z);
    }
  }
  private updateProjectiles(dt: number): void {
    const next: Projectile[] = [];
    for (const p of this.projectiles) {
      p.age += dt;
      let { x, z, vx, vz } = p;
      const rx = resolveEnemyCollision(this.level, x + vx * dt, z, PROJ_RADIUS, this.doorOpen).x;
      if (Math.abs(rx - (x + vx * dt)) > 1e-5) { vx *= -0.72; x = rx; p.bounces++; this.impactPulse(x, z); } else x += vx * dt;
      const rz = resolveEnemyCollision(this.level, x, z + vz * dt, PROJ_RADIUS, this.doorOpen).z;
      if (Math.abs(rz - (z + vz * dt)) > 1e-5) { vz *= -0.72; z = rz; p.bounces++; this.impactPulse(x, z); } else z += vz * dt;
      Object.assign(p, { x, z, vx, vz });
      if (p.bounces <= 8 && p.age <= 4.5) next.push(p);
    }
    this.projectiles = next;
  }
  private impactPulse(x: number, z: number): void {
    this.emitPulse(x, 0.22, z, THROW_STRENGTH * 0.85, 11, 0.55);
    this.audio.playPing(THROW_STRENGTH * 0.35);
  }
  private updateBeacons(dt: number): void {
    const keep: Beacon[] = [];
    for (const b of this.beacons) {
      b.age += dt;
      if (b.age >= b.nextPulse) {
        b.nextPulse += 1.1;
        this.emitPulse(b.x, 0.26, b.z, 0.5, 9.4, 0.58);
        this.echoDebt = Math.min(1, this.echoDebt + 0.012);
      }
      if (b.age <= 8.2) keep.push(b);
    }
    this.beacons = keep;
  }
  private checkEndConditions(): void {
    const atExit = Math.hypot(this.playerX - this.exitWorld.x, this.playerZ - this.exitWorld.z) < EXIT_RADIUS;
    if (atExit && this.level.keyPositions.length > 0 && !this.hasEchoKey && this.exitDenyCooldown <= 0) {
      this.exitDenyCooldown = 0.62;
      this.audio.playSealDenied();
    } else if (atExit && (this.hasEchoKey || this.level.keyPositions.length === 0)) {
      this.lastRunSummary = this.snapshotRun();
      this.phase = "won";
      this.audio.playWin();
    }
    for (const e of this.enemies) {
      if (Math.hypot(e.x - this.playerX, e.z - this.playerZ) < ENEMY_CATCH_RADIUS) {
        this.lastRunSummary = this.snapshotRun();
        this.phase = "lost";
        this.audio.playLose();
        break;
      }
    }
  }
  private snapshotRun(): RunStats {
    return { missionLevel: this.missionLevel, timeSec: this.simulationTime, pings: this.pingCount, throws: this.throwCount, harmonics: this.harmonicPingCount, focuses: this.focusCount, beacons: this.beaconCount, echoDebt: this.echoDebt, silenceBonuses: this.silenceBonusCount };
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
      this.audio.playHarmonicPing();
    } else {
      this.pingCooldown = 0.35;
      this.emitPulse(this.playerX, 0.4, this.playerZ, PING_STRENGTH, 12, 0.48);
      this.audio.playPing(PING_STRENGTH);
      this.resonance = Math.max(0, this.resonance - 9);
    }
  }
  tryFocus(): void {
    if (this.phase !== "playing" || this.focusCooldown > 0 || this.resonance < 18) return;
    this.focusCooldown = 1.6;
    this.focusCount += 1;
    this.resonance -= 18;
    this.emitPulse(this.playerX, 0.38, this.playerZ, 0.54, 5.8, 0.22, false);
    this.emitPulse(this.playerX, 0.5, this.playerZ, 0.34, 3.6, 0.18, false);
    this.audio.playFocus();
  }
  tryBeacon(): void {
    if (this.phase !== "playing" || this.beacons.length >= MAX_BEACONS || this.resonance < 24) return;
    this.resonance -= 24;
    this.beaconCount += 1;
    this.beacons.push({ x: this.playerX, z: this.playerZ, age: 0, nextPulse: 0.1 });
    this.emitPulse(this.playerX, 0.24, this.playerZ, 0.62, 10.5, 0.55);
    this.audio.playBeacon();
  }
  tryThrow(dirX: number, dirZ: number): void {
    if (this.phase !== "playing" || this.projectiles.length >= MAX_PROJECTILES) return;
    const len = Math.hypot(dirX, dirZ);
    if (len < 1e-5) return;
    const nx = dirX / len, nz = dirZ / len;
    this.throwCount += 1;
    this.echoDebt = Math.min(1, this.echoDebt + 0.078);
    this.projectiles.push({ x: this.playerX + nx * 0.45, z: this.playerZ + nz * 0.45, vx: nx * PROJ_SPEED, vz: nz * PROJ_SPEED, bounces: 0, age: 0 });
    this.audio.playThrow();
    this.emitPulse(this.playerX, 0.2, this.playerZ, 0.25, 9, 0.65);
  }
  addMouseLook(dx: number, dy: number): void {
    if (this.phase !== "playing") return;
    const s = MOUSE_SENS * this.mouseLookMul;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * s));
  }
  getForwardDirection(): { x: number; z: number } { return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) }; }
  getPlayerGrid(): { ix: number; iz: number } { return worldToGrid(this.playerX, this.playerZ); }
  getObjectiveText(): string {
    if (!this.hasEchoKey && this.level.keyPositions.length) return `${this.missionTitle}: find the echo key, then reach the gate.`;
    if (this.echoDebt > 0.62) return "Heat is high — sneak, pause, or throw a beacon decoy.";
    if (this.resonance >= RESONANCE_HARMONIC_THRESHOLD) return "Harmonic ready: Space paints a twin-ring map.";
    return `${this.missionTitle}: read echoes, avoid hunters, reach the green exit.`;
  }
  getNetworkState(id: string, name: string): RemotePeerState {
    return { id, name, x: this.playerX, z: this.playerZ, yaw: this.yaw, phase: this.phase, heat: this.echoDebt, resonance: this.resonance, t: performance.now() };
  }
  applyRemotePeers(peers: RemotePeerState[]): void {
    const live = new Set<string>();
    peers.forEach((p) => {
      live.add(p.id);
      this.remotePeers.set(p.id, p);
      let mesh = this.ghostMeshes.get(p.id);
      if (!mesh) { mesh = this.addSphere(this.ghostGeometry); this.ghostMeshes.set(p.id, mesh); }
      mesh.visible = p.phase === "playing";
      mesh.position.set(p.x, 0.28, p.z);
    });
    [...this.ghostMeshes].forEach(([id, mesh]) => {
      if (!live.has(id)) { this.scene.remove(mesh); this.ghostMeshes.delete(id); this.remotePeers.delete(id); }
    });
  }
  getRadarSnapshot(radius = 9): RadarSnapshot {
    const p = worldToGrid(this.playerX, this.playerZ);
    const cells = [];
    for (let iz = p.iz - radius; iz <= p.iz + radius; iz++) {
      for (let ix = p.ix - radius; ix <= p.ix + radius; ix++) cells.push({ ix, iz, cell: getCell(this.level, ix, iz) });
    }
    return { radius, cells, player: { ix: p.ix, iz: p.iz, x: this.playerX, z: this.playerZ, yaw: this.yaw }, exit: this.level.exit, keys: this.hasEchoKey ? [] : this.level.keyPositions, enemies: this.enemies.map((e) => ({ ...e })), beacons: this.beacons.map((b) => ({ x: b.x, z: b.z })), peers: [...this.remotePeers.values()] };
  }
  private syncMeshes(): void {
    this.projectileMeshes.forEach((m, i) => { const p = this.projectiles[i]; m.visible = !!p; if (p) m.position.set(p.x, PROJ_RADIUS + 0.02, p.z); });
    this.beaconMeshes.forEach((m, i) => { const b = this.beacons[i]; m.visible = !!b; if (b) m.position.set(b.x, BEACON_RADIUS + 0.02, b.z); });
  }
  render(): void {
    this.material.uniforms.uCameraPos.value.copy(this.camera.position);
    this.pulseSystem.applyToMaterial(this.material, this.simulationTime);
    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);
    this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"));
    this.syncMeshes();
    this.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.mesh.geometry.dispose();
    [this.enemyGeometry, this.projectileGeometry, this.ghostGeometry, this.beaconGeometry].forEach((g) => g.dispose());
    this.material.dispose();
    this.renderer.dispose();
  }
}
