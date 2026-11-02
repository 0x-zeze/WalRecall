"use client";

import React, { useState, useMemo } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { Wallet, Calculator, AlertTriangle, ExternalLink } from "lucide-react";
import { SIMULATED_STARTING_BANKROLL, simulatedBalance, cumulativePnlSeries } from "@/lib/dashboard-stats";
import { computeForecasterStats } from "@/lib/credibility";
import { parseOdds } from "@/lib/odds";
import { laplaceWinProbability, calculateKelly } from "@/lib/bankroll";
import { formatLocalDateLabel } from "@/lib/date-utils";
import { getWalrusBlobExplorerUrl } from "@/lib/explorer";
import type { PredictionRecord } from "@/lib/types";

interface BankrollViewProps {
  predictions?: PredictionRecord[];
  isMainnetConnected?: boolean;
}

export function BankrollView({
  predictions = [],
}: BankrollViewProps) {
  // Current simulated balance derived honestly from records
  const currentBalance = useMemo(() => {
    return simulatedBalance(predictions, SIMULATED_STARTING_BANKROLL);
  }, [predictions]);

  // Forecasters for analyst selector
  const forecasters = useMemo(() => {
    return computeForecasterStats(predictions);
  }, [predictions]);

  // State for Kelly Calculator
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>("");
  const [manualWinProb, setManualWinProb] = useState<number>(50); // Neutral default: 50%
  const [oddsInput, setOddsInput] = useState<string>("-110");
  const [stakeMethod, setStakeMethod] = useState<"kelly" | "flat">("kelly");

  // Determine active win probability from selected analyst or manual input
  const activeWinProbData = useMemo(() => {
    if (!selectedAnalyst) {
      return {
        winProb: manualWinProb,
        n: 0,
        lowSample: false,
        sourceText: "manual probability (neutral default 50%)",
      };
    }

    const f = forecasters.find((item) => item.handle === selectedAnalyst);
    if (!f) {
      return {
        winProb: manualWinProb,
        n: 0,
        lowSample: false,
        sourceText: "manual input",
      };
    }

    const laplace = laplaceWinProbability(f.wins, f.losses);
    return {
      winProb: laplace.winProbPercent,
      n: laplace.n,
      lowSample: laplace.lowSample,
      sourceText: `Laplace smoothed (${f.wins + 1}/${laplace.n + 2}) based on ${laplace.n} resolved forecasts`,
    };
  }, [selectedAnalyst, manualWinProb, forecasters]);

  // Parse odds
  const parsedOdds = useMemo(() => {
    return parseOdds(oddsInput);
  }, [oddsInput]);

  // Calculate Kelly stake recommendation from CURRENT balance
  const kellyResult = useMemo(() => {
    return calculateKelly(currentBalance, parsedOdds.decimal, activeWinProbData.winProb, 0.25);
  }, [currentBalance, parsedOdds.decimal, activeWinProbData.winProb]);

  const recommendedStake =
    stakeMethod === "kelly"
      ? kellyResult.recommendedStake
      : Math.round(currentBalance * 0.025);

  const recommendedPercent =
    stakeMethod === "kelly" ? kellyResult.recommendedPercent : 2.5;

  // Cumulative Balance History Curve: starts at SIMULATED_STARTING_BANKROLL
  const balanceHistory = useMemo(() => {
    const pnlSeries = cumulativePnlSeries(predictions, "All");
    const points = [
      {
        date: pnlSeries.length > 0 ? "Start" : "Initial",
        balance: SIMULATED_STARTING_BANKROLL,
      },
    ];

    for (const pt of pnlSeries) {
      points.push({
        date: pt.label,
        balance: SIMULATED_STARTING_BANKROLL + pt.pnl,
      });
    }

    return points;
  }, [predictions]);

  // Real Ledger: Up to 20 newest resolved records
  const ledgerRows = useMemo(() => {
    const resolved = predictions
      .filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED")
      .slice()
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20);

    return resolved.map((r) => ({
      id: r.id,
      date: formatLocalDateLabel(r.timestamp, r.dateStr),
      desc: `${r.target}: ${r.pick}`,
      amount: r.pnl !== undefined ? (r.pnl >= 0 ? `+$${r.pnl}` : `-$${Math.abs(r.pnl)}`) : "$0",
      isPositive: (r.pnl || 0) >= 0,
      blobId: r.blobId,
    }));
  }, [predictions]);

  return (
    <div className="space-y-4">
      {/* Top Header Card with Honest Explanatory Banner */}
      <div className="liquid-glass p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-5 h-5 text-[var(--accent-violet)]" />
            <h2 className="text-lg font-heading font-bold text-[var(--text)]">Simulated Portfolio & Bankroll</h2>
          </div>
          <p className="text-xs text-[var(--muted)] max-w-3xl leading-relaxed">
            Bankroll is a capital management simulation. It displays a hypothetical balance derived from simulated stakes
            and calculates recommended position sizes (Kelly Criterion) based on estimated win probabilities and odds. It is not a wallet or real currency.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--glass-surface-1)] px-4 py-2.5 rounded-xl border border-[var(--border)] font-mono-num text-xs backdrop-blur-sm">
          <span className="text-[11px] font-medium text-amber-400">Capital Simulation</span>
          <span className="text-[var(--border)]">|</span>
          <span className="text-[var(--text)] font-semibold">${currentBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* Grid: Balance History Curve & Stake Sizing Helper */}
      <div className="grid grid-cols-12 gap-4">
        {/* Balance History Curve */}
        <BentoCard colSpan="col-span-12 lg:col-span-7" delay={0.05}>
          <BentoHeader
            title="Portfolio Balance Trajectory"
            subtitle="Cumulative simulated balance derived from starting capital and resolved records"
          />

          <div className="mb-2">
            <span className="text-3xl font-bold font-mono-num text-[var(--text)]">
              <AnimatedNumber value={currentBalance} prefix="$" />
            </span>
            <span className="text-xs text-[var(--muted)] font-mono-num ml-2">
              starting ${SIMULATED_STARTING_BANKROLL.toLocaleString()} · simulated
            </span>
          </div>

          <div className="h-60 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceHistory} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="balanceGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis
                  stroke="var(--muted)"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  domain={["dataMin - 500", "dataMax + 500"]}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="p-2.5 rounded-[10px] bg-[var(--card)] border border-[var(--border)] text-xs font-mono-num shadow-xl">
                          <p className="text-[var(--muted)]">{payload[0].payload.date}</p>
                          <p className="font-bold text-[var(--accent)]">${payload[0].value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="balance" stroke="var(--accent)" strokeWidth={2} fill="url(#balanceGlow)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </BentoCard>

        {/* Stake Sizing Helper (Kelly / Flat %) */}
        <BentoCard colSpan="col-span-12 lg:col-span-5" delay={0.1}>
          <BentoHeader
            title="Stake Sizing Calculator (Kelly Criterion)"
            subtitle="Calculates optimal stake from current simulated balance"
            action={<Calculator className="w-4 h-4 text-[var(--accent)]" />}
          />

          <div className="space-y-3 font-mono-num text-xs">
            {/* Method Toggle */}
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-[8px] bg-[var(--border-subtle)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => setStakeMethod("kelly")}
                className={`py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  stakeMethod === "kelly"
                    ? "bg-[var(--card)] text-[var(--accent)] border border-[var(--border)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Quarter-Kelly (Conservative)
              </button>
              <button
                type="button"
                onClick={() => setStakeMethod("flat")}
                className={`py-1.5 rounded-[6px] text-xs font-semibold transition ${
                  stakeMethod === "flat"
                    ? "bg-[var(--card)] text-[var(--accent)] border border-[var(--border)]"
                    : "text-[var(--muted)]"
                }`}
              >
                Flat 2.5% Allocation
              </button>
            </div>

            {/* Analyst Picker */}
            <div>
              <label className="text-[10px] text-[var(--muted)] uppercase block mb-1">Select Forecaster</label>
              <select
                value={selectedAnalyst}
                onChange={(e) => setSelectedAnalyst(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none text-xs font-mono-num"
              >
                <option value="">Manual Probability (Default 50%)</option>
                {forecasters.map((f) => (
                  <option key={f.handle} value={f.handle}>
                    {f.handle} ({f.wins}W - {f.losses}L, {f.weightMultiplier.toFixed(2)}x)
                  </option>
                ))}
              </select>
            </div>

            {/* Inputs: Win Probability & Odds */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-[var(--muted)] uppercase block mb-1">Win Probability (%)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  disabled={Boolean(selectedAnalyst)}
                  value={activeWinProbData.winProb}
                  onChange={(e) => setManualWinProb(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none disabled:opacity-60"
                />
              </div>

              <div>
                <label className="text-[10px] text-[var(--muted)] uppercase block mb-1">Odds (American/Decimal)</label>
                <input
                  type="text"
                  value={oddsInput}
                  onChange={(e) => setOddsInput(e.target.value)}
                  placeholder="-110 or 1.91"
                  className="w-full px-2.5 py-1.5 rounded-[6px] bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
                />
              </div>
            </div>

            {/* Probability Source Note & Low Sample Warning */}
            <div className="text-[10px] text-[var(--muted)]">
              <span>{activeWinProbData.sourceText}</span>
              {activeWinProbData.lowSample && (
                <div className="mt-1 flex items-center gap-1.5 text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  <span>Low sample (n&lt;5): win rate estimate is preliminary and unreliable.</span>
                </div>
              )}
            </div>

            {/* Recommended Output Box */}
            <div className="p-4 rounded-[10px] bg-[var(--accent)]/10 border border-[var(--accent)]/30 space-y-1">
              <span className="text-[10px] text-[var(--muted)] uppercase block">
                Recommended Stake (From Current ${currentBalance.toLocaleString()})
              </span>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[var(--accent)]">
                  ${recommendedStake.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-[var(--text)]">
                  {stakeMethod === "kelly" ? (
                    kellyResult.hasEdge ? (
                      `${recommendedPercent}% Quarter-Kelly`
                    ) : (
                      <span className="text-amber-400">0% (no edge at these odds)</span>
                    )
                  ) : (
                    "2.5% Flat Allocation"
                  )}
                </span>
              </div>
              <p className="text-[10px] text-[var(--muted)] pt-1">
                {stakeMethod === "kelly"
                  ? kellyResult.hasEdge
                    ? "Quarter-Kelly fraction balances long-term growth against drawdown variance."
                    : "Expected value is zero or negative at current odds. Recommendation is to pass."
                  : "Fixed conservative sizing independent of edge estimation."}
              </p>
            </div>
          </div>
        </BentoCard>
      </div>

      {/* Ledger Table: Computed strictly from real resolved records */}
      <BentoCard colSpan="col-span-12" delay={0.15}>
        <BentoHeader
          title="Bankroll Capital Ledger"
          subtitle="Recent resolved forecasts and capital adjustments derived from records"
        />

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono-num border-collapse">
            <thead className="bg-[var(--border-subtle)] text-[var(--muted)] uppercase border-b border-[var(--border)] text-[10px]">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Walrus blob</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {/* Opening entry */}
              <tr className="hover:bg-[var(--border-subtle)]/40">
                <td className="py-3 px-4 text-[var(--muted)]">Start</td>
                <td className="py-3 px-4 font-medium text-[var(--muted)]">Simulated starting bankroll</td>
                <td className="py-3 px-4 text-right font-bold text-[var(--win)]">
                  +${SIMULATED_STARTING_BANKROLL.toLocaleString()}
                </td>
                <td className="py-3 px-4 text-right text-[var(--muted)]">—</td>
              </tr>

              {/* Resolved records entries */}
              {ledgerRows.map((tx) => (
                <tr key={tx.id} className="hover:bg-[var(--border-subtle)]/40">
                  <td className="py-3 px-4 text-[var(--muted)]">{tx.date}</td>
                  <td className="py-3 px-4 font-medium">{tx.desc}</td>
                  <td
                    className={`py-3 px-4 text-right font-bold ${
                      tx.isPositive ? "text-[var(--win)]" : "text-[var(--loss)]"
                    }`}
                  >
                    {tx.amount}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {tx.blobId ? (
                      <a
                        href={getWalrusBlobExplorerUrl(tx.blobId)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--accent)] hover:underline font-semibold"
                      >
                        <span>Blob #{tx.blobId.slice(0, 8)}...</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span className="text-[var(--muted)]">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </BentoCard>
    </div>
  );
}
