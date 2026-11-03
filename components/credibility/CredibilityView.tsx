"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  XCircle,
  TrendingUp,
  ShieldCheck,
  Inbox,
  AlertTriangle,
} from "lucide-react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { PredictionRecord } from "@/lib/types";
import { getWalrusBlobExplorerUrl } from "@/lib/explorer";
import { formatLocalDateLabel } from "@/lib/date-utils";
import {
  computeForecasterStats,
  consensus,
  MarketOpinion,
  ForecasterAnalysis,
} from "@/lib/credibility";
import { groupOpenMarkets } from "@/lib/markets";

interface CredibilityViewProps {
  predictions: PredictionRecord[];
  walrusMemoriesCount: number;
  isMainnetConnected?: boolean;
  possiblyTruncated?: boolean;
  droppedCount?: number;
}

export function CredibilityView({
  predictions,
  walrusMemoriesCount,
  isMainnetConnected = false,
  possiblyTruncated = false,
  droppedCount = 0,
}: CredibilityViewProps) {
  // PURE CALCULATION: Derived strictly from actual predictions / recalled memories
  const forecasters: ForecasterAnalysis[] = useMemo(() => {
    return computeForecasterStats(predictions);
  }, [predictions]);

  // Build a weight lookup map from real stats
  const weightsMap = useMemo(() => {
    const map = new Map<string, number>();
    forecasters.forEach((f) => map.set(f.handle, f.weightMultiplier));
    return map;
  }, [forecasters]);

  // PURE CONSENSUS EVALUATION: Run consensus() on active open markets from groupOpenMarkets
  const openMarkets = useMemo(() => {
    return groupOpenMarkets(predictions, { includeBacktest: !isMainnetConnected });
  }, [predictions, isMainnetConnected]);

  const consensusComparison = useMemo(() => {
    if (openMarkets.length > 0) {
      const topMarket = openMarkets[0];
      const result = consensus(topMarket.label, topMarket.opinions, weightsMap);
      return { result, isIllustrative: false, market: topMarket.label };
    }

    // In DEMO mode (not LIVE), provide one illustrative example built from real demo forecaster handles
    if (!isMainnetConnected && forecasters.length >= 2) {
      const h1 = forecasters[0].handle;
      const h2 = forecasters[1].handle;
      const demoOpinions: MarketOpinion[] = [
        { analyst: h1, pick: "HOME WIN", confidence: 4.5 },
        { analyst: h2, pick: "AWAY WIN", confidence: 4.0 },
      ];
      const result = consensus("Demonstration Match", demoOpinions, weightsMap);
      return { result, isIllustrative: true, market: "Demonstration Match (Real Demo Forecasters)" };
    }

    return null;
  }, [openMarkets, isMainnetConnected, forecasters, weightsMap]);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="fin-card p-4 sm:p-6 flex flex-col gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-[var(--accent)] shrink-0" />
            <h2 className="text-base sm:text-lg font-heading font-bold text-[var(--text)] leading-tight">
              Forecaster Credibility Matrix
            </h2>
            <span className="text-[10px] font-mono-num px-2.5 py-0.5 rounded-full bg-[#72BFFF]/10 text-[var(--accent)] border border-[#72BFFF]/30 font-semibold shadow-sm">
              Walrus Consensus Engine
            </span>
          </div>
          <p className="text-xs text-[var(--text-dim)] leading-relaxed">
            Credibility weights are computed from resolved forecasts recalled from Walrus Memory (local demo data in demo mode).
            Formula: <span className="font-mono-num font-semibold text-[var(--highlight)] break-all">Weight = max(0.40, min(2.40, 1.0 + delta / 20))</span>.
            <span className="block mt-1 text-[11px] text-[var(--muted)]">
              Historical baseline scores evaluate long-term signal accuracy, while live forecasts dynamically adjust analyst multipliers in real-time.
            </span>
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 bg-[var(--surface-subtle)] px-4 py-2.5 rounded-xl border border-[var(--border)] text-xs font-mono-num w-full">
          <div>
            <span className="text-[11px] text-[var(--muted)] block font-medium">Dynamic multiplier range</span>
            <span className="font-bold text-[var(--accent)]">0.40x — 2.40x</span>
          </div>
          <div className="h-6 w-px bg-[var(--border)]" />
          <div>
            <span className="text-[11px] text-[var(--muted)] block font-medium">Evaluated analysts</span>
            <span className="font-bold text-[var(--win)]">{forecasters.length} tracked</span>
          </div>
        </div>
      </div>

      {/* Truncation warning indicator */}
      {possiblyTruncated && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono-num shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>Showing {predictions.length} records; recall may be truncated</span>
        </div>
      )}

      {/* Dropped records warning indicator */}
      {droppedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] font-mono-num shadow-sm">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{droppedCount} records could not be read from Walrus; stats may be incomplete</span>
        </div>
      )}

      {/* Empty State */}
      {forecasters.length === 0 ? (
        <div className="liquid-glass p-12 text-center text-xs font-mono-num text-[var(--muted)] space-y-3">
          <Inbox className="w-10 h-10 mx-auto text-[var(--muted)]/40" />
          <h3 className="font-bold text-sm text-[var(--text)]">No Forecaster Memory Records Found</h3>
          <p className="max-w-md mx-auto text-[var(--muted)]">
            Walrus Memory is currently clean. Click &quot;Seed 10 Memories&quot; in the sidebar or record new predictions to calculate adaptive credibility weights.
          </p>
        </div>
      ) : (
        /* Grid: Dynamically Evaluated Forecasters */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {forecasters.map((f) => (
            <BentoCard key={f.handle} delay={0} className="flex flex-col justify-between">
              <div>
                <div className="flex flex-col gap-2 mb-2 min-w-0">
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text)] break-all">{f.handle}</h3>
                    <span className="text-[11px] text-[var(--muted)] block capitalize">
                      {f.category} Specialist
                    </span>
                  </div>
                  <span
                    className={`self-start text-xs font-mono-num font-bold px-2 py-0.5 rounded-[6px] border ${
                      f.weightMultiplier >= 2.0
                        ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30"
                        : f.weightMultiplier >= 1.0
                        ? "bg-[var(--accent)]/10 text-[var(--accent)] border-[var(--accent)]/30"
                        : "bg-[var(--loss-bg)] text-[var(--loss)] border-[var(--loss)]/30"
                    }`}
                  >
                    {f.weightMultiplier.toFixed(2)}x Weight
                  </span>
                </div>

                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-2 py-2.5 my-2 border-y border-[var(--border)] text-center text-xs font-mono-num">
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Win rate</span>
                    <span className="font-bold text-[var(--text)]">
                      <AnimatedNumber value={f.winRate} decimals={1} suffix="%" />
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Record</span>
                    <span className="font-medium text-[var(--text)]">
                      {f.wins}W - {f.losses}L
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-[var(--muted)] block">Net P&L</span>
                    <span
                      className={`font-bold ${
                        f.netPnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"
                      }`}
                    >
                      {f.netPnl >= 0 ? `+$${f.netPnl}` : `-$${Math.abs(f.netPnl)}`}
                    </span>
                  </div>
                </div>

                {/* W/L Dots */}
                <div className="flex items-center justify-between text-xs font-mono-num my-2">
                  <span className="text-[11px] text-[var(--muted)]">Recent Form</span>
                  {f.recent.length === 0 ? (
                    <span className="text-[11px] text-[var(--muted)]">No resolved forecasts yet</span>
                  ) : (
                    <div className="flex items-center gap-1">
                      {f.recent.map((res, i) => (
                        <span
                          key={i}
                          className={`w-4 h-4 rounded-[4px] text-[9px] font-bold flex items-center justify-center ${
                            res === "W"
                              ? "bg-[var(--win-bg)] text-[var(--win)]"
                              : "bg-[var(--loss-bg)] text-[var(--loss)]"
                          }`}
                        >
                          {res}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="text-[11px] text-[var(--muted)] font-mono-num pt-1 flex justify-between">
                  <span>Credibility Delta:</span>
                  <span
                    className={
                      f.deltaTotal >= 0
                        ? "text-[var(--win)] font-semibold"
                        : "text-[var(--loss)] font-semibold"
                    }
                  >
                    {f.deltaTotal >= 0 ? `+${f.deltaTotal}` : f.deltaTotal}
                  </span>
                </div>
              </div>

              {/* Walrus Blob or Local Demo */}
              <div className="pt-3 border-t border-[var(--border)] mt-3 flex items-center justify-between text-[10px] font-mono-num text-[var(--muted)]">
                <span>Walrus Blob:</span>
                {f.verifiedBlobs.length > 0 ? (
                  <a
                    href={getWalrusBlobExplorerUrl(f.verifiedBlobs[0])}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] font-semibold hover:underline"
                  >
                    {f.verifiedBlobs[0].slice(0, 16)}...
                  </a>
                ) : (
                  <span className="text-[var(--muted)] italic">Local Demo</span>
                )}
              </div>
            </BentoCard>
          ))}
        </div>
      )}

      {/* Pure Consensus Demonstration: Before vs After Memory */}
      {!consensusComparison ? (
        <div className="liquid-glass p-8 text-center text-xs font-mono-num text-[var(--muted)] space-y-2">
          <p className="font-bold text-sm text-[var(--text)]">No Multi-Analyst Markets Active</p>
          <p>Add two forecasts on the same match from different handles to see weighted vs. unweighted consensus.</p>
        </div>
      ) : (
        <div className="liquid-glass p-6 space-y-4">
          <BentoHeader
            title="Consensus Engine: Unweighted vs Memory-Weighted"
            subtitle={`Consensus calculation on market: "${consensusComparison.market}"`}
            action={
              <div className="flex items-center gap-2">
                {consensusComparison.isIllustrative && (
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono-num font-semibold">
                    Illustrative example
                  </span>
                )}
                {consensusComparison.result.confidenceShift !== 0 && (
                  <span className="flex items-center gap-1 text-[11px] font-mono-num font-semibold text-[var(--win)] bg-[var(--win-bg)] px-2.5 py-1 rounded-full border border-[var(--win)]/30">
                    <TrendingUp className="w-3.5 h-3.5" />
                    <span>
                      {consensusComparison.result.confidenceShift > 0 ? "+" : ""}
                      {consensusComparison.result.confidenceShift}% Confidence Shift
                    </span>
                  </span>
                )}
              </div>
            }
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono-num">
            {/* Unweighted Consensus */}
            <div className="p-4 rounded-[10px] bg-[var(--border-subtle)] border border-[var(--border)] space-y-3">
              <span className="text-[11px] font-semibold text-[var(--muted)] flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-[var(--loss)]" />
                Before memory (flat 1.0x weight)
              </span>
              <div className="p-3 rounded-[8px] bg-[var(--card)] border border-[var(--border)] space-y-1">
                <span className="text-[10px] text-[var(--muted)] block font-medium">Consensus call</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--text)]">
                    {consensusComparison.result.unweightedPick}
                  </span>
                  <span className="text-xs text-[var(--muted)] font-bold">
                    {consensusComparison.result.unweightedConfidence}% conviction
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--muted)] leading-relaxed">
                Every analyst receives identical 1.0x voting power regardless of their past hit rate or unhedged draw variance.
              </p>
            </div>

            {/* Memory-Weighted Consensus */}
            <div className="p-4 rounded-[10px] bg-[var(--accent)]/5 border border-[var(--accent)]/30 space-y-3">
              <span className="text-[11px] font-semibold text-[var(--accent)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--win)]" />
                With Walrus memory (adaptive weights)
              </span>
              <div className="p-3 rounded-[8px] bg-[var(--card)] border border-[var(--accent)]/30 space-y-1">
                <span className="text-[10px] text-[var(--muted)] block font-medium">Recalibrated consensus</span>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--accent)]">
                    {consensusComparison.result.weightedPick}
                  </span>
                  <span className="text-xs text-[var(--win)] font-bold">
                    {consensusComparison.result.weightedConfidence}% conviction
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-[var(--text)]/90 leading-relaxed">
                High-accuracy forecasters ({consensusComparison.result.boostedSharps.join(", ") || "Sharps"}) have their weight scaled up, while volatile predictors ({consensusComparison.result.dampenedForecasters.join(", ") || "erratic forecasters"}) are dampened.
              </p>
            </div>
          </div>

          {/* Breakdown of supporting analysts */}
          <div className="space-y-2 pt-2 border-t border-[var(--border)]">
            <span className="text-[11px] text-[var(--muted)] font-mono-num font-semibold block">
              Mathematical pick breakdown
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono-num">
              {consensusComparison.result.breakdown.map((b) => (
                <div
                  key={b.pick}
                  className="p-2.5 rounded-[8px] bg-[var(--card)] border border-[var(--border)] flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-[var(--text)] block">{b.pick}</span>
                    <span className="text-[10px] text-[var(--muted)]">
                      By: {b.supportingAnalysts.join(", ")}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--muted)]">
                      Score: {b.unweightedScore} → <span className="text-[var(--accent)] font-bold">{b.weightedScore}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Memory Recall Live Feed */}
      <div className="liquid-glass p-6 space-y-4">
        <BentoHeader
          title="Memory records"
          subtitle="Shown records. On-chain count is only rows with a blob id."
          action={
            <span className="flex items-center gap-1 text-[11px] font-mono-num text-[var(--muted)]">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{walrusMemoriesCount} on-chain blobs</span>
            </span>
          }
        />

        <div className="space-y-2 text-xs font-mono-num">
          {predictions.slice(0, 6).map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="p-3 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)] shrink-0" />
                <span className="font-semibold text-[var(--text)]">{m.title}</span>
                <span className="text-[10px] text-[var(--muted)]">by {m.analyst}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0 text-[11px]">
                <span
                  className={
                    m.outcome === "ACCURATE"
                      ? "text-[var(--win)] font-bold"
                      : m.outcome === "FAILED"
                      ? "text-[var(--loss)] font-bold"
                      : "text-amber-500 font-bold"
                  }
                >
                  {m.outcome}
                </span>
                <span className="text-[var(--muted)] font-mono-num">
                  {formatLocalDateLabel(m.timestamp, m.dateStr)}
                </span>
                {m.writeStatus === "confirmed" && m.blobId ? (
                  <a
                    href={getWalrusBlobExplorerUrl(m.blobId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--accent)] text-[10px] hover:underline"
                  >
                    Blob #{m.blobId.slice(0, 8)}...
                  </a>
                ) : (
                  <span className="text-[var(--muted)] text-[10px] italic">
                    Local Demo
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
