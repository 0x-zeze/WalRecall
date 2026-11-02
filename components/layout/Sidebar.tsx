"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  BookOpen,
  Award,
  BarChart3,
  Wallet,
  Sun,
  Moon,
  Database,
  RefreshCw,
  Server,
  Network,
  Menu,
  X,
  ShieldCheck,
} from "lucide-react";
import { useTheme } from "../theme/ThemeProvider";
import { SuiNodeStatus, TatumGatewayStatus, SuiChainStatus } from "@/lib/types";

export type NavTab = "dashboard" | "journal" | "credibility" | "analytics" | "bankroll";

interface SidebarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  suiMetrics?: SuiNodeStatus | null;
  tatumStatus?: TatumGatewayStatus | null;
  suiChainStatus?: SuiChainStatus | null;
  onSeed: () => void;
  seeding: boolean;
  walrusMemoriesCount: number;
  isMainnetConnected?: boolean;
}

export function Sidebar({
  activeTab,
  setActiveTab,
  suiMetrics,
  tatumStatus,
  suiChainStatus,
  onSeed,
  seeding,
  walrusMemoriesCount,
  isMainnetConnected = false,
}: SidebarProps) {
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navItems: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Overview", icon: LayoutDashboard },
    { id: "journal", label: "Prediction Journal", icon: BookOpen },
    { id: "credibility", label: "Credibility Matrix", icon: Award },
    { id: "analytics", label: "Consensus Intel", icon: BarChart3 },
    { id: "bankroll", label: "Bankroll Terminal", icon: Wallet },
  ];

  const resolvedTatum = tatumStatus ?? null;
  const resolvedSui = suiChainStatus || suiMetrics || null;

  /* ── Lunetra-Inspired Telemetry Mini-Panel ── */
  const renderTelemetryPanel = () => (
    <div className="space-y-2 pt-3 border-t border-[var(--border)]">
      {/* Tatum Data API */}
      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px] font-mono-num space-y-1.5 transition-colors">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                resolvedTatum?.status === "live" ? "bg-[var(--win)] shadow-[0_0_8px_var(--win)]" : "bg-amber-400"
              }`}
            />
            <Server className="w-3 h-3 text-[var(--accent)]" />
            Tatum Oracle
          </span>
          <span className={resolvedTatum?.status === "live" ? "text-[var(--win)] font-semibold" : "text-[var(--muted)]"}>
            {resolvedTatum?.status === "live"
              ? `${resolvedTatum.latencyMs !== null ? `${resolvedTatum.latencyMs}ms · ` : ""}live`
              : "standby"}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-[var(--muted)]">Gateway Tier</span>
          <span className="font-semibold text-[var(--highlight)]">
            {resolvedTatum?.status === "live" && resolvedTatum.plan ? resolvedTatum.plan : "Mainnet API"}
          </span>
        </div>
      </div>

      {/* Sui Checkpoint */}
      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px] font-mono-num space-y-1.5 transition-colors">
        <div className="flex items-center justify-between text-[var(--muted)]">
          <span className="flex items-center gap-1.5 font-medium">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                resolvedSui?.status === "live" ? "bg-[var(--win)] shadow-[0_0_8px_var(--win)]" : "bg-amber-400"
              }`}
            />
            <Network className="w-3 h-3 text-[var(--accent)]" />
            Sui Consensus
          </span>
          <span className="text-[10px] text-[var(--muted)]">
            {resolvedSui?.status === "live" ? "verified" : "syncing"}
          </span>
        </div>
        <div className="flex items-center justify-between font-medium text-[10px]">
          <span className="text-[var(--muted)]">Checkpoint</span>
          <span className={`truncate max-w-[130px] ${resolvedSui?.status === "live" && resolvedSui.checkpoint ? "font-semibold text-[var(--accent)]" : "text-[var(--muted)]"}`}>
            {resolvedSui?.status === "live" && resolvedSui.checkpoint
              ? `#${resolvedSui.checkpoint.slice(-8)}`
              : "unavailable"}
          </span>
        </div>
      </div>

      {/* Walrus Memory Status */}
      <div className="p-2.5 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[11px] space-y-1.5 transition-colors">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[var(--muted)] font-mono-num text-[10px] font-medium">
            <Database className="w-3 h-3 text-[var(--accent)]" />
            Walrus Storage
          </span>
          <span className={`font-mono-num font-semibold text-[10px] ${isMainnetConnected ? "text-[var(--win)]" : "text-[var(--accent)]"}`}>
            {isMainnetConnected
              ? `${walrusMemoriesCount} blobs`
              : "21 verified"}
          </span>
        </div>

        {process.env.NEXT_PUBLIC_ENABLE_SEED === "true" && (
          <button
            onClick={onSeed}
            disabled={seeding}
            className="w-full flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-[var(--card)] hover:bg-[var(--accent)]/15 hover:text-[var(--accent)] text-[var(--text-dim)] text-[10px] font-medium transition-all border border-[var(--border)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${seeding ? "animate-spin" : ""}`} />
            <span>{seeding ? "Seeding..." : "Seed 16 Memories"}</span>
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* ── Mobile top bar ────────────────────────────────────── */}
      <header className="md:hidden sticky top-0 z-30 w-full flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[#050B14]/90 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 shrink-0 rounded-xl bg-[#09182A] border border-[var(--border-hover)] flex items-center justify-center text-[var(--accent)] font-heading font-bold text-xs shadow-md">
            W
          </div>
          <div className="min-w-0 leading-tight">
            <h1 className="font-heading font-bold text-sm text-[var(--text)] tracking-tight">WalRecall</h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-[var(--accent)]"
                }`}
              />
              <span className="text-[9px] text-[var(--muted)] font-mono-num tracking-wider uppercase font-semibold">
                {isMainnetConnected ? "SUI MAINNET" : "INSTITUTIONAL DEMO"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleTheme}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/40 transition-colors"
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? (
              <Moon className="w-4 h-4 text-[var(--accent)]" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--surface-subtle)] border border-[var(--border)] text-[var(--text)] hover:border-[var(--accent)]/40 transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ── Mobile slide-over drawer ─────────────────────────── */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative ml-auto w-72 max-w-full bg-[#050B14] border-l border-[var(--border)] p-5 flex flex-col gap-4 z-10 overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#09182A] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold text-xs">
                  W
                </div>
                <span className="font-heading font-bold text-sm tracking-tight text-[var(--text)]">Navigation</span>
              </div>
              <button
                ref={closeRef}
                onClick={() => setMobileOpen(false)}
                className="w-8 h-8 rounded-lg border border-[var(--border)] flex items-center justify-center hover:bg-[var(--surface-subtle)] transition-colors text-[var(--muted)] hover:text-[var(--text)]"
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileOpen(false);
                    }}
                    className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#102840] text-[var(--highlight)] border border-[var(--accent)]/40 shadow-sm"
                        : "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)]"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
                    <span className="font-semibold">{item.label}</span>
                    {isActive && (
                      <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]" />
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="mt-2">
              {renderTelemetryPanel()}
            </div>
            <div className="mt-auto pt-4 text-[9px] text-[var(--muted)] font-mono-num text-center border-t border-[var(--border)]">
              SUI MAINNET · WALRUS STORAGE · TATUM ORACLE
            </div>
          </aside>
        </div>
      )}

      {/* ── Desktop sidebar (Lunetra Financial Terminal) ───────────────────────────────────── */}
      <aside className="hidden md:flex flex-col w-64 border-r border-[var(--border)] bg-[#050B14]/85 backdrop-blur-2xl p-5 shrink-0 select-none">
        {/* Brand */}
        <div className="flex items-center gap-3 pb-5 mb-4 border-b border-[var(--border)]">
          <div className="w-10 h-10 rounded-xl bg-[#09182A] border border-[var(--border-hover)] flex items-center justify-center text-[var(--accent)] font-heading font-bold text-sm shadow-[0_4px_16px_-4px_rgba(114,191,255,0.25)]">
            W
          </div>
          <div className="leading-tight">
            <h1 className="font-heading font-bold text-base text-[var(--text)] tracking-tight flex items-center gap-1.5">
              WalRecall
            </h1>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isMainnetConnected ? "bg-[var(--win)] shadow-[0_0_6px_var(--win)]" : "bg-[var(--accent)] shadow-[0_0_6px_var(--accent)]"
                }`}
              />
              <span className="text-[9px] text-[var(--muted)] font-mono-num tracking-wider uppercase font-semibold">
                {isMainnetConnected ? "Sui Mainnet" : "Financial Terminal"}
              </span>
            </div>
          </div>
        </div>

        {/* Section Label */}
        <div className="px-3 pb-2 text-[10px] font-mono-num uppercase tracking-wider text-[var(--muted)] font-semibold">
          Platform Navigation
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                  isActive
                    ? "bg-[#102840] text-[var(--highlight)] border border-[var(--accent)]/40 shadow-[0_2px_12px_rgba(5,11,20,0.6)]"
                    : "text-[var(--text-dim)] hover:text-[var(--text)] hover:bg-[var(--surface-subtle)] border border-transparent"
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
                <span className={`truncate ${isActive ? "font-semibold" : "font-normal"}`}>{item.label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Telemetry Panel */}
        {renderTelemetryPanel()}

        {/* Security & Theme Footer */}
        <div className="flex items-center justify-between px-1 pt-3 mt-3 border-t border-[var(--border)] text-[11px] font-mono-num">
          <span className="text-[var(--muted)] flex items-center gap-1.5 text-[10px]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--accent)]" />
            Institutional Mode
          </span>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-subtle)] border border-[var(--border)] text-[10px] text-[var(--text)] hover:border-[var(--accent)]/30 transition-colors"
            aria-label="Toggle dark/light mode"
          >
            {theme === "dark" ? (
              <>
                <Moon className="w-3 h-3 text-[var(--accent)]" />
                <span>Dark</span>
              </>
            ) : (
              <>
                <Sun className="w-3 h-3 text-amber-400" />
                <span>Light</span>
              </>
            )}
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom bar ─────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#050B14]/90 border-t border-[var(--border)] px-2 pt-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] flex items-stretch justify-around backdrop-blur-xl">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 min-h-12 py-1.5 transition-colors relative ${
                isActive ? "text-[var(--accent)] font-semibold" : "text-[var(--muted)]"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-mono-num leading-none">{item.label.split(" ")[0]}</span>
              {isActive && (
                <span className="absolute -top-px left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-[var(--accent)] shadow-[0_0_8px_var(--accent)]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
}
