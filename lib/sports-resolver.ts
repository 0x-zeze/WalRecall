import type { SportsMarketRef } from "./types";
import { SUPPORTED_LEAGUES } from "./espn";

export interface FinalScore {
  home: number;
  away: number;
}

export type SportsMarketSettlement = "ACCURATE" | "FAILED" | "manual_required";

/**
 * Pure function to settle a sports market based on official final score.
 * - Moneyline: compare home vs away score.
 *   Soccer draw only accurate if selection === 'draw'.
 * - Total: compare sum of scores vs line. Line MUST be a half-number (x.5),
 *   eliminating pushes. If line is integer or invalid, returns manual_required.
 */
export function settleMarket(
  market: SportsMarketRef,
  finalScore: FinalScore
): SportsMarketSettlement {
  if (!market || !finalScore) return "manual_required";

  const home = finalScore.home;
  const away = finalScore.away;
  if (typeof home !== "number" || typeof away !== "number" || isNaN(home) || isNaN(away)) {
    return "manual_required";
  }

  if (market.type === "moneyline") {
    if (home > away) {
      return market.selection === "home" ? "ACCURATE" : "FAILED";
    } else if (away > home) {
      return market.selection === "away" ? "ACCURATE" : "FAILED";
    } else {
      // Tie / Draw
      return market.selection === "draw" ? "ACCURATE" : "FAILED";
    }
  }

  if (market.type === "total") {
    const line = market.line;
    if (typeof line !== "number" || isNaN(line) || Math.abs(line % 1) !== 0.5) {
      return "manual_required"; // Ties / whole numbers are strictly disallowed
    }
    const totalScore = home + away;
    if (market.selection === "over") {
      return totalScore > line ? "ACCURATE" : "FAILED";
    } else if (market.selection === "under") {
      return totalScore < line ? "ACCURATE" : "FAILED";
    }
  }

  return "manual_required";
}

export type EspnLookupFailure =
  | "not_found"
  | "request_failed"
  | "unrecognized";

export interface EspnGameStatusResult {
  completed: boolean;
  state: "pre" | "in" | "post";
  statusName?: string;
  statusDescription?: string;
  isOvertimeOrPenalties?: boolean;
  isVoid?: boolean;
  score?: FinalScore;
  /** Set only when the event could not be resolved. Callers map this into user-facing reasons. */
  lookupFailure?: EspnLookupFailure;
}

export interface EspnEventStatusType {
  state?: string;
  name?: string;
  completed?: boolean;
  description?: string;
}

export interface EspnScoreboardEvent {
  id?: string;
  status?: {
    type?: EspnEventStatusType;
  };
  competitions?: Array<{
    competitors?: Array<{
      homeAway?: string;
      score?: string | number;
    }>;
  }>;
}

