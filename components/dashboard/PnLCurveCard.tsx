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
import type { PredictionRecord } from "../../lib/types";
import { cumulativePnlSeries, type PnlSeriesPoint } from "../../lib/dashboard-stats";

interface PnLCurveCardProps {
  records?: PredictionRecord[];
  currentPnl?: number;
  totalPnlPercent?: number;
}

const TIMEFRAME_DAYS: Record<string, number> = {
  "7D": 7,
  "30D": 30,
  "90D": 90,
};

export function PnLCurveCard({ records = [], currentPnl, totalPnlPercent }: PnLCurveCardProps) {
  const [timeframe, setTimeframe] = useState<"7D" | "30D" | "90D" | "All">("30D");

  const series: PnlSeriesPoint[] = cumulativePnlSeries(records, timeframe);
  const hasSeries = series.length > 0;

  // The main stat matches the last point of the selected window series, or 0 if empty
  const displayPnl = hasSeries ? series[series.length - 1].pnl : (currentPnl ?? 0);

  // Compute resolved stake percentage specifically for the selected timeframe window
  const resolved = useMemo(
    () => records.filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED"),
    [records]
  );

  const windowStake = useMemo(() => {
    if (timeframe === "All") {
      return resolved.reduce((acc, r) => acc + (r.stake || 0), 0);
    }
    const days = TIMEFRAME_DAYS[timeframe] || 30;
    const windowMs = days * 24 * 60 * 60 * 1000;
    const sorted = resolved.slice().sort((a, b) => a.timestamp - b.timestamp);
    if (sorted.length === 0) return 0;
    const latestTs = sorted[sorted.length - 1].timestamp;
    const cutoff = latestTs - windowMs;
    return sorted
      .filter((r) => r.timestamp >= cutoff && r.timestamp <= latestTs)
      .reduce((acc, r) => acc + (r.stake || 0), 0);
  }, [resolved, timeframe]);

  // Compute percentage strictly from the active window's PnL and stake
  const displayPercent =
    timeframe === "All" && totalPnlPercent !== undefined
      ? totalPnlPercent
      : windowStake > 0
        ? Number(((displayPnl / windowStake) * 100).toFixed(1))
        : 0;

  const chartData = series.map((s) => ({
    date: s.label,
    pnl: s.pnl,
  }));

  return (
    <BentoCard colSpan="col-span-12 lg:col-span-8" delay={0.05} className="flex flex-col justify-between">
      <div>
        <BentoHeader
          title="Cumulative PnL Performance"
          subtitle="Simulated capital trajectory from resolved market forecasts"
          action={
            <div className="flex items-center gap-1 bg-[#09182A] p-1 rounded-xl border border-[var(--border)]">
              {(["7D", "30D", "90D", "All"] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono-num font-medium transition-all ${
                    timeframe === tf
                      ? "bg-[#102840] text-[var(--accent)] border border-[var(--accent)]/40 shadow-sm font-semibold"
                      : "text-[var(--muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          }
        />

        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--text)] font-mono-num">
            <AnimatedNumber value={Math.abs(displayPnl)} prefix={displayPnl >= 0 ? "+$" : "-$"} />
          </span>
          <span
            className={`text-xs font-mono-num px-2.5 py-1 rounded-full font-semibold border ${
              displayPnl >= 0
                ? "bg-[var(--win-bg)] text-[var(--win)] border-[var(--win)]/30"
                : "bg-[var(--loss-bg)] text-[var(--loss)] border-[var(--loss)]/30"
            }`}
          >
            {displayPercent >= 0 ? "+" : ""}{displayPercent}% of resolved stake
          </span>
        </div>
      </div>

      {/* Lunetra Financial Line/Area Chart */}
      <div className="h-[210px] w-full mt-2">
        {!hasSeries ? (
          <div className="h-full w-full flex items-center justify-center text-xs text-[var(--muted)] border border-dashed border-[var(--border)] rounded-xl font-mono-num">
            No resolved forecasts in this window
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pnlGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#72BFFF" stopOpacity={0.20} />
                  <stop offset="95%" stopColor="#72BFFF" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="var(--muted)"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
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
                    const val = Number(payload[0].value) || 0;
                    return (
                      <div className="p-3 rounded-xl bg-[#102840] border border-[var(--border-hover)] shadow-xl text-xs font-mono-num space-y-1">
                        <p className="text-[var(--muted)]">{payload[0].payload.date}</p>
                        <p className={`text-sm font-bold ${val >= 0 ? "text-[var(--accent)]" : "text-[var(--loss)]"}`}>
                          {val >= 0 ? `+$${val.toLocaleString()}` : `-$${Math.abs(val).toLocaleString()}`}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="pnl"
                stroke="#72BFFF"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#pnlGlow)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </BentoCard>
  );
}
