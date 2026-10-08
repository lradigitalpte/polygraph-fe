import type { Expense, SalesReport, VatReturnReport } from "@/lib/accounting";
import { toDateInputValue, toDateInputValueUTC } from "@/lib/accounting";

/** RFC4180-style CSV with UTF-8 BOM for Excel. */
export function downloadCsvFile(filename: string, rows: string[][]) {
  const escape = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const body = rows.map((r) => r.map((c) => escape(String(c))).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function buildExpensesCsvRows(
  items: Expense[],
  opts: { from?: string; to?: string; search?: string }
): string[][] {
  const periodLabel =
    opts.from && opts.to
      ? `${opts.from} to ${opts.to}`
      : opts.from
        ? `From ${opts.from}`
        : opts.to
          ? `Until ${opts.to}`
          : "All dates";

  let exVat = 0;
  let vat = 0;
  let gross = 0;
  for (const item of items) {
    exVat += item.amount_ex_vat;
    vat += item.vat_amount;
    gross += item.amount_inc_vat;
  }

  const rows: string[][] = [
    ["Polygraph — Expense export"],
    ["Period", periodLabel],
  ];
  if (opts.search?.trim()) {
    rows.push(["Search filter", opts.search.trim()]);
  }
  rows.push(
    ["Exported at", new Date().toISOString()],
    [],
    ["Date", "Vendor", "Category", "Description", "Ex-VAT", "VAT rate %", "VAT", "Incl. VAT", "Currency", "Receipt ref"],
    ...items.map((item) => [
      toDateInputValue(new Date(item.expense_date)),
      item.vendor,
      item.category,
      item.description,
      String(item.amount_ex_vat),
      String(item.vat_rate),
      String(item.vat_amount),
      String(item.amount_inc_vat),
      item.currency,
      item.receipt_ref || "",
    ]),
    [],
    ["Totals", "", "", "", String(exVat), "", String(vat), String(gross), items[0]?.currency || "", ""]
  );
  return rows;
}

export function buildVatReturnCsvRows(report: VatReturnReport, from: string, to: string): string[][] {
  const cur = report.summary.currency;
  return [
    ["Polygraph — VAT return export"],
    ["Period", `${from} to ${to}`],
    ["Exported at", new Date().toISOString()],
    [],
    ["Summary"],
    ["Taxable supplies (ex-VAT)", String(report.summary.taxable_supplies_ex_vat)],
    ["Output VAT", String(report.summary.output_vat)],
    ["Input VAT (expenses)", String(report.summary.input_vat)],
    ["Net VAT payable", String(report.summary.net_vat_payable)],
    ["Currency", cur],
    [],
    ["Sales / output VAT"],
    ["Invoice", "Client", "Payment date", "Method", "Gross paid", "Ex-VAT portion", "VAT portion", "Currency"],
    ...report.output_lines.map((l) => [
      l.invoice_code,
      l.client_name,
      toDateInputValueUTC(new Date(l.paid_at)),
      l.method,
      String(l.gross_paid),
      String(l.ex_vat_portion),
      String(l.vat_portion),
      l.currency || cur,
    ]),
    [],
    ["Expenses / input VAT"],
    ["Date", "Vendor", "Category", "Description", "Ex-VAT", "VAT rate %", "VAT", "Incl. VAT", "Currency"],
    ...report.input_lines.map((l) => [
      toDateInputValue(new Date(l.expense_date)),
      l.vendor,
      l.category,
      l.description,
      String(l.amount_ex_vat),
      String(l.vat_rate),
      String(l.vat_amount),
      String(l.amount_inc_vat),
      l.currency || cur,
    ]),
  ];
}

export function buildSalesReportCsvRows(report: SalesReport, from: string, to: string): string[][] {
  const cur = report.summary.currency;
  return [
    ["Polygraph — Sales report (all invoices)"],
    ["Period", `${from} to ${to}`],
    ["Exported at", new Date().toISOString()],
    [],
    ["Summary"],
    ["Total gross (incl. VAT where applicable)", String(report.summary.total_gross_incl_vat)],
    ["Total ex-VAT", String(report.summary.total_ex_vat)],
    ["Total VAT", String(report.summary.total_vat)],
    ["Payment lines", String(report.summary.payment_line_count)],
    ["Lines with VAT", String(report.summary.with_vat_line_count)],
    ["Lines without VAT", String(report.summary.without_vat_line_count)],
    ["Currency", cur],
    [],
    ["Detail"],
    [
      "Invoice",
      "Client",
      "Payment date",
      "Method",
      "VAT invoice",
      "VAT rate %",
      "Gross paid (incl. VAT)",
      "Ex-VAT portion",
      "VAT portion",
      "Currency",
    ],
    ...report.lines.map((l) => [
      l.invoice_code,
      l.client_name,
      toDateInputValueUTC(new Date(l.paid_at)),
      l.method,
      l.has_vat ? "Yes" : "No",
      l.has_vat ? String(l.vat_rate) : "",
      String(l.gross_paid),
      String(l.ex_vat_portion),
      String(l.vat_portion),
      l.currency || cur,
    ]),
  ];
}

export function expensesExportFilename(from?: string, to?: string) {
  if (from && to) return `expenses-${from}-to-${to}.csv`;
  if (from) return `expenses-from-${from}.csv`;
  if (to) return `expenses-until-${to}.csv`;
  return `expenses-all.csv`;
}
