"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import {
  collectAppointmentPayment,
  formatMoney,
  sendAppointmentPaymentReminder,
  type AccountLedgerEntry,
  type AccountSummary,
} from "@/lib/client-account";
import { fetchBillingLedger, ledgerEntryCollectTarget } from "@/lib/billing";
import { collectQuotationPayment, sendQuotationEmail } from "@/lib/quotations";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusVariant(status: string) {
  const s = status.toLowerCase();
  if (s === "paid" || s === "accepted") return "default" as const;
  if (s === "partial" || s === "sent") return "secondary" as const;
  return "outline" as const;
}

export default function ClientAccountPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { client } = useClientDetail();

  const [summary, setSummary] = React.useState<AccountSummary | null>(null);
  const [entries, setEntries] = React.useState<AccountLedgerEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [selected, setSelected] = React.useState<AccountLedgerEntry | null>(null);
  const [collectOpen, setCollectOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [reminderEmail, setReminderEmail] = React.useState("");
  const [reminderSubject, setReminderSubject] = React.useState("");
  const [reminderBody, setReminderBody] = React.useState("");

  const load = React.useCallback(async () => {
    if (!Number.isFinite(clientId)) return;
    setLoading(true);
    try {
      const data = await fetchBillingLedger(clientId);
      setSummary(data.summary);
      setEntries(data.entries);
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
    setReminderBody(
      `Hello,\n\nThis is a payment reminder for ${entry.title} (${entry.code}).\n\nTotal: ${formatMoney(entry.total_amount)}\nPaid: ${formatMoney(entry.paid_amount)}\nBalance due: ${formatMoney(entry.balance_due)}\n\nPlease contact us to arrange payment.\n\nThank you,\nPolygraph Forensic System`
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
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total billed</CardDescription>
                <CardTitle className="text-2xl tabular-nums">
                  {formatMoney(summary?.total_billed ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total paid</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-emerald-600 dark:text-emerald-400">
                  {formatMoney(summary?.total_paid ?? 0)}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardHeader className="pb-2">
                <CardDescription>Outstanding balance</CardDescription>
                <CardTitle className="text-2xl tabular-nums text-amber-600 dark:text-amber-400">
                  {formatMoney(summary?.balance_due ?? 0)}
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
                    {entries.map((entry) => (
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
                          {formatMoney(entry.total_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {formatMoney(entry.paid_amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {formatMoney(entry.balance_due)}
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
    </div>
  );
}
