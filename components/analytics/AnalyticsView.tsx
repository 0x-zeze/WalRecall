"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { BarChart3, Users, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import type { PredictionRecord } from "../../lib/types";
import { groupOpenMarkets } from "../../lib/markets";
import { computeForecasterStats, consensus } from "../../lib/credibility";
import {
  computeLeagueAnalytics,
  computeOddsRangeAnalytics,
  computeConfidenceAnalytics,
  computeMonthlyPnlAnalytics,
} from "../../lib/analytics";

interface AnalyticsViewProps {
  predictions?: PredictionRecord[];
  isMainnetConnected?: boolean;
}

export function AnalyticsView({
  predictions = [],
  isMainnetConnected = false,
}: AnalyticsViewProps) {
  // Pure forecaster stats & weights
  const forecasters = useMemo(() => {
    return computeForecasterStats(predictions);
  }, [predictions]);

  const weightsMap = useMemo(() => {
    const map = new Map<string, number>();
    forecasters.forEach((f) => map.set(f.handle, f.weightMultiplier));
    return map;
  }, [forecasters]);

  // (a) Consensus per open market
  const openMarkets = useMemo(() => {
    return groupOpenMarkets(predictions, { includeBacktest: !isMainnetConnected });
  }, [predictions, isMainnetConnected]);

  const marketConsensusList = useMemo(() => {
    return openMarkets.map((m) => {
      const result = consensus(m.label, m.opinions, weightsMap);
      return {
        market: m,
        result,
      };
    });
  }, [openMarkets, weightsMap]);

  // (b) Real performance analytics calculated from resolved records
  const leagueData = useMemo(() => computeLeagueAnalytics(predictions), [predictions]);
  const oddsRangeData = useMemo(() => computeOddsRangeAnalytics(predictions), [predictions]);
  const confidenceData = useMemo(() => computeConfidenceAnalytics(predictions), [predictions]);
  const monthlyPnlData = useMemo(() => computeMonthlyPnlAnalytics(predictions), [predictions]);

  return (
    <div className="space-y-6">
      {/* Top Overview Banner */}
      <div className="fin-card p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-1.5 rounded-lg bg-[#09182A] border border-[var(--border)] text-[var(--accent)]">
              <BarChart3 className="w-4 h-4" />
            </span>
            <h2 className="text-lg font-heading font-bold text-[var(--text)] tracking-tight">
              Market Consensus & Predictive Intel
            </h2>
          </div>
          <p className="text-xs text-[var(--text-dim)] max-w-2xl leading-relaxed">
            Calculated from the forecast records in the journal (backtest and live).
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--surface-subtle)] px-4 py-2 rounded-xl border border-[var(--border)] font-mono-num text-xs">
          <span className="text-[11px] font-medium text-[var(--win)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[var(--win)] animate-pulse" />
            {isMainnetConnected
              ? `${predictions.filter((p) => Boolean(p.blobId)).length} on-chain records`
              : "local demo data"}
          </span>
          <span className="text-[var(--border)]">|</span>
          <span className="text-[var(--muted)]">{predictions.length} Total Records</span>
        </div>
      </div>

      {/* SECTION 1: Active Multi-Analyst Consensus Markets */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text)] font-heading flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-[var(--accent)]" />
              Active Consensus Distributions
            </h3>
            <p className="text-[11px] text-[var(--muted)]">
              Multi-analyst open markets comparing unweighted 1.0x votes against Walrus memory-weighted consensus.
            </p>
          </div>
          <span className="text-xs font-mono-num text-[var(--muted)]">
            {marketConsensusList.length} Multi-Analyst {marketConsensusList.length === 1 ? "Market" : "Markets"}
          </span>
        </div>

        {marketConsensusList.length === 0 ? (
          <div className="fin-card p-8 text-center text-xs font-mono-num text-[var(--muted)] space-y-2">
            <AlertCircle className="w-8 h-8 text-[var(--muted)]/50 mx-auto" />
            <p className="font-bold text-sm text-[var(--text)]">No Multi-Analyst Open Markets</p>
            <p className="max-w-md mx-auto text-[var(--muted)]">
              Add two forecasts on the same match or crypto asset from different handles to see real-time weighted vs. unweighted consensus.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {marketConsensusList.map(({ market, result }) => (
              <div
                key={market.marketKey}
                className="fin-card p-5 space-y-4 border border-[var(--border)] hover:border-[var(--border-hover)] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-[10px] font-mono-num text-[var(--accent)] uppercase font-semibold block tracking-wider">
                      {market.records[0]?.sportType || "Prediction"} Market
                    </span>
                    <h4 className="text-sm font-bold text-[var(--text)] truncate" title={market.label}>
                      {market.label}
                    </h4>
                  </div>
                  {result.pivoted && (
                    <span className="px-2.5 py-0.5 rounded-full bg-[var(--win-bg)] text-[var(--win)] border border-[var(--win-border)] text-[10px] font-mono-num font-bold shrink-0">
                      MEMORY PIVOT
                    </span>
                  )}
                </div>

                {/* Consensus Comparison Box */}
                <div className="grid grid-cols-2 gap-2 text-xs font-mono-num">
                  <div className="p-3 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] space-y-1">
                    <span className="text-[10px] text-[var(--muted)] uppercase block flex items-center gap-1 font-medium">
                      <XCircle className="w-3 h-3 text-[var(--loss)]" />
                      Flat 1.0x
                    </span>
                    <div className="font-bold text-[var(--text)] truncate">{result.unweightedPick}</div>
                    <div className="text-[10px] text-[var(--muted)]">{result.unweightedConfidence}% Conviction</div>
                  </div>

                  <div className="p-3 rounded-xl bg-[#102840] border border-[var(--border-hover)] space-y-1">
                    <span className="text-[10px] text-[var(--accent)] uppercase font-semibold block flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-[var(--win)]" />
                      Memory-Weighted
                    </span>
                    <div className="font-bold text-[var(--highlight)] truncate">{result.weightedPick}</div>
                    <div className="text-[10px] text-[var(--win)] font-bold">{result.weightedConfidence}% Conviction</div>
                  </div>
                </div>

                {/* Forecaster Weight Multipliers */}
                <div className="pt-2 border-t border-[var(--border)] text-[11px] font-mono-num space-y-1.5">
                  <span className="text-[10px] text-[var(--muted)] uppercase block font-medium">Analyst Opinions & Weights:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {market.opinions.map((op) => {
                      const weight = weightsMap.get(op.analyst) ?? 1.0;
                      return (
                        <span
                          key={op.analyst}
                          className="px-2 py-0.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px]"
                        >
                          <span className="font-semibold text-[var(--text)]">{op.analyst}</span>:{" "}
                          <span className="text-[var(--accent)]">{op.pick}</span>{" "}
                          <span className="text-[var(--muted)] font-mono-num">({weight.toFixed(2)}x)</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 2: Calculated Performance Charts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Win Rate by League / Asset */}
        <BentoCard colSpan="col-span-12 lg:col-span-7" delay={0.05}>
          <BentoHeader
            title="Win Rate by League & Asset"
            subtitle="Hit rates computed across distinct sports leagues and crypto targets"
          />

          <div className="h-64 w-full mt-2">
            {leagueData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--muted)] font-mono-num border border-dashed border-[var(--border)] rounded-xl">
                No resolved picks to compute category hit rates
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leagueData} layout="vertical" margin={{ top: 5, right: 30, left: 45, bottom: 5 }}>
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    stroke="var(--muted)"
                    fontSize={10}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    stroke="var(--text)"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as (typeof leagueData)[0];
                        return (
                          <div className="p-3 rounded-xl bg-[#102840] border border-[var(--border-hover)] shadow-xl text-xs font-mono-num space-y-1">
                            <p className="font-bold text-[var(--text)] flex items-center gap-1.5">
                              {item.name}
                              {item.lowSample && (
                                <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                  low sample (n&lt;5)
                                </span>
                              )}
                            </p>
                            <p className="text-[var(--accent)] font-semibold">Hit Rate: {item.winRate}%</p>
                            <p className="text-[var(--muted)]">Resolved Picks: {item.picks}</p>
                            <p className={item.pnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"}>
                              P&L: {item.pnl >= 0 ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                            </p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="winRate" radius={[0, 4, 4, 0]}>
                    {leagueData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill || "#72BFFF"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Sample count badges */}
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[var(--border)] mt-2">
            {leagueData.map((l) => (
              <span
                key={l.name}
                className="text-[10px] font-mono-num px-2 py-0.5 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--muted)] flex items-center gap-1"
              >
                <span className="font-semibold text-[var(--text)]">{l.name}:</span> {l.picks} picks
                {l.lowSample && <span className="text-amber-400 text-[9px]">(low sample)</span>}
              </span>
            ))}
          </div>
        </BentoCard>

        {/* Monthly PnL Trend */}
        <BentoCard colSpan="col-span-12 lg:col-span-5" delay={0.1}>
          <BentoHeader title="Monthly PnL Trajectory" subtitle="Net profit & loss aggregated by calendar month" />

          <div className="h-64 w-full mt-2">
            {monthlyPnlData.length === 0 ? (
              <div className="h-full w-full flex items-center justify-center text-xs text-[var(--muted)] font-mono-num border border-dashed border-[var(--border)] rounded-xl">
                No resolved months on record
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyPnlData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <XAxis dataKey="month" stroke="var(--muted)" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--muted)"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const item = payload[0].payload as (typeof monthlyPnlData)[0];
                        return (
                          <div className="p-3 rounded-xl bg-[#102840] border border-[var(--border-hover)] shadow-xl text-xs font-mono-num space-y-1">
                            <p className="font-bold text-[var(--text)]">{item.month}</p>
                            <p className={`font-semibold ${item.pnl >= 0 ? "text-[var(--win)]" : "text-[var(--loss)]"}`}>
                              Net P&L: {item.pnl >= 0 ? `+$${item.pnl}` : `-$${Math.abs(item.pnl)}`}
                            </p>
                            <p className="text-[var(--muted)]">{item.count} forecasts resolved</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                    {monthlyPnlData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.pnl >= 0 ? "var(--win)" : "var(--loss)"}
                        opacity={0.88}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </BentoCard>

        {/* Odds Range Hit Rate */}
        <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.15}>
          <BentoHeader
            title="Performance by Odds Range"
            subtitle="Stratified hit rate across standardized American odds brackets"
          />

          <div className="space-y-3 mt-4">
            {oddsRangeData.map((tier) => (
              <div key={tier.range} className="space-y-1.5 font-mono-num text-xs">
                <div className="flex justify-between items-center text-[var(--muted)]">
                  <span className="flex items-center gap-1.5 font-medium text-[var(--text)]">
                    {tier.range}
                    {tier.lowSample && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        low sample (n&lt;5)
                      </span>
                    )}
                  </span>
                  <span>
                    <strong className="text-[var(--text)]">{tier.hitRate}%</strong> ({tier.count} picks)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--surface-subtle)] overflow-hidden">
                  <div
                    className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, tier.hitRate))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </BentoCard>

        {/* Confidence Level Hit Rate */}
        <BentoCard colSpan="col-span-12 lg:col-span-6" delay={0.2}>
          <BentoHeader
            title="Performance by Confidence Rating"
            subtitle="Hit rate and average PnL across analyst star ratings (1 to 5)"
          />

          <div className="space-y-3 mt-4">
            {confidenceData.map((tier) => (
              <div
                key={tier.level}
                className="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] font-mono-num text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[var(--text)]">{tier.level}</span>
                  {tier.lowSample && (
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                      low sample (n&lt;5)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="text-[var(--muted)]">{tier.count} picks</span>
                  <span className="font-bold text-[var(--accent)] w-14 text-right">{tier.hitRate}%</span>
                  <span
                    className={`font-semibold w-16 text-right ${
                      tier.avgPnl.startsWith("+")
                        ? "text-[var(--win)]"
                        : tier.avgPnl.startsWith("-")
                        ? "text-[var(--loss)]"
                        : "text-[var(--muted)]"
                    }`}
                  >
                    {tier.avgPnl}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </BentoCard>
      </div>
    </div>
  );
}
