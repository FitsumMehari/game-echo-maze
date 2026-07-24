import * as THREE from "three";
import { EYE_HEIGHT, RESONANCE_HARMONIC_THRESHOLD } from "@/core/constants";
import type { Beacon, Enemy, Landmark, Projectile, RadarSnapshot, RemotePeerState, RunStats } from "@/core/types";
import { tryBeacon as doBeacon, tryFocus as doFocus, tryPing as doPing, tryThrow as doThrow } from "@/game/abilities";
import { checkEndConditions } from "@/game/endCheck";
import { impactPing, resolveProjectileKills, updateBeacons, updateLandmarks, updateProjectiles } from "@/game/entities";
import { eaterDampRadius, updateHunter } from "@/game/hunterAi";
import { handleTileInteractions, isHiddenFromHunters, movePlayer, updateQuietEconomy } from "@/game/playerMove";
import { createPulseUniforms, PulseSystem, type NoiseKind } from "@/game/pulseSystem";
import { applyRestore, buildMissionLevel } from "@/game/session";
import type { StartOptions } from "@/game/startOptions";
import type { AudioEngine } from "@/audio/AudioEngine";
import type { MutatorId } from "@/systems/mutators";
import type { ThemeId } from "@/systems/settings";
import { getMissionConfig } from "@/systems/campaign";
import { getDifficulty } from "@/systems/difficulty";
import { Cell, getCell, gridCenterWorld, worldToGrid, type ParsedLevel } from "@/world/level";
import { worldFragmentShader, worldVertexShader } from "@/world/shaders/worldShader";
import { buildEchoSphere, buildWorldMeshes } from "@/world/worldGeometry";

export type { StartOptions };

