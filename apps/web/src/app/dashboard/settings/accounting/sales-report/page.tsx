"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Banknote, Download, FileBarChart, Info, Loader2, Percent, Receipt, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, HeroAction, Segmented } from "@/components/dashboard/ui-kit";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { Input } from "@/components/ui/input";
import { fetchSalesReport, monthRange, quarterRange, toDateInputValueUTC, type SalesReport, type SalesReportLine } from "@/lib/accounting";
import { buildSalesReportCsvRows, downloadCsvFile } from "@/lib/accounting-csv";
import { cn } from "@/lib/utils";

type VatFilter = "all" | "with" | "without";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const PAGE_STEP = 25;

/** Whole amounts stay clean (AED 3,003); a fractional split still shows its fils. */
function formatAmount(amount: number, currency: string) {
  const code = (currency || "AED").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${code} ${amount}`;
  }
}

function formatDay(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

function periodLabel(from: string, to: string) {
  if (!from || !to) return "Choose a period";
  return `${formatDay(from)} – ${formatDay(to)}`;
}

function methodLabel(method?: string) {
  const m = (method || "").trim().replace(/[_-]+/g, " ");
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "—";
}

type Preset = { key: string; label: string; from: string; to: string };

export default function SalesReportPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const canView = can("accounting:view");

  const presets = React.useMemo<Preset[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const last = new Date(year, now.getMonth() - 1, 1);
    return [
      { key: "this-month", label: "This month", ...monthRange(year, now.getMonth()) },
      { key: "last-month", label: "Last month", ...monthRange(last.getFullYear(), last.getMonth()) },
      ...([1, 2, 3, 4] as const).map((q) => ({ key: `q${q}`, label: `Q${q} ${year}`, ...quarterRange(year, q) })),
      { key: "year", label: `${year}`, from: `${year}-01-01`, to: `${year}-12-31` },
    ];
  }, []);

  const [from, setFrom] = React.useState(presets[0].from);
  const [to, setTo] = React.useState(presets[0].to);
  const [report, setReport] = React.useState<SalesReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [vatFilter, setVatFilter] = React.useState<VatFilter>("all");
  const [search, setSearch] = React.useState("");
  const [shown, setShown] = React.useState(PAGE_STEP);

  const rangeInvalid = Boolean(from && to && from > to);
  const rangeIncomplete = !from || !to;
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.key;

  React.useEffect(() => {
    if (!userLoading && !canView) {
      toast.error("You don't have permission to view accounting.");
      router.replace("/dashboard");
    }
  }, [userLoading, canView, router]);

  // Changing the dates quickly fires several requests; only the latest one may win.
  const requestId = React.useRef(0);
  const load = React.useCallback(async () => {
    if (!from || !to || from > to) {
      requestId.current += 1;
      setReport(null);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchSalesReport(from, to);
      if (id === requestId.current) setReport(data);
    } catch (e) {
      if (id === requestId.current) {
        setReport(null);
        setLoadError(e instanceof Error ? e.message : "Failed to load sales report");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    if (!userLoading && canView) void load();
  }, [userLoading, canView, load]);

  React.useEffect(() => {
    setShown(PAGE_STEP);
  }, [vatFilter, search, from, to]);

  const allLines = React.useMemo<SalesReportLine[]>(
    () => [...(report?.lines ?? [])].sort((a, b) => b.paid_at.localeCompare(a.paid_at) || b.quotation_id - a.quotation_id),
    [report],
  );

  const visibleLines = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return allLines.filter((l) => {
      if (vatFilter === "with" && !l.has_vat) return false;
      if (vatFilter === "without" && l.has_vat) return false;
      if (!q) return true;
      return [l.invoice_code, l.client_name, l.method].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [allLines, vatFilter, search]);

  // Totals follow the rows on screen (VAT filter + search) — the same rows the CSV contains.
  const totals = React.useMemo(() => {
    let gross = 0;
    let ex = 0;
    let vat = 0;
    const currencies = new Set<string>();
    for (const l of visibleLines) {
      gross += l.gross_paid;
      ex += l.ex_vat_portion;
      vat += l.vat_portion;
      currencies.add((l.currency || report?.summary.currency || "AED").toUpperCase());
    }
    return { gross, ex, vat, count: visibleLines.length, currencies: Array.from(currencies) };
  }, [visibleLines, report]);

  const withVat = allLines.filter((l) => l.has_vat).length;
  const withoutVat = allLines.length - withVat;
  const currency = totals.currencies[0] || report?.summary.currency || "AED";
  const mixedCurrencies = totals.currencies.length > 1;
  const filtersActive = vatFilter !== "all" || search.trim() !== "";
  const visible = visibleLines.slice(0, shown);
  const showSkeleton = loading && !report;

  function exportCsv() {
    if (!report || visibleLines.length === 0) {
      toast.error("Nothing to export for the current filters.");
      return;
    }
    const exportReport: SalesReport = filtersActive
      ? {
          ...report,
          lines: visibleLines,
          summary: {
            ...report.summary,
            total_gross_incl_vat: totals.gross,
            total_ex_vat: totals.ex,
            total_vat: totals.vat,
            payment_line_count: totals.count,
            with_vat_line_count: visibleLines.filter((l) => l.has_vat).length,
            without_vat_line_count: visibleLines.filter((l) => !l.has_vat).length,
          },
        }
      : report;
    const suffix = [vatFilter === "all" ? "" : `-${vatFilter}-vat`, search.trim() ? "-filtered" : ""].join("");
    downloadCsvFile(`sales-report-${from}-to-${to}${suffix}.csv`, buildSalesReportCsvRows(exportReport, from, to));
    toast.success(`Exported ${visibleLines.length} ${visibleLines.length === 1 ? "payment" : "payments"} to CSV.`);
  }

  if (userLoading || !canView) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 aria-label="Loading" className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AccountingShell
      title={<>Sales <strong className="font-semibold">report</strong></>}
      tone="sage"
      description="Every invoice payment in the period: the gross amount, its ex-VAT portion and its VAT portion — invoices with and without VAT."
      actions={
        <HeroAction icon={Download} onClick={exportCsv} disabled={!report || loading || visibleLines.length === 0}>
          Export CSV
        </HeroAction>
      }
      stats={
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Gross collected" value={formatAmount(totals.gross, currency)} hint={`${totals.count} ${totals.count === 1 ? "payment" : "payments"} · incl. VAT`} icon={Banknote} accent="sage" loading={showSkeleton} />
          <GlassStat label="Ex-VAT" value={formatAmount(totals.ex, currency)} hint="Net sales" icon={FileBarChart} accent="lavender" loading={showSkeleton} />
          <GlassStat label="Output VAT" value={formatAmount(totals.vat, currency)} hint="Collected on sales" icon={Percent} accent="terracotta" loading={showSkeleton} />
          <GlassStat label="With / without VAT" value={`${withVat} / ${withoutVat}`} hint="Payment lines in the period" icon={Receipt} accent="amber" loading={showSkeleton} />
        </div>
      }
    >
      {/* Period */}
      <section aria-label="Reporting period" className={cn(CARD, "space-y-4 p-4 sm:p-5")}>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const active = activePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  setFrom(preset.from);
                  setTo(preset.to);
                }}
                className={cn(
                  "h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                  active
                    ? "bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground"
                    : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                )}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="grid gap-1.5">
            <label htmlFor="sr-from" className="px-1 text-[13px] font-medium">
              From
            </label>
            <Input id="sr-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="sr-to" className="px-1 text-[13px] font-medium">
              To
            </label>
            <Input id="sr-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <p className="text-[13px] text-muted-foreground sm:pb-3">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              "Payment date decides which period a payment falls in (UTC) — the same basis as VAT returns."
            )}
          </p>
        </div>
        {rangeInvalid ? (
          <p role="alert" className="flex items-center gap-2 px-1 text-[13px] text-destructive">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            The start date is after the end date.
          </p>
        ) : rangeIncomplete ? (
          <p className="flex items-center gap-2 px-1 text-[13px] text-muted-foreground">
            <Info aria-hidden="true" className="size-4 shrink-0" />
            Pick both a start and an end date.
          </p>
        ) : null}
      </section>

      {mixedCurrencies ? (
        <div className="flex gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="text-[13px] text-[#5C3D0C] dark:text-amber-100">
            These payments are in more than one currency ({totals.currencies.join(", ")}). The totals above add the amounts together without converting them.
          </p>
        </div>
      ) : null}

      {/* Payment lines */}
      <section aria-labelledby="lines-title" className={cn(CARD, "overflow-hidden")}>
        <div className="flex flex-col gap-3 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 id="lines-title" className="text-[15px] font-medium">
              Payment lines
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Ex-VAT and VAT are split proportionally on VAT invoices. Invoices without VAT count fully as ex-VAT.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Segmented<VatFilter>
              label="Filter by VAT"
              value={vatFilter}
              onChange={setVatFilter}
              options={[
                { value: "all", label: "All", count: allLines.length },
                { value: "with", label: "With VAT", count: withVat },
                { value: "without", label: "No VAT", count: withoutVat },
              ]}
            />
            <div className="relative w-full sm:w-56">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search payments" placeholder="Invoice or client…" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(FIELD, "pr-9 pl-10")} />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Clear search"
                  className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                >
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {showSkeleton ? (
          <div aria-hidden="true" className="divide-y divide-border/50 border-t border-border/50">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
                <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <div role="alert" className="flex items-center gap-3 border-t border-border/50 p-5 text-sm text-destructive">
            <span className="flex-1">{loadError}</span>
            <button type="button" onClick={() => void load()} className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-destructive/10">
              Try again
            </button>
          </div>
        ) : !report ? (
          <div className="border-t border-border/50 px-6 py-14 text-center text-sm text-muted-foreground">Choose a valid period to see its payments.</div>
        ) : visibleLines.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <Banknote aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">{filtersActive && allLines.length > 0 ? "No payments match your filters" : "No payments in this period"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {filtersActive && allLines.length > 0 ? "Try another VAT filter or search." : "Try another period, or check the Payments page for unpaid invoices."}
              </p>
            </div>
            {filtersActive && allLines.length > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setVatFilter("all");
                  setSearch("");
                }}
                className="mt-1 flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className={cn("overflow-x-auto border-t border-border/50 transition-opacity", loading && "opacity-60")}>
              <table className="w-full min-w-[820px] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-muted-foreground">
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Invoice</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Client</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Paid (UTC)</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Method</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">VAT</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Gross</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Ex-VAT</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">VAT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 border-t border-border/50">
                  {visible.map((line, i) => {
                    const cur = line.currency || currency;
                    return (
                      <tr key={`${line.quotation_id}-${line.paid_at}-${i}`} className="transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                        <td className="py-3 pr-3 pl-5 whitespace-nowrap">
                          <Link href={`/dashboard/payments/q/${line.quotation_id}`} className="text-primary font-medium underline-offset-4 hover:underline">
                            {line.invoice_code}
                          </Link>
                        </td>
                        <td className="max-w-[240px] truncate px-3 py-3 font-medium" title={line.client_name || undefined}>
                          {line.client_name || "—"}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{toDateInputValueUTC(new Date(line.paid_at)) ? formatDay(line.paid_at) : "—"}</td>
                        <td className="px-3 py-3 whitespace-nowrap text-muted-foreground">{methodLabel(line.method)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
                              line.has_vat ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
                            )}
                          >
                            {line.has_vat ? `${line.vat_rate}% VAT` : "No VAT"}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatAmount(line.gross_paid, cur)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(line.ex_vat_portion, cur)}</td>
                        <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatAmount(line.vat_portion, cur)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 bg-[#F7F6F1] font-medium dark:bg-muted/40">
                    <td colSpan={5} className="py-3 pr-3 pl-5 text-[13px]">
                      {filtersActive ? "Filtered total" : "Total"} · {totals.count} {totals.count === 1 ? "payment" : "payments"}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.gross, currency)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.ex, currency)}</td>
                    <td className="py-3 pr-5 pl-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.vat, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {visibleLines.length > visible.length ? (
              <div className="flex flex-col items-center gap-2 border-t border-border/50 p-4">
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {visibleLines.length} · totals include all {visibleLines.length}
                </p>
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE_STEP)}
                  className="flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                >
                  Show {Math.min(PAGE_STEP, visibleLines.length - visible.length)} more
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>
    </AccountingShell>
  );
}
