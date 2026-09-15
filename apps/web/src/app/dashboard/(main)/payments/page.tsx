"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Filter, 
  Download, 
  Plus, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  ChevronLeft,
  Calendar,
  Mail,
  FileText,
  ChevronDown,
  X,
  User,
  ClipboardList,
  Stethoscope,
  Loader2,
  Percent,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { fetchClients, type ClientRecord } from "@/lib/clients";
import {
  approveQuotation,
  collectQuotationPayment,
  createQuotation,
  sendQuotationEmail,
  type QuotationRecord,
} from "@/lib/quotations";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import { collectAppointmentPayment, formatMoney, convertCurrency, catalogPriceInCurrency, ledgerRowMoney } from "@/lib/client-account";
import type { AccountSummary } from "@/lib/client-account";
import { fetchBillingLedger, mapLedgerEntryToInvoice, deleteInvoice, bulkEditInvoicePrices, type FinancialInvoice } from "@/lib/billing";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { fetchOrganizationSettings } from "@/lib/settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Sheet, 
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

// Types for our billing system
type TransactionStatus = "Completed" | "Pending" | "Partial" | "Overdue" | "Sent" | "Approved" | "Draft";

type Invoice = FinancialInvoice & {
  examId?: string;
  sentAt?: string;
};

function pdfLogoUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/logo-print.png`;
  }
  return "/logo-print.png";
}

function pdfDocumentHeader() {
  const logoUrl = pdfLogoUrl();
  return `<div class="brand">
  <img src="${logoUrl}" alt="Polygraph UAE" class="logo-img" />
  <div class="tagline">Forensic Examination &amp; Clinical Assessment</div>