const ENEMY_RADIUS = 0.28;
const PROJ_RADIUS = 0.12;
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
  phase: "menu" | "playing" | "paused" | "won" | "lost" = "menu";
  missionLevel = 1;
  missionTitle = "Mission 1/33";
  missionBriefing = "";
  missionSeed = 0;
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
  memoryKey: { ix: number; iz: number } | null = null;
  memoryExit: { ix: number; iz: number } | null = null;
  threat = 0;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  beacons: Beacon[] = [];
  landmarks: Landmark[] = [];
  difficulty = getDifficulty("normal");
  mutator: MutatorId = "none";
  flashReduce = false;
  loreShown = new Set<string>();
  onLore: ((text: string) => void) | null = null;
  onPingJuice: (() => void) | null = null;
  private stealthHeld = false;
  exitDenyCooldown = 0;
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
  readonly exitWorld = { x: 0, z: 0 };
  readonly audio: AudioEngine;
  lastDeathTip = "";

  constructor(audio: AudioEngine) {
    this.audio = audio;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.setQuality("high");
    this.renderer.setClearColor(0x000008, 1);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.07, 260);
    this.scene.fog = new THREE.FogExp2(0x020208, 0.011);
    const first = getMissionConfig(1);
    this.missionTitle = first.title;
    this.missionBriefing = first.briefing;
    this.missionSeed = first.seed;
    const built = buildMissionLevel(first, this.difficulty, this.mutator);
    this.level = built.level;
    this.enemies = built.enemies;
    this.landmarks = built.landmarks;
    const { merged } = buildWorldMeshes(this.level, false);
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
    for (let i = 0; i < MAX_PROJECTILES; i++)
      this.projectileMeshes.push(this.addSphere(this.projectileGeometry, false));
    for (let i = 0; i < MAX_BEACONS; i++) this.beaconMeshes.push(this.addSphere(this.beaconGeometry, false));
    this.camera.position.set(this.playerX, EYE_HEIGHT, this.playerZ);
  }

  setQuality(q: "low" | "med" | "high"): void {
    const cap = q === "low" ? 1 : q === "med" ? 1.5 : 2;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, cap));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
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
    const dim = this.mutator === "blind";
    const density = dim ? 0.028 : 0.011;
    if (this.scene.fog instanceof THREE.FogExp2) this.scene.fog.density = density;
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
    this.mesh.geometry = buildWorldMeshes(this.level, this.doorOpen).merged;
  }

  syncSpawnFromLevel(): void {
    const p = gridCenterWorld(this.level.playerIx, this.level.playerIz);
    this.spawnX = p.x;
    this.spawnZ = p.z;
    this.playerX = p.x;
    this.playerZ = p.z;
  }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(1, w) / Math.max(1, h);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(Math.max(1, w), Math.max(1, h));
  }

  startPlaying(opts: StartOptions = {}): void {
    let mission = opts.mission ?? getMissionConfig(this.missionLevel);
    this.difficulty = opts.difficulty ?? this.difficulty;
    this.mutator = opts.mutator ?? this.mutator;
    if (opts.restore?.seed != null && opts.restore.seed > 0) {
      mission = { ...mission, seed: opts.restore.seed };
    }
    const built = buildMissionLevel(mission, this.difficulty, this.mutator);
    this.missionLevel = mission.level;
    this.missionTitle = mission.title;
    this.missionBriefing = mission.briefing;
    this.missionSeed = built.seed;
    this.phase = "playing";
    this.lastRunSummary = null;
    this.doorOpen = false;
    this.switchHeld = false;
    this.simulationTime = 0;
    this.pingCount = this.throwCount = this.harmonicPingCount = this.focusCount = this.beaconCount = 0;
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.beacons = [];
    this.level = built.level;
    this.enemies = built.enemies;
    this.landmarks = built.landmarks;
    this.loreShown = new Set();
    this.rebuildWorldFromLevel();
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = this.pitch = this.stepDistAccum = this.pingCooldown = this.focusCooldown = 0;
    this.resonance = this.echoDebt = this.silenceStreakSec = this.threat = 0;
    this.hasEchoKey = false;
    this.exitDenyCooldown = 0;
    this.silenceBonusCount = 0;
    this.memoryKey = null;
    this.memoryExit = null;
    if (opts.restore) {
      applyRestore(this, opts.restore);
      this.rebuildEnemyMeshes();
      if (this.doorOpen) this.rebuildWorldFromLevel();
    }
    this.emitPulse(this.playerX, 0.35, this.playerZ, 0.42, 10, 0.55, false);
    this.onLore?.(mission.briefing);
  }

  resetLevel(): void {
    this.startPlaying({
      difficulty: this.difficulty,
      mutator: this.mutator,
      mission: getMissionConfig(this.missionLevel),
    });
  }

  goToMenu(): void {
    this.phase = "menu";
    this.pulseSystem.pulses = [];
    this.projectiles = [];
    this.beacons = [];
    this.landmarks = [];
    this.simulationTime = 0;
    this.doorOpen = this.switchHeld = this.hasEchoKey = false;
    this.syncSpawnFromLevel();
    this.rebuildEnemyMeshes();
    this.yaw = this.pitch = this.resonance = this.echoDebt = this.silenceStreakSec = this.threat = 0;
  }

  emitPulse(
    x: number,
    y: number,
    z: number,
    strength: number,
    speed = 11,
    decay = 0.52,
    noise = true,
    noiseKind: NoiseKind = "pulse",
  ): void {
    let s = this.flashReduce ? strength * 0.72 : strength;
    for (const e of this.enemies) {
      const r = eaterDampRadius(e);
      if (r > 0 && Math.hypot(e.x - x, e.z - z) < r) s *= 0.55;
    }
    this.tmpVec.set(x, y, z);
    this.pulseSystem.addPulse(this.tmpVec, s, speed, decay, this.simulationTime);
    if (noise) this.pulseSystem.registerNoise(this.tmpVec, s * this.difficulty.heatGainMul, noiseKind);
  }

  tick(
    dtRaw: number,
    forward: boolean,
    back: boolean,
    left: boolean,
    right: boolean,
    stealth: boolean,
    micHeat = 0,
  ): void {
    const dt = Math.min(MAX_DT, Math.max(0, dtRaw));
    if (this.phase !== "playing") return;
    this.stealthHeld = stealth;
    this.simulationTime += dt;
    this.pingCooldown = Math.max(0, this.pingCooldown - dt);
    this.focusCooldown = Math.max(0, this.focusCooldown - dt);
    this.exitDenyCooldown = Math.max(0, this.exitDenyCooldown - dt);
    this.pulseSystem.updateNoise(dt);
    if (micHeat > 0.12) this.echoDebt = Math.min(1, this.echoDebt + micHeat * 0.35 * dt);
    handleTileInteractions(this);
    movePlayer(this, dt, forward, back, left, right, stealth);
    updateQuietEconomy(this, dt, stealth);
    this.updateEnemies(dt);
    this.projectiles = updateProjectiles(this.projectiles, dt, this.level, this.doorOpen, (x, z) =>
      impactPing(this.audio, this.emitPulse.bind(this), x, z),
    );
    this.resolveStoneKills();
    this.beacons = updateBeacons(
      this.beacons,
      dt,
      this.difficulty.heatGainMul,
      (x, y, z, s, sp, d) => this.emitPulse(x, y, z, s, sp, d, true, "beacon"),
      (n) => {
        this.echoDebt = Math.min(1, this.echoDebt + n);
      },
    );
    updateLandmarks(this.landmarks, dt, this.emitPulse.bind(this), this.audio, this.playerX, this.playerZ);
    this.updateThreat(dt);
    checkEndConditions(this);
  }

  get hidden(): boolean {
    return isHiddenFromHunters(this, this.stealthHeld);
  }

  setCheckpoint(x: number, z: number): void {
    this.spawnX = x;
    this.spawnZ = z;
  }

  private resolveStoneKills(): void {
    const result = resolveProjectileKills(this.projectiles, this.enemies);
    if (!result.kills.length) return;
    this.projectiles = result.projectiles;
    this.enemies = result.enemies;
    this.rebuildEnemyMeshes();
    for (const e of result.kills) {
      this.emitPulse(e.x, 0.35, e.z, 0.55, 10, 0.4, true, "stone");
      this.audio.playEnemyDown(e.x - this.playerX, e.z - this.playerZ);
    }
  }

  private updateEnemies(dt: number): void {
    const tx = this.pulseSystem.lastNoisePos.x;
    const tz = this.pulseSystem.lastNoisePos.z;
    const pathOn = this.missionLevel >= 10;
    this.audio.setListener(this.playerX, this.playerZ, this.level, this.doorOpen);
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i]!;
      updateHunter(
        e,
        dt,
        { x: tx, z: tz },
        this.pulseSystem.noiseIntensity,
        this.playerX,
        this.playerZ,
        this.echoDebt,
        this.level,
        this.doorOpen,
        this.difficulty.hunterSpeedMul,
        ENEMY_RADIUS,
        pathOn,
        () => this.audio.playLoseInterest(e.x - this.playerX, e.z - this.playerZ),
      );
      this.enemyMeshes[i]?.position.set(e.x, ENEMY_RADIUS + 0.02, e.z);
      this.audio.playHunterPresence(e.x - this.playerX, e.z - this.playerZ, e.state, e.kind);
    }
  }

  private updateThreat(dt: number): void {
    let nearest = 99;
    let chasing = 0;
    for (const e of this.enemies) {
      nearest = Math.min(nearest, Math.hypot(e.x - this.playerX, e.z - this.playerZ));
      if (e.state === "chase" || e.state === "search") chasing += 1;
    }
    const prox = nearest < 12 ? 1 - nearest / 12 : 0;
    const target = Math.min(1, prox * 0.75 + chasing * 0.2 + this.echoDebt * 0.35);
    this.threat += (target - this.threat) * Math.min(1, dt * 3.5);
    this.audio.updateTension(this.echoDebt, this.resonance, this.threat);
  }

  tryPing(): void {
    const n = this.pingCount;
    doPing(this);
    if (this.pingCount > n) this.onPingJuice?.();
  }
  tryFocus(): void {
    doFocus(this);
  }
  tryBeacon(): void {
    doBeacon(this);
  }
  tryThrow(dirX: number, dirZ: number): void {
    doThrow(this, dirX, dirZ);
  }

  addMouseLook(dx: number, dy: number): void {
    if (this.phase !== "playing") return;
    const s = MOUSE_SENS * this.mouseLookMul;
    this.yaw -= dx * s;
    this.pitch = Math.max(-1.45, Math.min(1.45, this.pitch - dy * s));
  }

  getForwardDirection(): { x: number; z: number } {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  getPlayerGrid(): { ix: number; iz: number } {
    return worldToGrid(this.playerX, this.playerZ);
  }

  getObjectiveText(): string {
    if (isHiddenFromHunters(this, this.stealthHeld)) return "Hidden — hold Stealth with low heat to stay immune.";
    if (!this.hasEchoKey && this.level.keyPositions.length)
      return `${this.missionTitle}: find the echo key, then reach the gate.`;
    if (this.doorOpen) return "Seal open — path through the door is clear.";
    if (this.threat > 0.7) return "Hunter pressure high — beacon, hide, or break line of noise.";
    if (this.echoDebt > 0.62) return "Heat is high — sneak, pause, or throw a beacon decoy.";
    if (this.resonance >= RESONANCE_HARMONIC_THRESHOLD) return "Harmonic ready: Space paints a twin-ring map.";
    return `${this.missionTitle}: read echoes, avoid hunters, reach the green exit.`;
  }

  /** Nearest active hunter for threat compass. */
  getNearestThreat(): { dist: number; bearing: number } | null {
    let best: { dist: number; bearing: number } | null = null;
    for (const e of this.enemies) {
      if (e.state === "idle" || e.state === "return") continue;
      const dx = e.x - this.playerX;
      const dz = e.z - this.playerZ;
      const dist = Math.hypot(dx, dz);
      if (!best || dist < best.dist) best = { dist, bearing: Math.atan2(dx, dz) };
    }
    return best;
  }

  getNetworkState(id: string, name: string): RemotePeerState {
    return {
      id,
      name,
      x: this.playerX,
      z: this.playerZ,
      yaw: this.yaw,
      phase: this.phase,
      heat: this.echoDebt,
      resonance: this.resonance,
      t: performance.now(),
    };
  }

  applyRemotePeers(peers: RemotePeerState[]): void {
    const live = new Set<string>();
    peers.forEach((p) => {
      live.add(p.id);
      this.remotePeers.set(p.id, p);
      let mesh = this.ghostMeshes.get(p.id);
      if (!mesh) {
        mesh = this.addSphere(this.ghostGeometry);
        this.ghostMeshes.set(p.id, mesh);
      }
      mesh.visible = p.phase === "playing";
      mesh.position.set(p.x, 0.28, p.z);
    });
    [...this.ghostMeshes].forEach(([id, mesh]) => {
      if (!live.has(id)) {
        this.scene.remove(mesh);
        this.ghostMeshes.delete(id);
        this.remotePeers.delete(id);
      }
    });
  }

  getRadarSnapshot(radius = 9): RadarSnapshot {
    const p = worldToGrid(this.playerX, this.playerZ);
    const cells = [];
    for (let iz = p.iz - radius; iz <= p.iz + radius; iz++) {
      for (let ix = p.ix - radius; ix <= p.ix + radius; ix++) {
        const cell = getCell(this.level, ix, iz);
        cells.push({ ix, iz, cell });
        if (cell === Cell.Key && !this.hasEchoKey) this.memoryKey = { ix, iz };
        if (cell === Cell.Exit) this.memoryExit = { ix, iz };
      }
    }
    return {
      radius,
      cells,
      player: { ix: p.ix, iz: p.iz, x: this.playerX, z: this.playerZ, yaw: this.yaw },
      exit: this.level.exit,
      keys: this.hasEchoKey ? [] : this.level.keyPositions,
      enemies: this.enemies.map((e) => ({ x: e.x, z: e.z, state: e.state, kind: e.kind })),
      beacons: this.beacons.map((b) => ({ x: b.x, z: b.z })),
      peers: [...this.remotePeers.values()],
      memoryKey: this.memoryKey,
      memoryExit: this.memoryExit,
    };
  }

  private syncMeshes(): void {
    this.projectileMeshes.forEach((m, i) => {
      const p = this.projectiles[i];
      m.visible = !!p;
      if (p) m.position.set(p.x, PROJ_RADIUS + 0.02, p.z);
    });
    this.beaconMeshes.forEach((m, i) => {
      const b = this.beacons[i];
      m.visible = !!b;
      if (b) m.position.set(b.x, BEACON_RADIUS + 0.02, b.z);
    });
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
    this.ghostMeshes.forEach((m) => this.scene.remove(m));
    this.ghostMeshes.clear();
    this.audio.dispose();
  }
}
