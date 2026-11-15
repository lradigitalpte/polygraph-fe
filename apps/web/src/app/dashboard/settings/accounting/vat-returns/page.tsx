"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileBarChart, Info, Loader2, Minus, Percent, Receipt, Scale, Equal, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, HeroAction } from "@/components/dashboard/ui-kit";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { Input } from "@/components/ui/input";
import { fetchVatReturn, monthRange, quarterRange, type VatReturnReport } from "@/lib/accounting";
import { buildVatReturnCsvRows, downloadCsvFile } from "@/lib/accounting-csv";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const PAGE_STEP = 25;

/** A VAT worksheet must keep its fils: whole amounts stay clean, fractions show two decimals. */
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
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
}

function methodLabel(method?: string) {
  const m = (method || "").trim().replace(/[_-]+/g, " ");
  return m ? m.charAt(0).toUpperCase() + m.slice(1) : "Manual";
}

type Preset = { key: string; label: string; from: string; to: string };

export default function VatReturnsPage() {
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
    ];
  }, []);

  const [from, setFrom] = React.useState(presets[0].from);
  const [to, setTo] = React.useState(presets[0].to);
  const [report, setReport] = React.useState<VatReturnReport | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

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
      const data = await fetchVatReturn(from, to);
      if (id === requestId.current) setReport(data);
    } catch (e) {
      if (id === requestId.current) {
        setReport(null);
        setLoadError(e instanceof Error ? e.message : "Failed to load VAT return");
      }
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    if (!userLoading && canView) void load();
  }, [userLoading, canView, load]);

  const currency = report?.summary.currency || "AED";
  const summary = report?.summary;
  const net = summary?.net_vat_payable ?? 0;
  const netHint = net > 0 ? "You pay the FTA" : net < 0 ? "The FTA owes you (credit)" : "Nothing to pay";
  const showSkeleton = loading && !report;

  const currencies = React.useMemo(() => {
    const set = new Set<string>();
    for (const l of report?.output_lines ?? []) set.add((l.currency || currency).toUpperCase());
    for (const l of report?.input_lines ?? []) set.add((l.currency || currency).toUpperCase());
    return Array.from(set);
  }, [report, currency]);

  const outputLines = React.useMemo(() => [...(report?.output_lines ?? [])].sort((a, b) => b.paid_at.localeCompare(a.paid_at)), [report]);
  const inputLines = React.useMemo(() => [...(report?.input_lines ?? [])].sort((a, b) => b.expense_date.localeCompare(a.expense_date)), [report]);

  function exportCsv() {
    if (!report) {
      toast.error("Load a valid period before exporting.");
      return;
    }
    downloadCsvFile(`vat-return-${from}-to-${to}.csv`, buildVatReturnCsvRows(report, from, to));
    toast.success("Exported the VAT return for this period (opens in Excel).");
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
      title={<>VAT <strong className="font-semibold">returns</strong></>}
      tone="lavender"
      description="Output VAT on invoice payments, minus input VAT on expenses — the worksheet your accountant needs for the FTA return."
      actions={
        <HeroAction icon={Download} onClick={exportCsv} disabled={!report || loading}>
          Export CSV
        </HeroAction>
      }
      stats={
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Taxable supplies" value={formatAmount(summary?.taxable_supplies_ex_vat ?? 0, currency)} hint="Sales ex-VAT" icon={FileBarChart} accent="sage" loading={showSkeleton} />
          <GlassStat label="Output VAT" value={formatAmount(summary?.output_vat ?? 0, currency)} hint={`${outputLines.length} ${outputLines.length === 1 ? "payment" : "payments"}`} icon={Percent} accent="lavender" loading={showSkeleton} />
          <GlassStat label="Input VAT" value={formatAmount(summary?.input_vat ?? 0, currency)} hint={`${inputLines.length} ${inputLines.length === 1 ? "expense" : "expenses"}`} icon={Receipt} accent="amber" loading={showSkeleton} />
          <GlassStat label="Net VAT" value={formatAmount(net, currency)} hint={netHint} icon={Scale} accent="terracotta" loading={showSkeleton} />
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
            <label htmlFor="vat-from" className="px-1 text-[13px] font-medium">
              From
            </label>
            <Input id="vat-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="vat-to" className="px-1 text-[13px] font-medium">
              To
            </label>
            <Input id="vat-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <p className="text-[13px] text-muted-foreground sm:pb-3">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              "Payment date and expense date decide the period (UTC). Partial payments are split proportionally."
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

      {currencies.length > 1 ? (
        <div className="flex gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="text-[13px] text-[#5C3D0C] dark:text-amber-100">
            This period has amounts in more than one currency ({currencies.join(", ")}). The totals add them together without converting them.
          </p>
        </div>
      ) : null}

      {loadError ? (
        <div role="alert" className={cn(CARD, "flex items-center gap-3 p-5 text-sm text-destructive")}>
          <span className="flex-1">{loadError}</span>
          <button type="button" onClick={() => void load()} className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-destructive/10">
            Try again
          </button>
        </div>
      ) : null}

      {/* The calculation, spelled out */}
      {summary ? (
        <section aria-label="Net VAT calculation" className={cn(CARD, "p-4 sm:p-5", loading && "opacity-60")}>
          <div className="flex flex-col gap-3 md:flex-row md:items-stretch">
            <Term label="Output VAT" sub="on sales" value={formatAmount(summary.output_vat, currency)} />
            <Operator icon={Minus} />
            <Term label="Input VAT" sub="on expenses" value={formatAmount(summary.input_vat, currency)} />
            <Operator icon={Equal} />
            <div
              className={cn(
                "flex flex-1 flex-col justify-center rounded-2xl px-4 py-3",
                net > 0 ? "bg-[#30302E] text-[#FAF9F5]" : net < 0 ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-200" : "bg-[#F3F1EA] dark:bg-muted",
              )}
            >
              <span className={cn("text-[12px] font-medium", net > 0 ? "text-[#C9C6BC]" : "opacity-80")}>
                {net > 0 ? "Net VAT payable" : net < 0 ? "Net VAT recoverable" : "Net VAT"}
              </span>
              <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatAmount(Math.abs(net), currency)}</span>
            </div>
          </div>
          <p className="mt-3 flex items-start gap-2 px-1 text-[12px] text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            For internal reporting and FTA preparation — this is not a filed return. Have your accountant check it before you submit.
          </p>
        </section>
      ) : null}

      {/* Output VAT */}
      <LineSection
        id="output"
        title="Sales · output VAT"
        description="Each row is one payment on a VAT invoice in this period."
        loading={loading}
        showSkeleton={showSkeleton}
        empty={!report ? "Choose a valid period to see the worksheet." : outputLines.length === 0 ? "No VAT invoice payments in this period." : null}
        count={outputLines.length}
        unit="payment"
        head={["Invoice", "Client", "Paid (UTC)", "Method"]}
        footer={[
          formatAmount(outputLines.reduce((s, l) => s + l.gross_paid, 0), currency),
          formatAmount(summary?.taxable_supplies_ex_vat ?? 0, currency),
          formatAmount(summary?.output_vat ?? 0, currency),
        ]}
        amountHead={["Gross", "Ex-VAT", "VAT"]}
        rows={outputLines.map((line, i) => {
          const cur = line.currency || currency;
          return {
            key: `${line.quotation_id}-${line.paid_at}-${i}`,
            cells: [
              <Link key="inv" href={`/dashboard/payments/q/${line.quotation_id}`} className="text-primary font-medium underline-offset-4 hover:underline">
                {line.invoice_code}
              </Link>,
              <span key="cl" className="block max-w-[240px] truncate font-medium" title={line.client_name || undefined}>
                {line.client_name || "—"}
              </span>,
              <span key="d" className="text-muted-foreground tabular-nums">{formatDay(line.paid_at)}</span>,
              <span key="m" className="text-muted-foreground">{methodLabel(line.method)}</span>,
            ],
            amounts: [formatAmount(line.gross_paid, cur), formatAmount(line.ex_vat_portion, cur), formatAmount(line.vat_portion, cur)],
          };
        })}
      />

      {/* Input VAT */}
      <LineSection
        id="input"
        title="Expenses · input VAT"
        description="Purchases in the expense log dated inside this period."
        loading={loading}
        showSkeleton={showSkeleton}
        empty={
          !report ? (
            "Choose a valid period to see the worksheet."
          ) : inputLines.length === 0 ? (
            <>
              No expenses in this period.{" "}
              <Link href="/dashboard/settings/accounting/expenses" className="text-primary font-medium underline-offset-4 hover:underline">
                Add expenses
              </Link>
            </>
          ) : null
        }
        count={inputLines.length}
        unit="expense"
        head={["Date", "Vendor", "Category", "Rate"]}
        footer={[
          formatAmount(inputLines.reduce((s, l) => s + l.amount_ex_vat, 0), currency),
          formatAmount(summary?.input_vat ?? 0, currency),
          formatAmount(inputLines.reduce((s, l) => s + l.amount_inc_vat, 0), currency),
        ]}
        amountHead={["Ex-VAT", "VAT", "Incl. VAT"]}
        rows={inputLines.map((line) => {
          const cur = line.currency || currency;
          return {
            key: String(line.expense_id),
            cells: [
              <span key="d" className="text-muted-foreground tabular-nums">{formatDay(line.expense_date)}</span>,
              <span key="v" className="block max-w-[240px]">
                <span className="block truncate font-medium">{line.vendor || "—"}</span>
                {line.description ? <span className="block truncate text-xs text-muted-foreground" title={line.description}>{line.description}</span> : null}
              </span>,
              <span key="c" className="inline-flex rounded-full bg-[#ECE9E0] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-[#3D3929] dark:bg-muted dark:text-foreground">
                {line.category || "General"}
              </span>,
              <span key="r" className="text-muted-foreground tabular-nums">{line.vat_amount > 0 && line.vat_rate > 0 ? `${line.vat_rate}%` : line.vat_amount > 0 ? "Fixed" : "None"}</span>,
            ],
            amounts: [formatAmount(line.amount_ex_vat, cur), formatAmount(line.vat_amount, cur), formatAmount(line.amount_inc_vat, cur)],
          };
        })}
      />
    </AccountingShell>
  );
}

function Term({ label, sub, value }: { label: string; sub: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col justify-center rounded-2xl bg-[#F7F6F1] px-4 py-3 dark:bg-muted/50">
      <span className="text-[12px] font-medium text-muted-foreground">
        {label} <span className="font-normal">{sub}</span>
      </span>
      <span className="text-xl font-medium tracking-[-0.02em] tabular-nums">{value}</span>
    </div>
  );
}

function Operator({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="flex items-center justify-center text-muted-foreground">
      <span className="flex size-8 items-center justify-center rounded-full ring-1 ring-border">
        <Icon className="size-4" />
      </span>
    </span>
  );
}

type Row = { key: string; cells: React.ReactNode[]; amounts: string[] };

function LineSection({
  id,
  title,
  description,
  loading,
  showSkeleton,
  empty,
  count,
  unit,
  head,
  amountHead,
  rows,
  footer,
}: {
  id: string;
  title: string;
  description: string;
  loading: boolean;
  showSkeleton: boolean;
  empty: React.ReactNode | null;
  count: number;
  unit: string;
  head: string[];
  amountHead: string[];
  rows: Row[];
  footer: string[];
}) {
  const [shown, setShown] = React.useState(PAGE_STEP);
  React.useEffect(() => setShown(PAGE_STEP), [rows.length]);
  const visible = rows.slice(0, shown);

  return (
    <section aria-labelledby={`${id}-title`} className={cn(CARD, "overflow-hidden")}>
      <div className="flex items-start justify-between gap-3 p-4 sm:p-5">
        <div>
          <h2 id={`${id}-title`} className="text-[15px] font-medium">
            {title}
          </h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">{description}</p>
        </div>
        {!showSkeleton && !empty ? (
          <span className="shrink-0 rounded-full bg-[#F3F1EA] px-2.5 py-1 text-xs font-medium tabular-nums dark:bg-muted">
            {count} {count === 1 ? unit : `${unit}s`}
          </span>
        ) : null}
      </div>

      {showSkeleton ? (
        <div aria-hidden="true" className="divide-y divide-border/50 border-t border-border/50">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="h-3.5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3.5 flex-1 animate-pulse rounded bg-muted" />
              <div className="h-3.5 w-24 animate-pulse rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : empty ? (
        <div className="border-t border-border/50 px-6 py-12 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <>
          <div className={cn("overflow-x-auto border-t border-border/50 transition-opacity", loading && "opacity-60")}>
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="text-left text-[12px] text-muted-foreground">
                  {head.map((h, i) => (
                    <th key={h} scope="col" className={cn("px-3 py-2.5 font-medium", i === 0 && "pl-5")}>
                      {h}
                    </th>
                  ))}
                  {amountHead.map((h, i) => (
                    <th key={h} scope="col" className={cn("px-3 py-2.5 text-right font-medium", i === amountHead.length - 1 && "pr-5")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 border-t border-border/50">
                {visible.map((row) => (
                  <tr key={row.key} className="transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                    {row.cells.map((cell, i) => (
                      <td key={i} className={cn("px-3 py-3 whitespace-nowrap", i === 0 && "pl-5")}>
                        {cell}
                      </td>
                    ))}
                    {row.amounts.map((amount, i) => (
                      <td key={i} className={cn("px-3 py-3 text-right whitespace-nowrap tabular-nums", i === 0 && "font-medium", i === row.amounts.length - 1 && "pr-5")}>
                        {amount}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border/50 bg-[#F7F6F1] font-medium dark:bg-muted/40">
                  <td colSpan={head.length} className="py-3 pr-3 pl-5 text-[13px]">
                    Period total · {count} {count === 1 ? unit : `${unit}s`}
                  </td>
                  {footer.map((value, i) => (
                    <td key={i} className={cn("px-3 py-3 text-right whitespace-nowrap tabular-nums", i === footer.length - 1 && "pr-5")}>
                      {value}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          {rows.length > visible.length ? (
            <div className="flex flex-col items-center gap-2 border-t border-border/50 p-4">
              <p className="text-xs text-muted-foreground">
                Showing {visible.length} of {rows.length} · totals include all {rows.length}
              </p>
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_STEP)}
                className="flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                Show {Math.min(PAGE_STEP, rows.length - visible.length)} more
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
