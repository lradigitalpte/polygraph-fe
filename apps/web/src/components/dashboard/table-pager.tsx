"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [10, 20, 50] as const;

/** Page numbers with gaps: 1 … 4 5 6 … 12 */
function pageList(current: number, total: number): (number | "gap")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const keep = new Set([1, total, current - 1, current, current + 1]);
  const out: (number | "gap")[] = [];
  let prev = 0;
  for (let n = 1; n <= total; n++) {
    if (!keep.has(n)) continue;
    if (n - prev > 1) out.push("gap");
    out.push(n);
    prev = n;
  }
  return out;
}

/**
 * Client-side paging for a list. Resets to page 1 whenever `resetKey` changes
 * (pass the filter/search values) and clamps when the list shrinks.
 */
export function usePager<T>(items: readonly T[], resetKey: unknown, initialPerPage = 10) {
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState(initialPerPage);
  const key = JSON.stringify(resetKey);
  React.useEffect(() => setPage(1), [key, perPage]);
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    perPage,
    totalPages,
    total: items.length,
    rows: items.slice((current - 1) * perPage, current * perPage),
    setPage,
    setPerPage,
  };
}

const ROUND = "flex size-9 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-40 dark:hover:bg-muted";
const ACTIVE = "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background";

/** Footer: "1–10 of 150 · 10 20 50 per page" on the left, ‹ 1 2 … 15 › on the right. */
export function TablePager({
  page,
  perPage,
  totalPages,
  total,
  onPage,
  onPerPage,
  label = "Rows",
  scrollTo,
}: {
  page: number;
  perPage: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
  label?: string;
  /** Scrolled into view when the page changes, so the reader lands at the top of the table. */
  scrollTo?: React.RefObject<HTMLElement | null>;
}) {
  if (total <= PAGE_SIZES[0]) return null;
  const go = (n: number) => {
    onPage(n);
    scrollTo?.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  return (
    <div className="flex flex-col gap-3 border-t border-border/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="tabular-nums">
          {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
        </span>
        <span className="flex items-center gap-1" role="group" aria-label={`${label} per page`}>
          {PAGE_SIZES.map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={perPage === n}
              onClick={() => onPerPage(n)}
              className={cn("h-7 rounded-full px-2.5 font-medium tabular-nums transition-colors", perPage === n ? ACTIVE : "hover:text-foreground")}
            >
              {n}
            </button>
          ))}
          <span className="ml-0.5">per page</span>
        </span>
      </div>
      {totalPages > 1 ? (
        <nav aria-label={`${label} pages`} className="flex items-center gap-1">
          <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => go(page - 1)} className={ROUND}>
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          {pageList(page, totalPages).map((n, i) =>
            n === "gap" ? (
              <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                aria-current={n === page ? "page" : undefined}
                onClick={() => go(n)}
                className={cn("size-9 rounded-full text-[13px] font-medium tabular-nums transition-colors", n === page ? ACTIVE : "hover:bg-[#F3F1EA] dark:hover:bg-muted")}
              >
                {n}
              </button>
            ),
          )}
          <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => go(page + 1)} className={ROUND}>
            <ChevronRight aria-hidden="true" className="size-4" />
          </button>
        </nav>
      ) : null}
    </div>
  );
}

/** Pill search box used above tables. */
export function TableSearch({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  return (
    <div className="relative w-full sm:w-64">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <input
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-full bg-[#F3F1EA] pr-9 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted"
      />
      {value ? (
        <button type="button" aria-label="Clear search" onClick={() => onChange("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
