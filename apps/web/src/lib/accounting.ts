import { authenticatedFetch } from "@/lib/api-client";
import { computeQuotationTotal } from "@/lib/quotation-pricing";

export type Expense = {
  id: number;
  created_at: string;
  updated_at: string;
  expense_date: string;
  vendor: string;
  description: string;
  category: string;
  amount_ex_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_inc_vat: number;
  currency: string;
  receipt_ref?: string;
  created_by_user_id?: number;
};

export type VatReturnSummary = {
  taxable_supplies_ex_vat: number;
  output_vat: number;
  input_vat: number;
  net_vat_payable: number;
  currency: string;
};

export type VatReturnOutputLine = {
  quotation_id: number;
  invoice_code: string;
  client_name: string;
  paid_at: string;
  method: string;
  gross_paid: number;
  ex_vat_portion: number;
  vat_portion: number;
  currency: string;
};

export type VatReturnInputLine = {
  expense_id: number;
  expense_date: string;
  vendor: string;
  category: string;
  description: string;
  amount_ex_vat: number;
  vat_rate: number;
  vat_amount: number;
  amount_inc_vat: number;
  currency: string;
};

export type VatReturnReport = {
  from: string;
  to: string;
  summary: VatReturnSummary;
  output_lines: VatReturnOutputLine[];
  input_lines: VatReturnInputLine[];
};

export function computeExpenseTotals(input: {
  amountExVat: number;
  vatRate: number;
  applyVat?: boolean;
}) {
  return computeQuotationTotal({
    subtotal: input.amountExVat,
    discountAmount: 0,
    vatRate: input.vatRate,
    applyVat: input.applyVat !== false && input.vatRate > 0,
  });
}

export async function fetchExpenses(filters?: {
  from?: string;
  to?: string;
}): Promise<Expense[]> {
  const params = new URLSearchParams();
  if (filters?.from) params.set("from", filters.from);
  if (filters?.to) params.set("to", filters.to);
  const qs = params.toString();
  const response = await authenticatedFetch(
    `/api/accounting/expenses${qs ? `?${qs}` : ""}`
  );
  if (!response.ok) {
    throw new Error(`Failed to load expenses (${response.status})`);
  }
  return response.json();
}

export async function createExpense(input: {
  expense_date: string;
  vendor?: string;
  description?: string;
  category?: string;
  amount_ex_vat: number;
  vat_rate?: number;
  vat_amount?: number;
  amount_inc_vat?: number;
  currency?: string;
  receipt_ref?: string;
}): Promise<Expense> {
  const response = await authenticatedFetch("/api/accounting/expenses", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to create expense (${response.status})`);
  }
  return response.json();
}

export async function updateExpense(
  id: number,
  input: Partial<{
    expense_date: string;
    vendor: string;
    description: string;
    category: string;
    amount_ex_vat: number;
    vat_rate: number;
    vat_amount: number;
    amount_inc_vat: number;
    currency: string;
    receipt_ref: string;
  }>
): Promise<Expense> {
  const response = await authenticatedFetch(`/api/accounting/expenses/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to update expense (${response.status})`);
  }
  return response.json();
}

export async function deleteExpense(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/accounting/expenses/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    throw new Error(`Failed to delete expense (${response.status})`);
  }
}

export type SalesReportSummary = {
  total_gross_incl_vat: number;
  total_ex_vat: number;
  total_vat: number;
  payment_line_count: number;
  with_vat_line_count: number;
  without_vat_line_count: number;
  currency: string;
};

export type SalesReportLine = {
  quotation_id: number;
  invoice_code: string;
  client_name: string;
  paid_at: string;
  method: string;
  has_vat: boolean;
  vat_rate: number;
  gross_paid: number;
  ex_vat_portion: number;
  vat_portion: number;
  currency: string;
};

export type SalesReport = {
  from: string;
  to: string;
  summary: SalesReportSummary;
  lines: SalesReportLine[];
};

export async function fetchSalesReport(from: string, to: string): Promise<SalesReport> {
  const params = new URLSearchParams({ from, to });
  const response = await authenticatedFetch(`/api/accounting/sales-report?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load sales report (${response.status})`);
  }
  return response.json();
}

export async function fetchVatReturn(from: string, to: string): Promise<VatReturnReport> {
  const params = new URLSearchParams({ from, to });
  const response = await authenticatedFetch(`/api/accounting/vat-return?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load VAT return (${response.status})`);
  }
  return response.json();
}

export function formatMoney(amount: number, currency: string) {
  const code = (currency || "AED").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${Math.round(amount)}`;
  }
}

export function toDateInputValue(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthRange(year: number, monthIndex: number) {
  const from = new Date(year, monthIndex, 1);
  const to = new Date(year, monthIndex + 1, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}

export function quarterRange(year: number, quarter: 1 | 2 | 3 | 4) {
  const startMonth = (quarter - 1) * 3;
  const from = new Date(year, startMonth, 1);
  const to = new Date(year, startMonth + 3, 0);
  return { from: toDateInputValue(from), to: toDateInputValue(to) };
}
