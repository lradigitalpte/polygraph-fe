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
  Link2,
  FileSignature,
  Check,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAgreementTemplates,
  fetchClientAgreementRequests,
  isAgreementRequestOpen,
  sendClientAgreements,
  type AgreementTemplate,
} from "@/lib/agreements";
import { isOrganizationClient } from "@/lib/client-types";
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
  createQuotationPayLink,
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
  const canSendTerms = can("agreement:send");

  const [quote, setQuote] = React.useState<QuotationRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [orgSettings, setOrgSettings] = React.useState<OrganizationSettings | null>(null);

  // Agreements signing link already open for this booking (reused rather than re-sent).
  const [openTerms, setOpenTerms] = React.useState<{ link: string; titles: string[] } | null>(null);
  const [includeTerms, setIncludeTerms] = React.useState(false);
  const [termTemplates, setTermTemplates] = React.useState<AgreementTemplate[]>([]);
  const [termSelection, setTermSelection] = React.useState<Record<number, boolean>>({});
  const [termsBusy, setTermsBusy] = React.useState(false);
  const [payLinkBusy, setPayLinkBusy] = React.useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = React.useState(false);
  const [confirmRecord, setConfirmRecord] = React.useState(false);
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
        let terms: { link: string; titles: string[] } | null = null;
        if (q.client_id) {
          try {
            const reqs = await fetchClientAgreementRequests(q.client_id);
            // Newest open link for this booking (or, with no booking, one not tied to any),
            // so a reload reuses it instead of creating a duplicate.
            const open = reqs.find(
              (r) =>
                (r.appointment_id ?? null) === (q.appointment_id ?? null) &&
                isAgreementRequestOpen(r) &&
                Boolean(r.link),
            );
            if (open?.link) terms = { link: open.link, titles: open.items.map((i) => i.title) };
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
        setOpenTerms(terms);
        setIncludeTerms(Boolean(terms));
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
            includeAgreements: Boolean(terms),
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
        includeAgreements: includeTerms,
        bankAccounts: banks,
      }),
    );
  };

  React.useEffect(() => {
    if (!quote) return;
    rebuildBody(chargeAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuild when fee toggle or inputs change
  }, [quote?.id, chargeAmount, passProcessingFee, effectiveFeePercent, effectiveFeeFixed, total, paid, balance, includeTerms]);

  // Active agreements to choose from, loaded once the client is known to sign online.
  const termsAvailable = Boolean(quote?.client_id) && canSendTerms && !isOrganizationClient(billingClient);
  React.useEffect(() => {
    if (!termsAvailable) return;
    let cancelled = false;
    fetchAgreementTemplates()
      .then((rows) => {
        if (cancelled) return;
        setTermTemplates(rows);
        setTermSelection(Object.fromEntries(rows.map((t) => [t.id, true])));
      })
      .catch(() => {
        if (!cancelled) setTermTemplates([]);
      });
    return () => {
      cancelled = true;
    };
  }, [termsAvailable]);
  const chosenTerms = termTemplates.filter((t) => termSelection[t.id]);

  /** The client's signing link: the one already open for this booking, or a new one made without its own email. */
  const ensureTermsLink = async (): Promise<string> => {
    if (openTerms?.link) return openTerms.link;
    if (!quote?.client_id) throw new Error("This invoice has no client to send agreements to");
    if (chosenTerms.length === 0) throw new Error("Choose at least one agreement");
    const res = await sendClientAgreements(quote.client_id, {
      appointment_id: quote.appointment_id ?? undefined,
      template_ids: chosenTerms.map((t) => t.id),
      recipient_email: toEmail.trim() || undefined,
      recipient_name: quote.client?.name || undefined,
      skip_email: true,
    });
    const next = { link: res.link, titles: chosenTerms.map((t) => t.title) };
    setOpenTerms(next);
    return next.link;
  };

  const copyText = async (text: string, done: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(done);
    } catch {
      toast.error("Could not copy. Link: " + text);
    }
  };

  const handleCopyTermsLink = async () => {
    setTermsBusy(true);
    try {
      const link = await ensureTermsLink();
      await copyText(link, "Agreements link copied — no email was sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the agreements link");
    } finally {
      setTermsBusy(false);
    }
  };

  /** Validates the amount box; returns the amount to request or null after showing why not. */
  const requestedCharge = (): number | null => {
    let charge = balance;
    if (chargeAmount.trim() !== "") {
      charge = Number(chargeAmount);
      if (!Number.isFinite(charge) || charge <= 0) {
        toast.error("Enter a valid amount greater than zero");
        return null;
      }
      if (charge > balance + 0.0001) {
        toast.error("The amount cannot be more than the remaining balance");
        return null;
      }
    }
    return charge;
  };

  const payLinkInput = (charge: number) => ({
    charge_amount: charge,
    pass_processing_fee: passProcessingFee,
    ...(feePercentOverride.trim() !== "" ? { processing_fee_percent: Number(feePercentOverride) } : {}),
    ...(feeFixedOverride.trim() !== "" ? { processing_fee_fixed: Number(feeFixedOverride) } : {}),
    customer_email: toEmail.trim() || undefined,
  });

  /** Makes a pay link for the amount and fee settings above and copies it. No email. */
  const handleCreatePayLink = async () => {
    if (!quote) return;
    const charge = requestedCharge();
    if (charge == null) return;
    setPayLinkBusy(true);
    try {
      const res = await createQuotationPayLink(quote.id, payLinkInput(charge));
      await reload();
      await copyText(res.pay_url, `Payment link for ${formatMoney(res.charge_amount, currency)} copied — no email was sent`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the payment link");
    } finally {
      setPayLinkBusy(false);
    }
  };

  const requestSend = () => {
    if (!quote) return;
    if (!toEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    if (balance > 0 && requestedCharge() == null) return;
    if (includeTerms && !openTerms && chosenTerms.length === 0) {
      toast.error("Choose at least one agreement, or untick “Add agreements to sign”");
      return;
    }
    setConfirmSendOpen(true);
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
      const agreementUrl = includeTerms && termsAvailable ? await ensureTermsLink() : undefined;
      const result = await sendQuotationEmail(quote.id, {
        to_email: toEmail.trim(),
        subject: subject.trim(),
        body: body.trim(),
        ...(agreementUrl ? { agreement_url: agreementUrl } : {}),
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
      setConfirmSendOpen(false);
      await reload();
      const parts = ["PDF", result?.payment_url ? "payment link" : "", agreementUrl ? "agreements link" : ""].filter(Boolean);
      toast.success(`Invoice emailed with ${parts.join(", ").replace(/, ([^,]*)$/, " and $1")}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const handleCopyLink = async () => {
    const url = quote?.pay_link_url;
    if (url) {
      await copyText(url, "Payment link copied");
      return;
    }
    await handleCreatePayLink();
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

  // After a payment, the amount boxes follow the new balance instead of showing the old one.
  const lastBalance = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!quote) return;
    if (lastBalance.current != null && lastBalance.current !== balance) {
      setPaymentAmount(String(balance));
      setChargeAmount(String(balance));
    }
    lastBalance.current = balance;
  }, [quote, balance]);

  const handleRecordPayment = async () => {
    if (!quote) return;
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (amount > balance + 0.0001) {
      toast.error(`That's more than the balance of ${formatMoney(balance, currency)}`);
      return;
    }
    setConfirmRecord(false);
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

  const fieldLabel = "px-1 text-[13px] font-medium text-foreground";
  const card = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
  const field = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
  const pill = "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors";
  const recordAmount = Number(paymentAmount);
  const recordValid = Number.isFinite(recordAmount) && recordAmount > 0 && recordAmount <= balance + 0.0001;
  const showSlots = (prepaidSlotsLocked || isCorporateQuote || (quote.status === "Completed" && balance <= 0)) &&
    !quote.appointment_id &&
    can("appointment:manage");
  const canEditPricing = quote.status !== "Completed" && can("appointment:manage");
  const examCount = quote.line_quantity && quote.line_quantity > 0 ? quote.line_quantity : 1;

  return (
    <div className="space-y-8 max-w-[1440px] mx-auto pb-20 px-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <Button variant="ghost" size="icon" render={<Link href="/dashboard/payments" />} className="rounded-full shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-4xl leading-none font-semibold tracking-[-0.035em] sm:text-5xl">
                {formatInvoiceDisplayNumber(quote.code, quote.id)}
              </h1>
              {quote.code && formatInvoiceDisplayNumber(quote.code, quote.id) !== quote.code ? (
                <span className="text-xs text-muted-foreground font-normal">({quote.code})</span>
              ) : null}
              <span className="bg-primary/15 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium text-[oklch(0.42_0.12_39)] dark:text-primary"><span aria-hidden="true" className="bg-primary size-1.5 rounded-full" />{quote.status}</span>
              {fullyPaid ? <InvoicePaidStamp size="sm" className="opacity-50" /> : null}
            </div>
            <p className="text-muted-foreground mt-2 truncate text-base">
              {quote.client?.name || `Client #${quote.client_id}`}
              {quote.sent_at ? ` · Emailed ${new Date(quote.sent_at).toLocaleDateString()}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-10 rounded-full px-4" onClick={handleDownloadPdf}>
            <Download className="h-4 w-4 mr-2" />
            PDF
          </Button>
          <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => void handleCopyLink()} disabled={payLinkBusy || (!quote.pay_link_url && balance <= 0)}>
            {payLinkBusy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Copy className="h-4 w-4 mr-2" />}
            Copy pay link
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-[30px] bg-[#2B2A27] p-8 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] dark:bg-card dark:ring-1 dark:ring-border">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold tracking-[0.1em] uppercase">Balance due</span>
            <span className="text-[44px] leading-none font-medium tracking-[-0.03em] tabular-nums">
              {formatMoney(balance, currency)}
            </span>
            <span className="text-sm text-[#C9C6BC]">
              {fullyPaid ? "Paid in full" : `${total > 0 ? Math.round((paid / total) * 100) : 0}% collected`}
            </span>
          </div>
          <div className="flex flex-wrap items-end gap-6 sm:gap-8">
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-[#C9C6BC]">Total</span>
              <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(total, currency)}</span>
            </div>
            <span aria-hidden="true" className="hidden h-10 w-px bg-[#4A4944] sm:block" />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-[#C9C6BC]">Paid</span>
              <span className="text-primary text-2xl font-medium tracking-[-0.02em] tabular-nums">{formatMoney(paid, currency)}</span>
            </div>
            <span aria-hidden="true" className="hidden h-10 w-px bg-[#4A4944] sm:block" />
            <div className="flex flex-col gap-1">
              <span className="text-[13px] text-[#C9C6BC]">{quote.appointment_id ? "Linked booking" : "Examinations"}</span>
              <span className="text-2xl font-medium tracking-[-0.02em] tabular-nums">
                {quote.appointment_id ? "1 session" : examCount}
              </span>
              {!quote.appointment_id && prepaidSlotsLocked && invoicePrepaidStats ? (
                <span className="text-xs text-[#C9C6BC]">
                  {invoicePrepaidStats.available} free · {invoicePrepaidStats.consumed} used
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <div className="mt-7 h-2 w-full overflow-hidden rounded-full bg-white/10">
          <div className="bg-primary h-full rounded-full transition-all" style={{ width: `${total > 0 ? Math.min(100, (paid / total) * 100) : 0}%` }} />
        </div>
      </div>
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none bg-transparent p-0">
          <TabsTrigger value="overview" className="h-9 rounded-full border bg-card px-3.5 text-[13px] data-[active]:border-transparent data-[active]:bg-[#30302E] data-[active]:font-semibold data-[active]:text-[#FAF9F5] data-[active]:shadow-none dark:data-[active]:bg-foreground dark:data-[active]:text-background">Overview</TabsTrigger>
          {canEditPricing ? <TabsTrigger value="pricing" className="h-9 rounded-full border bg-card px-3.5 text-[13px] data-[active]:border-transparent data-[active]:bg-[#30302E] data-[active]:font-semibold data-[active]:text-[#FAF9F5] data-[active]:shadow-none dark:data-[active]:bg-foreground dark:data-[active]:text-background">Edit pricing</TabsTrigger> : null}
          <TabsTrigger value="email" className="h-9 rounded-full border bg-card px-3.5 text-[13px] data-[active]:border-transparent data-[active]:bg-[#30302E] data-[active]:font-semibold data-[active]:text-[#FAF9F5] data-[active]:shadow-none dark:data-[active]:bg-foreground dark:data-[active]:text-background">Send email</TabsTrigger>
          <TabsTrigger value="history" className="h-9 rounded-full border bg-card px-3.5 text-[13px] data-[active]:border-transparent data-[active]:bg-[#30302E] data-[active]:font-semibold data-[active]:text-[#FAF9F5] data-[active]:shadow-none dark:data-[active]:bg-foreground dark:data-[active]:text-background">
            Payment history{paymentHistory.length > 0 ? ` (${paymentHistory.length})` : ""}
          </TabsTrigger>
        </TabsList>

        {/* Overview: what you do most — record payment, slots, next steps */}
        <TabsContent value="overview" className="outline-none">
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="space-y-6 lg:col-span-3">
              {/* Record payment */}
              <section aria-labelledby="record-title" className={cn(card, "overflow-hidden")}>
                <div className="flex items-start gap-3 px-6 pt-6 pb-4">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                    <DollarSign aria-hidden="true" className="size-[18px]" />
                  </span>
                  <div className="min-w-0">
                    <h2 id="record-title" className="text-[15px] font-medium">Record payment</h2>
                    <p className="text-[13px] text-muted-foreground">Bank transfer, cash, or anything received outside the pay link.</p>
                  </div>
                </div>
                {balance <= 0 ? (
                  <div className="mx-6 mb-6 flex items-center gap-3 rounded-2xl bg-[#E7F1E4] px-4 py-3.5 text-sm text-[#2D5A27] dark:bg-emerald-950/60 dark:text-emerald-200">
                    <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
                    <span className="font-medium">Paid in full — nothing left to record.</span>
                  </div>
                ) : (
                  <div className="space-y-3 px-6 pb-6">
                    <div className="relative">
                      <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-sm font-medium text-muted-foreground">{currency}</span>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        inputMode="decimal"
                        aria-label="Amount received"
                        className="h-14 rounded-2xl border-0 bg-[#F3F1EA] pr-4 pl-16 text-xl font-medium tabular-nums shadow-none dark:bg-muted"
                        value={paymentAmount}
                        onChange={(e) => {
                          setPaymentAmount(e.target.value);
                          setConfirmRecord(false);
                        }}
                      />
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: "Full balance", value: balance },
                        ...(balance >= 2 ? [{ label: "Half", value: wholeMoneyAmount(balance / 2) }] : []),
                      ].map((chip) => {
                        const active = Number(paymentAmount) === chip.value;
                        return (
                          <button
                            key={chip.label}
                            type="button"
                            aria-pressed={active}
                            onClick={() => {
                              setPaymentAmount(String(chip.value));
                              setConfirmRecord(false);
                            }}
                            className={cn(
                              pill,
                              active
                                ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background"
                                : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                            )}
                          >
                            {chip.label} · <span className="tabular-nums">{formatMoney(chip.value, currency)}</span>
                          </button>
                        );
                      })}
                    </div>
                    {paymentAmount.trim() !== "" && Number(paymentAmount) > balance + 0.0001 ? (
                      <p role="alert" className="px-1 text-[13px] text-destructive">That&apos;s more than the balance of {formatMoney(balance, currency)}.</p>
                    ) : null}

                    {confirmRecord ? (
                      <div className="space-y-3 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/50">
                        <p className="text-sm">
                          Record <span className="font-semibold tabular-nums">{formatMoney(recordAmount, currency)}</span> as received?
                          {" "}
                          {recordAmount + 0.0001 >= balance
                            ? "This settles the invoice."
                            : `${formatMoney(balance - recordAmount, currency)} will still be due.`}
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" className="h-10 flex-1 rounded-full" onClick={() => setConfirmRecord(false)} disabled={recording}>
                            Cancel
                          </Button>
                          <Button className="h-10 flex-1 rounded-full" onClick={() => void handleRecordPayment()} disabled={recording}>
                            {recording ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="mr-1.5 h-4 w-4" />}
                            Yes, record it
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button className="h-11 w-full rounded-full" onClick={() => setConfirmRecord(true)} disabled={recording || !recordValid}>
                        Record payment
                      </Button>
                    )}

                    {quote.stripe_checkout_session_id ? (
                      <button
                        type="button"
                        onClick={() => void handleSyncStripe()}
                        disabled={syncingStripe}
                        className="flex items-center gap-1.5 px-1 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {syncingStripe ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Client paid online but it&apos;s not showing? Check the card payment
                      </button>
                    ) : null}
                  </div>
                )}
              </section>

              {showSlots ? (
                <Card className={cn(card, "border-0", !prepaidSlotsLocked && "ring-[#5FA86C]/50")}>
                  <CardHeader className="px-7 pt-7 pb-4">
                    <CardTitle className="text-base font-semibold">Examination slots</CardTitle>
                    <CardDescription>
                      {prepaidSlotsLocked
                        ? "Staff book exams from the calendar against these slots."
                        : "This invoice has no slots yet. Create them so exams can be booked against it."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 px-7 pb-7">
                    {prepaidSlotsLocked ? (
                      <>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[
                            { label: "Free", value: invoicePrepaidStats?.available },
                            { label: "Used", value: invoicePrepaidStats?.consumed },
                            { label: "Total", value: invoicePrepaidStats?.total ?? examCount },
                          ].map((s) => (
                            <div key={s.label} className="rounded-2xl bg-[#F7F6F1] py-3 dark:bg-muted/50">
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
                              className={field}
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
                              className={field}
                              value={mintAlreadyUsed}
                              onChange={(e) => setMintAlreadyUsed(e.target.value)}
                            />
                          </div>
                        </div>
                        <Button className="h-11 w-full rounded-full" onClick={() => void handleMintPrepaidSlots()} disabled={mintingSlots}>
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
                  !(isCorporateQuote && (quote.line_quantity ?? 1) > 1) &&
                  !((quote.line_quantity ?? 1) > 1 && quote.status === "Completed" && !quote.appointment_id))) ? (
                <div className="flex flex-wrap gap-2">
                  {!["Approved", "Completed"].includes(quote.status) && (
                    <Button variant="outline" className="h-10 rounded-full px-4" onClick={() => void handleApprove()} disabled={approving}>
                      {approving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                      Approve quotation
                    </Button>
                  )}
                  {can("appointment:create") &&
                    !quote.prepaid_slots_minted &&
                    !(isCorporateQuote && (quote.line_quantity ?? 1) > 1) &&
                    !((quote.line_quantity ?? 1) > 1 && quote.status === "Completed" && !quote.appointment_id) && (
                      <Button
                        variant="secondary"
                        className="h-10 rounded-full px-4"
                        onClick={() => router.push(`/dashboard/calendar/book?clientId=${quote.client_id}&quotationId=${quote.id}`)}
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Convert to booking
                      </Button>
                    )}
                </div>
              ) : null}
            </div>

            <div className="space-y-6 lg:col-span-2">
              {/* Breakdown */}
              <section aria-labelledby="breakdown-title" className={cn(card, "p-6")}>
                <h2 id="breakdown-title" className="text-[15px] font-medium">Breakdown</h2>
                <dl className="mt-4 space-y-2.5 text-sm">
                  {displaySubtotal > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">Subtotal{examCount > 1 ? ` · ${examCount} exams` : ""}</dt>
                      <dd className="tabular-nums">{formatMoney(displaySubtotal, currency)}</dd>
                    </div>
                  ) : null}
                  {displayDiscount > 0 ? (
                    <div className="flex justify-between gap-3 text-[#2D5A27] dark:text-emerald-300">
                      <dt>Discount</dt>
                      <dd className="tabular-nums">−{formatMoney(displayDiscount, currency)}</dd>
                    </div>
                  ) : null}
                  {displayVat > 0 ? (
                    <div className="flex justify-between gap-3">
                      <dt className="text-muted-foreground">VAT ({displayVatRate}%)</dt>
                      <dd className="tabular-nums">{formatMoney(displayVat, currency)}</dd>
                    </div>
                  ) : null}
                  <div className="flex justify-between gap-3 rounded-2xl bg-[#F7F6F1] px-4 py-3 font-semibold dark:bg-muted/50">
                    <dt>Total</dt>
                    <dd className="tabular-nums">{formatMoney(total, currency)}</dd>
                  </div>
                  {paid > 0 ? (
                    <div className="flex justify-between gap-3 px-4">
                      <dt className="text-muted-foreground">Paid</dt>
                      <dd className="text-[#2D5A27] tabular-nums dark:text-emerald-300">−{formatMoney(paid, currency)}</dd>
                    </div>
                  ) : null}
                  {paid > 0 ? (
                    <div className="flex justify-between gap-3 px-4 font-semibold">
                      <dt>Balance due</dt>
                      <dd className="tabular-nums">{formatMoney(balance, currency)}</dd>
                    </div>
                  ) : null}
                </dl>
              </section>

              {/* Bank details */}
              <section aria-labelledby="bank-title" className={cn(card, "p-6")}>
                <div className="flex items-center justify-between gap-3">
                  <h2 id="bank-title" className="flex items-center gap-2 text-[15px] font-medium">
                    <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
                    Bank details
                  </h2>
                  {can("appointment:manage") && !editingBanks ? (
                    <button type="button" onClick={startEditingBanks} className={cn(pill, "h-8 text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted")}>
                      Change
                    </button>
                  ) : null}
                </div>
                <div className="mt-4 space-y-4">
                  {editingBanks ? (
                    <>
                      <BankAccountPicker accounts={bankAccounts} currency={currency} value={bankSelection} onChange={setBankSelection} />
                      <div className="flex gap-2">
                        <Button className="rounded-full" onClick={() => void handleSaveBanks()} disabled={savingBanks}>
                          {savingBanks ? "Saving…" : "Save"}
                        </Button>
                        <Button variant="outline" className="rounded-full" onClick={() => setEditingBanks(false)}>
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : quote.bank_accounts?.length ? (
                    quote.bank_accounts.map((d, idx) => (
                      <div key={idx} className="overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/50">
                        <p className="border-b border-border/50 px-4 py-2.5 text-sm font-medium">
                          {d.bank_name} <span className="font-normal text-muted-foreground">· {d.currency}</span>
                        </p>
                        <dl className="divide-y divide-border/50 text-sm">
                          {[
                            { label: "Name", value: d.account_name, mono: false },
                            { label: "Account no.", value: d.account_number, mono: true },
                            { label: "IBAN", value: d.iban, mono: true },
                            { label: "SWIFT", value: d.swift_code, mono: true },
                          ]
                            .filter((row) => row.value)
                            .map((row) => (
                              <div key={row.label} className="group flex items-center gap-3 px-4 py-2.5">
                                <dt className="w-24 shrink-0 text-[13px] text-muted-foreground">{row.label}</dt>
                                <dd className={cn("min-w-0 flex-1 break-all", row.mono && "font-mono text-[13px]")}>{row.value}</dd>
                                <button
                                  type="button"
                                  aria-label={`Copy ${row.label}`}
                                  onClick={() => void copyText(String(row.value), `${row.label} copied`)}
                                  className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:hover:bg-card"
                                >
                                  <Copy aria-hidden="true" className="size-3.5" />
                                </button>
                              </div>
                            ))}
                        </dl>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">None — this invoice shows card payment only.</p>
                  )}
                </div>
              </section>

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
            <Card className="max-w-2xl rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/60 dark:bg-card">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Edit pricing</CardTitle>
                <CardDescription>Adjust lines, discount and VAT before sending.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 px-7 pb-7">
                <div className="grid gap-1.5">
                  <Label className={fieldLabel}>Title</Label>
                  <Input className="h-11 rounded-2xl" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Qty</Label>
                    <Input type="number" min={1} step={1} className="h-11 rounded-2xl" value={editQuantity} onChange={(e) => setEditQuantity(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Unit price</Label>
                    <Input type="number" min={0} step="0.01" className="h-11 rounded-2xl" value={editUnitPrice} onChange={(e) => setEditUnitPrice(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Subtotal</Label>
                    <Input type="number" readOnly className="h-11 rounded-xl bg-muted/40" value={editSubtotal} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div className="grid gap-1.5">
                    <Label className={fieldLabel}>Discount</Label>
                    <Input type="number" min={0} step="0.01" className="h-11 rounded-2xl" value={editDiscount} onChange={(e) => setEditDiscount(e.target.value)} />
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
          <div className="grid gap-6 lg:grid-cols-5">
            {/* What goes out */}
            <section aria-labelledby="send-title" className={cn(card, "space-y-5 p-6 lg:col-span-2")}>
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                  <Mail aria-hidden="true" className="size-[18px]" />
                </span>
                <div className="min-w-0">
                  <h2 id="send-title" className="text-[15px] font-medium">Send or share</h2>
                  <p className="text-[13px] text-muted-foreground">Email the invoice, or copy a link and share it yourself.</p>
                </div>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="send-to" className={fieldLabel}>To</Label>
                <Input id="send-to" type="email" className={field} value={toEmail} onChange={(e) => setToEmail(e.target.value)} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="send-subject" className={fieldLabel}>Subject</Label>
                <Input id="send-subject" className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              {balance > 0 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="send-amount" className={fieldLabel}>Amount to request</Label>
                  <div className="relative">
                    <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-sm font-medium text-muted-foreground">{currency}</span>
                    <Input
                      id="send-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      className={cn(field, "pl-14 tabular-nums")}
                      value={chargeAmount}
                      onChange={(e) => {
                        setChargeAmount(e.target.value);
                        rebuildBody(e.target.value);
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {[
                      { label: "Full", value: balance },
                      ...(balance >= 4 ? [{ label: "50%", value: wholeMoneyAmount(balance / 2) }] : []),
                      ...(balance >= 10 ? [{ label: "30% deposit", value: wholeMoneyAmount(balance * 0.3) }] : []),
                    ].map((chip) => {
                      const active = Number(chargeAmount) === chip.value;
                      return (
                        <button
                          key={chip.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setChargeAmount(String(chip.value));
                            rebuildBody(String(chip.value));
                          }}
                          className={cn(
                            pill,
                            "h-8 px-3",
                            active
                              ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background"
                              : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
                          )}
                        >
                          {chip.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              {balance > 0 ? (
                  <div className="space-y-2 rounded-2xl bg-[#F7F6F1] p-3.5 dark:bg-muted/40">
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
                            className="h-9 rounded-xl border-0 bg-white shadow-none dark:bg-card"
                            value={feePercentOverride}
                            onChange={(e) => setFeePercentOverride(e.target.value)}
                          />
                          <Input
                            type="number"
                            min={0}
                            step="0.01"
                            aria-label="Fixed fee"
                            placeholder={`${orgSettings?.stripe_card_fee_fixed ?? 1} ${currency}`}
                            className="h-9 rounded-xl border-0 bg-white shadow-none dark:bg-card"
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
              {/* Links: pay link and agreements, each usable without sending an email */}
              <div className="divide-y divide-border/50 overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/40">
                {balance > 0 ? (
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-card">
                      <Link2 aria-hidden="true" className="size-[18px]" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">Payment link</p>
                      {quote.pay_link_url ? (
                        <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[13px] text-muted-foreground">
                          <span className="truncate rounded-full bg-white px-2.5 py-0.5 font-mono text-[12px] text-foreground ring-1 ring-border/60 dark:bg-card" title={quote.pay_link_url}>
                            {shortLink(quote.pay_link_url)}
                          </span>
                          {quote.pay_link_amount ? <span className="shrink-0">for {formatMoney(quote.pay_link_amount, currency)}</span> : null}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[13px] text-muted-foreground">Create a short link for the amount above and share it however you like.</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {quote.pay_link_url ? (
                        <Button variant="outline" size="sm" className="h-9 rounded-full" onClick={() => void copyText(quote.pay_link_url!, "Payment link copied")}>
                          <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
                        </Button>
                      ) : null}
                      <Button variant={quote.pay_link_url ? "ghost" : "outline"} size="sm" className="h-9 rounded-full" onClick={() => void handleCreatePayLink()} disabled={payLinkBusy}>
                        {payLinkBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
                        {quote.pay_link_url ? "New link for this amount" : "Create & copy link"}
                      </Button>
                    </div>
                  </div>
                ) : null}

                {termsAvailable ? (
                  <div className="space-y-3 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white dark:bg-card">
                        <FileSignature aria-hidden="true" className="size-[18px]" />
                      </span>
                      <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2.5">
                        <Checkbox className="mt-0.5" checked={includeTerms} onCheckedChange={(checked) => setIncludeTerms(Boolean(checked))} />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium">Add agreements to sign</span>
                          <span className="block text-[13px] text-muted-foreground">
                            {openTerms
                              ? `${quote.appointment_id ? "Uses the link already open for this booking" : "Uses the link you already created"}: ${openTerms.titles.join(" · ")}`
                              : "Adds a “Review & sign agreements” button to the email."}
                          </span>
                        </span>
                      </label>
                      <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-full" onClick={() => void handleCopyTermsLink()} disabled={termsBusy || (!openTerms && chosenTerms.length === 0)}>
                        {termsBusy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
                        Copy agreements link
                      </Button>
                    </div>
                    {!openTerms ? (
                      termTemplates.length === 0 ? (
                        <p className="pl-[52px] text-[13px] text-muted-foreground">No agreements are offered yet. Add them in Settings → Agreements.</p>
                      ) : (
                        <div role="group" aria-label="Agreements to include" className="flex flex-wrap gap-1.5 sm:pl-[52px]">
                          {termTemplates.map((t) => {
                            const on = Boolean(termSelection[t.id]);
                            return (
                              <button
                                key={t.id}
                                type="button"
                                aria-pressed={on}
                                onClick={() => setTermSelection((prev) => ({ ...prev, [t.id]: !on }))}
                                className={
                                  on
                                    ? "flex h-8 items-center gap-1.5 rounded-full bg-[#2B2A27] px-3 text-[13px] font-medium text-[#FAF9F5] dark:bg-foreground dark:text-background"
                                    : "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"
                                }
                              >
                                {on ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
                                {t.title}
                              </button>
                            );
                          })}
                        </div>
                      )
                    ) : null}
                  </div>
                ) : null}
              </div>

            </section>

            {/* The message */}
            <section aria-labelledby="message-title" className={cn(card, "flex flex-col p-6 lg:col-span-3")}>
              <div className="flex items-center justify-between gap-3">
                <h2 id="message-title" className="text-[15px] font-medium">Message</h2>
                <span className="text-[13px] text-muted-foreground">PDF attached automatically</span>
              </div>
              <div className="mt-4 flex flex-1 flex-col overflow-hidden rounded-2xl bg-[#F7F6F1] dark:bg-muted/40">
                <Textarea
                  aria-labelledby="message-title"
                  className="min-h-80 flex-1 resize-y rounded-none border-0 bg-transparent px-5 py-4 text-sm leading-relaxed shadow-none focus-visible:ring-0 dark:bg-transparent"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
                {balance > 0 || (includeTerms && termsAvailable) ? (
                  <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/50 px-5 py-4" aria-label="Buttons in the email">
                    {balance > 0 ? (
                      <span className="rounded-lg bg-[#c0392b] px-4 py-2 text-[13px] font-bold text-white">Pay invoice online</span>
                    ) : null}
                    {includeTerms && termsAvailable ? (
                      <span className="rounded-lg bg-white px-4 py-2 text-[13px] font-bold text-[#1a1a1a] ring-1 ring-[#d4d4d4]">Review &amp; sign agreements</span>
                    ) : null}
                    <span className="w-full text-center text-[11px] text-muted-foreground">Buttons the client sees under your message</span>
                  </div>
                ) : null}
              </div>
              <Button className="mt-4 h-12 w-full rounded-full text-[15px] font-semibold" onClick={requestSend} disabled={sending || !toEmail.trim()}>
                {sending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Review &amp; send email
                  </>
                )}
              </Button>
              <Dialog open={confirmSendOpen} onOpenChange={(next) => !sending && setConfirmSendOpen(next)}>
                <DialogContent className="rounded-2xl">
                  <DialogHeader>
                    <DialogTitle>Send this email now?</DialogTitle>
                    <DialogDescription>Please check the details before the email goes out.</DialogDescription>
                  </DialogHeader>
                  <dl className="grid gap-3 rounded-xl bg-[#F7F6F1] p-4 text-sm dark:bg-muted/50">
                    <div>
                      <dt className="text-xs text-muted-foreground">To</dt>
                      <dd className="font-medium break-all">{toEmail.trim()}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Subject</dt>
                      <dd className="font-medium">{subject.trim() || "(no subject)"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Includes</dt>
                      <dd className="font-medium">
                        Invoice PDF
                        {balance > 0 ? ` · Pay button for ${formatMoney(feePreview?.gross ?? chargeNet, currency)}` : ""}
                        {includeTerms && termsAvailable
                          ? ` · Agreements to sign (${(openTerms?.titles ?? chosenTerms.map((t) => t.title)).join(", ")})`
                          : ""}
                      </dd>
                    </div>
                  </dl>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setConfirmSendOpen(false)} disabled={sending}>
                      Cancel
                    </Button>
                    <Button onClick={() => void handleSend()} disabled={sending}>
                      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
                      {sending ? "Sending…" : "Send email"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </section>
          </div>
        </TabsContent>

        {/* Payment history */}
        <TabsContent value="history" className="outline-none">
          <Card className="max-w-2xl rounded-[28px] border-0 bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/60 dark:bg-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Payment history
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 px-7 pb-7">
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

/** "https://app.polygraph.ae/pay/k3j9xq2mpa" → "app.polygraph.ae/pay/k3j9xq2mpa". */
function shortLink(url: string) {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}
