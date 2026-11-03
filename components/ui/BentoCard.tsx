"use client";

import React from "react";
import { motion } from "framer-motion";

interface BentoCardProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: string;
  delay?: number;
  onClick?: () => void;
}

export function BentoCard({
  children,
  className = "",
  colSpan = "col-span-12",
  delay = 0,
  onClick,
}: BentoCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        duration: 0.2,
        delay: Math.min(delay, 0.1),
        ease: "easeOut",
      }}
      onClick={onClick}
      className={`liquid-glass p-5 sm:p-6 overflow-hidden ${colSpan} ${className}`}
    >
      {children}
    </motion.div>
  );
}

export function BentoHeader({
  title,
  subtitle,
  badge,
  action,
}: {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-heading font-semibold tracking-tight text-[var(--text)]">{title}</h3>
          {badge}
        </div>
        {subtitle && <p className="text-xs text-[var(--muted)] mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
