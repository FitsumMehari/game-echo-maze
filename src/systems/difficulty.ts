export type DifficultyId = "story" | "normal" | "overdrive";

export interface DifficultyProfile {
  id: DifficultyId;
  label: string;
  note: string;
  hunterSpeedMul: number;
  catchRadiusMul: number;
  heatDecayMul: number;
  heatGainMul: number;
  enemyCountAdd: number;
  resonanceGainMul: number;
}

export const DIFFICULTIES: DifficultyProfile[] = [
  {
    id: "story",
    label: "Story",
    note: "softer hunters, faster silence recovery",
    hunterSpeedMul: 0.78,
    catchRadiusMul: 0.88,
    heatDecayMul: 1.35,
    heatGainMul: 0.75,
    enemyCountAdd: 0,
    resonanceGainMul: 1.2,
  },
  {
    id: "normal",
    label: "Normal",
    note: "intended balance",
    hunterSpeedMul: 1,
    catchRadiusMul: 1,
    heatDecayMul: 1,
    heatGainMul: 1,
    enemyCountAdd: 0,
    resonanceGainMul: 1,
  },
  {
    id: "overdrive",
    label: "Overdrive",
    note: "faster hunters, hotter noise, +1 hunter",
    hunterSpeedMul: 1.22,
    catchRadiusMul: 1.08,
    heatDecayMul: 0.72,
    heatGainMul: 1.28,
    enemyCountAdd: 2,
    resonanceGainMul: 0.9,
  },
];

export function getDifficulty(id: DifficultyId): DifficultyProfile {
  return DIFFICULTIES.find((d) => d.id === id) ?? DIFFICULTIES[1]!;
}
