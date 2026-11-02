"use client";

import React from "react";
import { PnLCurveCard } from "./PnLCurveCard";
import { WinRateRingCard } from "./WinRateRingCard";
import { StreakCard } from "./StreakCard";
import { RoiCategoryCard } from "./RoiCategoryCard";
import { BankrollCard } from "./BankrollCard";
import { OpenPredictionsCard } from "./OpenPredictionsCard";
import { BestWorstPickCard } from "./BestWorstPickCard";
import { CalendarHeatmapCard } from "./CalendarHeatmapCard";
import { PredictionRecord, SuiNodeStatus } from "@/lib/types";
import {
  SIMULATED_STARTING_BANKROLL,
  activeRisk,
  avgStakeOfBankrollPercent,
  countLiveVsBacktest,
  currentWinStreak,
  simulatedBalance,
  liveOpenPredictions,
} from "@/lib/dashboard-stats";
import { Shield } from "lucide-react";

interface DashboardViewProps {
  predictions: PredictionRecord[];
  suiMetrics?: SuiNodeStatus | null;
  onNavigateJournal: () => void;
  isMainnetConnected?: boolean;
}

export function DashboardView({
  predictions,
  onNavigateJournal,
  isMainnetConnected = false,
}: DashboardViewProps) {
  const resolved = predictions.filter((p) => p.outcome !== "PENDING");
  const wins = resolved.filter((p) => p.outcome === "ACCURATE").length;
  const losses = resolved.filter((p) => p.outcome === "FAILED").length;
  const openList = liveOpenPredictions(predictions, isMainnetConnected);
  const pending = openList.length;
  const winRate = resolved.length > 0 ? (wins / resolved.length) * 100 : 0;

  const recent10: ("W" | "L")[] = resolved
    .slice()
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)
    .map((p) => (p.outcome === "ACCURATE" ? "W" : "L"));

  const streak = currentWinStreak(predictions);
  const sample = countLiveVsBacktest(predictions);
  const balance = simulatedBalance(predictions);
  const pnlPercent =
    SIMULATED_STARTING_BANKROLL > 0
      ? Number((((balance - SIMULATED_STARTING_BANKROLL) / SIMULATED_STARTING_BANKROLL) * 100).toFixed(1))
      : 0;

  const best = resolved.slice().sort((a, b) => (b.pnl || 0) - (a.pnl || 0))[0];
  const worst = resolved.slice().sort((a, b) => (a.pnl || 0) - (b.pnl || 0))[0];

  return (
    <div className="space-y-4">
      {/* Lunetra Top Institutional Terminal Banner */}
      <div className="lunetra-card p-5 sm:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#09182A] border border-[var(--border)] text-[var(--accent)]">
              <Shield className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-heading font-bold text-[var(--text)] tracking-tight">
              Institutional Intelligence Overview
            </h2>
          </div>
          <p className="text-xs text-[var(--text-dim)] max-w-2xl leading-relaxed">
            Autonomous forecaster performance & credibility telemetry anchored to Sui consensus and immutable Walrus blob storage.
          </p>
        </div>

        <div className="flex items-center gap-2.5 font-mono-num text-xs">
          <div className="flex items-center gap-2 bg-[var(--surface-subtle)] px-3.5 py-2 rounded-xl border border-[var(--border)]">
            <span className="w-2 h-2 rounded-full bg-[var(--win)] shadow-[0_0_8px_var(--win)]" />
            <span className="text-[11px] text-[var(--text)] font-semibold">
              {resolved.length} Resolved Events
            </span>
            <span className="text-[var(--border)]">|</span>
            <span className="text-[11px] text-[var(--accent)] font-semibold">
              {pending} Active Positions
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-4">
        <PnLCurveCard records={predictions} />
        <WinRateRingCard
          winRate={Number(winRate.toFixed(1))}
          wins={wins}
          losses={losses}
          pending={pending}
          liveCount={sample.live}
          backtestCount={sample.backtest}
        />
        <StreakCard currentStreak={`${streak}W`} recentPicks={recent10} hotRun={streak >= 3} />
        <RoiCategoryCard predictions={predictions} />
        <BankrollCard
          balance={balance}
          startingBalance={SIMULATED_STARTING_BANKROLL}
          monthlyPnlPercent={pnlPercent}
          activeRisk={activeRisk(predictions, isMainnetConnected)}
          avgStakePercent={avgStakeOfBankrollPercent(predictions)}
        />
        <OpenPredictionsCard
          predictions={predictions}
          onViewAll={onNavigateJournal}
          isMainnetConnected={isMainnetConnected}
        />
        <BestWorstPickCard bestPick={best} worstPick={worst} />
        <CalendarHeatmapCard records={predictions} daysCount={35} />
      </div>
    </div>
  );
}
