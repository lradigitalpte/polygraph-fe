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
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchClientAgreementRequests,
  isAgreementRequestOpen,
} from "@/lib/agreements";
import { deleteInvoice } from "@/lib/billing";
import { collectAppointmentPayment, formatMoney, wholeMoneyAmount } from "@/lib/client-account";
import { buildInvoicePaymentEmailBody } from "@/lib/invoice-email";
import { downloadQuotationPdfFromData } from "@/lib/invoice-pdf";
import {
  approveQuotation,
  collectQuotationPayment,
  fetchQuotation,
  sendQuotationEmail,
  syncQuotationStripePayment,
  updateQuotation,
  type QuotationRecord,
} from "@/lib/quotations";
import { computeQuotationTotal, normalizedQuotationAmounts } from "@/lib/quotation-pricing";
import { estimateStripeGrossCharge } from "@/lib/stripe-fees";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";

export default function InvoiceDetailPage() {
  const params = useParams<{ quotationId: string }>();
  const quotationId = Number(params.quotationId);
  const router = useRouter();
  const { can } = useCurrentUser();

  const [quote, setQuote] = React.useState<QuotationRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [orgSettings, setOrgSettings] = React.useState<OrganizationSettings | null>(null);

  const [agreementLink, setAgreementLink] = React.useState("");
  const [toEmail, setToEmail] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [chargeAmount, setChargeAmount] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [approving, setApproving] = React.useState(false);
  const [recording, setRecording] = React.useState(false);
  const [syncingStripe, setSyncingStripe] = React.useState(false);
  const [paymentAmount, setPaymentAmount] = React.useState("");
  const [passProcessingFee, setPassProcessingFee] = React.useState(false);
  const [feePercentOverride, setFeePercentOverride] = React.useState("");
  const [feeFixedOverride, setFeeFixedOverride] = React.useState("");
  const [editTitle, setEditTitle] = React.useState("");
  const [editSubtotal, setEditSubtotal] = React.useState("");
  const [editDiscount, setEditDiscount] = React.useState("");
  const [editVatRate, setEditVatRate] = React.useState("");
  const [editIncludeVat, setEditIncludeVat] = React.useState(false);
  const [savingPricing, setSavingPricing] = React.useState(false);

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
    if (org?.pass_stripe_fees_to_customer != null) {
      setPassProcessingFee(org.pass_stripe_fees_to_customer);
    }
    return { q, org };
  }, [quotationId]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const { q, org } = await reload();
        if (cancelled) return;
        const currency = (q.currency || org?.currency || "AED").toUpperCase();
        const priced = normalizedQuotationAmounts(q);
        const paidNow = wholeMoneyAmount(Number(q.collected_amount || 0));
        const balance = Math.max(0, priced.total - paidNow);
        const charge = balance;
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
        setEditTitle(q.title || "");
        setEditSubtotal(String(priced.subtotal));
        setEditDiscount(String(priced.discountAmount));
        setEditVatRate(String(Number(q.vat_rate || org?.default_vat_rate || 5)));
        setEditIncludeVat(Number(q.vat_amount || 0) > 0 || Number(q.vat_rate || 0) > 0);
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
            totalAmount: priced.total,
            paidAmount: paidNow,
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
  const quoteAmounts = React.useMemo(
    () => (quote ? normalizedQuotationAmounts(quote) : null),
    [quote],
  );
  const total = quoteAmounts?.total ?? 0;
  const paid = wholeMoneyAmount(Number(quote?.collected_amount || 0));
  const balance = Math.max(0, total - paid);
  const displaySubtotal = quoteAmounts?.subtotal ?? 0;
  const displayDiscount = quoteAmounts?.discountAmount ?? 0;
  const displayVat = quoteAmounts?.vatAmount ?? 0;
  const displayVatRate = quoteAmounts?.vatRate ?? Number(quote?.vat_rate || 0);

  const chargeNet = React.useMemo(() => {
    const parsed = wholeMoneyAmount(Number(chargeAmount));
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.min(parsed, balance);
    }
    return balance;
  }, [chargeAmount, balance]);

  const effectiveFeePercent = React.useMemo(() => {
    const o = feePercentOverride.trim();
    if (o !== "" && Number.isFinite(Number(o))) return Number(o);
    return orgSettings?.stripe_card_fee_percent ?? 2.9;
  }, [feePercentOverride, orgSettings?.stripe_card_fee_percent]);

  const effectiveFeeFixed = React.useMemo(() => {
    const o = feeFixedOverride.trim();
    if (o !== "" && Number.isFinite(Number(o))) return Number(o);
    return orgSettings?.stripe_card_fee_fixed ?? 1;
  }, [feeFixedOverride, orgSettings?.stripe_card_fee_fixed]);

  const feePreview = React.useMemo(() => {
    if (!passProcessingFee || chargeNet <= 0) {
      return null;
    }
    return estimateStripeGrossCharge(chargeNet, effectiveFeePercent, effectiveFeeFixed);
  }, [passProcessingFee, chargeNet, effectiveFeePercent, effectiveFeeFixed]);

  const pricingPreview = React.useMemo(() => {
    const subtotal = Number(editSubtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) return null;
    return computeQuotationTotal({
      subtotal,
      discountAmount: Number(editDiscount) || 0,
      vatRate: Number(editVatRate) || 0,
      applyVat: editIncludeVat,
    });
  }, [editSubtotal, editDiscount, editVatRate, editIncludeVat]);

  const paymentHistory = React.useMemo(() => {
    const rows = [...(quote?.payment_history || [])];
    rows.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    return rows;
  }, [quote?.payment_history]);

  const rebuildBody = (nextCharge: string) => {
    if (!quote) return;
    const parsed = Number(nextCharge);
    const chargeForBody = Number.isFinite(parsed) && parsed > 0 ? parsed : balance;
    const netForFee =
      Number.isFinite(parsed) && parsed > 0 ? Math.min(wholeMoneyAmount(parsed), balance) : balance;
    const gross =
      passProcessingFee && netForFee > 0
        ? estimateStripeGrossCharge(netForFee, effectiveFeePercent, effectiveFeeFixed).gross
        : chargeForBody;
    setBody(
      buildInvoicePaymentEmailBody({
        clientName: quote.client?.name || "there",
        code: quote.code,
        currency,
        totalAmount: total,
        paidAmount: paid,
        chargeAmount: chargeForBody,
        checkoutPayTotal:
          passProcessingFee && gross > chargeForBody + 0.0001 ? gross : undefined,
        agreementLink: agreementLink || undefined,
      }),
    );
  };

  React.useEffect(() => {
    if (!quote) return;
    rebuildBody(chargeAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when fee toggle or inputs change
  }, [quote?.id, chargeAmount, passProcessingFee, effectiveFeePercent, effectiveFeeFixed, total, paid, balance]);

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
        ...(balance > 0
          ? {
              charge_amount: charge,
              pass_processing_fee: passProcessingFee,
              ...(feePercentOverride.trim() !== ""
                ? { processing_fee_percent: Number(feePercentOverride) }
                : {}),
              ...(feeFixedOverride.trim() !== ""
                ? { processing_fee_fixed: Number(feeFixedOverride) }
                : {}),
            }
          : {}),
      });
      await reload();
      if (result?.payment_url) {
        toast.success("Invoice emailed with PDF and payment link");
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
      items: [{ description: quote.title || "Polygraph services", amount: displaySubtotal || total }],
      subtotal: displaySubtotal || total,
      discount:
        displayDiscount > 0
          ? { label: "Discount", amount: displayDiscount }
          : undefined,
      vat:
        displayVat > 0
          ? { rate: displayVatRate, amount: displayVat }
          : undefined,
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

  const handleSavePricing = async () => {
    if (!quote || !pricingPreview) {
      toast.error("Enter valid pricing amounts");
      return;
    }
    if (pricingPreview.total < paid - 0.0001) {
      toast.error("Total cannot be less than amount already paid");
      return;
    }
    setSavingPricing(true);
    try {
      await updateQuotation(quote.id, {
        title: editTitle.trim() || quote.title,
        amount: pricingPreview.total,
        subtotal_amount: pricingPreview.subtotal,
        discount_amount: pricingPreview.discountAmount,
        vat_rate: editIncludeVat ? pricingPreview.vatRate : 0,
        vat_amount: editIncludeVat ? pricingPreview.vatAmount : 0,
      });
      await reload();
      toast.success("Quotation pricing updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update pricing");
    } finally {
      setSavingPricing(false);
    }
  };

  const handleSyncStripe = async () => {
    if (!quote) return;
    setSyncingStripe(true);
    try {
      await syncQuotationStripePayment(quote.id);
      await reload();
      toast.success("Card payment applied to this invoice");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not sync card payment");
    } finally {
      setSyncingStripe(false);
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
              {displaySubtotal > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatMoney(displaySubtotal, currency)}</span>
                </div>
              ) : null}
              {displayDiscount > 0 ? (
                <div className="flex justify-between text-sm text-rose-600">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-semibold">-{formatMoney(displayDiscount, currency)}</span>
                </div>
              ) : null}
              {displayVat > 0 ? (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">VAT ({displayVatRate}%)</span>
                  <span>{formatMoney(displayVat, currency)}</span>
                </div>
              ) : null}
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
              {feePreview && feePreview.fee > 0 ? (
                <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 p-3 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processing fee (est.)</span>
                    <span>{formatMoney(feePreview.fee, currency)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>Customer pays by card</span>
                    <span>{formatMoney(feePreview.gross, currency)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Client sees {formatMoney(feePreview.gross, currency)} on checkout and in the email (service
                    breakdown stays on the PDF only).
                  </p>
                </div>
              ) : null}
              {quote.stripe_payment_link_url ? (
                <div className="rounded-xl border border-border/40 bg-muted/10 p-3 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Online payment link</p>
                  <p className="text-xs break-all">{quote.stripe_payment_link_url}</p>
                </div>
              ) : null}
              {quote.sent_at ? (
                <p className="text-xs text-emerald-600 font-semibold">Last emailed: {new Date(quote.sent_at).toLocaleString()}</p>
              ) : null}
            </CardContent>
          </Card>

          {quote.status !== "Completed" && can("appointment:manage") ? (
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Edit quotation pricing</CardTitle>
                <CardDescription>Adjust line totals, VAT, and invoice total before sending.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Title</Label>
                  <Input className="h-11 rounded-xl" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Subtotal</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-11 rounded-xl"
                      value={editSubtotal}
                      onChange={(e) => setEditSubtotal(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Discount</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-11 rounded-xl"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <Checkbox checked={editIncludeVat} onCheckedChange={(c) => setEditIncludeVat(Boolean(c))} />
                    Include VAT
                  </label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Rate (%)</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-10 w-24 rounded-xl"
                      disabled={!editIncludeVat}
                      value={editVatRate}
                      onChange={(e) => setEditVatRate(e.target.value)}
                    />
                  </div>
                </div>
                {pricingPreview ? (
                  <div className="rounded-xl border border-border/40 bg-muted/10 p-3 text-sm space-y-1">
                    {pricingPreview.discountAmount > 0 ? (
                      <div className="flex justify-between text-rose-600">
                        <span>Discount</span>
                        <span>-{formatMoney(pricingPreview.discountAmount, currency)}</span>
                      </div>
                    ) : null}
                    {pricingPreview.vatAmount > 0 ? (
                      <div className="flex justify-between">
                        <span>VAT</span>
                        <span>{formatMoney(pricingPreview.vatAmount, currency)}</span>
                      </div>
                    ) : null}
                    <div className="flex justify-between font-bold">
                      <span>Invoice total</span>
                      <span>{formatMoney(pricingPreview.total, currency)}</span>
                    </div>
                  </div>
                ) : null}
                <Button className="w-full rounded-xl" onClick={() => void handleSavePricing()} disabled={savingPricing}>
                  {savingPricing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save pricing
                </Button>
              </CardContent>
            </Card>
          ) : null}

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Payment history
              </CardTitle>
              <CardDescription>Each line shows what was applied to this invoice and when.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {paid > 0
                    ? "No per-payment timestamps yet (older payments). New card and manual payments will appear here."
                    : "No payments recorded yet."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {paymentHistory.map((entry, idx) => {
                    const when = new Date(entry.paid_at);
                    const label = entry.method === "stripe" ? "Card online" : "Manual";
                    const customerPaid =
                      entry.total_charged && entry.total_charged > 0
                        ? entry.total_charged
                        : entry.amount + (entry.processing_fee || 0);
                    return (
                      <li
                        key={`${entry.paid_at}-${idx}`}
                        className="rounded-xl border border-border/40 bg-muted/10 p-3 text-sm space-y-1"
                      >
                        <div className="flex justify-between gap-2 font-semibold">
                          <span>{when.toLocaleString()}</span>
                          <span>{label}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Applied to invoice</span>
                          <span className="text-foreground font-medium">{formatMoney(entry.amount, currency)}</span>
                        </div>
                        {entry.processing_fee != null && entry.processing_fee > 0 ? (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Processing fee</span>
                            <span>{formatMoney(entry.processing_fee, currency)}</span>
                          </div>
                        ) : null}
                        <div className="flex justify-between text-muted-foreground">
                          <span>Customer paid</span>
                          <span>{formatMoney(customerPaid, currency)}</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="flex justify-between border-t border-border/40 pt-3 text-sm font-bold">
                <span>Balance remaining</span>
                <span>{formatMoney(balance, currency)}</span>
              </div>
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
              {quote.stripe_checkout_session_id && balance > 0 ? (
                <Button
                  variant="outline"
                  className="w-full rounded-xl"
                  onClick={() => void handleSyncStripe()}
                  disabled={syncingStripe}
                >
                  {syncingStripe ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Sync online payment
                </Button>
              ) : null}
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
                Includes the invoice PDF and a secure payment link for the charge amount below.
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
                  Payment amount (applied to invoice)
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
                {balance > 0 ? (
                  <label className="flex items-start gap-3 rounded-xl border border-border/40 p-3 mt-2">
                    <Checkbox
                      checked={passProcessingFee}
                      onCheckedChange={(checked) => {
                        setPassProcessingFee(Boolean(checked));
                      }}
                      className="mt-0.5"
                    />
                    <div className="space-y-1 text-xs">
                      <div className="font-semibold text-sm">Add processing fee for customer</div>
                      <p className="text-muted-foreground">
                        Customer pays invoice/deposit plus processing fee. You still receive{" "}
                        {formatMoney(chargeNet, currency)} toward the invoice.
                      </p>
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Fee % (optional)</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            placeholder={String(orgSettings?.stripe_card_fee_percent ?? 2.9)}
                            className="h-9 rounded-lg mt-1"
                            value={feePercentOverride}
                            onChange={(e) => setFeePercentOverride(e.target.value)}
                          />
                        </div>
                        <div>
                          <Label className="text-[10px] uppercase text-muted-foreground">Fixed fee ({currency})</Label>
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            placeholder={String(orgSettings?.stripe_card_fee_fixed ?? 1)}
                            className="h-9 rounded-lg mt-1"
                            value={feeFixedOverride}
                            onChange={(e) => setFeeFixedOverride(e.target.value)}
                          />
                        </div>
                      </div>
                      {feePreview && feePreview.fee > 0 ? (
                        <div className="rounded-lg bg-muted/30 p-2 mt-2 space-y-1 text-foreground font-medium">
                          <div className="flex justify-between">
                            <span>Processing fee</span>
                            <span>{formatMoney(feePreview.fee, currency)}</span>
                          </div>
                          <div className="flex justify-between text-base font-black">
                            <span>Customer pays total</span>
                            <span>{formatMoney(feePreview.gross, currency)}</span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </label>
                ) : null}
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
