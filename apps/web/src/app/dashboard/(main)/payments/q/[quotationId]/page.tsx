"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  Mail,
  DollarSign,
} from "lucide-react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchClientAgreementRequests,
  isAgreementRequestOpen,
} from "@/lib/agreements";
import { deleteInvoice } from "@/lib/billing";
import { collectAppointmentPayment, formatMoney } from "@/lib/client-account";
import { buildInvoicePaymentEmailBody } from "@/lib/invoice-email";
import { downloadQuotationPdfFromData } from "@/lib/invoice-pdf";
import {
  approveQuotation,
  collectQuotationPayment,
  fetchQuotation,
  sendQuotationEmail,
  type QuotationRecord,
} from "@/lib/quotations";
import { fetchOrganizationSettings } from "@/lib/settings";

export default function InvoiceDetailPage() {
  const params = useParams<{ quotationId: string }>();
  const quotationId = Number(params.quotationId);
  const router = useRouter();
  const { can } = useCurrentUser();

  const [quote, setQuote] = React.useState<QuotationRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [orgSettings, setOrgSettings] = React.useState<{
    name?: string;
    address?: string;
    support_email?: string;
    phone?: string;
    currency?: string;
  } | null>(null);

  const [agreementLink, setAgreementLink] = React.useState("");
  const [toEmail, setToEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [chargeAmount, setChargeAmount] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState("");

  const reload = React.useCallback(async () => {
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      throw new Error("Invalid quotation id");
    }
    const [q, org] = await Promise.all([
      fetchQuotation(quotationId),
      fetchOrganizationSettings().catch(() => null),
    ]);
    setQuote(q);
    setOrgSettings(org);
    return q;
  }, [quotationId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = await reload();
        if (cancelled) return;
        const currency = (q.currency || orgSettings?.currency || "AED").toUpperCase();
        const balance = Math.max(0, Number(q.amount) - Number(q.collected_amount || 0));
        const charge = Number(balance.toFixed(2));
        let link = "";
        if (q.appointment_id && q.client_id) {
          try {
            const reqs = await fetchClientAgreementRequests(q.client_id);
            const open = reqs.find(
              (r) =>
                r.appointment_id === q.appointment_id &&
                isAgreementRequestOpen(r) &&
                Boolean(r.link),
            );
            link = open?.link || "";
          } catch {
            /* ignore */
          }
        }
        if (cancelled) return;
        setAgreementLink(link);
        setToEmail(q.sent_to_email || q.client?.email || "");
        setSubject(`${q.code} — invoice & payment`);
        setChargeAmount(String(charge));
        setPaymentAmount(String(charge));
        setBody(
          buildInvoicePaymentEmailBody({
            clientName: q.client?.name || "there",
            code: q.code,
            currency,
            totalAmount: Number(q.amount),
            paidAmount: Number(q.collected_amount || 0),
            chargeAmount: charge,
            agreementLink: link || undefined,
          }),
        );
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load invoice");
          router.replace("/dashboard/payments");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload, router]);

  const currency = (quote?.currency || orgSettings?.currency || "AED").toUpperCase();
  const total = Number(quote?.amount || 0);
  const paid = Number(quote?.collected_amount || 0);
  const balance = Math.max(0, total - paid);

  const rebuildBody = (nextCharge: string) => {
    if (!quote) return;
    const parsed = Number(nextCharge);
    const chargeForBody = Number.isFinite(parsed) && parsed > 0 ? parsed : balance;
    setBody(
      buildInvoicePaymentEmailBody({
        clientName: quote.client?.name || "there",
        code: quote.code,
        currency,
        totalAmount: total,
        paidAmount: paid,
        chargeAmount: chargeForBody,
        agreementLink: agreementLink || undefined,
      }),
    );
  };

  const handleSend = async () => {
    if (!quote) return;
    if (!toEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    let charge = balance;
    if (chargeAmount.trim() !== "") {
      charge = Number(chargeAmount);
      if (!Number.isFinite(charge) || charge <= 0) {
        toast.error("Enter a valid charge amount greater than zero");
        return;
      }
      if (charge > balance + 0.0001) {
        toast.error("Charge amount cannot exceed the remaining balance");
        return;
      }
    }
    setSending(true);
    try {
      const result = await sendQuotationEmail(quote.id, {
        to_email: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        ...(balance > 0 ? { charge_amount: charge } : {}),
      });
      await reload();
      if (result?.payment_url) {
        toast.success("Invoice emailed with PDF and Stripe payment link");
      } else {
        toast.success("Invoice emailed with PDF");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    const url = quote?.stripe_payment_link_url;
    if (!url) {
      toast.error("No payment link yet — send the invoice email first");
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Payment link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  const handleDownloadPdf = () => {
    if (!quote) return;
    downloadQuotationPdfFromData({
      code: quote.code,
      issueDate: quote.created_at,
      currency,
      client: {
        name: quote.client?.name || `Client #${quote.client_id}`,
        email: quote.client?.email,
      },
      items: [{ description: quote.title || "Polygraph services", amount: total }],
      subtotal: total,
      total,
      paidAmount: paid,
      balanceDue: balance,
      org: {
        name: orgSettings?.name || "Polygraph UAE",
        address: orgSettings?.address,
        email: orgSettings?.support_email,
        phone: orgSettings?.phone,
      },
    });
  };

  const handleApprove = async () => {
    if (!quote) return;
    setApproving(true);
    try {
      await approveQuotation(quote.id);
      await reload();
      toast.success("Quotation approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve");
    } finally {
      setApproving(false);
    }
  };

  const handleRecordPayment = async () => {
    if (!quote) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    setRecording(true);
    try {
      if (quote.appointment_id) {
        await collectAppointmentPayment(quote.appointment_id, { amount });
      } else {
        await collectQuotationPayment(quote.id, { amount });
      }
      await reload();
      toast.success("Payment recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to record payment");
    } finally {
      setRecording(false);
    }
  };

  if (loading || !quote) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-4 sm:px-0">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/payments" />} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{quote.code}</h1>
              <Badge variant="outline">{quote.status}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">{quote.client?.name || `Client #${quote.client_id}`}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-xl" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" className="rounded-xl" onClick={() => void handleCopyLink()} disabled={!quote.stripe_payment_link_url}>
            <Copy className="h-4 w-4 mr-2" />
            Copy pay link
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Amounts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatMoney(total, currency)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Paid</span>
                <span className="font-bold">{formatMoney(paid, currency)}</span>
              </div>
              <div className="flex justify-between text-base font-black border-t border-border/40 pt-3">
                <span>Balance due</span>
                <span>{formatMoney(balance, currency)}</span>
              </div>
              {quote.stripe_payment_link_url ? (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Stripe payment link</p>
                  <p className="text-xs break-all">{quote.stripe_payment_link_url}</p>
                </div>
              ) : null}
              {quote.sent_at ? (
                <p className="text-xs text-emerald-600 font-semibold">Last emailed: {new Date(quote.sent_at).toLocaleString()}</p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!["Approved", "Completed"].includes(quote.status) && (
                <Button variant="outline" className="w-full rounded-xl" onClick={() => void handleApprove()} disabled={approving}>
                  {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Approve quotation
                </Button>
              )}
              {can("appointment:create") && (
                <Button
                  variant="secondary"
                  className="w-full rounded-xl"
                  onClick={() =>
                    router.push(
                      `/dashboard/calendar/book?clientId=${quote.client_id}&quotationId=${quote.id}`,
                    )
                  }
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Convert to booking
                </Button>
              )}
              <div className="space-y-2 pt-2 border-t border-border/40">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Record payment</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    className="h-11 rounded-xl"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                  />
                  <Button className="rounded-xl" onClick={() => void handleRecordPayment()} disabled={recording || balance <= 0}>
                    {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}
                  </Button>
                </div>
              </div>
              {can("payment:manage") && (
                <div className="pt-2">
                  <DeleteConfirmDialog
                    title={`Delete ${quote.code}`}
                    description="This permanently removes this invoice from billing. The linked appointment (if any) is kept."
                    confirmLabel="Confirmation"
                    triggerLabel="Delete Invoice"
                    onConfirm={async () => {
                      await deleteInvoice({
                        quotationId: quote.id,
                        appointmentId: quote.appointment_id,
                      });
                      toast.success("Invoice deleted");
                      router.push("/dashboard/payments");
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Mail className="h-5 w-5 text-primary" />
                Send invoice email
              </CardTitle>
              <CardDescription>
                Includes the invoice PDF and a Stripe payment link for the charge amount below.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">To</Label>
                <Input type="email" className="h-11 rounded-xl" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subject</Label>
                <Input className="h-11 rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Stripe charge amount
                </Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  className="h-11 rounded-xl"
                  value={chargeAmount}
                  onChange={(e) => {
                    setChargeAmount(e.target.value);
                    rebuildBody(e.target.value);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a deposit (e.g. 100) or the full balance. Message updates automatically.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Message</Label>
                <Textarea className="min-h-[280px] rounded-xl" value={body} onChange={(e) => setBody(e.target.value)} />
              </div>
              <Button className="w-full h-12 rounded-2xl font-black" onClick={() => void handleSend()} disabled={sending || !toEmail.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send email with PDF &amp; pay link
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
