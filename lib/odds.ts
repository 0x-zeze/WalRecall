/**
 * Odds parsing and P&L calculation for WalRecall.
 *
 * Supports American odds ("-110", "+150", "-200", "110") and Decimal odds ("1.91", "2.5").
 * Falls back to standard American -110 (decimal 1.9091) on invalid or missing odds.
 */

export interface ParsedOdds {
  decimal: number;
  valid: boolean;
  fallback: boolean;
}

export const FALLBACK_ODDS = "-110";
export const FALLBACK_DECIMAL = 1.9091;

/**
 * Parses an odds string into a decimal multiplier.
 *
 * Rules:
 * 1. Signed integer or integer with |x| >= 100: American odds.
 *    - Positive (e.g. "+150", "110"): decimal = 1 + (x / 100)
 *    - Negative (e.g. "-110", "-200"): decimal = 1 + (100 / |x|)
 * 2. Decimal number between 1.01 and 100: Decimal odds.
 * 3. Anything else (invalid or empty): fallback to -110 (1.9091) with fallback: true.
 */
export function parseOdds(oddsRaw: string | undefined | null): ParsedOdds {
  if (!oddsRaw || typeof oddsRaw !== "string") {
    return { decimal: FALLBACK_DECIMAL, valid: false, fallback: true };
  }

  const str = oddsRaw.trim();
  if (!str) {
    return { decimal: FALLBACK_DECIMAL, valid: false, fallback: true };
  }

  // Check for American odds: integer, possibly signed, or absolute value >= 100
  // e.g. "-110", "+150", "-200", "110", "+100", "-100"
  const americanRegex = /^[+-]?\d+$/;
  if (americanRegex.test(str)) {
    const val = parseInt(str, 10);
    // Explicitly signed integer (e.g. "+150", "-110") or |val| >= 100
    const isSigned = str.startsWith("+") || str.startsWith("-");
    if (Math.abs(val) >= 100 || isSigned) {
      if (val > 0) {
        return {
          decimal: Number((1 + val / 100).toFixed(4)),
          valid: true,
          fallback: false,
        };
      } else if (val < 0) {
        const absVal = Math.abs(val);
        return {
          decimal: Number((1 + 100 / absVal).toFixed(4)),
          valid: true,
          fallback: false,
        };
      }
      // val === 0 is invalid
    }
  }

  // Check for Decimal odds: e.g. "1.91", "2.5", "1.50"
  // Must be between 1.01 and 100
  const decimalRegex = /^\d+(\.\d+)?$/;
  if (decimalRegex.test(str)) {
    const val = parseFloat(str);
    if (!isNaN(val) && val >= 1.01 && val <= 100) {
      return {
        decimal: Number(val.toFixed(4)),
        valid: true,
        fallback: false,
      };
    }
  }

  // Fallback for invalid input
  return {
    decimal: FALLBACK_DECIMAL,
    valid: false,
    fallback: true,
  };
}

/**
 * Calculates profit and loss (P&L) from stake, odds, and outcome.
 *
 * - ACCURATE (win): Math.round(stake * (decimal - 1))
 * - FAILED (loss): -Math.round(stake)
 * - Invalid stake (<= 0 or not finite): 0
 */
export function pnlFromOdds(
  stake: number,
  odds: string | undefined | null,
  outcome: "ACCURATE" | "FAILED" | string
): number {
  if (typeof stake !== "number" || !Number.isFinite(stake) || stake <= 0) {
    return 0;
  }

  if (outcome === "ACCURATE") {
    const { decimal } = parseOdds(odds);
    const multiplier = Number((decimal - 1).toFixed(6));
    return Math.round(stake * multiplier);
  }

  if (outcome === "FAILED") {
    return -Math.round(stake);
  }

  return 0;
}
