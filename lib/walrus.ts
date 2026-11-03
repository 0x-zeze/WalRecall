import { MemWal } from "@mysten-incubation/memwal";
import type { PredictionRecord } from "./types";
import { DEMO_PREDICTIONS } from "./demo-data";
import { dedupePredictions } from "./dedupe";
import {
  encodeMemory,
  decodeMemory,
  payloadToPredictionRecord,
  predictionRecordToPayload,
} from "./memory-codec";

export type MemoryRecord = PredictionRecord;

// Transient in-memory cache for demo/offline fallback.
// In production with Walrus keys configured, the source of truth is Walrus via recall().
const localDemoCache: MemoryRecord[] = [...DEMO_PREDICTIONS];

let customMemWalClient: MemWal | null = null;

/** Test seam only. Production client is unchanged when this is unset. */
export function setCustomMemWalClient(client: MemWal | null) {
  customMemWalClient = client;
}

export function getMemWalClient(): MemWal | null {
  if (customMemWalClient) {
    return customMemWalClient;
  }
  const key = process.env.MEMWAL_PRIVATE_KEY;
  const accountId = process.env.MEMWAL_ACCOUNT_ID;
  const serverUrl = process.env.MEMWAL_SERVER_URL || "https://relayer.memory.walrus.xyz";
  const namespace = process.env.MEMWAL_NAMESPACE || "alpharecall";

  if (!key || !accountId) {
    return null;
  }

  try {
    return MemWal.create({
      key,
      accountId,
      serverUrl,
      namespace,
    });
  } catch (err) {
    console.warn("Failed to initialize MemWal client:", err);
    return null;
  }
}

/**
 * Checks authentic Walrus Mainnet connectivity.
 * Returns true ONLY if keys are configured AND the live relayer/recall call succeeds.
 */
export async function checkWalrusConnection(): Promise<{
  isMainnetConnected: boolean;
  mode: "live" | "demo";
  error?: string;
}> {
  const client = getMemWalClient();
  if (!client) {
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: "MEMWAL_PRIVATE_KEY or MEMWAL_ACCOUNT_ID not configured.",
    };
  }

  try {
    const health = await client.health();
    if (health?.status === "ok" || health?.write_ready) {
      return {
        isMainnetConnected: true,
        mode: "live",
      };
    }
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: "Walrus relayer write_ready is false.",
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      isMainnetConnected: false,
      mode: "demo",
      error: `Walrus relayer unreachable: ${errorMsg}`,
    };
  }
}

export const RECALL_QUERIES = [
  "ALPHARECALL_V1 prediction",
  "ALPHARECALL_V1 resolution",
  "ALPHARECALL_V1 soccer nba",
  "ALPHARECALL_V1 crypto SUI BTC ETH",
] as const;

export const RECALL_LIMIT_PER_QUERY = 100; // Batas server tidak terdokumentasi di tipe SDK; deteksi pemotongan memakai total (total > results.length)
export const RECALL_TIMEOUT_MS = 10000;    // 10s budget per request
export const RECALL_CACHE_TTL_MS = 45000;  // 45s in-memory cache

export interface RecallCacheEntry {
  records: MemoryRecord[];
  possiblyTruncated: boolean;
  droppedCount: number;
  cachedAt: number;
}
let recallCache: RecallCacheEntry | null = null;

export function invalidateRecallCache(): void {
  recallCache = null;
}

export function getRecallCacheForTesting(): RecallCacheEntry | null {
  return recallCache;
}

export interface GetAllMemoriesResult {
  records: MemoryRecord[];
  possiblyTruncated: boolean;
  droppedCount: number;
  fromCache?: boolean;
  stale?: boolean;
}

/**
 * Retrieve all memories from Walrus Memory on Mainnet via multi-query recall().
 * Executes semantic recall across diverse topics, filters and validates via decodeMemory(),
 * drops invalid or non-prefixed items, and sorts by timestamp descending.
 * Falls back to canonical demo data ONLY if Walrus keys are missing or recall fails.
 */
