import type { PredictionRecord } from "./types";
import { isBacktestRecord } from "./dashboard-stats";
import type { MarketOpinion } from "./credibility";

export interface GroupedMarket {
  marketKey: string;
  label: string;
  deadline?: number;
  opinions: MarketOpinion[];
  records: PredictionRecord[];
}

/**
 * Derives a deterministic canonical key identifying a prediction market.
 *
 * Rules:
 * - Sports with structured fixture: `${provider}:${eventId}:${marketType}:${line ?? ""}`
 * - Crypto target: `crypto:${asset}:${deadlineMinutes}:${targetPrice}`
 * - Manual / seed without fixture: `manual:${normalizedTarget}`
 */
export function marketKey(record: PredictionRecord): string {
  if (record.fixture && record.market) {
    const line = record.market.line !== undefined ? String(record.market.line) : "";
    return `${record.fixture.provider}:${record.fixture.eventId}:${record.market.type}:${line}`;
  }

  if (record.sportType === "crypto" || record.asset) {
    const asset = (record.asset || "crypto").toLowerCase().trim();
    let deadlineMinutes = "";
    if (record.deadline) {
      const ms = new Date(record.deadline).getTime();
      if (!isNaN(ms)) {
        deadlineMinutes = String(Math.floor(ms / 60000));
      }
    }
    const targetPrice = record.targetPrice !== undefined ? String(record.targetPrice) : "";
    return `crypto:${asset}:${deadlineMinutes}:${targetPrice}`;
  }

  const normTarget = (record.target || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
  return `manual:${normTarget}`;
}

/**
 * Returns a normalized string representation of an analyst's selection.
 */
export function selectionKey(record: PredictionRecord): string {
  if (record.market?.selection) {
    return record.market.selection.toLowerCase().trim();
  }
  if (record.direction) {
    return record.direction.toLowerCase().trim();
  }
  return (record.pick || "").toLowerCase().trim().replace(/\s+/g, " ");
}

/**
 * Groups active PENDING predictions into distinct market consensus candidates.
 *
 * Requirements:
 * - Only pending records (outcome === "PENDING").
 * - Filters out historical backtest records unless explicitly requested.
 * - Requires >= 2 distinct analyst handles per market.
 * - Deduplicates per analyst (keeps newest forecast per analyst for that market).
 * - Sorts by nearest kickoff / deadline first.
 */
export function groupOpenMarkets(
  records: PredictionRecord[],
  options?: { includeBacktest?: boolean }
): GroupedMarket[] {
  const pending = records.filter((r) => {
    if (r.outcome !== "PENDING") return false;
    if (!options?.includeBacktest && isBacktestRecord(r)) return false;
    return true;
  });

  const byMarket = new Map<string, PredictionRecord[]>();
  for (const r of pending) {
    const key = marketKey(r);
    const list = byMarket.get(key) || [];
    list.push(r);
    byMarket.set(key, list);
  }

  const result: GroupedMarket[] = [];

  for (const [mKey, marketRecords] of Array.from(byMarket.entries())) {
    // Deduplicate per analyst: keep newest timestamp
    const analystMap = new Map<string, PredictionRecord>();
    const sortedDesc = marketRecords.slice().sort((a, b) => b.timestamp - a.timestamp);

    for (const rec of sortedDesc) {
      if (!analystMap.has(rec.analyst)) {
        analystMap.set(rec.analyst, rec);
      }
    }

    const uniqueAnalystRecords = Array.from(analystMap.values());

    // Only include markets with at least 2 distinct analysts
    if (uniqueAnalystRecords.length < 2) {
      continue;
    }

    // Determine representative label
    const sample = uniqueAnalystRecords[0];
    let label = sample.target;
    if (sample.fixture && sample.market) {
      const typeLabel = sample.market.type === "moneyline" ? "Moneyline" : `Total ${sample.market.line || ""}`;
      label = `${sample.fixture.home.name} vs ${sample.fixture.away.name} (${typeLabel})`;
    }

    // Determine nearest deadline/kickoff for sorting
    let earliestDeadline = Infinity;
    for (const rec of uniqueAnalystRecords) {
      if (rec.fixture?.kickoff) {
        const ms = new Date(rec.fixture.kickoff).getTime();
        if (!isNaN(ms) && ms < earliestDeadline) earliestDeadline = ms;
      }
      if (rec.deadline) {
        const ms = new Date(rec.deadline).getTime();
        if (!isNaN(ms) && ms < earliestDeadline) earliestDeadline = ms;
      }
      if (rec.timestamp < earliestDeadline) earliestDeadline = rec.timestamp;
    }

    const opinions: MarketOpinion[] = uniqueAnalystRecords.map((r) => ({
      id: r.id,
      analyst: r.analyst,
      pick: r.pick,
      confidence: r.confidence || 4,
    }));

    result.push({
      marketKey: mKey,
      label,
      deadline: earliestDeadline === Infinity ? undefined : earliestDeadline,
      opinions,
      records: uniqueAnalystRecords,
    });
  }

  // Sort by nearest deadline/kickoff
  result.sort((a, b) => (a.deadline || 0) - (b.deadline || 0));

  return result;
}
