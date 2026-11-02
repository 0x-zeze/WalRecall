import type { PredictionRecord } from "./types";
import { parseOdds } from "./odds";

export interface LeagueAssetMetric {
  name: string;
  winRate: number;
  picks: number;
  pnl: number;
  lowSample: boolean;
  fill?: string;
}

export interface OddsRangeMetric {
  range: string;
  count: number;
  hitRate: number;
  pnl: number;
  lowSample: boolean;
}

export interface ConfidenceMetric {
  level: string;
  stars: number;
  count: number;
  hitRate: number;
  avgPnl: string;
  lowSample: boolean;
}

export interface MonthlyPnlMetric {
  month: string;
  pnl: number;
  count: number;
  ts: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  crypto: "#38bdf8",
  soccer: "#22c55e",
  basketball: "#f97316",
  baseball: "#eab308",
  nba: "#f97316",
  ucl: "#a855f7",
  epl: "#22c55e",
  laliga: "#ef4444",
};

/**
 * Computes win rate and PnL breakdown by League / Asset / Category from resolved records.
 */
export function computeLeagueAnalytics(records: PredictionRecord[]): LeagueAssetMetric[] {
  const resolved = records.filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED");
  if (resolved.length === 0) return [];

  const groups = new Map<string, { wins: number; picks: number; pnl: number; key: string }>();

  for (const r of resolved) {
    const name = r.leagueOrAsset || r.asset || r.sportType || "General";
    const existing = groups.get(name) || { wins: 0, picks: 0, pnl: 0, key: name };
    existing.picks += 1;
    if (r.outcome === "ACCURATE") existing.wins += 1;
    existing.pnl += r.pnl || 0;
    groups.set(name, existing);
  }

  const results: LeagueAssetMetric[] = [];
  for (const item of Array.from(groups.values())) {
    const winRate = item.picks > 0 ? Number(((item.wins / item.picks) * 100).toFixed(1)) : 0;
    const lowerKey = item.key.toLowerCase();
    const fill =
      CATEGORY_COLORS[lowerKey] ||
      (lowerKey.includes("crypto") || lowerKey.includes("sui") || lowerKey.includes("btc")
        ? "var(--accent)"
        : "#a855f7");

    results.push({
      name: item.key,
      winRate,
      picks: item.picks,
      pnl: item.pnl,
      lowSample: item.picks < 5,
      fill,
    });
  }

  // Sort by picks descending, then winRate
  results.sort((a, b) => b.picks - a.picks || b.winRate - a.winRate);
  return results;
}

/**
 * Classifies resolved records into 4 standardized odds ranges:
 * - Heavy Favs (< -140): decimal < 1.714
 * - Slight Favs (-140 to -110): 1.714 <= decimal < 2.0
 * - Even / Plus (+100 to +125): 2.0 <= decimal <= 2.25
 * - Underdogs (> +125): decimal > 2.25
 */
export function computeOddsRangeAnalytics(records: PredictionRecord[]): OddsRangeMetric[] {
  const resolved = records.filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED");

  const BUCKETS = [
    { range: "Heavy Favs (< -140)", minDec: 0, maxDec: 1.714 },
    { range: "Slight Favs (-140 to -110)", minDec: 1.714, maxDec: 2.0 },
    { range: "Even / Plus (+100 to +125)", minDec: 2.0, maxDec: 2.251 },
    { range: "Underdogs (> +125)", minDec: 2.251, maxDec: Infinity },
  ];

  const bucketMap = new Map<string, { wins: number; count: number; pnl: number }>();
  for (const b of BUCKETS) {
    bucketMap.set(b.range, { wins: 0, count: 0, pnl: 0 });
  }

  for (const r of resolved) {
    const { decimal } = parseOdds(r.odds);
    let matchedRange = "Underdogs (> +125)";
    for (const b of BUCKETS) {
      if (decimal >= b.minDec && decimal < b.maxDec) {
        matchedRange = b.range;
        break;
      }
    }

    const cur = bucketMap.get(matchedRange)!;
    cur.count += 1;
    if (r.outcome === "ACCURATE") cur.wins += 1;
    cur.pnl += r.pnl || 0;
  }

  return BUCKETS.map((b) => {
    const data = bucketMap.get(b.range)!;
    const hitRate = data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0;
    return {
      range: b.range,
      count: data.count,
      hitRate,
      pnl: data.pnl,
      lowSample: data.count < 5,
    };
  });
}

/**
 * Computes performance metrics across forecaster confidence levels (1 to 5 stars).
 */
export function computeConfidenceAnalytics(records: PredictionRecord[]): ConfidenceMetric[] {
  const resolved = records.filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED");

  const LEVELS = [
    { stars: 5, level: "5 Stars (Max)" },
    { stars: 4, level: "4 Stars (High)" },
    { stars: 3, level: "3 Stars (Medium)" },
    { stars: 2, level: "2 Stars (Low)" },
    { stars: 1, level: "1 Star (Min)" },
  ];

  const levelMap = new Map<number, { wins: number; count: number; pnl: number }>();
  for (const l of LEVELS) {
    levelMap.set(l.stars, { wins: 0, count: 0, pnl: 0 });
  }

  for (const r of resolved) {
    const stars = Math.min(5, Math.max(1, Math.round(r.confidence || 3)));
    const cur = levelMap.get(stars);
    if (cur) {
      cur.count += 1;
      if (r.outcome === "ACCURATE") cur.wins += 1;
      cur.pnl += r.pnl || 0;
    }
  }

  return LEVELS.map((l) => {
    const data = levelMap.get(l.stars)!;
    const hitRate = data.count > 0 ? Number(((data.wins / data.count) * 100).toFixed(1)) : 0;
    const avgPnlNum = data.count > 0 ? Math.round(data.pnl / data.count) : 0;
    const avgPnl = avgPnlNum >= 0 ? `+$${avgPnlNum}` : `-$${Math.abs(avgPnlNum)}`;

    return {
      level: l.level,
      stars: l.stars,
      count: data.count,
      hitRate,
      avgPnl,
      lowSample: data.count < 5,
    };
  });
}

/**
 * Computes monthly aggregated P&L from resolved records.
 */
export function computeMonthlyPnlAnalytics(records: PredictionRecord[]): MonthlyPnlMetric[] {
  const resolved = records
    .filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED")
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (resolved.length === 0) return [];

  const monthMap = new Map<string, { pnl: number; count: number; ts: number; label: string }>();

  for (const r of resolved) {
    const d = new Date(r.timestamp);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    const existing = monthMap.get(key) || { pnl: 0, count: 0, ts: r.timestamp, label };
    existing.pnl += r.pnl || 0;
    existing.count += 1;
    monthMap.set(key, existing);
  }

  return Array.from(monthMap.values()).map((m) => ({
    month: m.label,
    pnl: m.pnl,
    count: m.count,
    ts: m.ts,
  }));
}