export async function getAllMemoriesWithMeta(): Promise<GetAllMemoriesResult> {
  if (customGetAllMemories) {
    const records = await customGetAllMemories();
    return { records, possiblyTruncated: false, droppedCount: 0 };
  }

  const now = Date.now();
  if (recallCache && now - recallCache.cachedAt < RECALL_CACHE_TTL_MS) {
    return {
      records: recallCache.records,
      possiblyTruncated: recallCache.possiblyTruncated,
      droppedCount: recallCache.droppedCount,
      fromCache: true,
    };
  }

  const client = getMemWalClient();
  if (!client) {
    return {
      records: dedupePredictions(localDemoCache),
      possiblyTruncated: false,
      droppedCount: 0,
    };
  }

  try {
    const settled = await Promise.allSettled(
      RECALL_QUERIES.map(async (query) => {
        const queryStart = Date.now();
        const res = await client.recall({
          query,
          limit: RECALL_LIMIT_PER_QUERY,
          timeoutMs: RECALL_TIMEOUT_MS,
        });

        const initialDropped =
          typeof res === "object" &&
          res !== null &&
          "dropped_count" in res &&
          typeof (res as { dropped_count?: unknown }).dropped_count === "number" &&
          ((res as { dropped_count: number }).dropped_count > 0)
            ? (res as { dropped_count: number }).dropped_count
            : 0;

        if (initialDropped > 0) {
          const elapsed = Date.now() - queryStart;
          const remainingBudget = Math.max(1000, RECALL_TIMEOUT_MS - elapsed - 100);
          await new Promise((resolve) => setTimeout(resolve, 100));
          try {
            const retryRes = await client.recall({
              query,
              limit: RECALL_LIMIT_PER_QUERY,
              timeoutMs: remainingBudget,
            });

            const retryDropped =
              typeof retryRes === "object" &&
              retryRes !== null &&
              "dropped_count" in retryRes &&
              typeof (retryRes as { dropped_count?: unknown }).dropped_count === "number" &&
              ((retryRes as { dropped_count: number }).dropped_count > 0)
                ? (retryRes as { dropped_count: number }).dropped_count
                : 0;

            const origLen = Array.isArray((res as { results?: unknown[] })?.results)
              ? (res as { results: unknown[] }).results.length
              : 0;
            const retryLen = Array.isArray((retryRes as { results?: unknown[] })?.results)
              ? (retryRes as { results: unknown[] }).results.length
              : 0;

            // Pakai hasil terbaik: dropped lebih sedikit, atau bila sama, hasil records lebih banyak/sama
            if (retryDropped < initialDropped || (retryDropped === initialDropped && retryLen >= origLen)) {
              return retryRes;
            }
            return res;
          } catch {
            return res;
          }
        }

        return res;
      })
    );

    let anySuccess = false;
    let possiblyTruncated = false;
    let droppedCount = 0;
    const combinedHits: Array<{ blob_id?: string; text: string }> = [];

    settled.forEach((res, i) => {
      if (res.status === "fulfilled") {
        anySuccess = true;
        const val = res.value as {
          results?: Array<{ blob_id?: string; text: string }>;
          total?: number;
          dropped_count?: number;
        };
        const results = val?.results;
        const total = val?.total;
        const dropped =
          typeof val?.dropped_count === "number" && val.dropped_count > 0
            ? val.dropped_count
            : 0;
        droppedCount += dropped;

        if (Array.isArray(results)) {
          if (
            results.length >= RECALL_LIMIT_PER_QUERY ||
            (typeof total === "number" && total > results.length)
          ) {
            possiblyTruncated = true;
          }
          combinedHits.push(...results);
        }
      } else {
        console.warn(`Walrus recall query "${RECALL_QUERIES[i]}" failed:`, res.reason);
      }
    });

    if (!anySuccess) {
      if (recallCache) {
        console.warn("All Walrus recall queries failed, returning stale cache.");
        return {
          records: recallCache.records,
          possiblyTruncated: recallCache.possiblyTruncated,
          droppedCount: recallCache.droppedCount,
          fromCache: true,
          stale: true,
        };
      }
      return {
        records: dedupePredictions(localDemoCache),
        possiblyTruncated: false,
        droppedCount: 0,
      };
    }

    const seenBlobs = new Set<string>();
    const validRecords: MemoryRecord[] = [];

    for (const item of combinedHits) {
      if (!item.blob_id || seenBlobs.has(item.blob_id)) continue;
      seenBlobs.add(item.blob_id);

      const decoded = decodeMemory(item.text);
      if (!decoded) continue;

      const record = payloadToPredictionRecord(decoded, item.blob_id);
      validRecords.push(record);
    }

    let finalRecords = validRecords;
    if (finalRecords.length > 0) {
      finalRecords.sort((a, b) => b.timestamp - a.timestamp);
      finalRecords = dedupePredictions(finalRecords);
    } else {
      finalRecords = dedupePredictions(localDemoCache);
    }

    recallCache = {
      records: finalRecords,
      possiblyTruncated,
      droppedCount,
      cachedAt: Date.now(),
    };

    return {
      records: finalRecords,
      possiblyTruncated,
      droppedCount,
    };
  } catch (error) {
    console.warn("Falling back after Walrus recall failure:", error);
    if (recallCache) {
      return {
        records: recallCache.records,
        possiblyTruncated: recallCache.possiblyTruncated,
        droppedCount: recallCache.droppedCount,
        fromCache: true,
        stale: true,
      };
    }
    return {
      records: dedupePredictions(localDemoCache),
      possiblyTruncated: false,
      droppedCount: 0,
    };
  }
}

