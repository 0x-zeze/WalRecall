export const MIN_STARTING_CAPITAL = 10;
export const MAX_STARTING_CAPITAL = 1_000_000_000;

/**
 * Normalizes number/price string with support for commas, dots, and 'k' multiplier.
 * e.g. "5000" -> 5000, "1,5" -> 1.5, "5,000" -> 5000, "5k" -> 5000
 */
export function normalizePriceString(raw: string): number | null {
  if (!raw || typeof raw !== "string") return null;
  const str = raw.trim().toLowerCase();

  // Handle 'k' / 'K' suffix
  const kMatch = str.match(/([\d.,]+)\s*k\b/);
  if (kMatch) {
    const base = normalizePriceString(kMatch[1]);
    return base !== null && base > 0 ? base * 1000 : null;
  }

  // Extract clean number token with digits, commas, periods
  const tokenMatch = str.match(/[\d.,]+/);
  if (!tokenMatch) return null;
  let token = tokenMatch[0];

  const hasComma = token.includes(",");
  const hasDot = token.includes(".");

  if (hasComma && hasDot) {
    const lastComma = token.lastIndexOf(",");
    const lastDot = token.lastIndexOf(".");
    if (lastDot > lastComma) {
      token = token.replace(/,/g, "");
    } else {
      token = token.replace(/\./g, "").replace(",", ".");
    }
  } else if (hasComma) {
    const thousandsPattern = /^[1-9]\d{0,2}(,\d{3})+$/;
    if (thousandsPattern.test(token)) {
      token = token.replace(/,/g, "");
    } else {
      token = token.replace(",", ".");
    }
  }

  const val = parseFloat(token);
  return !isNaN(val) && val > 0 ? val : null;
}

/**
 * Parses user input string for starting capital.
 * Accepts digits, commas, decimals, and k/K suffixes via normalizePriceString.
 * Returns null if input is empty, non-numeric, or invalid.
 */
export function parseStartingCapital(input: string): number | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const parsed = normalizePriceString(trimmed);
  if (parsed === null || !Number.isFinite(parsed) || isNaN(parsed)) return null;
  return parsed;
}

/**
 * Clamps starting capital within [MIN_STARTING_CAPITAL, MAX_STARTING_CAPITAL].
 * Guards against NaN, negative, or Infinity.
 */
export function clampStartingCapital(
  value: number,
  min = MIN_STARTING_CAPITAL,
  max = MAX_STARTING_CAPITAL
): number {
  if (!Number.isFinite(value) || isNaN(value)) return min;
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves final capital on blur/Enter.
 * Clamps the parsed value (or fallback if empty/invalid) to the safe range.
 */
export function resolveCapitalOnBlur(
  input: string,
  currentValue: number,
  min = MIN_STARTING_CAPITAL,
  max = MAX_STARTING_CAPITAL
): { value: number; formatted: string; outOfRange: boolean } {
  const parsed = parseStartingCapital(input);
  if (parsed === null) {
    const clampedFallback = clampStartingCapital(currentValue, min, max);
    return {
      value: clampedFallback,
      formatted: String(clampedFallback),
      outOfRange: false,
    };
  }
  const clamped = clampStartingCapital(parsed, min, max);
  const outOfRange = parsed < min || parsed > max;
  return {
    value: clamped,
    formatted: String(clamped),
    outOfRange,
  };
}

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
