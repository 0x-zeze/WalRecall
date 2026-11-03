"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";

interface WinRateRingCardProps {
  winRate: number;
  wins: number;
  losses: number;
  pending: number;
  liveCount: number;
  backtestCount: number;
}

export function WinRateRingCard({
  winRate,
  wins,
  losses,
  pending,
  liveCount,
  backtestCount,
}: WinRateRingCardProps) {
  const radius = 46;
  const circumference = 2 * Math.PI * radius;
  // Ensure valid bounded percentage [0, 100]
  const clampedRate = Math.max(0, Math.min(100, isNaN(winRate) ? 0 : winRate));
  const strokeDashoffset = circumference - (clampedRate / 100) * circumference;
  const resolvedCount = wins + losses;

  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0} className="flex flex-col justify-between">
      <BentoHeader
        title="Win Rate Matrix"
        subtitle="Historical prediction accuracy ratio"
      />

      <div className="flex items-center justify-between my-2 gap-2">
        {/* Precision Concentric Radial Gauge */}
        <div className="relative w-32 h-32 flex items-center justify-center shrink-0">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            {/* Background Track Circle: concentric at cx=60, cy=60 */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="rgba(114, 191, 255, 0.10)"
              strokeWidth="8"
              fill="transparent"
            />
            {/* Active Win Rate Arc: identical concentric center cx=60, cy=60 */}
            <circle
              cx="60"
              cy="60"
              r={radius}
              stroke="var(--win)"
              strokeWidth="8"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          </svg>
          {/* Centered Optical Overlay */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center select-none pointer-events-none">
            <span className="text-2xl font-bold font-mono-num text-[var(--text)] tracking-tight leading-none">
              {clampedRate.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[var(--muted)] font-mono-num font-medium mt-1">
              Hit rate
            </span>
          </div>
        </div>

        {/* Breakdown Stats: strictly right-aligned tabular figures */}
        <div className="space-y-2 text-xs font-mono-num pl-4 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--win)] shrink-0" />
              Wins
            </span>
            <span className="font-bold text-[var(--text)] tabular-nums text-right min-w-[20px]">
              {wins}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--loss)] shrink-0" />
              Losses
            </span>
            <span className="font-bold text-[var(--text)] tabular-nums text-right min-w-[20px]">
              {losses}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-[var(--muted)] font-medium">
              <span className="w-2 h-2 rounded-full bg-[var(--pending)] shrink-0" />
              Pending
            </span>
            <span className="font-bold text-[var(--text)] tabular-nums text-right min-w-[20px]">
              {pending}
            </span>
          </div>
        </div>
      </div>

      {/* Footer: Exact Mathematical Reconciliation (Resolved + Pending = Live + Backtest) */}
      <div className="text-[11px] text-[var(--muted)] pt-3 border-t border-[var(--border)] font-mono-num flex justify-between items-center">
        <span>
          {resolvedCount} resolved · {pending} pending
        </span>
        <span className="text-[var(--text-dim)]">
          {liveCount} live · {backtestCount} backtest
        </span>
      </div>
    </BentoCard>
  );
}
