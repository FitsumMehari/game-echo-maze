import type { RunStats } from "@/core/types";

export function gradeRun(stats: RunStats, won: boolean): string {
  if (!won) return "F";
  let score = 100;
  score -= Math.min(35, stats.pings * 2.2);
  score -= Math.min(20, stats.throws * 3);
  score -= Math.min(15, stats.echoDebt * 40);
  score += Math.min(20, stats.silenceBonuses * 4);
  score += Math.min(10, stats.focuses * 1.5);
  if (stats.timeSec > 240) score -= 15;
  else if (stats.timeSec < 90) score += 8;
  if (score >= 92) return "S";
  if (score >= 82) return "A";
  if (score >= 70) return "B";
  if (score >= 55) return "C";
  return "D";
}
