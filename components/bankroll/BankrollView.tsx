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
import { Wallet, Calculator, AlertTriangle, ExternalLink, Sliders, ShieldCheck, DollarSign, RotateCcw } from "lucide-react";
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

const COMMON_ODDS_PRESETS = [
  { label: "-110 (Standard)", value: "-110" },
  { label: "-150 (Favorite)", value: "-150" },
  { label: "+100 (Even)", value: "+100" },
  { label: "+150 (Underdog)", value: "+150" },
  { label: "+200 (Longshot)", value: "+200" },
];

const WIN_PROB_PRESETS = [
  { label: "50% (Coinflip)", value: 50 },
  { label: "55% (Break-even+)", value: 55 },
  { label: "60% (Sharp)", value: 60 },
  { label: "65% (Strong)", value: 65 },
  { label: "75% (Elite)", value: 75 },
];

const CAPITAL_PRESETS = [500, 1000, 2500, 5000, 10000, 25000, 50000];

export function BankrollView({
  predictions = [],
}: BankrollViewProps) {
  // Configurable starting capital (free input, not locked to $10,000)
  const [startingCapital, setStartingCapital] = useState<number>(SIMULATED_STARTING_BANKROLL);

  // Total resolved net PnL from records
  const totalResolvedPnl = useMemo(() => {
    return predictions
      .filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED")
      .reduce((sum, r) => sum + (r.pnl || 0), 0);
  }, [predictions]);

  // Current simulated balance derived from custom starting capital + authentic PnL
  const currentBalance = useMemo(() => {
    return simulatedBalance(predictions, startingCapital);
  }, [predictions, startingCapital]);

  // Forecasters for analyst selector
  const forecasters = useMemo(() => {
    return computeForecasterStats(predictions);
  }, [predictions]);

  // State for Kelly Calculator
  const [selectedAnalyst, setSelectedAnalyst] = useState<string>("");
  const [manualWinProb, setManualWinProb] = useState<number>(55);
  const [oddsInput, setOddsInput] = useState<string>("-110");
  const [kellyFraction, setKellyFraction] = useState<number>(0.25);
  const [stakeMethod, setStakeMethod] = useState<"kelly" | "flat">("kelly");

  // Determine active win probability from selected analyst or manual input
  const activeWinProbData = useMemo(() => {
    if (!selectedAnalyst) {
      return {
        winProb: manualWinProb,
        n: 0,
        lowSample: false,
        sourceText: "Manual probability (adjust slider / chips below)",
      };
    }

    const f = forecasters.find((item) => item.handle === selectedAnalyst);
    if (!f) {
      return {
        winProb: manualWinProb,
        n: 0,
        lowSample: false,
        sourceText: "Manual input",
      };
    }

    const laplace = laplaceWinProbability(f.wins, f.losses);
    return {
      winProb: laplace.winProbPercent,
      n: laplace.n,
      lowSample: laplace.lowSample,
      sourceText: `Laplace smoothed (${f.wins + 1}/${laplace.n + 2}) based on ${laplace.n} resolved forecasts by ${f.handle}`,
    };
  }, [selectedAnalyst, manualWinProb, forecasters]);

  // Parse odds
  const parsedOdds = useMemo(() => {
    return parseOdds(oddsInput);
  }, [oddsInput]);

  // Calculate Kelly stake recommendation from current balance
  const kellyResult = useMemo(() => {
    const fraction = stakeMethod === "flat" ? 0.25 : kellyFraction;
    return calculateKelly(currentBalance, parsedOdds.decimal, activeWinProbData.winProb, fraction);
  }, [currentBalance, parsedOdds.decimal, activeWinProbData.winProb, stakeMethod, kellyFraction]);

  const recommendedStake =
    stakeMethod === "kelly"
      ? kellyResult.recommendedStake
      : Math.round(currentBalance * 0.025);

  const recommendedPercent =
    stakeMethod === "kelly" ? kellyResult.recommendedPercent : 2.5;

  // Expected Value (EV) calculation: (winProb * profit) - (lossProb * stake)
  const potentialProfit = Math.round(recommendedStake * (parsedOdds.decimal - 1));
  const expectedValueDollars = Math.round(
    (activeWinProbData.winProb / 100) * potentialProfit -
      ((100 - activeWinProbData.winProb) / 100) * recommendedStake
  );
  const expectedValuePercent =
    recommendedStake > 0
      ? Number(((expectedValueDollars / recommendedStake) * 100).toFixed(1))
      : 0;

  // Cumulative Balance History Curve: dynamically anchors to startingCapital
  const balanceHistory = useMemo(() => {
    const pnlSeries = cumulativePnlSeries(predictions, "All");
    const points = [
      {
        date: pnlSeries.length > 0 ? "Start" : "Initial",
        balance: startingCapital,
      },
    ];

    for (const pt of pnlSeries) {
      points.push({
        date: pt.label,
        balance: startingCapital + pt.pnl,
      });
    }

    return points;
  }, [predictions, startingCapital]);

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
      <div className="lunetra-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#09182A] border border-[var(--border)] text-[var(--accent)]">
              <Wallet className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-heading font-bold text-[var(--text)] tracking-tight">Simulated Portfolio & Bankroll</h2>
          </div>
          <p className="text-xs text-[var(--text-dim)] max-w-3xl leading-relaxed">
            Capital risk simulation engine. Displays hypothetical balances derived from simulated stakes
            and calculates mathematically optimal position sizing (Kelly Criterion) based on estimated win probabilities and odds.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--surface-subtle)] px-4 py-2.5 rounded-xl border border-[var(--border)] font-mono-num text-xs">
          <span className="text-[11px] font-medium text-amber-400">Capital Sizing Active</span>
          <span className="text-[var(--border)]">|</span>
          <span className="text-[var(--text)] font-semibold">${currentBalance.toLocaleString()}</span>
        </div>
      </div>

      {/* STARTING CAPITAL CONFIGURATOR BAR */}
      <div className="lunetra-card p-4 rounded-2xl border border-[var(--border)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-bold text-[var(--text)] font-heading flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-[var(--win)]" />
            Set Initial Simulation Capital
          </span>
          <p className="text-[11px] text-[var(--muted)] font-mono-num">
            Ubah modal awal simulasi sesuai keinginanmu. Semua kurva, saldo akhir, dan kalkulator Kelly akan langsung menyesuaikan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Direct Numeric Input */}
          <div className="relative flex items-center min-w-[140px]">
            <span className="absolute left-3 text-xs font-bold text-[var(--muted)] font-mono-num">$</span>
            <input
              type="number"
              min="10"
              step="500"
              value={startingCapital}
              onChange={(e) => setStartingCapital(Math.max(10, Number(e.target.value) || 10))}
              className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-sm font-bold font-mono-num text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
            />
          </div>

          {/* Quick Preset Chips */}
          <div className="flex flex-wrap items-center gap-1">
            {CAPITAL_PRESETS.map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => setStartingCapital(amt)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-medium border transition-all ${
                  startingCapital === amt
                    ? "bg-[var(--accent)] text-white border-[var(--accent)] font-semibold shadow-sm"
                    : "bg-[var(--glass-surface-1)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                }`}
              >
                ${amt >= 1000 ? `${amt / 1000}k` : amt}
              </button>
            ))}

            {/* Reset Button */}
            {startingCapital !== SIMULATED_STARTING_BANKROLL && (
              <button
                type="button"
                onClick={() => setStartingCapital(SIMULATED_STARTING_BANKROLL)}
                title="Reset to default $10,000"
                className="p-1.5 rounded-lg border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)] transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Balance History Curve & Interactive Stake Sizing Helper */}
      <div className="grid grid-cols-12 gap-4">
        {/* Balance History Curve */}
        <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.05} className="flex flex-col justify-between">
          <div>
            <BentoHeader
              title="Portfolio Balance Trajectory"
              subtitle={`Simulated capital trajectory starting from $${startingCapital.toLocaleString()}`}
            />

            <div className="flex items-baseline gap-3 mb-2">
              <span className="text-3xl font-bold font-mono-num text-[var(--text)]">
                <AnimatedNumber value={currentBalance} prefix="$" />
              </span>
              <span
                className={`text-xs font-mono-num px-2 py-0.5 rounded-full font-semibold ${
                  totalResolvedPnl >= 0
                    ? "bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win)]/30"
                    : "bg-[var(--loss-bg)] text-[var(--loss)] border border-[var(--loss)]/30"
                }`}
              >
                {totalResolvedPnl >= 0 ? `+$${totalResolvedPnl}` : `-$${Math.abs(totalResolvedPnl)}`} net PnL
              </span>
            </div>
          </div>

          <div className="h-64 w-full mt-2">
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
                  domain={["dataMin - 300", "dataMax + 300"]}
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

        {/* Enhanced Interactive Stake Sizing Calculator */}
        <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.1}>
          <BentoHeader
            title="Interactive Bankroll Simulator"
            subtitle={`Calculates optimal stake sizing from your active $${currentBalance.toLocaleString()} capital`}
            action={<Calculator className="w-4 h-4 text-[var(--accent)]" />}
          />

          <div className="space-y-3.5 font-mono-num text-xs mt-1">
            {/* 1. Forecaster or Manual Probability with Quick Chips & Slider */}
            <div className="p-3 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[var(--text)] flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Estimated Win Probability
                </label>
                <span className="text-sm font-bold text-[var(--accent)]">
                  {activeWinProbData.winProb}%
                </span>
              </div>

              {/* Forecaster Dropdown */}
              <select
                value={selectedAnalyst}
                onChange={(e) => setSelectedAnalyst(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-mono-num focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="">Manual Probability (Direct Slider / Chips)</option>
                {forecasters.map((f) => (
                  <option key={f.handle} value={f.handle}>
                    {f.handle} ({f.wins}W - {f.losses}L, Laplace: {laplaceWinProbability(f.wins, f.losses).winProbPercent}%)
                  </option>
                ))}
              </select>

              {/* Slider & Quick Chips for Manual Input */}
              {!selectedAnalyst && (
                <div className="space-y-2 pt-1">
                  <input
                    type="range"
                    min="1"
                    max="99"
                    value={manualWinProb}
                    onChange={(e) => setManualWinProb(Number(e.target.value))}
                    className="w-full accent-[var(--accent)] cursor-pointer"
                  />
                  <div className="flex flex-wrap gap-1">
                    {WIN_PROB_PRESETS.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setManualWinProb(p.value)}
                        className={`px-2 py-0.5 rounded text-[10px] border transition ${
                          manualWinProb === p.value
                            ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] font-semibold"
                            : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Source Note or Low Sample Warning */}
              <div className="text-[10px] text-[var(--muted)]">
                <span>{activeWinProbData.sourceText}</span>
                {activeWinProbData.lowSample && (
                  <div className="mt-1 flex items-center gap-1.5 text-amber-400 bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>Low sample (n&lt;5): estimate is sensitive to small sample noise.</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Odds Input with Instant Clickable Presets */}
            <div className="p-3 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-semibold text-[var(--text)]">
                  Market Odds
                </label>
                <span className="text-xs text-[var(--muted)] font-mono-num">
                  Decimal: <strong className="text-[var(--text)]">{parsedOdds.decimal.toFixed(2)}</strong>
                </span>
              </div>

              <input
                type="text"
                value={oddsInput}
                onChange={(e) => setOddsInput(e.target.value)}
                placeholder="-110 or 1.91"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] text-xs font-mono-num focus:border-[var(--accent)] focus:outline-none"
              />

              {/* Quick Odds Chips */}
              <div className="flex flex-wrap gap-1">
                {COMMON_ODDS_PRESETS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setOddsInput(o.value)}
                    className={`px-2 py-0.5 rounded text-[10px] border transition ${
                      oddsInput === o.value
                        ? "bg-[var(--accent)]/15 border-[var(--accent)] text-[var(--accent)] font-semibold"
                        : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 3. Sizing Method & Conservative Fractions */}
            <div className="p-3 rounded-xl bg-[var(--glass-surface-1)] border border-[var(--border)] space-y-2">
              <label className="text-[11px] font-semibold text-[var(--text)] block">
                Position Sizing Methodology
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setStakeMethod("kelly");
                    setKellyFraction(0.25);
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                    stakeMethod === "kelly" && kellyFraction === 0.25
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm font-semibold"
                      : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Quarter (0.25x)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStakeMethod("kelly");
                    setKellyFraction(0.5);
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                    stakeMethod === "kelly" && kellyFraction === 0.5
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm font-semibold"
                      : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Half (0.50x)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStakeMethod("kelly");
                    setKellyFraction(1.0);
                  }}
                  className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                    stakeMethod === "kelly" && kellyFraction === 1.0
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm font-semibold"
                      : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Full (1.00x)
                </button>
                <button
                  type="button"
                  onClick={() => setStakeMethod("flat")}
                  className={`py-1.5 px-2 rounded-lg font-medium border transition text-center ${
                    stakeMethod === "flat"
                      ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-sm font-semibold"
                      : "bg-[var(--card)] border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  Flat 2.5%
                </button>
              </div>
            </div>

            {/* 4. Live Simulation Telemetry Result Card */}
            <div className="p-4 rounded-xl bg-gradient-to-br from-[var(--accent)]/10 via-[var(--glass-surface-2)] to-transparent border border-[var(--accent)]/30 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[var(--muted)] uppercase font-semibold block flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
                  Recommended Stake Size
                </span>
                <span className="text-[11px] font-semibold text-[var(--accent)]">
                  {stakeMethod === "kelly"
                    ? `${(kellyFraction * 100).toFixed(0)}% Kelly Fraction`
                    : "Fixed Risk"}
                </span>
              </div>

              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-3xl font-bold font-mono-num text-[var(--text)]">
                    ${recommendedStake.toLocaleString()}
                  </span>
                  <span className="text-xs text-[var(--muted)] font-mono-num ml-2">
                    ({recommendedPercent}% of ${currentBalance.toLocaleString()})
                  </span>
                </div>
                <div className="text-right">
                  <span
                    className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${
                      kellyResult.hasEdge
                        ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30"
                        : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    }`}
                  >
                    {kellyResult.hasEdge ? `+${expectedValuePercent}% Edge` : "No Edge (Pass)"}
                  </span>
                </div>
              </div>

              {/* Scenario Breakdown Matrix */}
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)] text-[10px]">
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--border)] space-y-0.5">
                  <span className="text-[var(--muted)] uppercase block">If Win</span>
                  <span className="font-bold text-[var(--win)] text-xs">
                    +${potentialProfit.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--border)] space-y-0.5">
                  <span className="text-[var(--muted)] uppercase block">If Loss</span>
                  <span className="font-bold text-[var(--loss)] text-xs">
                    -${recommendedStake.toLocaleString()}
                  </span>
                </div>
                <div className="p-2 rounded bg-[var(--card)] border border-[var(--border)] space-y-0.5">
                  <span className="text-[var(--muted)] uppercase block">Expected Value</span>
                  <span className={`font-bold text-xs ${expectedValueDollars >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"}`}>
                    {expectedValueDollars >= 0 ? `+$${expectedValueDollars}` : `-$${Math.abs(expectedValueDollars)}`}
                  </span>
                </div>
              </div>

              <p className="text-[10px] text-[var(--muted)] leading-relaxed">
                {stakeMethod === "kelly"
                  ? kellyResult.hasEdge
                    ? `Kelly formula balances geometric capital growth against drawdown risk. At ${activeWinProbData.winProb}% win rate and ${parsedOdds.decimal} odds, recommended stake is ${recommendedPercent}% ($${recommendedStake.toLocaleString()}).`
                    : "No mathematical edge detected at this probability and odds combination. Capital preservation advice is to pass."
                  : "Flat allocation applies a uniform 2.5% risk budget across all qualifying picks."}
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
            <thead className="bg-[#09182A] text-[var(--muted)] uppercase border-b border-[var(--border)] text-[10px] tracking-wider font-semibold select-none">
              <tr>
                <th className="py-2.5 px-4">Date</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4 text-right">Amount</th>
                <th className="py-2.5 px-4 text-right">Walrus blob</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]">
              {/* Opening entry reflects current starting capital */}
              <tr className="hover:bg-[var(--border-subtle)]/40">
                <td className="py-3 px-4 text-[var(--muted)]">Start</td>
                <td className="py-3 px-4 font-medium text-[var(--muted)]">Simulated starting capital</td>
                <td className="py-3 px-4 text-right font-bold text-[var(--win)]">
                  +${startingCapital.toLocaleString()}
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
