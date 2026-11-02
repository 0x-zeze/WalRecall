"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { Clock, ArrowRight } from "lucide-react";
import { PredictionRecord } from "@/lib/types";
import { liveOpenPredictions, isBacktestRecord } from "@/lib/dashboard-stats";

interface OpenPredictionsCardProps {
  predictions: PredictionRecord[];
  onViewAll?: () => void;
  isMainnetConnected?: boolean;
}

export function OpenPredictionsCard({
  predictions,
  onViewAll,
  isMainnetConnected = false,
}: OpenPredictionsCardProps) {
  const pendingPicks = liveOpenPredictions(predictions, isMainnetConnected).slice(0, 4);

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.3} className="flex flex-col justify-between">
      <div>
        <BentoHeader
          title="Active Open Positions"
          subtitle="Unresolved forecasts awaiting Oracle settlement"
          action={
            onViewAll && (
              <button
                onClick={onViewAll}
                className="flex items-center gap-1 text-[11px] font-mono-num text-[var(--accent)] hover:text-[var(--highlight)] font-semibold transition-colors"
              >
                <span>Journal View</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )
          }
        />

        <div className="space-y-2.5 my-2">
          {pendingPicks.length === 0 ? (
            <div className="text-xs text-[var(--muted)] py-8 text-center font-mono-num">
              No active pending predictions in market queue.
            </div>
          ) : (
            pendingPicks.map((pick) => (
              <div
                key={pick.id}
                className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] hover:border-[var(--border-hover)] flex items-center justify-between gap-3 text-xs transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[var(--text)] truncate block">
                      {pick.target}
                    </span>
                    <span className="text-[10px] font-mono-num px-1.5 py-0.5 rounded bg-[var(--card)] text-[var(--accent)] border border-[var(--border)] font-semibold">
                      {pick.odds}
                    </span>
                    {!isMainnetConnected && isBacktestRecord(pick) && (
                      <span className="text-[9px] font-mono-num px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 font-medium">
                        sample
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[var(--text-dim)] truncate mt-0.5 font-mono-num">{pick.pick}</p>
                </div>

                <div className="shrink-0 flex items-center gap-1.5 text-[10px] font-mono-num font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                  <Clock className="w-3 h-3" />
                  <span>Pending</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Active Queue: {pendingPicks.length} open</span>
        <span className="text-[var(--text-dim)]">Tatum / Sui settlement</span>
      </div>
    </BentoCard>
  );
}
