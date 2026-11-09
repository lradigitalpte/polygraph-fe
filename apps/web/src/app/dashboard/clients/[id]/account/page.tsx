"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Loader2,
  Mail,
  Receipt,
  Wallet,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { collectQuotationPayment, revokeQuotationSlot, sendQuotationEmail } from "@/lib/quotations";
import { fetchOrganizationSettings } from "@/lib/settings";
import { formatClinicDateLabel } from "@/lib/clinic-time";

function formatDate(iso: string) {
  return formatClinicDateLabel(iso) || iso;
}

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "accepted") return "default" as const;
  if (s === "partial" || s === "sent") return "secondary" as const;
  return "outline" as const;
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50] as const;

function buildPageNumbers(currentPage: number, totalPages: number): number[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
}

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
  // Per bulk invoice: unused / total slots, for the Revoke slot button on quote rows.
  const [slotsByQuote, setSlotsByQuote] = React.useState<
    Record<number, { available: number; total: number }>
  >({});
  const [revokeTarget, setRevokeTarget] = React.useState<AccountLedgerEntry | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [orgSettings, setOrgSettings] = React.useState<any>({ currency: "AED" });
  const orgCurrency = orgSettings?.currency || "AED";

  React.useEffect(() => {
    void (async () => {
      try {
        const org = await fetchOrganizationSettings();
        if (org) {
          setOrgSettings(org);
        }
      } catch (e) {
        // Fallback to USD
      }
    })();
  }, []);

  const calculatedSummary = React.useMemo(() => {
    if (ledgerSummary) {
      return ledgerSummary;
    }
    let totalBilled = 0;
    let totalPaid = 0;
    for (const entry of entries) {
      const { total, paid } = ledgerRowMoney(entry, orgCurrency, orgSettings);
      totalBilled += total;
      totalPaid += paid;
    }
    const balanceDue = totalBilled - totalPaid;
    return {
      total_billed: totalBilled,
      total_paid: totalPaid,
      balance_due: balanceDue > 0 ? balanceDue : 0,
    };
  }, [entries, ledgerSummary, orgCurrency, orgSettings]);

  const [selected, setSelected] = React.useState<AccountLedgerEntry | null>(null);
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reminderEmail, setReminderEmail] = React.useState("");
  const [reminderSubject, setReminderSubject] = React.useState("");
  const [reminderBody, setReminderBody] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [itemsPerPage, setItemsPerPage] = React.useState<number>(10);

  const totalPages = Math.max(1, Math.ceil(entries.length / itemsPerPage));
  const paginatedEntries = entries.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const pageNumbers = React.useMemo(
    () => buildPageNumbers(currentPage, totalPages),
    [currentPage, totalPages],
  );

  React.useEffect(() => {
    setCurrentPage(1);
  }, [itemsPerPage, clientId]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const load = React.useCallback(async () => {
    if (!Number.isFinite(clientId)) return;
    setLoading(true);
    try {
      const [data, prepaid, slots] = await Promise.all([
        fetchBillingLedger(clientId),
        fetchPrepaidSlotSummary(clientId).catch(() => null),
        fetchPrepaidSlots(clientId).catch(() => []),
      ]);
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

  const openCollect = (entry: AccountLedgerEntry) => {
    setSelected(entry);
    setAmount(entry.balance_due > 0 ? entry.balance_due.toFixed(2) : "");
    setCollectOpen(true);
  };

  const openReminder = (entry: AccountLedgerEntry) => {
    setSelected(entry);
    setReminderSubject(`Payment reminder — ${entry.code}`);
    const currency = entry.currency || orgCurrency;
    setReminderBody(
      `Hello,\n\nThis is a payment reminder for ${entry.title} (${entry.code}).\n\nTotal: ${formatMoney(entry.total_amount, currency)}\nPaid: ${formatMoney(entry.paid_amount, currency)}\nBalance due: ${formatMoney(entry.balance_due, currency)}\n\nPlease contact us to arrange payment.\n\nThank you,\nPolygraph Forensic System`
    );
    setReminderOpen(true);
  };

  const handleCollect = async () => {
    if (!selected) return;
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    setBusy(true);
    try {
      const target = ledgerEntryCollectTarget(selected);
      if (target.kind === "appointment") {
        await collectAppointmentPayment(target.id, { amount: value });
      } else {
        await collectQuotationPayment(target.id, { amount: value });
      }
      toast.success("Payment recorded");
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
      const summary = await setCancellationCountsAsUsed(clientId, value);
      setPrepaidSummary(summary);
      toast.success(
        value
          ? "Cancelled exams now keep their slot for this client"
          : "Cancelled exams now return their slot for this client",
      );
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
    if (!reminderEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setBusy(true);
    try {
      if (selected.appointment_id) {
        await sendAppointmentPaymentReminder(selected.appointment_id, {
          to_email: reminderEmail.trim(),
          subject: reminderSubject.trim(),
          body: reminderBody.trim(),
        });
      } else if (selected.quotation_id) {
        await sendQuotationEmail(selected.quotation_id, {
          to_email: reminderEmail.trim(),
          subject: reminderSubject.trim(),
          body: reminderBody.trim(),
        });
      }
      toast.success("Reminder sent");
      setReminderOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setBusy(false);
    }
  };

  if (!Number.isFinite(clientId)) {
    return <p className="text-destructive py-12 text-center">Invalid client.</p>;
  }

  return (
    <div className="space-y-6 pb-16">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Client account</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Billing ledger for {client?.name ?? "this client"} — sessions, quotations, payments, and
          reminders.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading account...
        </div>
      ) : (
        <>
          {prepaidSummary && prepaidSummary.total > 0 ? (
            <Card className="border-emerald-500/20 bg-emerald-500/5">
              <CardHeader className="pb-2">
                <CardDescription>Examination slots (bulk invoices)</CardDescription>
                <CardTitle className="text-lg">
                  {prepaidSummary.available} available
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({prepaidSummary.consumed} used of {prepaidSummary.total})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground space-y-1">
                <p>
                  Book exams from the calendar to use a slot. Slot exams have no invoice of their
                  own; they are billed on the bulk invoice and show paid once it is paid.
                </p>
                {(prepaidSummary.awaiting_payment ?? 0) > 0 ? (
                  <p className="text-amber-600 dark:text-amber-400">
                    {prepaidSummary.awaiting_payment} slot
                    {prepaidSummary.awaiting_payment === 1 ? "" : "s"} on unpaid bulk invoices,
                    awaiting payment.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy || prepaidSummary.available <= 0}
                    onClick={() => setSlotFix("mark_used")}
                  >
                    Mark 1 slot as used
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy || prepaidSummary.consumed <= 0}
                    onClick={() => setSlotFix("restore")}
                  >
                    Restore 1 slot
                  </Button>
                </div>
                <label className="flex items-start gap-2 pt-1 text-foreground cursor-pointer">
                  <Checkbox
                    checked={prepaidSummary.cancellation_counts_as_used === true}
                    disabled={busy}
                    onCheckedChange={(checked) => void handleCancellationRule(checked === true)}
                    className="mt-0.5"
                  />
                  <span className="text-sm">
                    Cancelled exams count as used for this client (per agreement)
                    <span className="block text-xs text-muted-foreground">
                      Off: cancelling an exam gives its slot back. Only affects this client.
                    </span>
                  </span>
                </label>
              </CardContent>
            </Card>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total billed</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(calculatedSummary.total_billed, orgCurrency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total paid</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(calculatedSummary.total_paid, orgCurrency)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardDescription>Outstanding balance</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-amber-600 dark:text-amber-400">
                  {formatMoney(calculatedSummary.balance_due, orgCurrency)}
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" />
                Account activity
              </CardTitle>
              <CardDescription>
                Record manual payments or email payment reminders for any open balance.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 py-12 text-center">
                  No billing activity yet. Book a session or create a quotation from Payments.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Due</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedEntries.map((entry) => (
                      <TableRow key={`${entry.source}-${entry.id}`}>
                        <TableCell className="text-muted-foreground whitespace-nowrap">
                          {formatDate(entry.date)}
                        </TableCell>
                        <TableCell>
                          <div className="font-mono text-xs font-bold">{entry.code}</div>
                          <div className="text-[10px] text-muted-foreground capitalize">
                            {entry.source}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">{entry.title}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(entry.total_amount, entry.currency || orgCurrency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatMoney(entry.paid_amount, entry.currency || orgCurrency)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(entry.balance_due, entry.currency || orgCurrency)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(entry.status)} className="capitalize">
                            {entry.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {entry.appointment_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                render={
                                  <Link
                                    href={`/dashboard/clients/${clientId}/exams/${entry.appointment_id}`}
                                  />
                                }
                              >
                                Open
                              </Button>
                            )}
                            {entry.appointment_id &&
                              !entry.covered_by &&
                              entry.source !== "quote" &&
                              (prepaidSummary?.available ?? 0) > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Bill this exam on the bulk invoice instead of its own invoice"
                                  onClick={() => setSlotTarget(entry)}
                                >
                                  Use slot
                                </Button>
                              )}
                            {entry.source === "quote" &&
                              entry.quotation_id &&
                              (slotsByQuote[entry.quotation_id]?.available ?? 0) > 0 &&
                              (slotsByQuote[entry.quotation_id]?.total ?? 0) > 1 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  title="Correction: remove 1 unused slot and reprice this invoice"
                                  onClick={() => setRevokeTarget(entry)}
                                >
                                  Revoke slot
                                </Button>
                              )}
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={entry.balance_due <= 0}
                              onClick={() => openCollect(entry)}
                            >
                              <CreditCard className="h-3.5 w-3.5 mr-1" />
                              Pay
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={entry.balance_due <= 0}
                              onClick={() => openReminder(entry)}
                            >
                              <Mail className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            {entries.length > 0 && (
              <div className="flex flex-col gap-4 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <p className="text-xs text-muted-foreground">
                    Showing{" "}
                    <span className="font-semibold text-foreground">
                      {(currentPage - 1) * itemsPerPage + 1}–
                      {Math.min(currentPage * itemsPerPage, entries.length)}
                    </span>{" "}
                    of {entries.length} entries
                  </p>
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                      Per page
                    </Label>
                    <Select
                      value={String(itemsPerPage)}
                      onValueChange={(v) => setItemsPerPage(Number(v))}
                    >
                      <SelectTrigger className="h-9 w-[88px] rounded-lg">
                        <SelectValue>{itemsPerPage}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <SelectItem key={size} value={String(size)}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {totalPages > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg px-3"
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" />
                      Previous
                    </Button>
                    {pageNumbers.map((page, index) => {
                      const prev = pageNumbers[index - 1];
                      const showEllipsis = prev !== undefined && page - prev > 1;
                      return (
                        <React.Fragment key={page}>
                          {showEllipsis && (
                            <span className="px-1 text-xs text-muted-foreground">…</span>
                          )}
                          <Button
                            variant={currentPage === page ? "default" : "ghost"}
                            size="sm"
                            className={cn("h-9 w-9 rounded-lg text-xs font-black")}
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        </React.Fragment>
                      );
                    })}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg px-3"
                      disabled={currentPage >= totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    >
                      Next
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Card>
        </>
      )}

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Record payment
            </DialogTitle>
            <DialogDescription>
              {selected
                ? `Manual payment for ${selected.code}. Partial payments are allowed.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Amount ($)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-11 rounded-xl"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Send payment reminder</DialogTitle>
            <DialogDescription>
              Email the client about the outstanding balance on {selected?.code}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                To
              </Label>
              <Input
                className="h-11 rounded-xl"
                value={reminderEmail}
                onChange={(e) => setReminderEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Subject
              </Label>
              <Input
                className="h-11 rounded-xl"
                value={reminderSubject}
                onChange={(e) => setReminderSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Message
              </Label>
              <Textarea
                className="min-h-[120px] rounded-xl resize-none"
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReminder} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slotTarget !== null} onOpenChange={(open) => !open && setSlotTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Bill {slotTarget?.code} on the bulk invoice?</DialogTitle>
            <DialogDescription>
              This exam will use 1 of the {prepaidSummary?.available ?? 0} free slot
              {(prepaidSummary?.available ?? 0) === 1 ? "" : "s"}. Its own invoice
              {slotTarget?.code ? ` (${slotTarget.code})` : ""} will be removed, and the exam
              will show paid once the bulk invoice is paid. Use this when the exam was booked
              separately by mistake.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleApplySlot} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Use slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={slotFix !== null} onOpenChange={(open) => !open && setSlotFix(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              {slotFix === "mark_used" ? "Mark 1 slot as used?" : "Restore 1 slot?"}
            </DialogTitle>
            <DialogDescription>
              {slotFix === "mark_used"
                ? `Free slots go from ${prepaidSummary?.available ?? 0} to ${Math.max(0, (prepaidSummary?.available ?? 0) - 1)}. Use this when an exam used a slot but was not linked to it. No invoice or payment changes.`
                : `Gives back 1 slot that was marked used by hand, or held by a cancelled exam (waiving that cancellation). Free slots go from ${prepaidSummary?.available ?? 0} to ${(prepaidSummary?.available ?? 0) + 1}. No invoice or payment changes.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlotFix(null)}>
              Cancel
            </Button>
            <Button onClick={handleSlotFix} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
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
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Keep
            </Button>
            <Button variant="destructive" onClick={handleRevokeSlot} disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Revoke slot
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
