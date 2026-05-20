"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CreditCard, Loader2, Mail, Wallet } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  collectAppointmentPayment,
  formatMoney,
  paymentBalance,
  sendAppointmentPaymentReminder,
} from "@/lib/client-account";
import type { AppointmentRecord } from "@/lib/exam-booking";

type ClientPaymentPanelProps = {
  appointment: AppointmentRecord;
  clientEmail?: string;
  clientId: number;
  onUpdated?: () => void;
  showAccountLink?: boolean;
};

function paymentStatusVariant(status?: string) {
  const s = (status ?? "").toLowerCase();
  if (s === "paid") return "default" as const;
  if (s === "partial") return "secondary" as const;
  return "outline" as const;
}

export function ClientPaymentPanel({
  appointment,
  clientEmail,
  clientId,
  onUpdated,
  showAccountLink = true,
}: ClientPaymentPanelProps) {
  const total = Number(appointment.exam_fee ?? 0);
  const paid = Number(appointment.collected_amount ?? 0);
  const balance = paymentBalance(total, paid);
  const status = appointment.payment_status ?? (balance <= 0 && total > 0 ? "Paid" : paid > 0 ? "Partial" : "Unpaid");

  const [collectOpen, setCollectOpen] = React.useState(false);
  const [reminderOpen, setReminderOpen] = React.useState(false);
  const [amount, setAmount] = React.useState("");
  const [collecting, setCollecting] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  const [reminderEmail, setReminderEmail] = React.useState(clientEmail ?? "");
  const [reminderSubject, setReminderSubject] = React.useState("");
  const [reminderBody, setReminderBody] = React.useState("");

  React.useEffect(() => {
    setReminderEmail(clientEmail ?? "");
  }, [clientEmail]);

  const openReminder = () => {
    const code = `APT-${String(appointment.id).padStart(4, "0")}`;
    setReminderSubject(`Payment reminder — ${code}`);
    setReminderBody(
      `Hello,\n\nThis is a reminder regarding your scheduled polygraph session (${code}).\n\nTotal fee: ${formatMoney(total)}\nPaid to date: ${formatMoney(paid)}\nBalance due: ${formatMoney(balance)}\n\nPlease contact us to arrange payment.\n\nThank you,\nPolygraph Forensic System`
    );
    setReminderOpen(true);
  };

  const handleCollect = async () => {
    const value = parseFloat(amount);
    if (Number.isNaN(value) || value <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setCollecting(true);
    try {
      await collectAppointmentPayment(appointment.id, { amount: value });
      toast.success("Payment recorded");
      setCollectOpen(false);
      setAmount("");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setCollecting(false);
    }
  };

  const handleSendReminder = async () => {
    if (!reminderEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setSending(true);
    try {
      await sendAppointmentPaymentReminder(appointment.id, {
        to_email: reminderEmail.trim(),
        subject: reminderSubject.trim(),
        body: reminderBody.trim(),
      });
      toast.success("Payment reminder sent");
      setReminderOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reminder");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Card className="border-border/50 shadow-sm bg-card/50">
        <CardHeader className="bg-muted/30 pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Session billing
          </CardTitle>
          <CardDescription>Total fee, payments received, and balance due.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Status
            </span>
            <Badge variant={paymentStatusVariant(status)} className="capitalize">
              {status}
            </Badge>
          </div>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Total fee</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Paid</dt>
              <dd className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                {formatMoney(paid)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-border/50 pt-2">
              <dt className="font-medium">Balance due</dt>
              <dd className="font-bold tabular-nums text-amber-600 dark:text-amber-400">
                {formatMoney(balance)}
              </dd>
            </div>
          </dl>
          {appointment.payment_mode && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Preferred: {appointment.payment_mode}
            </p>
          )}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              type="button"
              className="w-full gap-2 rounded-xl"
              disabled={balance <= 0 && status.toLowerCase() === "paid"}
              onClick={() => {
                setAmount(balance > 0 ? balance.toFixed(2) : "");
                setCollectOpen(true);
              }}
            >
              <CreditCard className="h-4 w-4" />
              Record payment
            </Button>
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 rounded-xl"
              disabled={balance <= 0}
              onClick={openReminder}
            >
              <Mail className="h-4 w-4" />
              Send payment reminder
            </Button>
            {showAccountLink && (
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                render={<Link href={`/dashboard/clients/${clientId}/account`} />}
              >
                View full account
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={collectOpen} onOpenChange={setCollectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              Manually record cash, card, or transfer received. Partial payments are supported.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Amount received ($)
            </Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              className="h-11 rounded-xl"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={balance > 0 ? balance.toFixed(2) : "0.00"}
            />
            {balance > 0 && (
              <p className="text-xs text-muted-foreground">
                Outstanding balance: {formatMoney(balance)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCollectOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCollect} disabled={collecting}>
              {collecting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Payment reminder email</DialogTitle>
            <DialogDescription>
              Sends via your configured SMTP server to the client or payer.
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
                placeholder="client@email.com"
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
                className="min-h-[140px] rounded-xl resize-none text-sm"
                value={reminderBody}
                onChange={(e) => setReminderBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReminderOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendReminder} disabled={sending}>
              {sending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Send email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
