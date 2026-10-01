import { formatMoney } from "@/lib/client-account";
import { toast } from "sonner";

export function pdfLogoUrl() {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/logo-print.png`;
  }
  return "/logo-print.png";
}

export function openPrintWindow(html: string, popupBlockedMessage = "Allow popups to download PDF") {
  const win = window.open("", "_blank");
  if (!win) {
    toast.error(popupBlockedMessage);
    return;
  }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
  }, 400);
}

export function formatPdfDate(input: string | Date): { display: string; date: Date | null } {
  const d = typeof input === "string" ? new Date(input) : input;
  if (!d || Number.isNaN(d.getTime())) {
    return { display: typeof input === "string" ? input : "—", date: null };
  }
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return { display: `${dd}-${mm}-${d.getFullYear()}`, date: d };
}

export type QuotationPdfData = {
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
  paidAmount?: number;
  balanceDue?: number;
  org: { name: string; address?: string; email?: string; phone?: string };
};

export function buildQuotationPdfHtml(data: QuotationPdfData): string {
  const logoUrl = pdfLogoUrl();
  const issue = formatPdfDate(data.issueDate);
  const validUntil = issue.date
    ? formatPdfDate(new Date(issue.date.getTime() + 30 * 24 * 60 * 60 * 1000)).display
    : "—";
  const money = (amt: number) => formatMoney(amt, data.currency);
  const showBreakdown = Boolean(
    (data.discount && data.discount.amount > 0) || (data.vat && data.vat.amount > 0),
  );

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

  const paid = Number(data.paidAmount || 0);
  const balance =
    data.balanceDue != null ? Number(data.balanceDue) : Math.max(0, data.total - paid);

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
      <div class="doc-title">Invoice</div>
      <table class="meta-table">
        <tr><td class="label">Invoice No.</td><td class="value">${data.code}</td></tr>
        <tr><td class="label">Date</td><td class="value">${issue.display}</td></tr>
        <tr><td class="label">Amount</td><td class="value">${money(data.total)}</td></tr>
        <tr><td class="label">Valid until</td><td class="value">${validUntil}</td></tr>
      </table>
    </div>
  </div>

  <div class="addresses">
    <div class="box">
      <h4>Bill To</h4>
      <div class="name">${data.client.name}</div>
      ${data.client.address ? `<div class="line">${data.client.address}</div>` : ""}
      ${data.client.phone ? `<div class="line">Phone: ${data.client.phone}</div>` : ""}
      ${data.client.email ? `<div class="line">Email: ${data.client.email}</div>` : ""}
      ${data.client.taxId ? `<div class="line">TRN: ${data.client.taxId}</div>` : ""}
    </div>
    <div class="box">
      <h4>Payment summary</h4>
      <div class="line">Total: ${money(data.total)}</div>
      <div class="line">Paid: ${money(paid)}</div>
      <div class="line"><strong>Balance due: ${money(balance)}</strong></div>
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

  <div class="footer">Thank you for choosing ${data.org.name}. This invoice is subject to acceptance within its validity period.</div>
</div>
</body>
</html>`;
}

export function downloadQuotationPdfFromData(data: QuotationPdfData) {
  openPrintWindow(buildQuotationPdfHtml(data));
}
