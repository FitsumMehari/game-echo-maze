import type { DifficultyProfile } from "@/systems/difficulty";
import type { MutatorId } from "@/systems/mutators";
import type { MissionConfig } from "@/systems/campaign";
import type { Beacon } from "@/core/types";
import type { EnemySnapshot } from "@/systems/runSave";

export interface StartOptions {
  mission?: MissionConfig;
  difficulty?: DifficultyProfile;
  mutator?: MutatorId;
  restore?: {
    playerX: number;
    playerZ: number;
    yaw: number;
    pitch: number;
    simulationTime: number;
    resonance: number;
    echoDebt: number;
    hasEchoKey: boolean;
    doorOpen: boolean;
    seed?: number;
    spawnX?: number;
    spawnZ?: number;
    enemies?: EnemySnapshot[];
    beacons?: Beacon[];
  };
}
