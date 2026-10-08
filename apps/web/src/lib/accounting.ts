import { authenticatedFetch } from "@/lib/api-client";
import { wholeMoneyAmount } from "@/lib/client-account";
import { computeQuotationTotal } from "@/lib/quotation-pricing";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type ExpensePaymentMethod = {
  id: number;
  label: string;
  type: string;
  last_four?: string;
  bank_name?: string;
  is_default?: boolean;
};

export type ExpensePurchaseItem = {
  id: number;
  name: string;
  description: string;
  category: string;
  default_amount_ex_vat: number;
  vat_mode: "rate" | "fixed" | "none" | string;
  vat_rate: number;
  vat_amount_fixed: number;
  active: boolean;
};

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
  receipt_file_name?: string;
  receipt_url?: string;
  purchase_item_id?: number;
  payment_method_id?: number;
  payment_type?: string;
  payment_label?: string;
  payment_last_four?: string;
  payment_method?: ExpensePaymentMethod;
  purchase_item?: ExpensePurchaseItem;
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
  vatMode?: string;
  vatAmountFixed?: number;
}) {
  const ex = wholeMoneyAmount(Math.max(0, input.amountExVat));
  const applyVat = input.applyVat !== false && input.vatMode !== "none";
  if (applyVat && input.vatMode === "fixed") {
    const vatAmount = wholeMoneyAmount(input.vatAmountFixed ?? 0);
    return {
      subtotal: ex,
      discountAmount: 0,
      afterDiscount: ex,
      vatRate: 0,
      vatAmount,
      total: ex + vatAmount,
    };
  }
  return computeQuotationTotal({
    subtotal: ex,
    discountAmount: 0,
    vatRate: input.vatRate,
    applyVat: applyVat && input.vatRate > 0,
  });
}

export function resolveReceiptUrl(receiptUrl?: string) {
  if (!receiptUrl) return "";
  if (receiptUrl.startsWith("http://") || receiptUrl.startsWith("https://")) return receiptUrl;
  return `${API_BASE.replace(/\/$/, "")}${receiptUrl.startsWith("/") ? "" : "/"}${receiptUrl}`;
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
  const data = await response.json();
  return Array.isArray(data) ? data : [];
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
  purchase_item_id?: number;
  payment_method_id?: number;
  payment_type?: string;
  payment_label?: string;
  payment_last_four?: string;
  payment_bank_name?: string;
  save_payment_method?: boolean;
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
    purchase_item_id: number;
    payment_method_id: number;
    payment_type: string;
    payment_label: string;
    payment_last_four: string;
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

export async function uploadExpenseReceipt(expenseId: number, file: File): Promise<Expense> {
  const form = new FormData();
  form.append("file", file);
  const response = await authenticatedFetch(`/api/accounting/expenses/${expenseId}/receipt`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to upload receipt");
  }
  return response.json();
}

export async function fetchPaymentMethods(): Promise<ExpensePaymentMethod[]> {
  const response = await authenticatedFetch("/api/accounting/payment-methods");
  if (!response.ok) throw new Error("Failed to load payment methods");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function fetchPurchaseItems(search?: string, includeInactive = false): Promise<ExpensePurchaseItem[]> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if includeInactive) params.set("include_inactive", "true");
  const qs = params.toString();
  const response = await authenticatedFetch(`/api/accounting/purchase-items${qs ? `?${qs}` : ""}`);
  if (!response.ok) throw new Error("Failed to load purchase items");
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function createPurchaseItem(input: Omit<ExpensePurchaseItem, "id" | "active"> & { active?: boolean }) {
  const response = await authenticatedFetch("/api/accounting/purchase-items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to create item");
  }
  return response.json() as Promise<ExpensePurchaseItem>;
}

export async function updatePurchaseItem(id: number, input: Partial<ExpensePurchaseItem>) {
  const response = await authenticatedFetch(`/api/accounting/purchase-items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || "Failed to update item");
  }
  return response.json() as Promise<ExpensePurchaseItem>;
}

export async function deletePurchaseItem(id: number) {
  const response = await authenticatedFetch(`/api/accounting/purchase-items/${id}`, { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete item");
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
  const data: SalesReport = await response.json();
  return {
    ...data,
    lines: data.lines ?? [],
    summary: data.summary ?? {
      total_gross_incl_vat: 0,
      total_ex_vat: 0,
      total_vat: 0,
      payment_line_count: 0,
      with_vat_line_count: 0,
      without_vat_line_count: 0,
      currency: "AED",
    },
  };
}

export async function fetchVatReturn(from: string, to: string): Promise<VatReturnReport> {
  const params = new URLSearchParams({ from, to });
  const response = await authenticatedFetch(`/api/accounting/vat-return?${params}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Failed to load VAT return (${response.status})`);
  }
  const data: VatReturnReport = await response.json();
  return {
    ...data,
    output_lines: data.output_lines ?? [],
    input_lines: data.input_lines ?? [],
    summary: data.summary ?? {
      taxable_supplies_ex_vat: 0,
      output_vat: 0,
      input_vat: 0,
      net_vat_payable: 0,
      currency: "AED",
    },
  };
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
