"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowUpRight, Check, CheckCircle2, CreditCard, Layers, Loader2, Mail, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, TableSearch, usePager } from "@/components/dashboard/table-pager";
import { cn } from "@/lib/utils";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import {
  collectAppointmentPayment,
  formatMoney,
  ledgerRowMoney,
  sendAppointmentPaymentReminder,
  type AccountLedgerEntry,
  type AccountSummary,
} from "@/lib/client-account";
import { fetchBillingLedger, ledgerEntryCollectTarget } from "@/lib/billing";
import {
  adjustClientSlotCount,
  applyPrepaidSlotToAppointment,
  setCancellationCountsAsUsed,
  fetchPrepaidSlots,
  fetchPrepaidSlotSummary,
  type PrepaidSlotSummary,
} from "@/lib/prepaid-slots";
import { collectQuotationPayment, revokeQuotationSlot, sendQuotationEmail } from "@/lib/quotations";
import { fetchOrganizationSettings } from "@/lib/settings";
import { formatClinicDateLabel } from "@/lib/clinic-time";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

type View = "open" | "paid" | "all";

const SOURCE_LABEL: Record<AccountLedgerEntry["source"], string> = { booking: "Booking", session: "Session", quote: "Invoice" };

function statusPill(entry: AccountLedgerEntry) {
  if (entry.covered_by) return { text: `Prepaid · ${entry.covered_by}`, style: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" };
  if (entry.balance_due <= 0 && entry.total_amount > 0) return { text: "Paid", style: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" };
  if (entry.paid_amount > 0) return { text: "Part paid", style: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" };
  if (entry.total_amount <= 0) return { text: "No charge", style: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" };
  return { text: "Unpaid", style: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" };
}

const SMALL = "flex h-8 items-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-40 dark:hover:bg-muted";
const pill = "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-40 dark:hover:bg-muted";

export default function ClientAccountPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client } = useClientDetail();
  const { loading: userLoading, can, showExaminerWorkspace } = useCurrentUser();

  React.useEffect(() => {
    // Pure examiners are redirected; examiners with elevated/override access keep billing.
    if (!userLoading && (!can("client:manage") || showExaminerWorkspace)) {
      toast.error("You don't have access to billing information.");
      router.replace(`/dashboard/clients/${clientId}`);
    }
  }, [userLoading, can, router, clientId, showExaminerWorkspace]);

  const [entries, setEntries] = React.useState<AccountLedgerEntry[]>([]);
  const [ledgerSummary, setLedgerSummary] = React.useState<AccountSummary | null>(null);
  const [prepaidSummary, setPrepaidSummary] = React.useState<PrepaidSlotSummary | null>(null);
  // Per bulk invoice: unused / total slots, for the Revoke slot button on invoice rows.
  const [slotsByQuote, setSlotsByQuote] = React.useState<Record<number, { available: number; total: number }>>({});
  const [revokeTarget, setRevokeTarget] = React.useState<AccountLedgerEntry | null>(null);
  const [loading, setLoading] = React.useState(true);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- settings shape is shared loosely with ledgerRowMoney
  const [orgSettings, setOrgSettings] = React.useState<any>({ currency: "AED" });
  const orgCurrency = orgSettings?.currency || "AED";
  const [view, setView] = React.useState<View | null>(null);
  const [ledgerQuery, setLedgerQuery] = React.useState("");
  const ledgerRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    fetchOrganizationSettings()
      .then((org) => {
        if (org) setOrgSettings(org);
      })
      .catch(() => undefined);
  }, []);

  const summary = React.useMemo(() => {
    if (ledgerSummary) return ledgerSummary;
    let totalBilled = 0;
    let totalPaid = 0;
    for (const entry of entries) {
      const { total, paid } = ledgerRowMoney(entry, orgCurrency, orgSettings);
      totalBilled += total;
      totalPaid += paid;
    }
    return { total_billed: totalBilled, total_paid: totalPaid, balance_due: Math.max(0, totalBilled - totalPaid) };
  }, [entries, ledgerSummary, orgCurrency, orgSettings]);

  const [selected, setSelected] = React.useState<AccountLedgerEntry | null>(null);
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [reminderStep, setReminderStep] = React.useState<"compose" | "confirm">("compose");
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reminderEmail, setReminderEmail] = React.useState("");
  const [reminderSubject, setReminderSubject] = React.useState("");
  const [reminderBody, setReminderBody] = React.useState("");

  const load = React.useCallback(async () => {
    if (!Number.isFinite(clientId)) return;
    setLoading(true);
    try {
      const [data, prepaid, slots] = await Promise.all([fetchBillingLedger(clientId), fetchPrepaidSlotSummary(clientId).catch(() => null), fetchPrepaidSlots(clientId).catch(() => [])]);
      const byQuote: Record<number, { available: number; total: number }> = {};
      for (const slot of slots) {
        const row = (byQuote[slot.source_quotation_id] ??= { available: 0, total: 0 });
        if (slot.status === "available" || slot.status === "consumed") row.total += 1;
        if (slot.status === "available") row.available += 1;
      }
      setSlotsByQuote(byQuote);
      setLedgerSummary(data.summary);
      setEntries(data.entries);
      setPrepaidSummary(prepaid);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load account");
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    setReminderEmail(client?.email ?? "");
  }, [client?.email]);

  const groups = React.useMemo(() => {
    const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    return { open: sorted.filter((e) => e.balance_due > 0), paid: sorted.filter((e) => e.balance_due <= 0), all: sorted };
  }, [entries]);
  const activeView: View = view ?? (groups.open.length > 0 ? "open" : "all");
  const lq = ledgerQuery.trim().toLowerCase();
  const ledgerRows = React.useMemo(
    () =>
      lq
        ? groups[activeView].filter((e) => [e.title, e.code, e.examiner_name ?? "", e.covered_by ?? "", formatClinicDateLabel(e.date)].some((v) => v.toLowerCase().includes(lq)))
        : groups[activeView],
    [groups, activeView, lq],
  );
  const ledgerPager = usePager(ledgerRows, [activeView, lq]);
  // Column totals for everything in the current view (not just this page); only when all rows share one currency.
  const ledgerTotals = React.useMemo(() => {
    if (ledgerRows.length < 2) return null;
    if (ledgerRows.some((e) => (e.currency || orgCurrency) !== orgCurrency)) return null;
    return ledgerRows.reduce((t, e) => ({ total: t.total + e.total_amount, paid: t.paid + e.paid_amount, due: t.due + e.balance_due }), { total: 0, paid: 0, due: 0 });
  }, [ledgerRows, orgCurrency]);

  const openCollect = (entry: AccountLedgerEntry) => {
    setSelected(entry);
    setAmount(entry.balance_due > 0 ? String(entry.balance_due) : "");
    setCollectOpen(true);
  };

  const openReminder = (entry: AccountLedgerEntry) => {
    setSelected(entry);
    setReminderStep("compose");
    setReminderSubject(`Payment reminder — ${entry.code}`);
    const currency = entry.currency || orgCurrency;
    setReminderBody(
      `Hello ${client?.name?.split(" ")[0] ?? ""},\n\nThis is a friendly reminder about ${entry.title} (${entry.code}).\n\nTotal: ${formatMoney(entry.total_amount, currency)}\nPaid: ${formatMoney(entry.paid_amount, currency)}\nBalance due: ${formatMoney(entry.balance_due, currency)}\n\n${entry.quotation_id && !entry.appointment_id ? 'You can pay online with the "Pay invoice online" button below.' : "Please contact us to arrange payment."}\n\nThank you,\nPolygraph Forensic System`,
    );
    setReminderOpen(true);
  };

  const collectValue = Number(amount);
  const collectValid = Number.isFinite(collectValue) && collectValue > 0 && (!selected || collectValue <= selected.balance_due + 0.0001);

  const handleCollect = async () => {
    if (!selected) return;
    if (!collectValid) {
      toast.error(collectValue > (selected.balance_due ?? 0) ? "That's more than is due on this entry" : "Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const target = ledgerEntryCollectTarget(selected);
      if (target.kind === "appointment") await collectAppointmentPayment(target.id, { amount: collectValue });
      else await collectQuotationPayment(target.id, { amount: collectValue });
      toast.success(`${formatMoney(collectValue, selected.currency || orgCurrency)} recorded on ${selected.code}`);
      setCollectOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setBusy(false);
    }
  };

  const [slotTarget, setSlotTarget] = React.useState<AccountLedgerEntry | null>(null);
  const handleApplySlot = async () => {
    if (!slotTarget?.appointment_id) return;
    setBusy(true);
    try {
      await applyPrepaidSlotToAppointment(slotTarget.appointment_id);
      toast.success(`${slotTarget.code} is now covered by the bulk invoice`);
      setSlotTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to apply prepaid slot");
    } finally {
      setBusy(false);
    }
  };

  const [slotFix, setSlotFix] = React.useState<"mark_used" | "restore" | null>(null);
  const handleSlotFix = async () => {
    if (!slotFix) return;
    setBusy(true);
    try {
      await adjustClientSlotCount(clientId, slotFix);
      toast.success(slotFix === "mark_used" ? "1 slot marked as used" : "1 slot restored");
      setSlotFix(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to correct slots");
    } finally {
      setBusy(false);
    }
  };

  const handleCancellationRule = async (value: boolean) => {
    setBusy(true);
    try {
      setPrepaidSummary(await setCancellationCountsAsUsed(clientId, value));
      toast.success(value ? "Cancelled exams now keep their slot for this client" : "Cancelled exams now return their slot for this client");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save cancellation rule");
    } finally {
      setBusy(false);
    }
  };

  const handleRevokeSlot = async () => {
    if (!revokeTarget?.quotation_id) return;
    setBusy(true);
    try {
      await revokeQuotationSlot(revokeTarget.quotation_id);
      toast.success(`1 slot revoked from ${revokeTarget.code}; invoice repriced`);
      setRevokeTarget(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke slot");
    } finally {
      setBusy(false);
    }
  };

  const handleSendReminder = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      if (selected.appointment_id) {
        await sendAppointmentPaymentReminder(selected.appointment_id, { to_email: reminderEmail.trim(), subject: reminderSubject.trim(), body: reminderBody.trim() });
      } else if (selected.quotation_id) {
        await sendQuotationEmail(selected.quotation_id, { to_email: reminderEmail.trim(), subject: reminderSubject.trim(), body: reminderBody.trim() });
      }
      toast.success(`Reminder emailed to ${reminderEmail.trim()}`);
      setReminderOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(clientId)) {
    return <p className="py-12 text-center text-destructive">Invalid client.</p>;
  }

  const paidPct = summary.total_billed > 0 ? Math.min(100, (summary.total_paid / summary.total_billed) * 100) : 0;
  const invoiceHref = (e: AccountLedgerEntry) => (e.quotation_id ? (`/dashboard/payments/q/${e.quotation_id}` as Route) : null);

  return (
    <div className="space-y-5 pb-16">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Account &amp; billing</h2>
        <p className="mt-1 text-sm text-muted-foreground">Everything billed to {client?.name ?? "this client"}, what&apos;s been paid, and what&apos;s still due.</p>
      </div>

      {loading ? (
        <div className={cn(CARD, "flex items-center justify-center py-20 text-sm text-muted-foreground")}>
          <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" /> Loading account…
        </div>
      ) : (
        <>
          {/* Balance */}
          <section className="rounded-[30px] bg-[#2B2A27] p-6 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] sm:p-8 dark:bg-[#1B1B19] dark:ring-1 dark:ring-white/10">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold tracking-[0.1em] uppercase">Balance due</span>
                <span className="text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums">{formatMoney(summary.balance_due, orgCurrency)}</span>
                <span className="text-sm text-[#C9C6BC]">
                  {summary.total_billed <= 0 ? "Nothing billed yet" : summary.balance_due <= 0 ? "All paid up" : `${Math.round(paidPct)}% collected · ${groups.open.length} open ${groups.open.length === 1 ? "item" : "items"}`}
                </span>
              </div>
              <div className="flex flex-wrap items-end gap-6 sm:gap-8">
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#C9C6BC]">Billed</span>
                  <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(summary.total_billed, orgCurrency)}</span>
                </div>
                <span aria-hidden="true" className="hidden h-10 w-px bg-[#4A4944] sm:block" />
                <div className="flex flex-col gap-1">
                  <span className="text-[13px] text-[#C9C6BC]">Paid</span>
                  <span className="text-primary text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(summary.total_paid, orgCurrency)}</span>
                </div>
              </div>
            </div>
            <div className="mt-7 h-2 w-full overflow-hidden rounded-full bg-white/10" aria-hidden="true">
              <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${paidPct}%` }} />
            </div>
          </section>

          {/* Prepaid slots */}
          {prepaidSummary && prepaidSummary.total > 0 ? (
            <section aria-labelledby="slots-title" className={cn(CARD, "p-6")}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                    <Layers aria-hidden="true" className="size-[18px]" />
                  </span>
                  <div>
                    <h3 id="slots-title" className="text-[15px] font-medium">
                      Examination slots
                    </h3>
                    <p className="mt-0.5 max-w-md text-[13px] text-muted-foreground">Prepaid on bulk invoices. Book exams from the calendar to use a slot; they show paid once the bulk invoice is paid.</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Free", value: prepaidSummary.available },
                    { label: "Used", value: prepaidSummary.consumed },
                    { label: "Total", value: prepaidSummary.total },
                  ].map((s) => (
                    <div key={s.label} className="min-w-20 rounded-2xl bg-[#F7F6F1] px-3 py-2.5 dark:bg-muted/50">
                      <p className="text-xl font-semibold tabular-nums">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              {(prepaidSummary.awaiting_payment ?? 0) > 0 ? (
                <p className="mt-4 rounded-2xl bg-[#F8EEDB] px-4 py-2.5 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
                  {prepaidSummary.awaiting_payment} slot{prepaidSummary.awaiting_payment === 1 ? " is" : "s are"} on a bulk invoice that isn&apos;t paid yet.
                </p>
              ) : null}
              <div className="mt-4 flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <label className="flex cursor-pointer items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={prepaidSummary.cancellation_counts_as_used === true}
                    disabled={busy}
                    onClick={() => void handleCancellationRule(!(prepaidSummary.cancellation_counts_as_used === true))}
                    className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50", prepaidSummary.cancellation_counts_as_used ? "bg-primary" : "bg-[#D6D2C6] dark:bg-muted-foreground/40")}
                  >
                    <span className={cn("absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform", prepaidSummary.cancellation_counts_as_used && "translate-x-5")} />
                  </button>
                  <span className="text-sm">
                    <span className="block font-medium">Cancelled exams count as used</span>
                    <span className="block text-xs text-muted-foreground">Per this client&apos;s agreement. Off: cancelling gives the slot back.</span>
                  </span>
                </label>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={pill} disabled={busy || prepaidSummary.available <= 0} onClick={() => setSlotFix("mark_used")}>
                    Mark 1 used
                  </button>
                  <button type="button" className={pill} disabled={busy || prepaidSummary.consumed <= 0} onClick={() => setSlotFix("restore")}>
                    Restore 1
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          {/* Ledger */}
          <section ref={ledgerRef} aria-labelledby="ledger-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h3 id="ledger-title" className="flex items-center gap-2 text-[15px] font-medium">
                  <Receipt aria-hidden="true" className="size-4 text-muted-foreground" /> Activity
                </h3>
                <p className="text-[13px] text-muted-foreground">Newest first. Invoices and bookings billed to this account.</p>
              </div>
              {entries.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Segmented<View>
                    label="Show"
                    value={activeView}
                    onChange={setView}
                    options={[
                      { value: "open", label: "Open", count: groups.open.length },
                      { value: "paid", label: "Paid", count: groups.paid.length },
                      { value: "all", label: "All", count: entries.length },
                    ]}
                  />
                  <TableSearch value={ledgerQuery} onChange={setLedgerQuery} label="Search activity" placeholder="Code, item or examiner…" />
                </div>
              ) : null}
            </div>

            {entries.length === 0 ? (
              <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                  <Receipt aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
                <p className="max-w-sm text-sm text-muted-foreground">Nothing billed yet. Book a session or create an invoice from Payments.</p>
              </div>
            ) : ledgerRows.length === 0 ? (
              <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">
                {lq ? `Nothing matches “${ledgerQuery.trim()}”.` : activeView === "open" ? "Nothing outstanding — all paid up." : "Nothing here."}
              </p>
            ) : (
              <div className="overflow-x-auto border-t border-border/50">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                    <tr>
                      <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Date</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Item</th>
                      <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Paid</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-medium">Due</th>
                      <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {ledgerPager.rows.map((entry) => {
                      const cur = entry.currency || orgCurrency;
                      const state = statusPill(entry);
                      const href = invoiceHref(entry);
                      const quoteSlots = entry.quotation_id ? slotsByQuote[entry.quotation_id] : undefined;
                      const canUseSlot = Boolean(entry.appointment_id) && !entry.covered_by && entry.source !== "quote" && (prepaidSummary?.available ?? 0) > 0;
                      const canRevoke = entry.source === "quote" && quoteSlots !== undefined && quoteSlots.available > 0 && quoteSlots.total > 1;
                      const openHref = href ?? (entry.appointment_id ? (`/dashboard/clients/${clientId}/exams/${entry.appointment_id}` as Route) : null);
                      return (
                        <tr key={`${entry.source}-${entry.id}`} className="align-middle transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30">
                          <td className="py-3 pr-3 pl-5 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{formatClinicDateLabel(entry.date) || entry.date}</td>
                          <td className="max-w-[300px] px-3 py-3">
                            {openHref ? (
                              <Link href={openHref} className="block truncate font-medium hover:underline hover:underline-offset-4" title={entry.title}>
                                {entry.title}
                              </Link>
                            ) : (
                              <span className="block truncate font-medium" title={entry.title}>
                                {entry.title}
                              </span>
                            )}
                            <span className="block truncate text-xs text-muted-foreground">
                              {SOURCE_LABEL[entry.source]} <span className="font-mono">{entry.code}</span>
                              {entry.examiner_name ? ` · ${entry.examiner_name}` : ""}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={cn("inline-flex max-w-[180px] truncate rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", state.style)} title={state.text}>
                              {state.text}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{entry.total_amount > 0 ? formatMoney(entry.total_amount, cur) : "—"}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{entry.paid_amount > 0 ? formatMoney(entry.paid_amount, cur) : "—"}</td>
                          <td className={cn("px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums", entry.balance_due > 0 ? "text-foreground" : "text-muted-foreground")}>
                            {entry.balance_due > 0 ? formatMoney(entry.balance_due, cur) : "—"}
                          </td>
                          <td className="py-3 pr-5 pl-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {canUseSlot ? (
                                <button type="button" className={cn(SMALL, "px-2.5")} title="Bill this exam on the bulk invoice instead of its own invoice" onClick={() => setSlotTarget(entry)}>
                                  Use slot
                                </button>
                              ) : null}
                              {canRevoke ? (
                                <button type="button" className={cn(SMALL, "px-2.5 text-destructive")} title="Correction: remove 1 unused slot and reprice this invoice" onClick={() => setRevokeTarget(entry)}>
                                  Revoke slot
                                </button>
                              ) : null}
                              {entry.balance_due > 0 ? (
                                <>
                                  <button type="button" className={cn(SMALL, "w-8 justify-center px-0")} aria-label={`Send a payment reminder for ${entry.code}`} title="Send a reminder" onClick={() => openReminder(entry)}>
                                    <Mail aria-hidden="true" className="size-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex h-8 items-center gap-1.5 rounded-full bg-[#2B2A27] px-3 text-[13px] font-medium whitespace-nowrap text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
                                    onClick={() => openCollect(entry)}
                                  >
                                    <CreditCard aria-hidden="true" className="size-3.5" /> Record payment
                                  </button>
                                </>
                              ) : null}
                              {openHref ? (
                                <Link href={openHref} aria-label={href ? `Open invoice ${entry.code}` : `Open session ${entry.code}`} title={href ? "Open invoice" : "Open session"} className={cn(SMALL, "w-8 justify-center px-0")}>
                                  <ArrowUpRight aria-hidden="true" className="size-4" />
                                </Link>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {ledgerTotals ? (
                    <tfoot className="border-t border-border/60 bg-[#F7F6F1] text-sm dark:bg-muted/40">
                      <tr>
                        <td colSpan={3} className="py-3 pr-3 pl-5 text-xs font-medium text-muted-foreground">
                          {lq ? "Matching items" : activeView === "open" ? "All open items" : activeView === "paid" ? "All paid items" : "All items"} · {ledgerRows.length}
                        </td>
                        <td className="px-3 py-3 text-right font-medium whitespace-nowrap tabular-nums">{formatMoney(ledgerTotals.total, orgCurrency)}</td>
                        <td className="px-3 py-3 text-right whitespace-nowrap text-muted-foreground tabular-nums">{formatMoney(ledgerTotals.paid, orgCurrency)}</td>
                        <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatMoney(ledgerTotals.due, orgCurrency)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            )}
            <TablePager
              label="Activity"
              page={ledgerPager.page}
              perPage={ledgerPager.perPage}
              totalPages={ledgerPager.totalPages}
              total={ledgerPager.total}
              onPage={ledgerPager.setPage}
              onPerPage={ledgerPager.setPerPage}
              scrollTo={ledgerRef}
            />
          </section>
        </>
      )}

      {/* Record payment */}
      <Dialog open={collectOpen} onOpenChange={(o) => !busy && setCollectOpen(o)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record a payment</DialogTitle>
            <DialogDescription>{selected ? `Money received for ${selected.code} outside the pay link — bank transfer, cash or card terminal. Part payments are fine.` : ""}</DialogDescription>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-medium text-muted-foreground">{selected.currency || orgCurrency}</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  aria-label="Amount received"
                  className="h-14 rounded-2xl border-0 bg-[#F3F1EA] pr-4 pl-16 text-xl font-medium tabular-nums shadow-none dark:bg-muted"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setAmount(String(selected.balance_due))}
                  className={cn("flex h-8 items-center gap-1 rounded-full px-3 text-[13px] font-medium", Number(amount) === selected.balance_due ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] dark:bg-muted")}
                >
                  {Number(amount) === selected.balance_due ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                  Full balance · {formatMoney(selected.balance_due, selected.currency || orgCurrency)}
                </button>
              </div>
              {amount.trim() !== "" && !collectValid ? (
                <p role="alert" className="px-1 text-[13px] text-destructive">
                  {collectValue > selected.balance_due ? `That's more than the ${formatMoney(selected.balance_due, selected.currency || orgCurrency)} due.` : "Enter an amount above zero."}
                </p>
              ) : collectValid ? (
                <p className="px-1 text-[13px] text-muted-foreground">
                  {collectValue + 0.0001 >= selected.balance_due ? "This settles it." : `${formatMoney(selected.balance_due - collectValue, selected.currency || orgCurrency)} will still be due.`}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setCollectOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void handleCollect()} disabled={busy || !collectValid}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Record {collectValid && selected ? formatMoney(collectValue, selected.currency || orgCurrency) : "payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reminder: compose, then confirm before it goes out */}
      <Dialog open={reminderOpen} onOpenChange={(o) => !busy && setReminderOpen(o)}>
        <DialogContent className="rounded-[26px] sm:max-w-lg">
          {reminderStep === "compose" ? (
            <>
              <DialogHeader>
                <DialogTitle>Payment reminder</DialogTitle>
                <DialogDescription>About the balance on {selected?.code}.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid gap-1.5">
                  <label htmlFor="rem-to" className="px-1 text-[13px] font-medium">To</label>
                  <Input id="rem-to" type="email" className={FIELD} value={reminderEmail} onChange={(e) => setReminderEmail(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="rem-subject" className="px-1 text-[13px] font-medium">Subject</label>
                  <Input id="rem-subject" className={FIELD} value={reminderSubject} onChange={(e) => setReminderSubject(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor="rem-body" className="px-1 text-[13px] font-medium">Message</label>
                  <Textarea id="rem-body" className="min-h-44 resize-y rounded-2xl border-0 bg-[#F3F1EA] px-4 py-3 text-sm shadow-none dark:bg-muted" value={reminderBody} onChange={(e) => setReminderBody(e.target.value)} />
                </div>
                {selected?.quotation_id && !selected.appointment_id ? (
                  <p className="px-1 text-xs text-muted-foreground">The invoice PDF and a &ldquo;Pay invoice online&rdquo; button for the full balance are attached.</p>
                ) : null}
              </div>
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => setReminderOpen(false)}>
                  Cancel
                </Button>
                <Button
                  className="rounded-full"
                  disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reminderEmail.trim())}
                  onClick={() => setReminderStep("confirm")}
                >
                  Review &amp; send
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Send this reminder now?</DialogTitle>
                <DialogDescription>Check the details before the email goes out.</DialogDescription>
              </DialogHeader>
              <dl className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] text-sm dark:bg-muted/40">
                {[
                  ["To", reminderEmail.trim()],
                  ["Subject", reminderSubject.trim()],
                  ["Balance", selected ? formatMoney(selected.balance_due, selected.currency || orgCurrency) : "—"],
                ].map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[6rem_1fr] gap-3 px-4 py-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="font-medium break-words">{v}</dd>
                  </div>
                ))}
              </dl>
              <DialogFooter>
                <Button variant="outline" className="rounded-full" onClick={() => setReminderStep("compose")} disabled={busy}>
                  Back
                </Button>
                <Button className="gap-2 rounded-full" onClick={() => void handleSendReminder()} disabled={busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  Send email
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={slotTarget !== null} onOpenChange={(o) => !o && setSlotTarget(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bill {slotTarget?.code} on the bulk invoice?</DialogTitle>
            <DialogDescription>
              This exam will use 1 of the {prepaidSummary?.available ?? 0} free slot{(prepaidSummary?.available ?? 0) === 1 ? "" : "s"}. Its own invoice
              {slotTarget?.code ? ` (${slotTarget.code})` : ""} will be removed, and the exam shows paid once the bulk invoice is paid. Use this when the exam was booked separately by mistake.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setSlotTarget(null)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void handleApplySlot()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Use slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slotFix !== null} onOpenChange={(o) => !o && setSlotFix(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{slotFix === "mark_used" ? "Mark 1 slot as used?" : "Restore 1 slot?"}</DialogTitle>
            <DialogDescription>
              {slotFix === "mark_used"
                ? `Free slots go from ${prepaidSummary?.available ?? 0} to ${Math.max(0, (prepaidSummary?.available ?? 0) - 1)}. Use this when an exam used a slot but was not linked to it. No invoice or payment changes.`
                : `Gives back 1 slot that was marked used by hand, or held by a cancelled exam (waiving that cancellation). Free slots go from ${prepaidSummary?.available ?? 0} to ${(prepaidSummary?.available ?? 0) + 1}. No invoice or payment changes.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setSlotFix(null)}>
              Cancel
            </Button>
            <Button className="rounded-full" onClick={() => void handleSlotFix()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeTarget !== null} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <DialogContent className="rounded-[26px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revoke 1 slot from {revokeTarget?.code}?</DialogTitle>
            <DialogDescription>
              {(() => {
                const s = revokeTarget?.quotation_id ? slotsByQuote[revokeTarget.quotation_id] : undefined;
                const next = (s?.total ?? 1) - 1;
                return `The invoice drops to ${next} examination${next === 1 ? "" : "s"} (${(s?.available ?? 1) - 1} unused left) and its total is repriced at the same unit price. If more was already paid than the new total, refund the difference first.`;
              })()}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" className="rounded-full" onClick={() => setRevokeTarget(null)}>
              Keep
            </Button>
            <Button variant="destructive" className="rounded-full" onClick={() => void handleRevokeSlot()} disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Revoke slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
