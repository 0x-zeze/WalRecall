"use client";

import React from "react";
import { BentoCard, BentoHeader } from "../ui/BentoCard";
import { AnimatedNumber } from "../ui/AnimatedNumber";
import { ArrowUpRight } from "lucide-react";
import { SIMULATED_STARTING_BANKROLL } from "@/lib/dashboard-stats";

interface BankrollCardProps {
  balance: number;
  startingBalance?: number;
  monthlyPnlPercent: number;
  activeRisk: number;
  avgStakePercent: number;
}

export function BankrollCard({
  balance = SIMULATED_STARTING_BANKROLL,
  monthlyPnlPercent = 0,
  activeRisk = 0,
  avgStakePercent = 0,
}: Partial<BankrollCardProps>) {
  const positive = monthlyPnlPercent >= 0;
  return (
    <BentoCard colSpan="col-span-12 sm:col-span-6 lg:col-span-4" delay={0.25} className="flex flex-col justify-between">
      <BentoHeader
        title="Simulated Capital Exposure"
        subtitle="Simulated bankroll derived from resolved PnL"
        action={
          <span className="text-[10px] font-mono-num font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-2.5 py-0.5 rounded-full border border-[var(--border)]">
            SIMULATION
          </span>
        }
      />

      <div className="my-2 space-y-1">
        <span className="text-[11px] uppercase tracking-wider font-mono-num text-[var(--muted)] font-semibold">Active Capital</span>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono-num text-[var(--text)] tracking-tight">
            <AnimatedNumber value={balance} prefix="$" />
          </span>
          <span className={`inline-flex items-center text-xs font-mono-num font-semibold ${positive ? "text-[var(--win)]" : "text-[var(--loss)]"}`}>
            <ArrowUpRight className="w-3.5 h-3.5" />
            {positive ? "+" : ""}{monthlyPnlPercent}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 py-3 border-t border-[var(--border)] text-xs font-mono-num">
        <div className="p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted)] uppercase block font-medium">Pending Exposure</span>
          <span className="font-bold text-[var(--text)]">${activeRisk.toLocaleString()}</span>
        </div>
        <div className="p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)]">
          <span className="text-[10px] text-[var(--muted)] uppercase block font-medium">Avg Position Size</span>
          <span className="font-bold text-[var(--accent)]">{avgStakePercent}%</span>
        </div>
      </div>
    </BentoCard>
  );
}
