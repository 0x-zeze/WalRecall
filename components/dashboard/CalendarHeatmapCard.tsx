"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import type { PredictionRecord } from "../../lib/types";
import { formatLocalDateLabel } from "../../lib/date-utils";

interface CalendarHeatmapCardProps {
  records?: PredictionRecord[];
  daysCount?: number; // default 35 days (5 weeks)
  now?: number;
}

export function CalendarHeatmapCard({
  records = [],
  daysCount = 35,
  now,
}: CalendarHeatmapCardProps) {
  const resolved = records.filter((r) => r.outcome === "ACCURATE" || r.outcome === "FAILED");

  // Determine anchor time: use explicit `now` or latest resolved record timestamp
  const anchorTime = React.useMemo(() => {
    if (typeof now === "number") return now;
    if (resolved.length === 0) return 0;
    return Math.max(...resolved.map((r) => r.timestamp));
  }, [resolved, now]);

  const days = React.useMemo(() => {
    if (anchorTime === 0) return [];
    // Group resolved records by local calendar day key
    const resolvedByDay = new Map<string, { count: number; wins: number; losses: number; pnl: number }>();
    for (const r of resolved) {
      const d = new Date(r.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const cur = resolvedByDay.get(key) || { count: 0, wins: 0, losses: 0, pnl: 0 };
      cur.count += 1;
      if (r.outcome === "ACCURATE") cur.wins += 1;
      if (r.outcome === "FAILED") cur.losses += 1;
      cur.pnl += r.pnl || 0;
      resolvedByDay.set(key, cur);
    }

    const startOfAnchor = new Date(anchorTime);
    startOfAnchor.setHours(23, 59, 59, 999);

    return Array.from({ length: daysCount }).map((_, i) => {
      const d = new Date(startOfAnchor.getTime() - (daysCount - 1 - i) * 86400000);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const dayData = resolvedByDay.get(key) || { count: 0, wins: 0, losses: 0, pnl: 0 };
      const dateStr = formatLocalDateLabel(d.getTime(), d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));

      return {
        dateStr,
        count: dayData.count,
        wins: dayData.wins,
        losses: dayData.losses,
        pnl: dayData.pnl,
        hasActivity: dayData.count > 0,
      };
    });
  }, [resolved, daysCount, anchorTime]);

  const totalActivity = days.reduce((sum, d) => sum + d.count, 0);
  const activeDays = days.filter((d) => d.hasActivity).length;

  return (
    <BentoCard colSpan="col-span-12" delay={0.4} className="flex flex-col justify-between">
      <BentoHeader
        title="Daily Resolution Activity Heatmap"
        subtitle="Resolved forecasts per day over the last 35 days"
        action={
          <div className="flex items-center gap-2 text-[10px] font-mono-num text-[var(--muted)]">
            <span>0</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--border-subtle)]" title="0 resolved" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent)]/20 border border-[var(--accent)]/40" title="1 resolved" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent)]/50" title="2 resolved" />
              <span className="w-2.5 h-2.5 rounded-[3px] bg-[var(--accent)]" title="3+ resolved" />
            </div>
            <span>3+</span>
          </div>
        }
      />

      <div className="my-2 overflow-x-auto pb-1">
        {totalActivity === 0 ? (
          <div className="h-16 flex items-center justify-center text-sm text-[var(--muted)] border border-dashed border-[var(--border)] rounded-xl">
            No resolved forecast activity recorded in this 35-day window
          </div>
        ) : (
          <div className="flex gap-1.5 min-w-[500px]">
            {days.map((day, idx) => {
              const bgClass =
                day.count === 0
                  ? "bg-[var(--border-subtle)] text-[var(--muted)]/40 border-transparent"
                  : day.count === 1
                  ? "bg-[var(--accent)]/20 text-[var(--accent)] border-[var(--accent)]/40 font-semibold"
                  : day.count === 2
                  ? "bg-[var(--accent)]/50 text-white border-[var(--accent)]/60 font-semibold"
                  : "bg-[var(--accent)] text-white border-[var(--accent)] font-bold shadow-[0_0_8px_-1px_var(--accent)]";

              const tooltip =
                day.count === 0
                  ? `${day.dateStr}: No resolved forecasts`
                  : `${day.dateStr}: ${day.count} resolved (${day.wins}W / ${day.losses}L), PnL: ${
                      day.pnl >= 0 ? `+$${day.pnl}` : `-$${Math.abs(day.pnl)}`
                    }`;

              return (
                <div
                  key={idx}
                  title={tooltip}
                  className={`flex-1 h-9 rounded-[6px] border transition-transform hover:scale-105 cursor-default flex items-center justify-center text-[9px] font-mono-num ${bgClass}`}
                >
                  {day.count > 0 ? day.count : "·"}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between">
        <span>Active days: {activeDays} of {daysCount}</span>
        <span>Total resolved: {totalActivity}</span>
      </div>
    </BentoCard>
  );
}
