"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/client-account";

export type InsightRow = {
  /** Timestamp of the invoice date, or null when it can't be parsed. */
  time: number | null;
  status: string;
  total: number;
  paid: number;
  balance: number;
};

const CARD = "rounded-[28px] bg-white dark:bg-card shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/60";

/* ------------------------------------------------------------------ */
/* Dark summary: totals + collection rate                              */
/* ------------------------------------------------------------------ */

export function CollectionSummary({
  total,
  collected,
  pending,
  overdue,
  currency,
  isLoading,
}: {
  total: number;
  collected: number;
  pending: number;
  overdue: number;
  currency: string;
  isLoading: boolean;
}) {
  const rate = total > 0 ? Math.min(100, Math.round((collected / total) * 100)) : 0;
  const collectedPct = total > 0 ? Math.min(100, (collected / total) * 100) : 0;
  const pendingPct = total > 0 ? Math.min(100 - collectedPct, (pending / total) * 100) : 0;

  return (
    <div className="flex min-w-0 flex-[2_1_600px] flex-col gap-6 rounded-[30px] bg-[#2B2A27] p-6 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] dark:bg-card dark:ring-1 dark:ring-border">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] uppercase">Revenue overview</h2>
          <span className="text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums">
            {isLoading ? "–" : formatMoney(total, currency)}
          </span>
          <span className="text-sm text-[#C9C6BC]">Total billed</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-primary text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums">
            {isLoading ? "–" : `${rate}%`}
          </span>
          <span className="text-sm text-[#C9C6BC]">Collection rate</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div
          role="img"
          aria-label={`${rate}% of billed amount collected`}
          className="flex h-3 w-full overflow-hidden rounded-full bg-white/10"
        >
          <div className="bg-primary h-full transition-all" style={{ width: `${collectedPct}%` }} />
          <div className="bg-chart-2/70 h-full transition-all" style={{ width: `${pendingPct}%` }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-[#C9C6BC]">
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="bg-primary size-2 rounded-full" /> Collected
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="bg-chart-2/70 size-2 rounded-full" /> Outstanding
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Collected", value: collected },
          { label: "Pending", value: pending },
          { label: "Overdue", value: overdue },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1 rounded-2xl border border-[#4A4944] p-4">
            <span className="text-[13px] text-[#C9C6BC]">{item.label}</span>
            <span className="text-xl font-medium tracking-[-0.02em] tabular-nums">
              {isLoading ? "–" : formatMoney(item.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status breakdown donut                                              */
/* ------------------------------------------------------------------ */

export function StatusDonut({ rows, isLoading }: { rows: InsightRow[]; isLoading: boolean }) {
  const segments = [
    { label: "Completed", match: ["Completed"], stroke: "stroke-[#3F7A37] dark:stroke-emerald-400", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
    { label: "Partial", match: ["Partial"], stroke: "stroke-primary", dot: "bg-primary" },
    { label: "Pending", match: ["Pending", "Sent", "Approved", "Draft"], stroke: "stroke-chart-2", dot: "bg-chart-2" },
    { label: "Overdue", match: ["Overdue"], stroke: "stroke-[#30302E] dark:stroke-foreground", dot: "bg-[#30302E] dark:bg-foreground" },
  ].map((s) => ({ ...s, value: rows.filter((r) => s.match.includes(r.status)).length }));

  const total = segments.reduce((s, x) => s + x.value, 0);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;

  return (
    <div className={cn(CARD, "flex min-w-0 flex-[4_1_320px] flex-col gap-4 p-6")}>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Status breakdown</h2>
        <span className="text-muted-foreground text-[13px]">All transactions</span>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative size-[150px] shrink-0">
          {isLoading ? (
            <div className="bg-muted size-[150px] animate-pulse rounded-full" />
          ) : (
            <svg
              role="img"
              aria-label={`Status: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}
              viewBox="0 0 140 140"
              className="size-[150px] -rotate-90"
            >
              <circle cx="70" cy="70" r={radius} fill="none" strokeWidth={18} className="stroke-muted" />
              {total > 0
                ? segments.map((segment) => {
                    const length = (segment.value / total) * circumference;
                    const dash = Math.max(0, length - gap);
                    const element = (
                      <circle
                        key={segment.label}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        strokeWidth={18}
                        className={segment.stroke}
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={-offset}
                      />
                    );
                    offset += length;
                    return segment.value > 0 ? element : null;
                  })
                : null}
            </svg>
          )}
          {!isLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl leading-none font-medium tracking-[-0.02em] tabular-nums">{total}</span>
              <span className="text-muted-foreground text-xs">transactions</span>
            </div>
          ) : null}
        </div>
        <ul className="flex min-w-[140px] flex-1 flex-col gap-2.5 text-sm">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center gap-2.5">
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", segment.dot)} />
              <span className="flex-1">{segment.label}</span>
              <span className="font-mono tabular-nums">{isLoading ? "–" : segment.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}