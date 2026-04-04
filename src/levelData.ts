/**
 * Echo maze with resonant tiles (=), echo-key (k), switch gate, hazards,
 * absorbing vs decoy wings — exit is sealed until the key resonates.
 */
export const LEVEL_ROWS = [
  "WWWWWWWWWWWWWWWWW",
  "W.......P.......W",
  "W.WWWWW.W.WWWWW.W",
  "W.W.a...W...d.W.W",
  "W.W.WWW.W.WWW.W.W",
  "W...W...s...W...W",
  "WWW.WWWWoWWW.WWWW",
  "W...H..=..m...k.W",
  "W.WWWWWWWWWWWWW.W",
  "W.......n....e..W",
  "WWWWWWWWWWWWWWWWW",
] as const;
