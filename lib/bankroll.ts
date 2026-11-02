/**
 * Pure bankroll and stake sizing helpers for WalRecall.
 * Implements Laplace smoothing for forecaster hit rates and Kelly Criterion.
 */

/**
 * Calculates Laplace smoothed win probability: (wins + 1) / (n + 2).
 * Guards against small sample distortion (e.g. 1/1 = 100% or 0/1 = 0%).
 */
export function laplaceWinProbability(
  wins: number,
  losses: number
): { winProbPercent: number; n: number; lowSample: boolean } {
  const safeWins = Math.max(0, wins || 0);
  const safeLosses = Math.max(0, losses || 0);
  const n = safeWins + safeLosses;
  const prob = (safeWins + 1) / (n + 2);
  return {
    winProbPercent: Number((prob * 100).toFixed(1)),
    n,
    lowSample: n < 5,
  };
}

export interface KellyResult {
  fullKellyPercent: number;
  recommendedPercent: number;
  recommendedStake: number;
  hasEdge: boolean;
  explanation: string;
}

/**
 * Calculates Quarter-Kelly (or custom fraction) recommended stake size.
 * Uses CURRENT simulated balance, not starting balance.
 * Returns 0% with explanation "no edge at these odds" if edge <= 0.
 */
export function calculateKelly(
  currentBalance: number,
  decimalOdds: number,
  winProbPercent: number,
  fraction = 0.25 // Quarter-Kelly institutional standard
): KellyResult {
  if (currentBalance <= 0 || !Number.isFinite(currentBalance)) {
    return {
      fullKellyPercent: 0,
      recommendedPercent: 0,
      recommendedStake: 0,
      hasEdge: false,
      explanation: "no balance available",
    };
  }

  const b = Math.max(0.001, decimalOdds - 1);
  const p = Math.max(0, Math.min(1, winProbPercent / 100));
  const q = 1 - p;

  const edge = b * p - q;

  if (edge <= 0) {
    return {
      fullKellyPercent: 0,
      recommendedPercent: 0,
      recommendedStake: 0,
      hasEdge: false,
      explanation: "no edge at these odds",
    };
  }

  const fullKelly = ((b * p - q) / b) * 100;
  const recommendedPercent = Number((fullKelly * fraction).toFixed(2));
  const recommendedStake = Math.round(currentBalance * (recommendedPercent / 100));

  return {
    fullKellyPercent: Number(fullKelly.toFixed(2)),
    recommendedPercent,
    recommendedStake,
    hasEdge: true,
    explanation: `${recommendedPercent}% Quarter-Kelly allocation`,
  };
}
