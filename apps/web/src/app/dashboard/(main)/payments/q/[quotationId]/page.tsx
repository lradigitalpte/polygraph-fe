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
  Landmark,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchClientAgreementRequests,
  isAgreementRequestOpen,
} from "@/lib/agreements";
import { deleteInvoice } from "@/lib/billing";
import { fetchClient, type ClientRecord } from "@/lib/clients";
import { collectAppointmentPayment, formatMoney, wholeMoneyAmount } from "@/lib/client-account";
import { buildInvoicePaymentEmailBody } from "@/lib/invoice-email";
import { formatInvoiceDisplayNumber } from "@/lib/invoice-number";
import { InvoicePaidStamp, isInvoiceFullyPaid } from "@/components/dashboard/invoice-paid-stamp";
import { downloadQuotationPdfFromData, pdfOrgFromSettings } from "@/lib/invoice-pdf";
import { fetchBankAccounts, type BankAccount, type BankDetails } from "@/lib/bank-accounts";
import { BankAccountPicker } from "@/components/dashboard/bank-account-picker";
import {
  approveQuotation,
  collectQuotationPayment,
  fetchQuotation,
  mintPrepaidSlotsForQuotation,
  revokeQuotationSlot,
  sendQuotationEmail,
  syncQuotationStripePayment,
  updateQuotation,
  type QuotationRecord,
} from "@/lib/quotations";
import {
  fetchPrepaidSlotSummary,
  fetchPrepaidSlots,
  type PrepaidSlotSummary,
} from "@/lib/prepaid-slots";
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
  const [editQuantity, setEditQuantity] = React.useState("1");
  const [editUnitPrice, setEditUnitPrice] = React.useState("");
  const [editInvoiceNotes, setEditInvoiceNotes] = React.useState("");
  const [billingClient, setBillingClient] = React.useState<ClientRecord | null>(null);
  const [savingPricing, setSavingPricing] = React.useState(false);
  const [bankAccounts, setBankAccounts] = React.useState<BankAccount[]>([]);
  const [editingBanks, setEditingBanks] = React.useState(false);
  const [bankSelection, setBankSelection] = React.useState<number[]>([]);
  const [savingBanks, setSavingBanks] = React.useState(false);
  const [prepaidSummary, setPrepaidSummary] = React.useState<PrepaidSlotSummary | null>(null);
  const [invoicePrepaidStats, setInvoicePrepaidStats] = React.useState<PrepaidSlotSummary | null>(null);
  const [mintSlotQuantity, setMintSlotQuantity] = React.useState("");
  const [mintAlreadyUsed, setMintAlreadyUsed] = React.useState("0");
  const [mintingSlots, setMintingSlots] = React.useState(false);

  React.useEffect(() => {
    void fetchBankAccounts().then(setBankAccounts).catch(() => setBankAccounts([]));
  }, []);

  const reload = React.useCallback(async () => {
    if (!Number.isFinite(quotationId) || quotationId <= 0) {
      throw new Error("Invalid quotation id");
    }
    const q = await fetchQuotation(quotationId);
    const [org, clientDetail] = await Promise.all([
      fetchOrganizationSettings().catch(() => null),
      q.client_id ? fetchClient(q.client_id).catch(() => null) : Promise.resolve(null),
    ]);
    setQuote(q);
    setOrgSettings(org);
    setBillingClient(clientDetail);
    const qty = q.line_quantity && q.line_quantity > 0 ? q.line_quantity : 1;
    setMintSlotQuantity(String(qty));
    if (q.client_id) {
      void Promise.all([
        fetchPrepaidSlotSummary(q.client_id).catch(() => null),
        fetchPrepaidSlots(q.client_id).catch(() => []),
      ]).then(([summary, slots]) => {
        setPrepaidSummary(summary);
        const mine = slots.filter((s) => s.source_quotation_id === q.id);
        if (mine.length === 0) {
          setInvoicePrepaidStats(null);
          return;
        }
        let available = 0;
        let consumed = 0;
        for (const s of mine) {
          if (s.status === "consumed") consumed++;
          else if (s.status === "available") available++;
        }
        setInvoicePrepaidStats({ available, consumed, total: mine.length });
      });
    } else {
      setPrepaidSummary(null);
      setInvoicePrepaidStats(null);
    }
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
        const qty = q.line_quantity && q.line_quantity > 0 ? q.line_quantity : 1;
        setEditQuantity(String(qty));
        const lineSubtotal = priced.subtotal;
        setEditSubtotal(String(lineSubtotal));
        setEditUnitPrice(String(qty > 0 ? wholeMoneyAmount(lineSubtotal / qty) : lineSubtotal));
        setEditInvoiceNotes(q.description || "");
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
            bankAccounts: q.bank_accounts,
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

  const lineSubtotalPreview = React.useMemo(() => {
    const qty = Math.max(1, parseInt(editQuantity, 10) || 1);
    const unit = Number(editUnitPrice);
    if (!Number.isFinite(unit) || unit < 0) return null;
    return wholeMoneyAmount(qty * unit);
  }, [editQuantity, editUnitPrice]);

  React.useEffect(() => {
    if (lineSubtotalPreview != null) {
      setEditSubtotal(String(lineSubtotalPreview));
    }
  }, [lineSubtotalPreview]);

  const pricingPreview = React.useMemo(() => {
    const subtotal = lineSubtotalPreview ?? Number(editSubtotal);
    if (!Number.isFinite(subtotal) || subtotal < 0) return null;
    return computeQuotationTotal({
      subtotal,
      discountAmount: Number(editDiscount) || 0,
      vatRate: Number(editVatRate) || 0,
      applyVat: editIncludeVat,
    });
  }, [lineSubtotalPreview, editSubtotal, editDiscount, editVatRate, editIncludeVat]);

  const paymentHistory = React.useMemo(() => {
    const rows = [...(quote?.payment_history || [])];
    rows.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    return rows;
  }, [quote?.payment_history]);

  const rebuildBody = (nextCharge: string, banks: BankDetails[] | undefined = quote?.bank_accounts) => {
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
        bankAccounts: banks,
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

  const startEditingBanks = () => {
    if (!quote) return;
    // Snapshots carry no ids, so match the printed details back to current accounts.
    const same = (a?: string, b?: string) => (a || "") === (b || "");
    setBankSelection(
      bankAccounts
        .filter((a) =>
          (quote.bank_accounts ?? []).some(
            (d) => d.currency === a.currency && same(d.iban, a.iban) && same(d.account_number, a.account_number),
          ),
        )
        .map((a) => a.id),
    );
    setEditingBanks(true);
  };

  const handleSaveBanks = async () => {
    if (!quote) return;
    setSavingBanks(true);
    try {
      const updated = await updateQuotation(quote.id, { bank_account_ids: bankSelection });
      setQuote(updated);
      rebuildBody(chargeAmount, updated.bank_accounts);
      setEditingBanks(false);
      toast.success("Bank details updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update bank details");
    } finally {
      setSavingBanks(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!quote) return;
    const bill = billingClient || quote.client;
    const qty = Math.max(1, quote.line_quantity && quote.line_quantity > 0 ? quote.line_quantity : parseInt(editQuantity, 10) || 1);
    const lineSub = displaySubtotal || total;
    const unit = qty > 0 ? wholeMoneyAmount(lineSub / qty) : lineSub;
    const noteLines = (quote.description || editInvoiceNotes || "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    downloadQuotationPdfFromData({
      bankAccounts: quote.bank_accounts,
      code: quote.code,
      quotationId: quote.id,
      paymentReference: quote.code,
      issueDate: quote.created_at,
      currency,
      client: {
        name: bill?.name || quote.client?.name || `Client #${quote.client_id}`,
        email: bill?.email || quote.client?.email,
        phone: bill?.phone || quote.client?.phone,
        address: bill?.address || quote.client?.address,
        taxId: bill?.tax_id || quote.client?.tax_id,
        contactPerson: bill?.contact_person || quote.client?.contact_person,
      },
      items: [
        {
          description: quote.title || "Polygraph services",
          quantity: qty,
          unitPrice: unit,
          lineTotal: lineSub,
        },
      ],
      invoiceNotes: noteLines.length > 0 ? noteLines : undefined,
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
      org: pdfOrgFromSettings(orgSettings),
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
      const qty = Math.max(1, parseInt(editQuantity, 10) || 1);
      await updateQuotation(quote.id, {
        title: editTitle.trim() || quote.title,
        description: editInvoiceNotes.trim(),
        line_quantity: qty,
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

  const handleMintPrepaidSlots = async () => {
    if (!quote) return;
    const qty = Math.max(1, parseInt(mintSlotQuantity, 10) || 1);
    const alreadyUsed = Math.max(0, parseInt(mintAlreadyUsed, 10) || 0);
    if (alreadyUsed > qty) {
      toast.error("Already used cannot be greater than total examinations on the invoice");
      return;
    }
    setMintingSlots(true);
    try {
      const summary = await mintPrepaidSlotsForQuotation(quote.id, {
        line_quantity: qty,
        already_consumed: alreadyUsed,
      });
      setPrepaidSummary(summary);
      await reload();
      toast.success(
        `Examination slots ready — ${summary.available} available, ${summary.consumed} marked used for this client`,
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create examination slots");
    } finally {
      setMintingSlots(false);
    }
  };

  const [confirmRevoke, setConfirmRevoke] = React.useState(false);
  const [revokingSlot, setRevokingSlot] = React.useState(false);

  const handleRevokeSlot = async () => {
    if (!quote) return;
    setRevokingSlot(true);
    try {
      await revokeQuotationSlot(quote.id);
      setConfirmRevoke(false);
      await reload();
      toast.success("1 slot revoked; invoice repriced for one examination less");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to revoke slot");
    } finally {
      setRevokingSlot(false);
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

  const prepaidSlotsLocked =
    quote.prepaid_slots_minted || (invoicePrepaidStats?.total ?? 0) > 0;
  // Corporate bulk invoices can get their slots before payment.
  const isCorporateQuote = ["corporate", "law firm"].includes(
    (quote.client?.client_type ?? "").trim().toLowerCase(),
  );
  const fullyPaid = isInvoiceFullyPaid(total, paid);

  const fieldLabel = "text-[10px] font-black uppercase tracking-widest text-muted-foreground";
  const showSlots = (prepaidSlotsLocked || isCorporateQuote || (quote.status === "Completed" && balance <= 0)) &&
    !quote.appointment_id &&
    can("appointment:manage");
  const canEditPricing = quote.status !== "Completed" && can("appointment:manage");
  const examCount = quote.line_quantity && quote.line_quantity > 0 ? quote.line_quantity : 1;

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20 px-4 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/payments" />} className="rounded-full shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">
                {formatInvoiceDisplayNumber(quote.code, quote.id)}
              </h1>
              {quote.code && formatInvoiceDisplayNumber(quote.code, quote.id) !== quote.code ? (
                <span className="text-xs text-muted-foreground font-normal">({quote.code})</span>
              ) : null}
              <Badge variant="outline">{quote.status}</Badge>
              {fullyPaid ? <InvoicePaidStamp size="sm" className="opacity-50" /> : null}
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {quote.client?.name || `Client #${quote.client_id}`}
              {quote.sent_at ? ` · Emailed ${new Date(quote.sent_at).toLocaleDateString()}` : ""}
            </p>
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

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className={fieldLabel}>Total</p>
            <p className="mt-1 text-lg font-bold tabular-nums">{formatMoney(total, currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className={fieldLabel}>Paid</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {formatMoney(paid, currency)}
            </p>
          </CardContent>
        </Card>
        <Card className={balance > 0 ? "border-amber-500/30 bg-amber-500/5" : "border-border/50"}>
          <CardContent className="p-4">
            <p className={fieldLabel}>Balance due</p>
            <p className="mt-1 text-lg font-black tabular-nums">{formatMoney(balance, currency)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className={fieldLabel}>{quote.appointment_id ? "Linked booking" : "Examinations"}</p>
            <p className="mt-1 text-lg font-bold tabular-nums">
              {quote.appointment_id ? "1 session" : examCount}
            </p>
            {!quote.appointment_id && prepaidSlotsLocked && invoicePrepaidStats ? (
              <p className="text-xs text-muted-foreground">
                {invoicePrepaidStats.available} free · {invoicePrepaidStats.consumed} used
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {canEditPricing ? <TabsTrigger value="pricing">Edit pricing</TabsTrigger> : null}
          <TabsTrigger value="email">Send email</TabsTrigger>
          <TabsTrigger value="history">
            Payment history{paymentHistory.length > 0 ? ` (${paymentHistory.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Overview: what you do most — record payment, slots, next steps */}
        <TabsContent value="overview" className="outline-none">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3 space-y-6">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Record payment</CardTitle>
                  <CardDescription>Bank transfer, cash, or any payment received outside the pay link.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
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
                  {quote.stripe_checkout_session_id && balance > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void handleSyncStripe()}
                      disabled={syncingStripe}
                    >
                      {syncingStripe ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <RefreshCw className="h-4 w-4 mr-2" />
                      )}
                      Client paid online? Sync card payment
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              {showSlots ? (
                <Card className={prepaidSlotsLocked ? "border-border/50" : "border-emerald-500/30 bg-emerald-500/5"}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Examination slots</CardTitle>
                    <CardDescription>
                      {prepaidSlotsLocked
                        ? "Staff book exams from the calendar against these slots."
                        : "This invoice has no slots yet. Create them so exams can be booked against it."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {prepaidSlotsLocked ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: "Free", value: invoicePrepaidStats?.available },
                            { label: "Used", value: invoicePrepaidStats?.consumed },
                            { label: "Total", value: invoicePrepaidStats?.total ?? examCount },
                          ].map((s) => (
                            <div key={s.label} className="rounded-xl bg-muted/30 py-2">
                              <p className="text-lg font-bold tabular-nums">{s.value ?? "—"}</p>
                              <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</p>
                            </div>
                          ))}
                        </div>
                        {balance > 0 ? (
                          <p className="text-xs text-amber-700 dark:text-amber-400">
                            Not fully paid yet: booked exams show unpaid (or partial) until it is.
                          </p>
                        ) : null}
                        {(invoicePrepaidStats?.available ?? 0) > 0 && (invoicePrepaidStats?.total ?? 0) > 1 ? (
                          confirmRevoke ? (
                            <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3">
                              <p className="text-xs">
                                Remove 1 unused slot? The invoice drops to {(invoicePrepaidStats?.total ?? 1) - 1}{" "}
                                examination{(invoicePrepaidStats?.total ?? 1) - 1 === 1 ? "" : "s"} and is repriced at
                                the same unit price.
                              </p>
                              <div className="flex gap-2">
                                <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmRevoke(false)} disabled={revokingSlot}>
                                  Keep
                                </Button>
                                <Button size="sm" variant="destructive" className="flex-1" onClick={() => void handleRevokeSlot()} disabled={revokingSlot}>
                                  {revokingSlot && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                                  Revoke slot
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmRevoke(true)}>
                              Revoke 1 unused slot
                            </Button>
                          )
                        ) : null}
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-1.5">
                            <Label className={fieldLabel}>Examinations</Label>
                            <Input
                              type="number"
                              min={1}
                              step={1}
                              className="h-11 rounded-xl"
                              value={mintSlotQuantity}
                              onChange={(e) => setMintSlotQuantity(e.target.value)}
                            />
                          </div>
                          <div className="grid gap-1.5">
                            <Label className={fieldLabel}>Already done</Label>
                            <Input
                              type="number"
                              min={0}
                              step={1}
                              className="h-11 rounded-xl"
                              value={mintAlreadyUsed}
                              onChange={(e) => setMintAlreadyUsed(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button className="w-full rounded-xl" onClick={() => void handleMintPrepaidSlots()} disabled={mintingSlots}>
                          {mintingSlots ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                          Create{" "}
                          {Math.max(0, (parseInt(mintSlotQuantity, 10) || 0) - (parseInt(mintAlreadyUsed, 10) || 0))} free
                          slots
                        </Button>
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              {(!["Approved", "Completed"].includes(quote.status) ||
                (can("appointment:create") &&
                  !quote.prepaid_slots_minted &&
                  !((quote.line_quantity ?? 1) > 1 && quote.status === "Completed" && !quote.appointment_id))) ? (
                <div className="flex flex-wrap gap-2">
                  {!["Approved", "Completed"].includes(quote.status) && (
                    <Button variant="outline" className="rounded-xl" onClick={() => void handleApprove()} disabled={approving}>
                      {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve quotation
                    </Button>
                  )}
                  {can("appointment:create") &&
                    !quote.prepaid_slots_minted &&
                    !((quote.line_quantity ?? 1) > 1 && quote.status === "Completed" && !quote.appointment_id) && (
                      <Button
                        variant="secondary"
                        className="rounded-xl"
                        onClick={() => router.push(`/dashboard/calendar/book?clientId=${quote.client_id}&quotationId=${quote.id}`)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Convert to booking
                      </Button>
                    )}
                </div>
              ) : null}
            </div>

            <div className="lg:col-span-2 space-y-6">
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {displaySubtotal > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="tabular-nums">{formatMoney(displaySubtotal, currency)}</span>
                    </div>
                  ) : null}
                  {displayDiscount > 0 ? (
                    <div className="flex justify-between text-rose-600">
                      <span>Discount</span>
                      <span className="tabular-nums">-{formatMoney(displayDiscount, currency)}</span>
                    </div>
                  ) : null}
                  {displayVat > 0 ? (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">VAT ({displayVatRate}%)</span>
                      <span className="tabular-nums">{formatMoney(displayVat, currency)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between border-t border-border/40 pt-2 font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{formatMoney(total, currency)}</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Landmark className="h-4 w-4 text-primary" />
                      Bank details
                    </CardTitle>
                    {can("appointment:manage") && !editingBanks ? (
                      <Button variant="ghost" size="sm" className="h-7 rounded-lg" onClick={startEditingBanks}>
                        Change
                      </Button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {editingBanks ? (
                    <>
                      <BankAccountPicker accounts={bankAccounts} currency={currency} value={bankSelection} onChange={setBankSelection} />
                      <div className="flex gap-2">
                        <Button className="rounded-xl" onClick={() => void handleSaveBanks()} disabled={savingBanks}>
                          {savingBanks ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="outline" className="rounded-xl" onClick={() => setEditingBanks(false)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : quote.bank_accounts?.length ? (
                    quote.bank_accounts.map((d, idx) => (
                      <dl key={idx} className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
                        <dt className="text-muted-foreground">Bank</dt>
                        <dd className="font-semibold">
                          {d.bank_name} · {d.currency}
                        </dd>
                        <dt className="text-muted-foreground">Name</dt>
                        <dd className="wrap-break-word">{d.account_name}</dd>
                        {d.account_number ? (
                          <>
                            <dt className="text-muted-foreground">Acc. no.</dt>
                            <dd className="font-mono">{d.account_number}</dd>
                          </>
                        ) : null}
                        {d.iban ? (
                          <>
                            <dt className="text-muted-foreground">IBAN</dt>
                            <dd className="font-mono break-all">{d.iban}</dd>
                          </>
                        ) : null}
                        {d.swift_code ? (
                          <>
                            <dt className="text-muted-foreground">SWIFT</dt>
                            <dd className="font-mono">{d.swift_code}</dd>
                          </>
                        ) : null}
                      </dl>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">None. This invoice shows card payment only.</p>
                  )}
                </CardContent>
              </Card>

              {can("payment:manage") && (
                <DeleteConfirmDialog
                  title={`Delete ${quote.code}`}
                  description="This permanently removes this invoice from billing. The linked appointment (if any) is kept."
                  confirmLabel="Confirmation"
                  triggerLabel="Delete Invoice"
                  onConfirm={async () => {
                    await deleteInvoice({ quotationId: quote.id, appointmentId: quote.appointment_id });
                    toast.success("Invoice deleted");
                    router.push("/dashboard/payments");
                  }}
                />
              )}
            </div>
          </div>
        </TabsContent>

        {/* Edit pricing */}
        {canEditPricing ? (
          <TabsContent value="pricing" className="outline-none">
            <Card className="border-border/50 max-w-2xl">
              <CardHeader>
                <CardTitle className="text-base">Edit pricing</CardTitle>
                <CardDescription>Adjust lines, discount and VAT before sending.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>Title</Label>
                  <Input className="h-11 rounded-xl" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Qty</Label>
                    <Input type="number" min={1} step={1} className="h-11 rounded-xl" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Unit price</Label>
                    <Input type="number" min={0} step="0.01" className="h-11 rounded-xl" value={editUnitPrice} onChange={(e) => setEditUnitPrice(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Subtotal</Label>
                    <Input type="number" readOnly className="h-11 rounded-xl bg-muted/40" value={editSubtotal} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Discount</Label>
                    <Input type="number" min={0} step="0.01" className="h-11 rounded-xl" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-3 h-11">
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox checked={editIncludeVat} onCheckedChange={(c) => setEditIncludeVat(Boolean(c))} />
                      VAT
                    </label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      className="h-10 w-20 rounded-xl"
                      disabled={!editIncludeVat}
                      value={editVatRate}
                      onChange={(e) => setEditVatRate(e.target.value)}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>Invoice notes (PDF)</Label>
                  <Textarea
                    rows={3}
                    className="rounded-xl text-sm"
                    placeholder={"A 100% payment is required to confirm the booking.\nPartner pricing"}
                    value={editInvoiceNotes}
                    onChange={(e) => setEditInvoiceNotes(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">One bullet per line. Billing address and TRN come from the client&apos;s Account Details.</p>
                </div>
                {pricingPreview ? (
                  <div className="rounded-xl bg-muted/30 p-3 text-sm space-y-1">
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
                      <span>New invoice total</span>
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
          </TabsContent>
        ) : null}

        {/* Send email */}
        <TabsContent value="email" className="outline-none">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" />
                Send invoice email
              </CardTitle>
              <CardDescription>Sends the PDF and a secure pay link for the amount below.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>To</Label>
                  <Input type="email" className="h-11 rounded-xl" value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>Subject</Label>
                  <Input className="h-11 rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>Amount to request</Label>
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
                  <p className="text-xs text-muted-foreground">A deposit (e.g. 30%) or the full balance.</p>
                </div>
                {balance > 0 ? (
                  <div className="rounded-xl border border-border/40 p-3 space-y-2">
                    <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                      <Checkbox checked={passProcessingFee} onCheckedChange={(checked) => setPassProcessingFee(Boolean(checked))} />
                      Customer pays card fee
                    </label>
                    {passProcessingFee ? (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <Input
                            type="number"
                            min={0}
                            step="0.1"
                            aria-label="Fee percent"
                            placeholder={`${orgSettings?.stripe_card_fee_percent ?? 2.9} %`}
                            className="h-9 rounded-lg"
                            value={feePercentOverride}
                            onChange={(e) => setFeePercentOverride(e.target.value)}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label="Fixed fee"
                            placeholder={`${orgSettings?.stripe_card_fee_fixed ?? 1} ${currency}`}
                            className="h-9 rounded-lg"
                            value={feeFixedOverride}
                            onChange={(e) => setFeeFixedOverride(e.target.value)}
                          />
                        </div>
                        {feePreview && feePreview.fee > 0 ? (
                          <p className="text-xs text-muted-foreground">
                            Fee {formatMoney(feePreview.fee, currency)} · customer pays{" "}
                            <span className="font-bold text-foreground">{formatMoney(feePreview.gross, currency)}</span> · you
                            receive {formatMoney(chargeNet, currency)}
                          </p>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-1.5">
                <Label className={fieldLabel}>Message</Label>
                <Textarea className="min-h-70 rounded-xl" value={body} onChange={(e) => setBody(e.target.value)} />
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
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="history" className="outline-none">
          <Card className="border-border/50 max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Payment history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {paid > 0
                    ? "No per-payment timestamps yet (older payments). New card and manual payments will appear here."
                    : "No payments recorded yet."}
                </p>
              ) : (
                <ul className="divide-y divide-border/40">
                  {paymentHistory.map((entry, idx) => {
                    const when = new Date(entry.paid_at);
                    const label = entry.method === "stripe" ? "Card online" : "Manual";
                    const customerPaid =
                      entry.total_charged && entry.total_charged > 0
                        ? entry.total_charged
                        : entry.amount + (entry.processing_fee || 0);
                    return (
                      <li key={`${entry.paid_at}-${idx}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <div>
                          <p className="font-medium">{when.toLocaleString()}</p>
                          <p className="text-xs text-muted-foreground">
                            {label}
                            {entry.processing_fee && entry.processing_fee > 0
                              ? ` · customer paid ${formatMoney(customerPaid, currency)} incl. fee`
                              : ""}
                          </p>
                        </div>
                        <span className="font-semibold tabular-nums">{formatMoney(entry.amount, currency)}</span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
