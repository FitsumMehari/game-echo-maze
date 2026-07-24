export type MutatorId = "none" | "no-radar" | "eternal-heat" | "twin-hunt" | "blind";

export interface MutatorDef {
  id: MutatorId;
  label: string;
  note: string;
  /** Requires campaign clear (mission 33 unlocked progress) */
  requiresFinale: boolean;
}

export const MUTATORS: MutatorDef[] = [
  { id: "none", label: "None", note: "standard rules", requiresFinale: false },
  { id: "no-radar", label: "No Radar", note: "radar forced off", requiresFinale: true },
  { id: "eternal-heat", label: "Eternal Heat", note: "heat barely decays", requiresFinale: true },
  { id: "twin-hunt", label: "Twin Hunt", note: "+2 hunters", requiresFinale: true },
  { id: "blind", label: "Blind Cartography", note: "no visual assist, dimmer baseline", requiresFinale: true },
];

export function getMutator(id: MutatorId): MutatorDef {
  return MUTATORS.find((m) => m.id === id) ?? MUTATORS[0]!;
}
