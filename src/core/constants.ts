/** World units per grid cell (horizontal footprint) */
export const CELL_SIZE = 1;

/** Vertical extent of solid wall blocks — taller than eye height so corridors feel enclosed */
export const WALL_HEIGHT = 5.8;

/** Procedural maze grid size (odd — outer shell is wall). ~79×79 ≈ “endless” on foot */
export const MAZE_WIDTH_CELLS = 79;
export const MAZE_HEIGHT_CELLS = 79;

/** Player capsule (XZ circle) radius */
export const PLAYER_RADIUS = 0.22;

/** Eye height from floor */
export const EYE_HEIGHT = 1.55;

/** Max simultaneous echo pulses in shader */
export const MAX_PULSES = 8;

/** Manual ping strength */
export const PING_STRENGTH = 1.15;

/** Footstep pulse strength */
export const STEP_STRENGTH = 0.38;

/** Quiet walk multiplier (hold Shift) */
export const STEALTH_STEP_MULT = 0.35;

/** Throw impact pulse */
export const THROW_STRENGTH = 0.72;

/** Distance traveled before footstep pulse */
export const STEP_DISTANCE = 0.42;

/** Enemy catch radius */
export const ENEMY_CATCH_RADIUS = 0.62;

/** Exit trigger radius */
export const EXIT_RADIUS = 0.65;

/** Resonance (0–100): standing still & stealth build charge for a harmonic ping. */
export const RESONANCE_HARMONIC_THRESHOLD = 72;
export const RESONANCE_HARMONIC_COST = 72;

/** Echo heat must stay at or below this (0–1) to build a silence streak. */
export const SILENCE_DEBT_GATE = 0.16;
/** Seconds of quiet heat before Resonance dividend. */
export const SILENCE_STREAK_SECONDS = 4.25;
/** Resonance granted each time the silence dividend fires. */
export const SILENCE_BONUS_RESONANCE = 22;