export async function getAllMemories(): Promise<MemoryRecord[]> {
  const { records } = await getAllMemoriesWithMeta();
  return records;
}

/**
 * Commit a new prediction or audit record to Walrus Memory.
 * - Encodes using strict ALPHARECALL_V1 prefix and schema validator.
 * - If client is configured: submits remember(), waits for job, and records real blobId + writeStatus: "confirmed".
 * - If client is missing: writeStatus: "local-demo" without blobId.
 * - If remember fails: writeStatus: "failed" with explicit writeError.
 */
export type SaveMemoryInput = Partial<MemoryRecord> & {
  title: string;
  content: string;
  analyst: string;
  target: string;
  pick: string;
  outcome: "PENDING" | "ACCURATE" | "FAILED";
  credibilityDelta: number;
};

let customSaveMemory: ((record: SaveMemoryInput) => Promise<MemoryRecord>) | null = null;
let customGetAllMemories: (() => Promise<MemoryRecord[]>) | null = null;

export function setCustomSaveMemory(fn: ((record: SaveMemoryInput) => Promise<MemoryRecord>) | null) {
  customSaveMemory = fn;
}

/** Test seam only. Production recall is unchanged when this is unset. */
export function setCustomGetAllMemories(fn: (() => Promise<MemoryRecord[]>) | null) {
  customGetAllMemories = fn;
}

export async function saveMemory(record: SaveMemoryInput): Promise<MemoryRecord> {
  invalidateRecallCache();
  if (customSaveMemory) {
    return customSaveMemory(record);
  }

  const newRecord: MemoryRecord = {
    id: record.id || `rec-${Date.now()}`,
    category: record.category || "prediction",
    sportType: record.sportType || "soccer",
    leagueOrAsset: record.leagueOrAsset,
    title: record.title,
    content: record.content,
    analyst: record.analyst,
    target: record.target,
    pick: record.pick,
    odds: record.odds || "-110",
    stake: record.stake ?? 250,
    pnl: record.pnl ?? 0,
    outcome: record.outcome,
    credibilityDelta: record.credibilityDelta,
    confidence: record.confidence ?? 4,
    timestamp: record.timestamp || Date.now(),
    dateStr: record.dateStr || new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    reasoning: record.reasoning,
    postMortem: record.postMortem,
    tags: record.tags,
    deadline: record.deadline,
    direction: record.direction,
    targetPrice: record.targetPrice,
    asset: record.asset,
    suiCheckpoint: record.suiCheckpoint,
    suiCheckpointDigest: record.suiCheckpointDigest,
    suiCheckpointSource: record.suiCheckpointSource,
    fixture: record.fixture,
    market: record.market,
    blobId: undefined,
    writeStatus: "pending",
    source: "demo",
  };

  const client = getMemWalClient();
  if (!client) {
    newRecord.writeStatus = "local-demo";
    newRecord.blobId = undefined;
    localDemoCache.unshift(newRecord);
    return newRecord;
  }

  try {
    // Encode via strictly validated memory codec
    const payload = predictionRecordToPayload(newRecord);
    const memoryString = encodeMemory(payload);

    const accepted = await client.remember(memoryString);
    if (!accepted?.job_id) {
      newRecord.writeStatus = "failed";
      newRecord.writeError = "Walrus relayer did not return an accepted job_id";
      localDemoCache.unshift(newRecord);
      return newRecord;
    }

    // Wait for terminal state to extract the authentic Walrus blob_id
    const rememberResult = await client.waitForRememberJob(accepted.job_id);
    if (rememberResult?.blob_id) {
      newRecord.blobId = rememberResult.blob_id;
      newRecord.writeStatus = "confirmed";
      newRecord.source = "walrus";
    } else {
      newRecord.writeStatus = "failed";
      newRecord.writeError = "Remember job finished without valid blob_id";
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.warn("Walrus remember operation failed:", errorMsg);
    newRecord.writeStatus = "failed";
    newRecord.writeError = errorMsg;
  }

  invalidateRecallCache();
  localDemoCache.unshift(newRecord);
  return newRecord;
}