function formatUtcYYYYMMDD(ms: number): string {
  const dateObj = new Date(ms);
  const y = dateObj.getUTCFullYear();
  const m = String(dateObj.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dateObj.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * ESPN groups scoreboard games by US Eastern calendar day.
 * A UTC kickoff of 00:00-04:59 is still the previous US evening, so a single
 * UTC date misses it. Query a three-day window around the UTC kickoff.
 */
export function espnScoreboardDateRange(kickoffIso: string): string | null {
  const dateObj = new Date(kickoffIso);
  if (isNaN(dateObj.getTime())) return null;
  const dayMs = 24 * 60 * 60 * 1000;
  const start = formatUtcYYYYMMDD(dateObj.getTime() - dayMs);
  const end = formatUtcYYYYMMDD(dateObj.getTime() + dayMs);
  return `${start}-${end}`;
}

function parseEspnStatusEvent(
  sport: "nba" | "soccer",
  targetEvent: EspnScoreboardEvent
): EspnGameStatusResult | null {
  const statusType = targetEvent.status?.type;
  if (!statusType || typeof statusType !== "object") return null;

  const rawState = statusType.state || "pre";
  if (rawState !== "pre" && rawState !== "in" && rawState !== "post") return null;
  const state = rawState;
  const completed = Boolean(statusType.completed);
  const statusName = statusType.name || "";
  const description = statusType.description || "";

  const lowerDesc = `${statusName} ${description}`.toLowerCase();
  if (
    lowerDesc.includes("cancel") ||
    lowerDesc.includes("postpone") ||
    lowerDesc.includes("suspend") ||
    lowerDesc.includes("forfeit")
  ) {
    return {
      completed: true,
      state: "post",
      statusName,
      statusDescription: description,
      isVoid: true,
    };
  }

  if (state !== "post" || !completed) {
    return {
      completed: false,
      state,
      statusName,
      statusDescription: description,
    };
  }

  let isOvertimeOrPenalties = false;
  if (sport === "soccer") {
    if (
      lowerDesc.includes("extra") ||
      lowerDesc.includes("penalt") ||
      lowerDesc.includes("aet") ||
      lowerDesc.includes("pen")
    ) {
      isOvertimeOrPenalties = true;
    }
  }

  const competition = Array.isArray(targetEvent.competitions) ? targetEvent.competitions[0] : null;
  const competitors = Array.isArray(competition?.competitors) ? competition.competitors : [];

  let homeScore: number | null = null;
  let awayScore: number | null = null;

  for (const c of competitors) {
    const s = parseInt(String(c.score ?? ""), 10);
    if (!isNaN(s)) {
      if (c.homeAway === "home") homeScore = s;
      else if (c.homeAway === "away") awayScore = s;
    }
  }

  if (homeScore === null || awayScore === null) {
    return null;
  }

  return {
    completed: true,
    state: "post",
    statusName,
    statusDescription: description,
    isOvertimeOrPenalties,
    isVoid: false,
    score: {
      home: homeScore,
      away: awayScore,
    },
  };
}

async function fetchEspnJson(
  url: string,
  customFetch: typeof fetch
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await customFetch(url, {
      headers: { "User-Agent": "WalRecall/1.0" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return { ok: false };
    const data = await res.json();
    return { ok: true, data };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parses raw ESPN event to extract final game outcome.
 * Scoreboard uses a UTC±1 day range (`dates=YYYYMMDD-YYYYMMDD`) then matches eventId.
 * If the event is absent, falls back to the summary endpoint.
 */
export async function fetchEspnGameStatus(
  sport: "nba" | "soccer",
  leagueSlug: string,
  eventId: string,
  kickoffIso: string,
  customFetch: typeof fetch = fetch
): Promise<EspnGameStatusResult | null> {
  const leagueConfig = SUPPORTED_LEAGUES[leagueSlug];
  if (!leagueConfig) return null;

  const dateRange = espnScoreboardDateRange(kickoffIso);
  if (!dateRange) return null;

  const scoreboardUrl = `https://site.api.espn.com/apis/site/v2/sports/${leagueConfig.espnPath}/scoreboard?dates=${dateRange}`;
  const scoreboard = await fetchEspnJson(scoreboardUrl, customFetch);

  if (scoreboard.ok) {
    const payload = scoreboard.data as { events?: unknown };
    const events: EspnScoreboardEvent[] = Array.isArray(payload?.events) ? payload.events : [];
    const targetEvent = events.find((e) => String(e?.id || "").trim() === eventId);
    if (targetEvent) {
      const parsed = parseEspnStatusEvent(sport, targetEvent);
      if (parsed) return parsed;
      return { completed: false, state: "pre", lookupFailure: "unrecognized" };
    }
  }

  const summaryUrl = `https://site.api.espn.com/apis/site/v2/sports/${leagueConfig.espnPath}/summary?event=${encodeURIComponent(eventId)}`;
  const summary = await fetchEspnJson(summaryUrl, customFetch);

  if (!scoreboard.ok && !summary.ok) {
    return { completed: false, state: "pre", lookupFailure: "request_failed" };
  }

  if (summary.ok) {
    const payload = summary.data as { header?: { competitions?: unknown } };
    const competitions = payload?.header?.competitions;
    if (Array.isArray(competitions) && competitions[0] && typeof competitions[0] === "object") {
      const competition = competitions[0] as {
        status?: EspnScoreboardEvent["status"];
        competitors?: NonNullable<EspnScoreboardEvent["competitions"]>[number]["competitors"];
      };
      const headerEvent: EspnScoreboardEvent = {
        id: eventId,
        status: competition.status,
        competitions: [{ competitors: competition.competitors }],
      };
      const parsed = parseEspnStatusEvent(sport, headerEvent);
      if (parsed) return parsed;
    }
  }

  if (!scoreboard.ok && summary.ok) {
    return { completed: false, state: "pre", lookupFailure: "unrecognized" };
  }

  return { completed: false, state: "pre", lookupFailure: "not_found" };
}
