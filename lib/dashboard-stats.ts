import type { PredictionRecord } from "./types";
import { formatLocalDateLabel } from "./date-utils";

/** Named simulated starting bankroll. Not a live balance. */
export const SIMULATED_STARTING_BANKROLL = 10000;

/**
 * Identifies if a record is a historical backtest seed.
 * A record is historical backtest ONLY IF:
 * 1. Its source is explicitly "demo", OR
 * 2. Its id matches the 16 canonical historical seeds (rec-01 .. rec-16).
 * Live forecasts (e.g. rec-1730000000000 or live-...) are strictly considered live.
 */
export function isBacktestRecord(record: { id?: string; source?: string }): boolean {
  if (record.source === "demo") return true;
  if (!record.id) return false;
  return /^rec-(0[1-9]|1[0-6])$/.test(record.id);
}

export function countLiveVsBacktest(records: PredictionRecord[]): {
  live: number;
  backtest: number;
} {
  let live = 0;
  let backtest = 0;
  for (const record of records) {
    if (isBacktestRecord(record)) backtest += 1;
    else live += 1;
  }
  return { live, backtest };
}

export function countOnChainBlobs(records: PredictionRecord[]): number {
  return records.filter((record) => Boolean(record.blobId)).length;
}

/** Current win streak from newest resolved record. A loss resets it to 0. */
export function currentWinStreak(records: PredictionRecord[]): number {
  const resolved = records
    .filter((record) => record.outcome === "ACCURATE" || record.outcome === "FAILED")
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp);

  let streak = 0;
  for (const record of resolved) {
    if (record.outcome !== "ACCURATE") break;
    streak += 1;
  }
  return streak;
}

/**
 * Filters open (PENDING) predictions based on active network connection mode.
 * - In LIVE mode (isMainnetConnected === true), excludes historical backtest records.
 * - In DEMO mode (isMainnetConnected === false), retains demo records for display.
 */
export function liveOpenPredictions(
  records: PredictionRecord[],
  isMainnetConnected = false
): PredictionRecord[] {
  return records.filter((record) => {
    if (record.outcome !== "PENDING") return false;
    if (isMainnetConnected && isBacktestRecord(record)) return false;
    return true;
  });
}

/** Sum of stake on PENDING predictions only, excluding backtest records in LIVE mode. */
export function activeRisk(
  records: PredictionRecord[],
  isMainnetConnected = false
): number {
  return liveOpenPredictions(records, isMainnetConnected)
    .reduce((sum, record) => sum + (record.stake || 0), 0);
}

/** Simulated balance = named starting bankroll + PnL of resolved records only. */
export function simulatedBalance(
  records: PredictionRecord[],
  starting = SIMULATED_STARTING_BANKROLL
): number {
  const resolvedPnl = records
    .filter((record) => record.outcome === "ACCURATE" || record.outcome === "FAILED")
    .reduce((sum, record) => sum + (record.pnl || 0), 0);
  return starting + resolvedPnl;
}

export function avgStakeOfBankrollPercent(
  records: PredictionRecord[],
  starting = SIMULATED_STARTING_BANKROLL
): number {
  if (records.length === 0 || starting <= 0) return 0;
  const avgStake = records.reduce((sum, record) => sum + (record.stake || 0), 0) / records.length;
  return Number(((avgStake / starting) * 100).toFixed(1));
}

export interface PnlSeriesPoint {
  ts: number;
  label: string;
  pnl: number;
}

/**
 * Calculates a cumulative daily PnL series from resolved predictions.
 * - Only includes resolved records (ACCURATE or FAILED).
 * - Aggregates cumulatively by local calendar day.
 * - Timeframe window is relative to `now`, falling back to the latest record
 *   timestamp if no records fall in the active [now - windowMs, now] span.
 * - The last point's PnL is guaranteed to equal the sum of PnL in that window.
 */
export function cumulativePnlSeries(
  records: PredictionRecord[],
  timeframe: "7D" | "30D" | "90D" | "All",
  now = Date.now()
): PnlSeriesPoint[] {
  const resolved = records
    .filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED")
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp);

  if (resolved.length === 0) return [];

  const TIMEFRAME_DAYS: Record<string, number> = {
    "7D": 7,
    "30D": 30,
    "90D": 90,
  };

  let inWindow = resolved;
  if (timeframe !== "All") {
    const days = TIMEFRAME_DAYS[timeframe] || 30;
    const windowMs = days * 24 * 60 * 60 * 1000;
    const latestTs = resolved[resolved.length - 1].timestamp;

    const effectiveAnchor = now - windowMs <= latestTs && latestTs <= now ? now : latestTs;
    const cutoff = effectiveAnchor - windowMs;

    inWindow = resolved.filter((r) => r.timestamp >= cutoff && r.timestamp <= effectiveAnchor);
  }

  if (inWindow.length === 0) return [];

  const dayGroups = new Map<string, { lastTs: number; pnlSum: number }>();
  for (const rec of inWindow) {
    const d = new Date(rec.timestamp);
    const dayKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = dayGroups.get(dayKey);
    if (!existing) {
      dayGroups.set(dayKey, { lastTs: rec.timestamp, pnlSum: rec.pnl || 0 });
    } else {
      existing.pnlSum += rec.pnl || 0;
      if (rec.timestamp > existing.lastTs) {
        existing.lastTs = rec.timestamp;
      }
    }
  }

  let runningPnl = 0;
  const series: PnlSeriesPoint[] = [];

  for (const val of Array.from(dayGroups.values())) {
    runningPnl += val.pnlSum;
    series.push({
      ts: val.lastTs,
      label: formatLocalDateLabel(val.lastTs),
      pnl: runningPnl,
    });
  }

  return series;
}