</div>`;
}

function pdfSharedStyles() {
  return `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#e9e9ea}
  body{font-family:'Helvetica Neue',sans-serif;color:#111;padding:24px 0}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 14mm;box-shadow:0 2px 18px rgba(0,0,0,.18);box-sizing:border-box}
  .brand{margin-bottom:32px}
  .logo-img{height:52px;width:auto;object-fit:contain;display:block;margin-bottom:8px}
  .tagline{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.15em;margin-top:2px}
  h1{font-size:38px;font-weight:900;letter-spacing:-0.04em;margin:16px 0 4px}
  .meta{font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.12em}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}
  .field label{font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;color:#aaa;display:block;margin-bottom:4px}
  .field span{font-size:13px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin:32px 0}
  th{font-size:9px;text-transform:uppercase;letter-spacing:0.14em;color:#aaa;border-bottom:1px solid #e5e5e5;padding:8px 0;text-align:left;font-weight:800}
  td{padding:12px 0;font-size:13px;border-bottom:1px solid #f3f3f3;font-weight:600}
  .amount{text-align:right}
  .total-row td{font-weight:900;font-size:15px;border-top:2px solid #000;border-bottom:none;padding-top:16px}
  .badge{display:inline-block;background:#f0f0f0;border-radius:99px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;padding:3px 10px;color:#444}
  .footer{margin-top:64px;font-size:10px;color:#bbb;border-top:1px solid #eee;padding-top:16px}
  @media print{
    @page{size:A4;margin:14mm 12mm}
    html,body{background:#fff}
    body{padding:0}
    .page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}
  }
  `;
}

function resolveInvoiceExamType(inv: Invoice): string {
  const description = inv.items[0]?.description?.trim();
  if (!description) return "";
  const parts = description.split(" — ");
  return parts[0]?.trim() || description;
}

// ---------- shared: open a generated HTML document in a print-ready window ----------
function openPrintWindow(html: string, popupBlockedMessage = "Allow popups to download PDF") {
  const win = window.open("", "_blank");
  if (!win) { toast.error(popupBlockedMessage); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); }, 400);
}

// ---------- shared: DD-MM-YYYY formatter, tolerant of already-formatted date strings ----------
function formatPdfDate(input: string | Date): { display: string; date: Date | null } {
  const d = typeof input === "string" ? new Date(input) : input;
  if (!d || Number.isNaN(d.getTime())) {
    return { display: typeof input === "string" ? input : "—", date: null };
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { display: `${dd}-${mm}-${d.getFullYear()}`, date: d };
}

type QuotationPdfData = {
  code: string;
  issueDate: string;
  currency: string;
  client: { name: string; email?: string; phone?: string; address?: string; taxId?: string };
  examinerName?: string;
  examTypeName?: string;
  items: { description: string; amount: number }[];
  subtotal: number;
  discount?: { label: string; amount: number };
  vat?: { rate: number; amount: number };
  total: number;
  org: { name: string; address?: string; email?: string; phone?: string };
};

// ---------- helper: build the professional, branded quotation PDF markup ----------
function buildQuotationPdfHtml(data: QuotationPdfData): string {
  const logoUrl = pdfLogoUrl();
  const issue = formatPdfDate(data.issueDate);
  const validUntil = issue.date
    ? formatPdfDate(new Date(issue.date.getTime() + 30 * 24 * 60 * 60 * 1000)).display
    : "—";
  const money = (amt: number) => formatMoney(amt, data.currency);
  const showBreakdown = Boolean((data.discount && data.discount.amount > 0) || (data.vat && data.vat.amount > 0));

  const rows = data.items
    .map(
      (item, idx) => `
    <tr>
      <td class="sn">${idx + 1}</td>
      <td class="desc">${item.description}</td>
      <td class="num">1</td>
      <td class="amt">${money(item.amount)}</td>
      <td class="amt">${money(item.amount)}</td>
    </tr>`,
    )
    .join("");

  const notes = [
    data.examTypeName ? `Exam Type: ${data.examTypeName}` : null,
    data.examinerName ? `Examiner: ${data.examinerName}` : null,
    "This quotation is valid for 30 days from the issue date.",
  ].filter(Boolean) as string[];

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="format-detection" content="telephone=no,email=no"/>
<title>${data.code} — Quotation</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{background:#e9e9ea}
  body{font-family:'Helvetica Neue',Arial,sans-serif;color:#2a2a2a;padding:24px 0}
  .page{width:210mm;min-height:297mm;margin:0 auto;background:#fff;padding:16mm 14mm;box-shadow:0 2px 18px rgba(0,0,0,.18)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:28px}
  .brand img{height:52px;width:auto;object-fit:contain;display:block;margin-bottom:10px}
  .brand .org-name{font-size:17px;font-weight:900;color:#111;letter-spacing:-0.01em}
  .brand .line{font-size:10.5px;color:#666;line-height:1.6;margin-top:2px;max-width:280px}
  .header-right{text-align:right}
  .doc-title{font-size:30px;font-weight:900;letter-spacing:-0.02em;color:#111;margin-bottom:12px}
  .meta-table{border-collapse:collapse;margin-left:auto}
  .meta-table td{padding:7px 14px;font-size:10.5px;white-space:nowrap}
  .meta-table td.label{background:#c96442;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;text-align:left}
  .meta-table td.value{background:#f6efeb;font-weight:800;color:#111;text-align:right}
  .addresses{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin:30px 0}
  .box{border:1px solid #e2e2e2;border-radius:8px;padding:16px 18px}
  .box h4{font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:#111;font-weight:900;margin-bottom:8px}
  .box .name{font-weight:800;font-size:13px;margin-bottom:3px}
  .box .line{font-size:11px;color:#555;line-height:1.6}
  table.items{width:100%;border-collapse:collapse;margin:8px 0 28px}
  table.items thead th{background:#c96442;color:#fff;font-size:9.5px;text-transform:uppercase;letter-spacing:0.07em;padding:11px 12px;text-align:left;font-weight:700}
  table.items thead th.num,table.items thead th.amt{text-align:right}
  table.items thead th.sn{text-align:center;width:40px}
  table.items tbody td{padding:11px 12px;font-size:12px;border-bottom:1px solid #f0f0f0}
  table.items tbody td.sn{text-align:center;color:#888}
  table.items tbody td.num{text-align:right;color:#555}
  table.items tbody td.amt{text-align:right;font-weight:700}
  .bottom{display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start}
  .notes ul{list-style:disc;margin-left:16px;font-size:11px;color:#444;line-height:1.8}
  .totals{border:1px solid #e2e2e2;border-radius:8px;overflow:hidden}
  .totals .row{display:flex;justify-content:space-between;gap:12px;padding:11px 16px;font-size:12px;border-bottom:1px solid #f0f0f0}
  .totals .row.discount{color:#c0392b;font-weight:700}
  .totals .row.total{background:#c96442;color:#fff;font-weight:900;font-size:14.5px;border-bottom:none}
  .footer{margin-top:56px;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:14px;text-align:center}
  @media print{
    @page{size:A4;margin:14mm 12mm}
    html,body{background:#fff}
    body{padding:0}
    .page{width:auto;min-height:auto;margin:0;padding:0;box-shadow:none}
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="brand">
      <img src="${logoUrl}" alt="${data.org.name}" />
      <div class="org-name">${data.org.name}</div>
      ${data.org.address ? `<div class="line">${data.org.address}</div>` : ""}
      ${data.org.phone ? `<div class="line">Phone: ${data.org.phone}</div>` : ""}
      ${data.org.email ? `<div class="line">${data.org.email}</div>` : ""}
    </div>
    <div class="header-right">
      <div class="doc-title">Quotation</div>
      <table class="meta-table">
        <tr><td class="label">Quotation No.</td><td class="value">${data.code}</td></tr>
        <tr><td class="label">Date</td><td class="value">${issue.display}</td></tr>
        <tr><td class="label">Amount</td><td class="value">${money(data.total)}</td></tr>
        <tr><td class="label">Valid until</td><td class="value">${validUntil}</td></tr>
      </table>
    </div>
  </div>

  <div class="addresses">
    <div class="box">
      <h4>Quotation To</h4>
      <div class="name">${data.client.name}</div>
      ${data.client.address ? `<div class="line">${data.client.address}</div>` : ""}
      ${data.client.phone ? `<div class="line">Phone: ${data.client.phone}</div>` : ""}
      ${data.client.email ? `<div class="line">Email: ${data.client.email}</div>` : ""}
      ${data.client.taxId ? `<div class="line">TRN: ${data.client.taxId}</div>` : ""}
    </div>
    <div class="box">
      <h4>Billing Address</h4>
      <div class="name">${data.client.name}</div>
      ${data.client.address ? `<div class="line">${data.client.address}</div>` : ""}
      ${data.client.phone ? `<div class="line">Phone: ${data.client.phone}</div>` : ""}
      ${data.client.email ? `<div class="line">Email: ${data.client.email}</div>` : ""}
    </div>
  </div>

  <table class="items">
    <thead>
      <tr>
        <th class="sn">S/N</th>
        <th>Description</th>
        <th class="num">Qty</th>
        <th class="amt">Unit Price</th>
        <th class="amt">Total Price</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="bottom">
    <div class="box notes">
      <h4>Notes</h4>
      <ul>${notes.map((n) => `<li>${n}</li>`).join("")}</ul>
    </div>
    <div class="totals">
      ${showBreakdown ? `<div class="row"><span>Net Subtotal</span><span>${money(data.subtotal)}</span></div>` : ""}
      ${data.discount && data.discount.amount > 0 ? `<div class="row discount"><span>${data.discount.label}</span><span>-${money(data.discount.amount)}</span></div>` : ""}
      ${data.vat && data.vat.amount > 0 ? `<div class="row"><span>VAT (${data.vat.rate}%)</span><span>${money(data.vat.amount)}</span></div>` : ""}
      <div class="row total"><span>Total Amount${data.vat && data.vat.amount > 0 ? " (Incl. VAT)" : ""}</span><span>${money(data.total)}</span></div>
    </div>
  </div>

  <div class="footer">Thank you for choosing ${data.org.name}. This quotation is subject to acceptance within its validity period.</div>
</div>
</body>
</html>`;
}

// ---------- helper: generate + open printable PDF for an existing quotation/invoice row ----------
function downloadQuotationPDF(
  inv: Invoice,
  examiner: string,
  examType: string,
  client: ClientRecord | undefined,
  org: { name?: string; address?: string; support_email?: string; phone?: string } | null,
) {
  openPrintWindow(
    buildQuotationPdfHtml({
      code: inv.code,
      issueDate: inv.date,
      currency: inv.currency || "AED",
      client: {
        name: inv.client,
        email: client?.email || inv.clientEmail,
        phone: client?.phone,
        address: client?.address,
        taxId: client?.tax_id,
      },
      examinerName: examiner || inv.examinerName || undefined,
      examTypeName: examType || resolveInvoiceExamType(inv) || undefined,
      items: inv.items,
      subtotal: inv.totalAmount,
      total: inv.totalAmount,
      org: {
        name: org?.name || "Polygraph UAE",
        address: org?.address,
        email: org?.support_email,
        phone: org?.phone,
      },
    }),
  );
}

function isPaidInFull(status: string): boolean {
  const s = status.toLowerCase();
  return s === "paid" || s === "completed";
}

// ---------- helper: printable PAID receipt (shown once an invoice is settled) ----------
function downloadReceiptPDF(inv: Invoice) {
  const receiptNo = inv.code.replace(/^INV-/, "RCPT-");
  const currency = inv.currency || "AED";
  const formattedPaid = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(inv.paidAmount);
  const formattedZero = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
  const examinerName = inv.examinerName || "—";
  const examTypeLabel = resolveInvoiceExamType(inv);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="format-detection" content="telephone=no,email=no"/>
<title>${receiptNo} — Payment Receipt</title>
<style>
  ${pdfSharedStyles()}
  .paid{display:inline-block;margin-top:8px;background:#dcfce7;color:#15803d;border-radius:8px;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:0.14em;padding:8px 16px}
  h1{color:#15803d}
</style>
</head>
<body>
<div class="page">
${pdfDocumentHeader()}

<div class="paid">✓ Paid in Full</div>
<h1>${formattedPaid}</h1>
<div class="meta">Amount Received</div>

<div class="grid">
  <div class="field"><label>Receipt No.</label><span>${receiptNo}</span></div>
  <div class="field"><label>Invoice No.</label><span>${inv.code}</span></div>
  <div class="field"><label>Client</label><span>${inv.client}</span></div>
  <div class="field"><label>Date</label><span>${inv.date}</span></div>
  <div class="field"><label>Examiner</label><span>${examinerName}</span></div>
  ${examTypeLabel ? `<div class="field"><label>Exam Type</label><span>${examTypeLabel}</span></div>` : ""}
</div>

<table>
  <thead><tr><th>Description</th><th class="amount">Amount</th></tr></thead>
  <tbody>
    ${inv.items.map((item) => {
      const itemAmt = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(item.amount);
      return `<tr><td>${item.description}</td><td class="amount">${itemAmt}</td></tr>`;
    }).join("")}
    <tr class="total-row"><td>Total Paid</td><td class="amount">${formattedPaid}</td></tr>
    <tr><td style="color:#888;font-size:12px">Balance Due</td><td class="amount">${formattedZero}</td></tr>
  </tbody>
</table>

<div class="footer">Thank you for your payment. This receipt confirms settlement in full of ${inv.code}.</div>
</div>
</body>
</html>`;

  openPrintWindow(html, "Allow popups to download the receipt");
}
// ---------------------------------------------------------------------------

export default function PaymentsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("payment:view")) {
      toast.error("You don't have permission to access this page.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [invoices, setInvoices] = React.useState<Invoice[]>([]);
  const [ledgerSummary, setLedgerSummary] = React.useState<AccountSummary | null>(null);
  const [clients, setClients] = React.useState<ClientRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedInvoice, setSelectedInvoice] = React.useState<Invoice | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = React.useState(1);
  const itemsPerPage = 10;

  // Bulk Edit State
  const [selectedInvoiceKeys, setSelectedInvoiceKeys] = React.useState<string[]>([]);
  const [isBulkPriceEditOpen, setIsBulkPriceEditOpen] = React.useState(false);
  const [bulkEditPrice, setBulkEditPrice] = React.useState("1000");
  const [updatingPrices, setUpdatingPrices] = React.useState(false);

  const handleToggleRow = (source: string, id: number) => {
    const key = `${source}-${id}`;
    setSelectedInvoiceKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAll = (visibleInvoices: Invoice[]) => {
    const visibleKeys = visibleInvoices.map((inv) => `${inv.source}-${inv.id}`);
    const allSelected = visibleKeys.every((k) => selectedInvoiceKeys.includes(k));
    if (allSelected) {
      setSelectedInvoiceKeys((prev) => prev.filter((k) => !visibleKeys.includes(k)));
    } else {
      setSelectedInvoiceKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  // Modal states
  const [isNewInvoiceOpen, setIsNewInvoiceOpen] = React.useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = React.useState(false);
  const [isSendQuoteOpen, setIsSendQuoteOpen] = React.useState(false);
  const [sendEmailStep, setSendEmailStep] = React.useState<"compose" | "confirm">("compose");
  const [sendEmail, setSendEmail] = React.useState({ toEmail: "", subject: "", body: "" });
  const [sendingSaving, setSendingSaving] = React.useState(false);
  const [orgSettings, setOrgSettings] = React.useState<any>({ currency: "AED" });
  const orgCurrency = orgSettings?.currency || "AED";

  // New quotation form state
  const [form, setForm] = React.useState<{
    client: ClientRecord | null;
    examType: ExamTypeRecord | null;
    examiner: UserRecord | null;
    extraItems: { description: string; amount: number }[];
    clientSearch: string;
    examTypeSearch: string;
    examinerSearch: string;
    showClientList: boolean;
    showExamTypeList: boolean;
    showExaminerList: boolean;
    currency: string;
    discountType: "fixed" | "percent";
    discountValue: number;
    includeVat: boolean;
  }>({
    client: null,
    examType: null,
    examiner: null,
    extraItems: [],
    clientSearch: "",
    examTypeSearch: "",
    examinerSearch: "",
    showClientList: false,
    showExamTypeList: false,
    showExaminerList: false,
    currency: "AED",
    discountType: "fixed",
    discountValue: 0,
    includeVat: false,
  });

  // New quotation flow: form entry -> review/confirm -> success (with PDF download).
  const [quotationStep, setQuotationStep] = React.useState<"form" | "confirm" | "success">("form");
  const [creatingQuotation, setCreatingQuotation] = React.useState(false);
  const [createdQuotation, setCreatedQuotation] = React.useState<{
    record: QuotationRecord;
    client: ClientRecord;
    examType: ExamTypeRecord;
    examiner: UserRecord | null;
    currency: string;
    items: { description: string; amount: number }[];
    subtotal: number;
    discount?: { label: string; amount: number };
    vat?: { rate: number; amount: number };
    total: number;
  } | null>(null);

  const VAT_RATE = 5;

  // Fee math for the New Quotation dialog — recomputed on every render off `form`.
  const feeBasePrice = form.examType ? catalogPriceInCurrency(form.examType.price, form.currency, orgSettings) : 0;
  const feeExtrasTotal = form.extraItems.reduce((s, i) => s + i.amount, 0);
  const feeSubtotal = feeBasePrice + feeExtrasTotal;
  const feeDiscountAmount = Math.min(
    form.discountValue > 0
      ? form.discountType === "percent"
        ? feeSubtotal * (form.discountValue / 100)
        : form.discountValue
      : 0,
    feeSubtotal,
  );
  const feeAfterDiscount = Math.max(0, feeSubtotal - feeDiscountAmount);
  const feeVatAmount = form.includeVat ? feeAfterDiscount * (VAT_RATE / 100) : 0;
  const feeTotal = feeAfterDiscount + feeVatAmount;

  const filteredFormClients = clients.filter((c) =>
    c.name.toLowerCase().includes(form.clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(form.clientSearch.toLowerCase()),
  );
  const filteredFormExamTypes = examTypes.filter((et) =>
    et.name.toLowerCase().includes(form.examTypeSearch.toLowerCase()),
  );
  const filteredFormExaminers = examiners.filter((ex) =>
    ex.name.toLowerCase().includes(form.examinerSearch.toLowerCase()),
  );

  const resetForm = () => {
    setForm({
      client: null, examType: null, examiner: null, extraItems: [],
      clientSearch: "", examTypeSearch: "", examinerSearch: "",
      showClientList: false, showExamTypeList: false, showExaminerList: false,
      currency: orgCurrency,
      discountType: "fixed", discountValue: 0,
      includeVat: false,
    });
  };

  const closeNewQuotationDialog = () => {
    setIsNewInvoiceOpen(false);
    resetForm();
    setQuotationStep("form");
    setCreatedQuotation(null);
  };

  React.useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ledger, clientRows, examTypeRows, examinerRows, org] = await Promise.all([
        fetchBillingLedger(),
        fetchClients(),
        fetchExamTypes(),
        fetchExaminers(),
        fetchOrganizationSettings().catch(() => ({ currency: "AED" })),
      ]);

      if (org) {
        setOrgSettings(org);
      }

      setLedgerSummary(ledger.summary);
      setInvoices(
        ledger.entries.map((entry) => {
          const inv = mapLedgerEntryToInvoice(entry) as Invoice;
          if (entry.appointment_id) {
            inv.examId = `APT-${String(entry.appointment_id).padStart(4, "0")}`;
          }
          return inv;
        }),
      );
      setClients(clientRows);
      setExamTypes(examTypeRows);
      setExaminers(examinerRows);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load financial records");
    } finally {
      setLoading(false);
    }
  };

  // Record Payment Form State
  const [paymentAmount, setPaymentAmount] = React.useState<string>("");
  const [recordingPayment, setRecordingPayment] = React.useState(false);
  const [approvingQuotation, setApprovingQuotation] = React.useState(false);

  const [statusFilter, setStatusFilter] = React.useState<string>("All");
  const [clientFilter, setClientFilter] = React.useState<string>("All");
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  const filteredInvoices = React.useMemo(() => {
    const res = invoices.filter(inv => {
      const matchesSearch = inv.client.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "All" || inv.status === statusFilter;
      const matchesClient = clientFilter === "All" || inv.client === clientFilter;
      return matchesSearch && matchesStatus && matchesClient;
    });

    // Sort latest first (descending by id / date)
    return res.sort((a, b) => b.id - a.id);
  }, [invoices, searchQuery, statusFilter, clientFilter]);

  const handleExportCSV = () => {
    const headers = ["Invoice Code", "Client", "Source", "Status", "Date", "Total Amount", "Paid Amount", "Balance Due", "Currency"];
    const rows = filteredInvoices.map((inv) => {
      const { total: convertedTotal, paid: convertedPaid, balance } = ledgerRowMoney(
        { total_amount: inv.totalAmount, paid_amount: inv.paidAmount, balance_due: inv.balanceDue, currency: inv.currency },
        orgCurrency,
        orgSettings,
      );
      return [
        inv.code,
        inv.client,
        inv.source === "quote" ? "Quotation" : "Invoice",
        inv.status,
        inv.date || "—",
        convertedTotal.toFixed(2),
        convertedPaid.toFixed(2),
        balance.toFixed(2),
        orgCurrency,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Polygraph_Transactions_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Transactions exported to CSV in " + orgCurrency);
  };

  // Pagination Logic
  const totalPages = Math.max(1, Math.ceil(filteredInvoices.length / itemsPerPage));
  
  // Ensure currentPage is within bounds if filters change
  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [totalPages, currentPage]);

  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const stats = {
    total: ledgerSummary?.total_billed ?? 0,
    collected: ledgerSummary?.total_paid ?? 0,
    pending: ledgerSummary?.balance_due ?? 0,
    overdue: invoices.filter((inv) => inv.status === "Overdue").reduce((acc, inv) => {
      return acc + ledgerRowMoney(
        { total_amount: inv.totalAmount, paid_amount: inv.paidAmount, balance_due: inv.balanceDue, currency: inv.currency },
        orgCurrency,
        orgSettings,
      ).balance;
    }, 0),
  };

  // Called from the confirm step — the form step's button only advances to "confirm".
  const handleCreateInvoice = async () => {
    if (!form.client || !form.examType) return;

    const basePrice = catalogPriceInCurrency(form.examType.price, form.currency, orgSettings);
    const lineItems: { description: string; amount: number }[] = [
      { description: form.examType.name, amount: basePrice },
      ...form.extraItems.filter((item) => item.description.trim() && item.amount > 0),
    ];
    const subtotal = lineItems.reduce((acc, item) => acc + item.amount, 0);
    const discountAmount = Math.min(
      form.discountValue > 0
        ? form.discountType === "percent"
          ? subtotal * (form.discountValue / 100)
          : form.discountValue
        : 0,
      subtotal,
    );
    const afterDiscount = Math.max(0, subtotal - discountAmount);
    const vatAmount = form.includeVat ? afterDiscount * (VAT_RATE / 100) : 0;
    const total = afterDiscount + vatAmount;
    if (total <= 0) { toast.error("Total must be greater than zero"); return; }

    const discountLabel = `Discount${form.discountType === "percent" ? ` (${form.discountValue}%)` : ""}`;
    const title = [form.examType.name, form.examiner ? `— ${form.examiner.name}` : ""].filter(Boolean).join(" ");
    const description = [
      ...lineItems.map((item) => `${item.description}: ${formatMoney(item.amount, form.currency)}`),
      discountAmount > 0 ? `${discountLabel}: -${formatMoney(discountAmount, form.currency)}` : null,
      vatAmount > 0 ? `VAT (${VAT_RATE}%): ${formatMoney(vatAmount, form.currency)}` : null,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    setCreatingQuotation(true);
    try {
      const record = await createQuotation({
        client_id: form.client.id,
        title,
        description,
        amount: total,
        currency: form.currency,
      });
      await loadData();
      setCreatedQuotation({
        record,
        client: form.client,
        examType: form.examType,
        examiner: form.examiner,
        currency: form.currency,
        items: lineItems,
        subtotal,
        discount: discountAmount > 0 ? { label: discountLabel, amount: discountAmount } : undefined,
        vat: vatAmount > 0 ? { rate: VAT_RATE, amount: vatAmount } : undefined,
        total,
      });
      setQuotationStep("success");
      toast.success("Quotation created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create quotation");
    } finally {
      setCreatingQuotation(false);
    }
  };

  const handleDownloadCreatedQuotationPdf = () => {
    if (!createdQuotation) return;
    openPrintWindow(
      buildQuotationPdfHtml({
        code: createdQuotation.record.code,
        issueDate: createdQuotation.record.created_at,
        currency: createdQuotation.currency,
        client: {
          name: createdQuotation.client.name,
          email: createdQuotation.client.email,
          phone: createdQuotation.client.phone,
          address: createdQuotation.client.address,
          taxId: createdQuotation.client.tax_id,
        },
        examinerName: createdQuotation.examiner?.name,
        examTypeName: createdQuotation.examType.name,
        items: createdQuotation.items,
        subtotal: createdQuotation.subtotal,
        discount: createdQuotation.discount,
        vat: createdQuotation.vat,
        total: createdQuotation.total,
        org: {
          name: orgSettings?.name || "Polygraph UAE",
          address: orgSettings?.address,
          email: orgSettings?.support_email,
          phone: orgSettings?.phone,
        },
      }),
    );
  };

  const handleRecordPayment = async () => {
    if (!selectedInvoice) return;
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setRecordingPayment(true);
    try {
      if (selectedInvoice.appointmentId) {
        await collectAppointmentPayment(selectedInvoice.appointmentId, { amount });
      } else {
        await collectQuotationPayment(selectedInvoice.quotationId ?? selectedInvoice.id, {
          amount,
        });
      }

      await loadData();
      setIsRecordPaymentOpen(false);
      setPaymentAmount("");
      setIsSheetOpen(false);
      toast.success("Payment collected");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to collect payment");
    } finally {
      setRecordingPayment(false);
    }
  };

  const handleApproveQuotation = async () => {
    if (!selectedInvoice) return;
    const quoteId = selectedInvoice.quotationId ?? (selectedInvoice.source === "quote" ? selectedInvoice.id : undefined);
    if (!quoteId) return;

    setApprovingQuotation(true);
    try {
      await approveQuotation(quoteId);
      await loadData();
      setSelectedInvoice((current) => (current ? { ...current, status: "Approved" } : current));
      toast.success("Quotation approved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to approve quotation");
    } finally {
      setApprovingQuotation(false);
    }
  };

  const handleSendQuotation = async () => {
    if (!selectedInvoice) return;
    const quoteId = selectedInvoice.quotationId ?? (selectedInvoice.source === "quote" ? selectedInvoice.id : undefined);
    if (!quoteId) {
      toast.error("No invoice on file for this record");
      return;
    }
    if (!sendEmail.toEmail.trim()) {
      toast.error("Recipient email is required");
      return;
    }
    setSendingSaving(true);
    try {
      await sendQuotationEmail(quoteId, {
        to_email: sendEmail.toEmail.trim(),
        subject: sendEmail.subject.trim(),
        body: sendEmail.body.trim(),
      });
      await loadData();
      setIsSendQuoteOpen(false);
      setSendEmailStep("compose");
      toast.success("Quotation emailed");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send quotation");
    } finally {
      setSendingSaving(false);
    }
  };

  const handleBulkPriceEditSubmit = async () => {
    if (selectedInvoiceKeys.length === 0) {
      toast.error("No transactions selected");
      return;
    }
    const newPrice = Number(bulkEditPrice);
    if (isNaN(newPrice) || newPrice < 0) {
      toast.error("Please enter a valid price");
      return;
    }
    setUpdatingPrices(true);
    try {
      const targets = selectedInvoiceKeys.map((k) => {
        const parts = k.split("-");
        const source = parts[0];
        const id = Number(parts[1]);
        const inv = invoices.find((i) => i.id === id && i.source === source);
        return {
          source,
          id,
          appointmentId: inv?.appointmentId,
          quotationId: inv?.quotationId,
        };
      });
      await bulkEditInvoicePrices(targets, newPrice);
      await loadData();
      setSelectedInvoiceKeys([]);
      setIsBulkPriceEditOpen(false);
      toast.success(`Successfully updated ${targets.length} transactions to ${formatMoney(newPrice, orgCurrency)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to bulk edit prices");
    } finally {
      setUpdatingPrices(false);
    }
  };

  return (
    <div className="space-y-10 max-w-[1600px] mx-auto pb-20 px-4 sm:px-0">
      {/* Decorative Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-8 rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-xl shadow-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <DollarSign className="h-6 w-6" />
            </div>
            <h1 className="text-3xl font-black tracking-tight">Financial Hub</h1>
          </div>
          <p className="text-muted-foreground text-sm font-bold opacity-70 uppercase tracking-widest text-[10px] pl-1 pt-1">
            Clinical Revenue & Collection Oversight
          </p>
          <p className="text-xs text-muted-foreground pl-1 pt-2 max-w-xl">
            Booked exams from Calendar appear here as invoices. Exam types under Settings set the price when you book.
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <Button 
            onClick={() => setIsNewInvoiceOpen(true)}
            className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="mr-2 h-5 w-5" />
            New Quotation
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: "Billed Total", value: stats.total, icon: FileText, color: "bg-primary/10 text-primary" },
          { label: "Collected", value: stats.collected, icon: CheckCircle2, color: "bg-emerald-500/10 text-emerald-500" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "bg-amber-500/10 text-amber-500" },
          { label: "Overdue", value: stats.overdue, icon: AlertCircle, color: "bg-rose-500/10 text-rose-500" }
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md shadow-xl overflow-hidden group hover:border-primary/30 transition-all hover:scale-[1.02]">
            <CardContent className="p-6">
              <div className="flex justify-between items-center mb-4">
                <div className={cn("p-2.5 rounded-xl shadow-inner", stat.color)}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <p className="text-[10px] uppercase font-black tracking-[0.2em] text-muted-foreground/60">{stat.label}</p>
              </div>
              <p className="text-3xl font-black tracking-tighter">{formatMoney(stat.value, orgCurrency)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table Section */}
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2">
          <div className="relative w-full sm:w-96 group">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-all" />
            <Input 
              placeholder="Search by client or invoice ID..." 
              className="h-12 pl-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            {selectedInvoiceKeys.length > 0 && (
              <Button
                onClick={() => setIsBulkPriceEditOpen(true)}
                className="h-12 px-6 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-amber-500/25 transition-all"
              >
                Bulk Edit ({selectedInvoiceKeys.length})
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12 rounded-2xl border-border/50 bg-card/50 backdrop-blur-sm px-6 gap-2 hover:bg-muted/50 transition-all"
              onClick={() => setFiltersOpen(true)}
            >
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filters</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 rounded-2xl border border-border/50 hover:bg-muted/50"
              onClick={handleExportCSV}
            >
                <Download className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="rounded-[2.5rem] border border-border/40 bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="bg-muted/30 border-b border-border/50">
                  <th className="w-12 px-6 py-5">
                    <input
                      type="checkbox"
                      checked={
                        paginatedInvoices.length > 0 &&
                        paginatedInvoices.every((inv) =>
                          selectedInvoiceKeys.includes(`${inv.source}-${inv.id}`)
                        )
                      }
                      onChange={() => handleToggleAll(paginatedInvoices)}
                      className="rounded border-border/50 h-4 w-4 accent-primary cursor-pointer"
                    />
                  </th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Invoice / Client</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Progress</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Balance Due</th>
                  <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      Loading financial records...
                    </td>
                  </tr>
                ) : paginatedInvoices.length > 0 ? (
                  paginatedInvoices.map((inv) => {
                    const { total: convertedTotal, paid: convertedPaid, balance: convertedBalance } = ledgerRowMoney(
                      {
                        total_amount: inv.totalAmount,
                        paid_amount: inv.paidAmount,
                        balance_due: inv.balanceDue,
                        currency: inv.currency,
                      },
                      orgCurrency,
                      orgSettings,
                    );

                    return (
                      <tr key={`${inv.source}-${inv.id}`} className="hover:bg-primary/[0.03] transition-all group">
                        <td className="px-6 py-6 w-12 text-center">
                          <input
                            type="checkbox"
                            checked={selectedInvoiceKeys.includes(`${inv.source}-${inv.id}`)}
                            onChange={() => handleToggleRow(inv.source, inv.id)}
                            className="rounded border-border/50 h-4 w-4 accent-primary cursor-pointer"
                          />
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-1">
                            <span className="font-black text-base leading-none text-foreground">{inv.client}</span>
                            <span className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-black text-primary uppercase tracking-[0.1em]">{inv.code}</span>
                              <span className={cn(
                                "rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-widest",
                                inv.source === "quote" ? "bg-violet-500/10 text-violet-600" : "bg-muted text-muted-foreground",
                              )}>
                                {inv.source === "quote" ? "Quotation" : "Invoice"}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                                <Calendar className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                                {inv.date || "—"}
                              </span>
                            </span>
                          </div>
                        </td>
                        <td className="px-8 py-6">
                          <Badge 
                            variant="outline"
                            className={cn(
                              "rounded-full px-3 py-1 font-black uppercase tracking-widest text-[9px] border-none shadow-sm",
                              inv.status === "Completed" ? "bg-emerald-500/10 text-emerald-600" :
                              inv.status === "Pending" ? "bg-amber-500/10 text-amber-600" :
                              inv.status === "Sent" ? "bg-cyan-500/10 text-cyan-600" :
                              inv.status === "Approved" ? "bg-indigo-500/10 text-indigo-600" :
                              inv.status === "Partial" ? "bg-blue-500/10 text-blue-600" :
                              "bg-rose-500/10 text-rose-600"
                            )}
                          >
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-8 py-6">
                          <div className="space-y-2">
                            <div className="w-32 h-1.5 bg-muted/50 rounded-full overflow-hidden border border-border/50">
                              <div 
                                className={cn(
                                  "h-full transition-all duration-1000 ease-out rounded-full",
                                  inv.status === "Completed" ? "bg-emerald-500" : 
                                  inv.status === "Partial" ? "bg-blue-500" : "bg-primary/20"
                                )}
                                style={{ width: `${(convertedPaid / (convertedTotal || 1)) * 100}%` }}
                              />
                            </div>
                            <p className="text-[9px] font-black text-muted-foreground/60 uppercase tracking-widest">
                              {formatMoney(convertedPaid, orgCurrency)} Collected
                            </p>
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right font-black text-lg tracking-tighter">
                          {formatMoney(convertedBalance, orgCurrency)}
                        </td>
                        <td className="px-8 py-6 text-right">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all group-hover:translate-x-1"
                            onClick={() => {
                              setSelectedInvoice(inv);
                              setIsSheetOpen(true);
                            }}
                          >
                            <ChevronRight className="h-6 w-6" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                      No invoices found matching your criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Footer */}
          <div className="px-10 py-6 border-t border-border/50 bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">
              Showing <span className="text-foreground">{(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</span> of {filteredInvoices.length} Transactions
            </p>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                <span className="font-black text-[9px] uppercase tracking-widest">Previous</span>
              </Button>
              
              <div className="flex items-center gap-1.5">
                {[...Array(totalPages)].map((_, i) => (
                    <Button 
                        key={i}
                        variant={currentPage === i + 1 ? "default" : "ghost"}
                        className={cn(
                            "h-10 w-10 rounded-xl font-black text-xs transition-all", 
                            currentPage === i + 1 ? "shadow-xl shadow-primary/20 bg-primary" : "text-muted-foreground hover:bg-primary/5"
                        )}
                        onClick={() => setCurrentPage(i + 1)}
                    >
                        {i + 1}
                    </Button>
                ))}
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                className="h-10 px-4 rounded-xl border-border/50 bg-card hover:bg-muted transition-all disabled:opacity-30"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                <span className="font-black text-[9px] uppercase tracking-widest">Next</span>
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Invoice Details Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md bg-card/95 backdrop-blur-3xl border-l border-border/50 shadow-2xl p-0 overflow-hidden">
          {selectedInvoice && (
            <div className="h-full flex flex-col">
              <div className="h-72 flex flex-col justify-end p-10 text-white relative">
                <div className="absolute inset-0 bg-neutral-950 z-0" />
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-transparent z-10" />
                <div className="absolute inset-0 opacity-10 z-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
                
                <div className="relative z-20 space-y-4">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] font-black uppercase tracking-widest px-4 py-1.5 backdrop-blur-xl">
                    {selectedInvoice.status}
                  </Badge>
                  <div className="space-y-1">
                    <h2 className="text-5xl font-black tracking-tighter leading-none">{formatMoney(selectedInvoice.balanceDue ?? Math.max(0, selectedInvoice.totalAmount - selectedInvoice.paidAmount), selectedInvoice.currency || orgCurrency)}</h2>
                    <p className="text-[11px] font-black text-white/40 uppercase tracking-[0.3em] pl-1">Balance Due</p>
                  </div>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar bg-background">
                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Case Information</p>
                  <div className="grid grid-cols-2 gap-4 border border-border/50 p-6 rounded-[2rem] bg-muted/10 shadow-inner">
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Client</p>
                      <p className="text-sm font-black tracking-tight">{selectedInvoice.client}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Issue Date</p>
                      <p className="text-sm font-black tracking-tight">{selectedInvoice.date}</p>
                    </div>
                  </div>
                  {selectedInvoice.sentAt ? (
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500">
                      Emailed: {selectedInvoice.sentAt}
                    </p>
                  ) : null}
                </div>

                <div className="space-y-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Service Fee Breakdown</p>
                  <div className="space-y-3">
                    {selectedInvoice.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 border border-border/30 rounded-2xl bg-card shadow-sm transition-all hover:border-primary/20">
                        <span className="text-xs font-black text-foreground/80 uppercase tracking-tight">{item.description}</span>
                        <span className="text-sm font-black text-foreground">{formatMoney(item.amount, selectedInvoice.currency || orgCurrency)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-10 flex flex-col gap-4">
                  {selectedInvoice.source === "quote" &&
                    !["Approved", "Completed"].includes(selectedInvoice.status) && (
                      <Button
                        variant="outline"
                        className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-2 border-indigo-500/30 text-indigo-600 hover:bg-indigo-500/10"
                        onClick={() => void handleApproveQuotation()}
                        disabled={approvingQuotation}
                      >
                        {approvingQuotation ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Approving…
                          </>
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Approve Quotation
                          </>
                        )}
                      </Button>
                    )}
                  <Button
                    onClick={() => setIsRecordPaymentOpen(true)}
                    className="w-full h-16 rounded-[2rem] font-black text-base shadow-2xl shadow-primary/30 bg-primary text-primary-foreground hover:scale-[1.03] transition-all"
                  >
                    Record Payment Entry
                  </Button>
                  {selectedInvoice.source === "quote" && can("appointment:create") && (
                    <Button
                      variant="secondary"
                      className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-2"
                      onClick={() =>
                        router.push(
                          `/dashboard/calendar/book?clientId=${selectedInvoice.clientId}&quotationId=${selectedInvoice.quotationId ?? selectedInvoice.id}`,
                        )
                      }
                    >
                      <Calendar className="h-4 w-4" />
                      Convert to Booking
                    </Button>
                  )}
                  {isPaidInFull(selectedInvoice.status) && (
                    <Button
                      className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest gap-2 bg-emerald-600 text-white hover:bg-emerald-600/90"
                      onClick={() => downloadReceiptPDF(selectedInvoice)}
                    >
                      <Download className="h-4 w-4" />
                      Download Receipt
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 hover:bg-muted/20"
                      disabled={selectedInvoice.source !== "quote"}
                      onClick={() => {
                        if (selectedInvoice.source !== "quote") {
                          return;
                        }
                        setSendEmail({
                          toEmail: selectedInvoice.clientEmail || "",
                          subject: `${selectedInvoice.code} Quotation`,
                          body: `Hello ${selectedInvoice.client},\n\nPlease find your quotation ${selectedInvoice.code} for ${formatMoney(selectedInvoice.totalAmount, selectedInvoice.currency || orgCurrency)}.`,
                        });
                        setSendEmailStep("compose");
                        setIsSendQuoteOpen(true);
                      }}
                    >
                        <Mail className="mr-2 h-4 w-4 text-primary" />
                        {selectedInvoice.quotationId ? "Email invoice" : "Email (invoice only)"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-14 rounded-2xl font-black text-[10px] uppercase tracking-widest border-border/50 hover:bg-muted/20"
                      onClick={() =>
                        downloadQuotationPDF(
                          selectedInvoice,
                          selectedInvoice.examinerName || "",
                          resolveInvoiceExamType(selectedInvoice),
                          clients.find((c) => c.id === selectedInvoice.clientId),
                          orgSettings,
                        )
                      }
                    >
                        <Download className="mr-2 h-4 w-4 text-primary" /> PDF
                    </Button>
                  </div>
                  {can("payment:manage") && (
                    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3">
                      <DeleteConfirmDialog
                        title={`Delete ${selectedInvoice.code}`}
                        description="This permanently removes this invoice from billing. The linked appointment (if any) is kept."
                        confirmLabel="Confirmation"
                        triggerLabel="Delete Invoice"
                        onConfirm={async () => {
                          await deleteInvoice({
                            quotationId: selectedInvoice.quotationId,
                            appointmentId: selectedInvoice.appointmentId,
                          });
                          setInvoices((current) => current.filter((inv) => inv.id !== selectedInvoice.id));
                          setIsSheetOpen(false);
                          toast.success("Invoice deleted");
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* New Quotation Dialog — smart search-select */}
      <Dialog open={isNewInvoiceOpen} onOpenChange={(open) => { if (open) { setIsNewInvoiceOpen(true); } else { closeNewQuotationDialog(); } }}>
        <DialogContent className="sm:max-w-lg rounded-3xl p-0 overflow-hidden border-border/50 shadow-2xl">
          <div className="p-8 space-y-6 bg-background max-h-[90vh] overflow-y-auto">
          {quotationStep === "form" && (
            <>
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight">New Quotation</h2>
                <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Forensic Polygraph Services</p>
              </div>
            </div>

            {/* Client picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" /> Client
              </Label>
              {form.client ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <span className="font-bold text-sm">{form.client.name}</span>
                  <button onClick={() => setForm((f) => ({ ...f, client: null, clientSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search clients…"
                    value={form.clientSearch}
                    onFocus={() => setForm((f) => ({ ...f, showClientList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, clientSearch: e.target.value, showClientList: true }))}
                  />
                  {form.showClientList && filteredFormClients.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormClients.map((c) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex flex-col"
                          onClick={() => setForm((f) => ({ ...f, client: c, clientSearch: "", showClientList: false }))}
                        >
                          {c.name}
                          <span className="text-[10px] text-muted-foreground font-normal">{c.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Exam type picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <ClipboardList className="h-3 w-3" /> Exam Type
              </Label>
              {form.examType ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-sm">{form.examType.name}</span>
                    <Badge variant="outline" className="text-[9px] font-black">
                      {formatMoney(
                        catalogPriceInCurrency(form.examType.price, form.currency, orgSettings),
                        form.currency
                      )}
                    </Badge>
                  </div>
                  <button onClick={() => setForm((f) => ({ ...f, examType: null, examTypeSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search exam types…"
                    value={form.examTypeSearch}
                    onFocus={() => setForm((f) => ({ ...f, showExamTypeList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, examTypeSearch: e.target.value, showExamTypeList: true }))}
                  />
                  {form.showExamTypeList && filteredFormExamTypes.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormExamTypes.map((et) => (
                        <button
                          key={et.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex items-center justify-between"
                          onClick={() => setForm((f) => ({ ...f, examType: et, examTypeSearch: "", showExamTypeList: false }))}
                        >
                          <span>{et.name}</span>
                          <span className="text-xs font-black text-primary">
                            {formatMoney(
                              catalogPriceInCurrency(et.price, form.currency, orgSettings),
                              form.currency
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Examiner picker */}
            <div className="space-y-2 relative">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground flex items-center gap-1.5">
                <Stethoscope className="h-3 w-3" /> Rendering Examiner
              </Label>
              {form.examiner ? (
                <div className="flex items-center justify-between h-12 px-4 rounded-xl border border-border bg-muted/20">
                  <span className="font-bold text-sm">{form.examiner.name}</span>
                  <button onClick={() => setForm((f) => ({ ...f, examiner: null, examinerSearch: "" }))} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="h-12 pl-9 rounded-xl"
                    placeholder="Search examiners…"
                    value={form.examinerSearch}
                    onFocus={() => setForm((f) => ({ ...f, showExaminerList: true }))}
                    onChange={(e) => setForm((f) => ({ ...f, examinerSearch: e.target.value, showExaminerList: true }))}
                  />
                  {form.showExaminerList && filteredFormExaminers.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-xl shadow-xl max-h-44 overflow-y-auto">
                      {filteredFormExaminers.map((ex) => (
                        <button
                          key={ex.id}
                          className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted/50 flex flex-col"
                          onClick={() => setForm((f) => ({ ...f, examiner: ex, examinerSearch: "", showExaminerList: false }))}
                        >
                          {ex.name}
                          <span className="text-[10px] text-muted-foreground font-normal">{ex.email}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Currency picker */}
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Currency</Label>
              <Select value={form.currency} onValueChange={(val) => setForm((f) => ({ ...f, currency: val as string }))}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="AED">AED (AED)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fee preview / extra items */}
            {form.examType && (
              <div className="space-y-3">
                <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Fee Schedule</Label>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-muted/20">
                    <span className="text-xs font-bold">{form.examType.name}</span>
                    <span className="text-sm font-black text-primary">
                      {formatMoney(
                        catalogPriceInCurrency(form.examType.price, form.currency, orgSettings),
                        form.currency
                      )}
                    </span>
                  </div>
                  {form.extraItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 px-4 py-2 border-t border-border/50">
                      <Input
                        className="h-9 flex-1 text-xs"
                        placeholder="Description"
                        value={item.description}
                        onChange={(e) => {
                          const next = [...form.extraItems];
                          next[idx] = { ...next[idx], description: e.target.value };
                          setForm((f) => ({ ...f, extraItems: next }));
                        }}
                      />
                      <div className="relative w-24">
                        <Input
                          type="number"
                          className="h-9 pl-6 text-xs"
                          placeholder="0.00"
                          value={item.amount || ""}
                          onChange={(e) => {
                            const next = [...form.extraItems];
                            next[idx] = { ...next[idx], amount: parseFloat(e.target.value) || 0 };
                            setForm((f) => ({ ...f, extraItems: next }));
                          }}
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground">{form.currency}</span>
                      </div>
                      <button
                        className="text-muted-foreground hover:text-rose-500 transition-colors"
                        onClick={() => setForm((f) => ({ ...f, extraItems: f.extraItems.filter((_, i) => i !== idx) }))}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    className="w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/5 border-t border-border/50 transition-colors"
                    onClick={() => setForm((f) => ({ ...f, extraItems: [...f.extraItems, { description: "", amount: 0 }] }))}
                  >
                    + Add fee line
                  </button>

                  {/* Discount */}
                  <div className="flex items-center gap-2.5 px-4 py-3 border-t border-border/50 bg-rose-500/[0.03]">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                      <Tag className="h-3.5 w-3.5 text-rose-500" /> Discount
                    </span>
                    <div className="flex items-center gap-3 ml-auto">
                      <div className="flex items-center rounded-lg border border-border/60 bg-background p-0.5 shrink-0">
                        <button
                          type="button"
                          className={cn(
                            "h-7 w-9 rounded-md text-[10px] font-black transition-all",
                            form.discountType === "fixed"
                              ? "bg-rose-500 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setForm((f) => ({ ...f, discountType: "fixed" }))}
                          aria-pressed={form.discountType === "fixed"}
                        >
                          {form.currency}
                        </button>
                        <button
                          type="button"
                          className={cn(
                            "h-7 w-9 rounded-md text-[10px] font-black transition-all flex items-center justify-center",
                            form.discountType === "percent"
                              ? "bg-rose-500 text-white shadow-sm"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                          onClick={() => setForm((f) => ({ ...f, discountType: "percent" }))}
                          aria-pressed={form.discountType === "percent"}
                        >
                          <Percent className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="relative w-24">
                        <Input
                          type="number"
                          min={0}
                          className="h-9 text-xs text-right pr-6 rounded-lg"
                          placeholder="0"
                          value={form.discountValue || ""}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, discountValue: Math.max(0, parseFloat(e.target.value) || 0) }))
                          }
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-bold text-muted-foreground pointer-events-none">
                          {form.discountType === "percent" ? "%" : form.currency}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* VAT toggle */}
                  <div className="flex items-center justify-between gap-2.5 px-4 py-3 border-t border-border/50">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                      <Percent className="h-3.5 w-3.5 text-primary" /> Add VAT ({VAT_RATE}%)
                    </span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.includeVat}
                      onClick={() => setForm((f) => ({ ...f, includeVat: !f.includeVat }))}
                      className={cn(
                        "h-6 w-11 rounded-full transition-colors relative shrink-0",
                        form.includeVat ? "bg-primary" : "bg-muted-foreground/25",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
                          form.includeVat ? "translate-x-[22px]" : "translate-x-0.5",
                        )}
                      />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5 px-1 pt-1">
                  {(feeDiscountAmount > 0 || feeVatAmount > 0) && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">Subtotal</span>
                      <span className="text-xs font-bold text-muted-foreground">{formatMoney(feeSubtotal, form.currency)}</span>
                    </div>
                  )}
                  {feeDiscountAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-rose-500/80">
                        Discount{form.discountType === "percent" ? ` (${form.discountValue}%)` : ""}
                      </span>
                      <span className="text-xs font-bold text-rose-500">-{formatMoney(feeDiscountAmount, form.currency)}</span>
                    </div>
                  )}
                  {feeVatAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">VAT ({VAT_RATE}%)</span>
                      <span className="text-xs font-bold text-muted-foreground">{formatMoney(feeVatAmount, form.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-0.5">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total</span>
                    <span className="text-lg font-black text-foreground">{formatMoney(feeTotal, form.currency)}</span>
                  </div>
                </div>
              </div>
            )}

            <Button
              className="w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
              onClick={() => setQuotationStep("confirm")}
              disabled={!form.client || !form.examType || feeTotal <= 0}
            >
              Review Quotation
            </Button>
            </>
          )}

          {quotationStep === "confirm" && form.client && form.examType && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <ClipboardList className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-black tracking-tight">Review Quotation</h2>
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest">Confirm details before creating</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/50 bg-muted/10 p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Client</p>
                    <p className="text-sm font-black">{form.client.name}</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-widest mb-1">Examiner</p>
                    <p className="text-sm font-black">{form.examiner?.name || "—"}</p>
                  </div>
                </div>

                <div className="space-y-2 pt-3 border-t border-border/40">
                  <div className="flex justify-between text-xs">
                    <span className="font-bold text-muted-foreground">{form.examType.name}</span>
                    <span className="font-black">{formatMoney(feeBasePrice, form.currency)}</span>
                  </div>
                  {form.extraItems.filter((i) => i.description.trim() && i.amount > 0).map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="font-bold text-muted-foreground">{item.description}</span>
                      <span className="font-black">{formatMoney(item.amount, form.currency)}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5 pt-3 border-t border-border/40">
                  {feeDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-rose-500">
                        Discount{form.discountType === "percent" ? ` (${form.discountValue}%)` : ""}
                      </span>
                      <span className="font-black text-rose-500">-{formatMoney(feeDiscountAmount, form.currency)}</span>
                    </div>
                  )}
                  {feeVatAmount > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="font-bold text-muted-foreground">VAT ({VAT_RATE}%)</span>
                      <span className="font-black">{formatMoney(feeVatAmount, form.currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Due</span>
                    <span className="text-xl font-black text-primary">{formatMoney(feeTotal, form.currency)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  className="h-13 rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={() => setQuotationStep("form")}
                  disabled={creatingQuotation}
                >
                  Back
                </Button>
                <Button
                  className="h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20"
                  onClick={() => void handleCreateInvoice()}
                  disabled={creatingQuotation}
                >
                  {creatingQuotation ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Creating…
                    </>
                  ) : (
                    "Confirm & Create"
                  )}
                </Button>
              </div>
            </div>
          )}

          {quotationStep === "success" && createdQuotation && (
            <div className="space-y-6 text-center py-2">
              <div className="mx-auto h-16 w-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <h2 className="text-2xl font-black tracking-tight">Quotation Created</h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">{createdQuotation.record.code}</p>
              </div>
              <div className="rounded-2xl border border-border/50 bg-muted/10 p-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Total Amount</p>
                <p className="text-4xl font-black tracking-tighter">{formatMoney(createdQuotation.total, createdQuotation.currency)}</p>
                <p className="text-xs font-bold text-muted-foreground mt-1">{createdQuotation.client.name}</p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <Button
                  className="w-full h-13 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 gap-2"
                  onClick={handleDownloadCreatedQuotationPdf}
                >
                  <Download className="h-4 w-4" /> Download PDF
                </Button>
                <Button
                  variant="outline"
                  className="w-full h-12 rounded-2xl font-black text-xs uppercase tracking-widest"
                  onClick={closeNewQuotationDialog}
                >
                  Done
                </Button>
              </div>
            </div>
          )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isSendQuoteOpen}
        onOpenChange={(open) => { setIsSendQuoteOpen(open); if (!open) setSendEmailStep("compose"); }}
      >
        <DialogContent className="sm:max-w-[520px] rounded-[2rem] p-8 border-border/50 shadow-2xl bg-background">
          {sendEmailStep === "compose" ? (
            <>
              <DialogHeader>
                <DialogTitle>Send Quotation Email</DialogTitle>
                <DialogDescription>
                  Edit the message, then review it before it goes out.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">To</Label>
                  <Input
                    placeholder="Recipient email"
                    type="email"
                    value={sendEmail.toEmail}
                    onChange={(e) => setSendEmail((v) => ({ ...v, toEmail: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Subject</Label>
                  <Input
                    placeholder="Email subject"
                    value={sendEmail.subject}
                    onChange={(e) => setSendEmail((v) => ({ ...v, subject: e.target.value }))}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">Message</Label>
                  <Textarea
                    placeholder="Message"
                    rows={6}
                    value={sendEmail.body}
                    onChange={(e) => setSendEmail((v) => ({ ...v, body: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsSendQuoteOpen(false)}>Cancel</Button>
                <Button
                  onClick={() => {
                    if (!sendEmail.toEmail.trim()) { toast.error("Recipient email is required"); return; }
                    setSendEmailStep("confirm");
                  }}
                >
                  Review &amp; Send
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>Review Before Sending</DialogTitle>
                <DialogDescription>
                  Confirm this is what you want your client to receive.
                </DialogDescription>
              </DialogHeader>
              <div className="rounded-2xl border border-border/50 bg-muted/10 overflow-hidden">
                <div className="divide-y divide-border/40 px-5 py-3 text-sm">
                  <div className="flex gap-2 py-2">
                    <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground pt-0.5">To</span>
                    <span className="font-bold">{sendEmail.toEmail}</span>
                  </div>
                  <div className="flex gap-2 py-2">
                    <span className="w-16 shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground pt-0.5">Subject</span>
                    <span className="font-bold">{sendEmail.subject || "(no subject)"}</span>
                  </div>
                </div>
                <div className="px-5 py-4 bg-background border-t border-border/40 text-sm whitespace-pre-wrap leading-relaxed">
                  {sendEmail.body || <span className="text-muted-foreground italic">(no message)</span>}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendEmailStep("compose")} disabled={sendingSaving}>
                  Back to Edit
                </Button>
                <Button onClick={() => void handleSendQuotation()} disabled={sendingSaving}>
                  {sendingSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Sending…
                    </>
                  ) : (
                    "Approve & Send"
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog
        open={isRecordPaymentOpen}
        onOpenChange={(open) => {
          if (recordingPayment) return;
          setIsRecordPaymentOpen(open);
        }}
      >
        <DialogContent className="sm:max-w-[440px] rounded-[3rem] p-12 border-border/50 shadow-2xl bg-background">
          <div className="space-y-8">
            <div className="space-y-3">
                <div className="w-16 h-16 rounded-[1.5rem] bg-emerald-500/10 text-emerald-500 flex items-center justify-center shadow-inner">
                    <DollarSign className="h-8 w-8" />
                </div>
                <h2 className="text-3xl font-black tracking-tighter text-foreground">Record Payment</h2>
                <p className="text-muted-foreground font-bold text-xs leading-relaxed">
                    Verify and enter the amount collected. Partial payments are supported for clinical cases.
                </p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Collection Amount ({selectedInvoice?.currency || orgCurrency})</label>
              <div className="flex items-stretch gap-3">
                <div className="flex items-center justify-center px-4 rounded-[1.5rem] bg-muted/40 border border-border/50 shadow-inner min-w-[70px]">
                  <span className="text-base font-black text-primary tracking-wider">{selectedInvoice?.currency || orgCurrency}</span>
                </div>
                <Input 
                  placeholder="0.00" 
                  className="h-20 flex-1 rounded-[1.5rem] border-border/50 bg-muted/30 text-3xl font-black focus:bg-background transition-all shadow-inner"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  disabled={recordingPayment}
                />
              </div>
              <div className="grid grid-cols-3 gap-3 pt-2">
                    {[100, 250, 500].map(val => (
                        <Button 
                            key={val}
                            variant="outline" 
                            className="h-12 rounded-2xl text-[11px] font-black border-border/40 hover:bg-muted/50 transition-all"
                            disabled={recordingPayment}
                            onClick={() => setPaymentAmount(val.toString())}
                        >
                            +{selectedInvoice?.currency || orgCurrency} {val}
                        </Button>
                    ))}
              </div>
            </div>

            <div className="pt-4">
                <Button 
                    className="w-full h-16 rounded-[2rem] font-black text-sm uppercase tracking-[0.2em] bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:scale-[1.03] transition-all disabled:opacity-70 disabled:hover:scale-100" 
                    onClick={() => void handleRecordPayment()}
                    disabled={recordingPayment}
                >
                    {recordingPayment ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Saving...
                      </>
                    ) : (
                      "Confirm Entry"
                    )}
                </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filters Drawer Sheet */}
      <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
        <SheetContent side="right" className="flex h-full max-h-[100dvh] w-full flex-col rounded-l-[2rem] border-border/50 p-0 sm:max-w-sm">
          <SheetHeader className="border-b border-border/40 px-6 pb-4 pt-6 pr-14 text-left">
            <SheetTitle className="flex items-center gap-2 text-lg font-black">
              <Filter className="h-5 w-5 text-primary" />
              Filter Transactions
            </SheetTitle>
            <SheetDescription>
              Narrow down the list by client or payment status.
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={(val) => setStatusFilter(String(val))}>
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="All statuses">
                      {statusFilter === "All" ? "All statuses" : statusFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="All">All statuses</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Sent">Sent</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Partial">Partial</SelectItem>
                    <SelectItem value="Overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Client account</Label>
                <Select value={clientFilter} onValueChange={(val) => setClientFilter(String(val))}>
                  <SelectTrigger className="h-11 rounded-xl bg-background">
                    <SelectValue placeholder="All clients">
                      {clientFilter === "All" ? "All clients" : clientFilter}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="rounded-xl">
                    <SelectItem value="All">All clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <SheetFooter className="mt-auto flex shrink-0 flex-row gap-2 border-t border-border/40 bg-background px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="w-full rounded-xl sm:flex-1"
              onClick={() => {
                setStatusFilter("All");
                setClientFilter("All");
                setCurrentPage(1);
              }}
            >
              Reset
            </Button>
            <Button
              type="button"
              className="w-full rounded-xl sm:flex-1"
              onClick={() => {
                setCurrentPage(1);
                setFiltersOpen(false);
              }}
            >
              Apply filters
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Bulk Price Edit Dialog */}
      <Dialog open={isBulkPriceEditOpen} onOpenChange={setIsBulkPriceEditOpen}>
        <DialogContent className="max-w-md rounded-[2rem] border-border/50 bg-background/95 backdrop-blur-xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black flex items-center gap-2">
              <DollarSign className="h-6 w-6 text-amber-500" />
              Bulk Edit Transaction Prices
            </DialogTitle>
            <DialogDescription className="font-semibold text-xs mt-1">
              Override the total billed amount for all {selectedInvoiceKeys.length} selected transactions.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">
                New Price ({orgCurrency})
              </label>
              <div className="flex items-stretch gap-3">
                <div className="flex items-center justify-center px-4 rounded-[1.5rem] bg-muted/40 border border-border/50 shadow-inner min-w-[70px]">
                  <span className="text-base font-black text-primary tracking-wider">{orgCurrency}</span>
                </div>
                <Input
                  type="number"
                  placeholder="1000.00"
                  className="h-20 flex-1 rounded-[1.5rem] border-border/50 bg-muted/30 text-3xl font-black focus:bg-background transition-all shadow-inner"
                  value={bulkEditPrice}
                  onChange={(e) => setBulkEditPrice(e.target.value)}
                  disabled={updatingPrices}
                />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed pl-1 pt-1">
                This will update the underlying appointment exam fees or quotation totals. Completed transactions will have their collected amounts synced to match.
              </p>
            </div>

            <div className="pt-4 flex gap-3">
              <Button
                variant="outline"
                className="w-full h-12 rounded-2xl font-semibold border-border/40 hover:bg-muted/50"
                onClick={() => setIsBulkPriceEditOpen(false)}
                disabled={updatingPrices}
              >
                Cancel
              </Button>
              <Button
                className="w-full h-12 rounded-2xl font-black uppercase tracking-[0.15em] bg-primary text-primary-foreground shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                onClick={() => void handleBulkPriceEditSubmit()}
                disabled={updatingPrices}
              >
                {updatingPrices ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  "Apply Override"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

