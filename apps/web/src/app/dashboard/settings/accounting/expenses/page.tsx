"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, ListOrdered, Loader2, Paperclip, Pencil, Percent, Plus, Receipt, Search, Trash2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { ExpenseFormDialog } from "@/components/dashboard/accounting/expense-form-dialog";
import { GlassStat, HeroAction } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { deleteExpense, fetchExpenses, monthRange, quarterRange, resolveReceiptUrl, type Expense } from "@/lib/accounting";
import { buildExpensesCsvRows, downloadCsvFile, expensesExportFilename } from "@/lib/accounting-csv";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const PAGE_STEP = 25;

/** Accounting amounts keep their fils — VAT of 4.95 must not show as 5. */
function formatAmount(amount: number, currency: string) {
  const code = (currency || "AED").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: code, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${code} ${amount.toFixed(2)}`;
  }
}

/** Expense dates are stored as UTC calendar days (the API buckets periods by UTC day). */
function formatDay(value: string, withYear = true) {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { timeZone: "UTC", day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}) });
}

function periodLabel(from: string, to: string) {
  if (from && to) return from.slice(0, 4) === to.slice(0, 4) ? `${formatDay(from, false)} – ${formatDay(to)}` : `${formatDay(from)} – ${formatDay(to)}`;
  if (from) return `From ${formatDay(from)}`;
  if (to) return `Up to ${formatDay(to)}`;
  return "All dates";
}

function paymentSummary(item: Expense) {
  if (item.payment_label) {
    return item.payment_last_four ? `${item.payment_label} •••• ${item.payment_last_four}` : item.payment_label;
  }
  if (item.payment_last_four) return `•••• ${item.payment_last_four}`;
  return item.payment_type || "";
}

type Preset = { key: string; label: string; from: string; to: string };

export default function AccountingExpensesPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const canView = can("accounting:view");
  const canManage = can("accounting:manage");

  React.useEffect(() => {
    if (!userLoading && !canView) {
      toast.error("You don't have permission to view accounting.");
      router.replace("/dashboard");
    }
  }, [userLoading, canView, router]);

  const presets = React.useMemo<Preset[]>(() => {
    const now = new Date();
    const year = now.getFullYear();
    const thisMonth = monthRange(year, now.getMonth());
    const last = new Date(year, now.getMonth() - 1, 1);
    const lastMonth = monthRange(last.getFullYear(), last.getMonth());
    return [
      { key: "this-month", label: "This month", ...thisMonth },
      { key: "last-month", label: "Last month", ...lastMonth },
      ...([1, 2, 3, 4] as const).map((q) => ({ key: `q${q}`, label: `Q${q} ${year}`, ...quarterRange(year, q) })),
      { key: "all", label: "All dates", from: "", to: "" },
    ];
  }, []);

  const [items, setItems] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Expense | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | null>(null);
  const [search, setSearch] = React.useState("");
  const [shown, setShown] = React.useState(PAGE_STEP);
  const [from, setFrom] = React.useState(presets[0].from);
  const [to, setTo] = React.useState(presets[0].to);

  const rangeInvalid = Boolean(from && to && from > to);
  const activePreset = presets.find((p) => p.from === from && p.to === to)?.key;

  // Changing the dates quickly fires several requests; only the latest one may win.
  const requestId = React.useRef(0);
  const load = React.useCallback(async () => {
    if (rangeInvalid) return;
    const id = ++requestId.current;
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchExpenses({ from: from || undefined, to: to || undefined });
      if (id === requestId.current) setItems(data);
    } catch (e) {
      if (id === requestId.current) setLoadError(e instanceof Error ? e.message : "Failed to load expenses");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [from, to, rangeInvalid]);

  React.useEffect(() => {
    if (!userLoading && canView) void load();
  }, [userLoading, canView, load]);

  React.useEffect(() => {
    setShown(PAGE_STEP);
  }, [search, from, to]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id);
    if (!q) return sorted;
    return sorted.filter((item) =>
      [item.vendor, item.description, item.category, paymentSummary(item), item.receipt_ref ?? ""].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [items, search]);

  // Totals follow what's on screen (period + search) — the same rows the CSV export contains.
  const totals = React.useMemo(() => {
    let exVat = 0;
    let inputVat = 0;
    let gross = 0;
    const currencies = new Set<string>();
    for (const item of filtered) {
      exVat += item.amount_ex_vat;
      inputVat += item.vat_amount;
      gross += item.amount_inc_vat;
      currencies.add((item.currency || "AED").toUpperCase());
    }
    return { exVat, inputVat, gross, count: filtered.length, currencies: Array.from(currencies) };
  }, [filtered]);

  const displayCurrency = totals.currencies[0] || items[0]?.currency || "AED";
  const mixedCurrencies = totals.currencies.length > 1;
  const visible = filtered.slice(0, shown);

  function applyPreset(preset: Preset) {
    setFrom(preset.from);
    setTo(preset.to);
  }

  function exportExpensesCsv() {
    if (filtered.length === 0) {
      toast.error("Nothing to export for the current filters.");
      return;
    }
    const rows = buildExpensesCsvRows(filtered, { from, to, search });
    downloadCsvFile(expensesExportFilename(from, to), rows);
    toast.success(`Exported ${filtered.length} ${filtered.length === 1 ? "expense" : "expenses"} to CSV.`);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: Expense) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget || !canManage) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success("Expense removed");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
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
      title={<>Expense <strong className="font-semibold">log</strong></>}
      tone="amber"
      description="Record business purchases with ex-VAT and recoverable VAT. These amounts feed the VAT returns report as input tax."
      actions={
        <>
          <HeroAction icon={Download} onClick={exportExpensesCsv} disabled={loading || filtered.length === 0}>
            Export CSV
          </HeroAction>
          {canManage ? (
            <HeroAction variant="primary" icon={Plus} onClick={openCreate}>
              Add expense
            </HeroAction>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-[#ECE9E0] ring-1 ring-white/15">View only</span>
          )}
        </>
      }
      stats={
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Expenses" value={totals.count} hint={search.trim() ? `Matching “${search.trim()}”` : periodLabel(from, to)} icon={ListOrdered} accent="lavender" loading={loading} />
          <GlassStat label="Total ex-VAT" value={formatAmount(totals.exVat, displayCurrency)} hint="Before VAT" icon={Wallet} accent="sage" loading={loading} />
          <GlassStat label="Recoverable VAT" value={formatAmount(totals.inputVat, displayCurrency)} hint="Input tax for the VAT return" icon={Percent} accent="terracotta" loading={loading} />
          <GlassStat label="Total incl. VAT" value={formatAmount(totals.gross, displayCurrency)} hint="What was paid" icon={Receipt} accent="amber" loading={loading} />
        </div>
      }
    >
      {/* Period */}
      <section aria-label="Period" className={cn(CARD, "space-y-4 p-4 sm:p-5")}>
        <div className="flex flex-wrap gap-1.5">
          {presets.map((preset) => {
            const active = activePreset === preset.key;
            return (
              <button
                key={preset.key}
                type="button"
                aria-pressed={active}
                onClick={() => applyPreset(preset)}
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
            <label htmlFor="exp-from" className="px-1 text-[13px] font-medium">
              From
            </label>
            <Input id="exp-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="exp-to" className="px-1 text-[13px] font-medium">
              To
            </label>
            <Input id="exp-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className={cn(FIELD, "sm:w-48")} />
          </div>
          <p className="text-[13px] text-muted-foreground sm:pb-3">
            {loading ? (
              <span className="inline-flex items-center gap-1.5">
                <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />
                Loading…
              </span>
            ) : (
              "Leave both empty for all dates."
            )}
          </p>
        </div>
        {rangeInvalid ? (
          <p role="alert" className="flex items-center gap-2 px-1 text-[13px] text-destructive">
            <AlertTriangle aria-hidden="true" className="size-4 shrink-0" />
            The start date is after the end date.
          </p>
        ) : null}
      </section>

      {mixedCurrencies ? (
        <div className="flex gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="text-[13px] text-[#5C3D0C] dark:text-amber-100">
            These expenses are in more than one currency ({totals.currencies.join(", ")}). The totals above add the amounts together without converting them.
          </p>
        </div>
      ) : null}

      {/* Ledger */}
      <section aria-labelledby="ledger-title" className={cn(CARD, "overflow-hidden")}>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div>
            <h2 id="ledger-title" className="text-[15px] font-medium">
              Ledger
            </h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Search narrows the totals and the CSV export too.</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input aria-label="Search expenses" placeholder="Vendor, category, card…" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(FIELD, "pr-9 pl-10")} />
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

        {loading && items.length === 0 ? (
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
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <Receipt aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="font-medium">{items.length > 0 ? "No expenses match your search" : activePreset === "all" ? "No expenses yet" : "No expenses in this period"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {items.length > 0
                  ? "Try a different vendor, category or card."
                  : canManage
                    ? "Add an expense to track input VAT for your returns."
                    : "Nothing has been recorded for these dates."}
              </p>
            </div>
            {items.length === 0 && canManage ? (
              <button
                type="button"
                onClick={openCreate}
                className="mt-1 flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                <Plus aria-hidden="true" className="size-4" />
                Add expense
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className={cn("overflow-x-auto border-t border-border/50 transition-opacity", loading && "opacity-60")}>
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[12px] text-muted-foreground">
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Date</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Vendor</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Category</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Paid with</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Ex-VAT</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">VAT</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Incl. VAT</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 border-t border-border/50">
                  {visible.map((item) => {
                    const paidWith = paymentSummary(item);
                    return (
                      <tr key={item.id} className="group transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                        <td className="py-3 pr-3 pl-5 whitespace-nowrap text-muted-foreground tabular-nums">{formatDay(item.expense_date)}</td>
                        <td className="max-w-[260px] px-3 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{item.vendor || "Unnamed vendor"}</span>
                            {item.receipt_url ? (
                              <a
                                href={resolveReceiptUrl(item.receipt_url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={`Open receipt${item.receipt_file_name ? ` ${item.receipt_file_name}` : ""}`}
                                title={item.receipt_file_name || "Open receipt"}
                                className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:hover:bg-card"
                              >
                                <Paperclip aria-hidden="true" className="size-3.5" />
                              </a>
                            ) : null}
                          </div>
                          {item.description || item.receipt_ref ? (
                            <p className="truncate text-xs text-muted-foreground" title={item.description || undefined}>
                              {item.description}
                              {item.description && item.receipt_ref ? " · " : ""}
                              {item.receipt_ref ? `Ref ${item.receipt_ref}` : ""}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-flex rounded-full bg-[#ECE9E0] px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-[#3D3929] dark:bg-muted dark:text-foreground">
                            {item.category}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-3 py-3 text-xs text-muted-foreground">{paidWith || "—"}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(item.amount_ex_vat, item.currency)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">
                          {formatAmount(item.vat_amount, item.currency)}
                          {item.vat_rate ? <span className="ml-1 text-[11px]">({item.vat_rate}%)</span> : null}
                        </td>
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatAmount(item.amount_inc_vat, item.currency)}</td>
                        <td className="py-3 pr-5 pl-3">
                          {canManage ? (
                            <div className="flex justify-end gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                              <IconButton label={`Edit ${item.vendor || "expense"}`} onClick={() => openEdit(item)}>
                                <Pencil aria-hidden="true" className="size-4" />
                              </IconButton>
                              <IconButton label={`Delete ${item.vendor || "expense"}`} onClick={() => setDeleteTarget(item)} danger>
                                <Trash2 aria-hidden="true" className="size-4" />
                              </IconButton>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border/50 bg-[#F7F6F1] font-medium dark:bg-muted/40">
                    <td colSpan={4} className="py-3 pr-3 pl-5 text-[13px]">
                      Total · {totals.count} {totals.count === 1 ? "expense" : "expenses"}
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.exVat, displayCurrency)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.inputVat, displayCurrency)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{formatAmount(totals.gross, displayCurrency)}</td>
                    <td className="py-3 pr-5 pl-3" />
                  </tr>
                </tfoot>
              </table>
            </div>

            {filtered.length > visible.length ? (
              <div className="flex flex-col items-center gap-2 border-t border-border/50 p-4">
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {filtered.length} · totals include all {filtered.length}
                </p>
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE_STEP)}
                  className="flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                >
                  Show {Math.min(PAGE_STEP, filtered.length - visible.length)} more
                </button>
              </div>
            ) : null}
          </>
        )}
      </section>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        currency={editing?.currency || displayCurrency}
        canManage={canManage}
        onSaved={() => void load()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && !deleting && setDeleteTarget(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete this expense?</DialogTitle>
            <DialogDescription>It will be removed from the expense log and from the input VAT on your VAT returns. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#F7F6F1] px-4 py-3 text-sm dark:bg-muted/40">
              <div className="min-w-0">
                <p className="truncate font-medium">{deleteTarget.vendor || "Expense"}</p>
                <p className="text-xs text-muted-foreground">{formatDay(deleteTarget.expense_date)}</p>
              </div>
              <span className="shrink-0 font-medium tabular-nums">{formatAmount(deleteTarget.amount_inc_vat, deleteTarget.currency)}</span>
            </div>
          ) : null}
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              disabled={deleting}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void confirmDelete()}
              disabled={deleting}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {deleting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-white hover:text-foreground dark:hover:bg-card",
      )}
    >
      {children}
    </button>
  );
}
