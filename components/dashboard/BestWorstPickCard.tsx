"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { TrendingUp, TrendingDown } from "lucide-react";
import { PredictionRecord } from "@/lib/types";

interface BestWorstPickCardProps {
  bestPick?: PredictionRecord;
  worstPick?: PredictionRecord;
}

export function BestWorstPickCard({ bestPick, worstPick }: BestWorstPickCardProps) {
  if (!bestPick && !worstPick) {
    return (
      <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.35}>
        <BentoHeader title="Outlier Yield & Drawdown" subtitle="No resolved records in dataset." />
      </BentoCard>
    );
  }

  const bestTitle = bestPick?.target || bestPick?.title || "—";
  const bestPnl = bestPick?.pnl ?? 0;
  const bestAnalyst = bestPick?.analyst || "—";
  const bestContent = bestPick?.content || "";
  const bestDelta = bestPick?.credibilityDelta ?? 0;

  const worstTitle = worstPick?.target || worstPick?.title || "—";
  const worstPnl = worstPick?.pnl ?? 0;
  const worstAnalyst = worstPick?.analyst || "—";
  const worstContent = worstPick?.content || "";
  const worstDelta = worstPick?.credibilityDelta ?? 0;

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-8" delay={0} className="flex flex-col justify-between">
      <BentoHeader
        title="Yield Extremes"
        subtitle="Maximum gain and drawdown among resolved records"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-2">
        {/* Best Pick */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--win-border)] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--win)] text-[11px]">
              <TrendingUp className="w-3.5 h-3.5" />
              Maximum alpha
            </span>
            <span className="font-bold text-[var(--win)]">+{bestPnl >= 0 ? `$${bestPnl}` : `-$${Math.abs(bestPnl)}`}</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)] truncate">{bestTitle}</h4>
            <p className="text-[11px] text-[var(--text-dim)] line-clamp-2 mt-0.5 font-mono-num">
              {bestContent}
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1.5 flex justify-between border-t border-[var(--border)]">
            <span>Analyst: <strong className="text-[var(--text)]">{bestAnalyst}</strong></span>
            <span className="text-[var(--win)] font-semibold">+{bestDelta} pts</span>
          </div>
        </div>

        {/* Worst Pick */}
        <div className="p-3.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--loss-border)] space-y-2">
          <div className="flex items-center justify-between text-xs font-mono-num">
            <span className="flex items-center gap-1.5 font-semibold text-[var(--loss)] text-[11px]">
              <TrendingDown className="w-3.5 h-3.5" />
              Max drawdown
            </span>
            <span className="font-bold text-[var(--loss)]">{worstPnl >= 0 ? `+$${worstPnl}` : `-$${Math.abs(worstPnl)}`}</span>
          </div>

          <div>
            <h4 className="text-xs font-bold text-[var(--text)] truncate">{worstTitle}</h4>
            <p className="text-[11px] text-[var(--text-dim)] line-clamp-2 mt-0.5 font-mono-num">
              {worstContent}
            </p>
          </div>

          <div className="text-[10px] font-mono-num text-[var(--muted)] pt-1.5 flex justify-between border-t border-[var(--border)]">
            <span>Analyst: <strong className="text-[var(--text)]">{worstAnalyst}</strong></span>
            <span className="text-[var(--loss)] font-semibold">{worstDelta} pts</span>
          </div>
        </div>
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Variance spread: ${Math.abs(bestPnl - worstPnl).toLocaleString()}</span>
        <span className="text-[var(--text-dim)]">Verified outcomes</span>
      </div>
    </BentoCard>
  );
}
