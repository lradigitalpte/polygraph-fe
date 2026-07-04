import { authenticatedFetch } from "@/lib/api-client";
import type { AccountLedgerEntry, AccountSummary, ClientAccountResponse } from "@/lib/client-account";
import { catalogPriceInCurrency, CATALOG_PRICE_CURRENCY, ledgerRowMoney } from "@/lib/client-account";
import { fetchAppointments, fetchExamTypes } from "@/lib/exam-booking";
import { fetchQuotations } from "@/lib/quotations";
import { fetchOrganizationSettings, type OrganizationSettings } from "@/lib/settings";

function examTypePriceIndex(types: { name: string; price: number }[]) {
  return new Map(types.map((t) => [t.name.trim().toLowerCase(), Number(t.price || 0)]));
}

function titleFromNotes(notes?: string) {
  const line = (notes || "").split("\n")[0]?.trim();
  return line || "Polygraph session";
}

/** Prefer stored org fee; fall back to catalog USD converted once. */
function resolveAppointmentFeeOrg(
  appt: { exam_fee?: number; fee_currency?: string; notes?: string },
  prices: Map<string, number>,
  orgCurrency: string,
  orgSettings: { usd_aed_rate?: number; usd_gbp_rate?: number; usd_eur_rate?: number },
) {
  const stored = Number(appt.exam_fee || 0);
  const feeCurrency = (appt.fee_currency || orgCurrency).toUpperCase();
  if (stored > 0 && feeCurrency === orgCurrency.toUpperCase()) {
    return stored;
  }
  const key = titleFromNotes(appt.notes).toLowerCase();
  const catalogUSD = prices.get(key) ?? 0;
  if (catalogUSD > 0) {
    return catalogPriceInCurrency(catalogUSD, orgCurrency, orgSettings);
  }
  if (stored > 0 && feeCurrency === CATALOG_PRICE_CURRENCY) {
    return catalogPriceInCurrency(stored, orgCurrency, orgSettings);
  }
  return stored;
}

export type { AccountLedgerEntry, AccountSummary };

/** Build ledger client-side when the billing API is unavailable (legacy fallback). */
async function fetchBillingLedgerFallback(clientId?: number): Promise<ClientAccountResponse> {
  const [quotes, appointments, examTypes, org] = await Promise.all([
    fetchQuotations(),
    fetchAppointments(),
    fetchExamTypes(),
    fetchOrganizationSettings().catch(() => ({ currency: "USD" } as OrganizationSettings)),
  ]);
  const orgCurrency = org?.currency || "USD";
  const orgSettings = {
    usd_aed_rate: org?.usd_aed_rate,
    usd_gbp_rate: org?.usd_gbp_rate,
    usd_eur_rate: org?.usd_eur_rate,
  };
  const typePrices = examTypePriceIndex(examTypes);

  const filteredQuotes = clientId
    ? quotes.filter((q) => q.client_id === clientId)
    : quotes;
  const filteredAppts = clientId
    ? appointments.filter((a) => a.client_id === clientId)
    : appointments;

  const apptByID = new Map(filteredAppts.map((a) => [a.id, a]));
  const seenAppts = new Set<number>();
  const entries: AccountLedgerEntry[] = [];

  for (const quote of filteredQuotes) {
    if (!quote.appointment_id) continue;
    const appt = apptByID.get(quote.appointment_id);
    if (!appt) continue;
    seenAppts.add(appt.id);
    const total =
      resolveAppointmentFeeOrg(appt, typePrices, orgCurrency, orgSettings) ||
      Number(quote.amount || 0);
    const paid = Number(appt.collected_amount ?? quote.collected_amount ?? 0);
    entries.push({
      id: quote.id,
      source: "booking",
      code: quote.code || `INV-${String(quote.id).padStart(4, "0")}`,
      reference_id: appt.id,
      appointment_id: appt.id,
      quotation_id: quote.id,
      client_id: appt.client_id,
      client_name: quote.client?.name ?? appt.client?.name,
      client_email: quote.client?.email ?? appt.client?.email,
      title: titleFromNotes(appt.notes) || quote.title,
      date: appt.scheduled_at,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
      status: appt.payment_status ?? quote.status,
      payment_mode: appt.payment_mode,
      currency: orgCurrency,
    });
  }

  for (const appt of filteredAppts) {
    if (seenAppts.has(appt.id)) continue;
    if (appt.status?.toLowerCase() === "cancelled") continue;
    const total = resolveAppointmentFeeOrg(appt, typePrices, orgCurrency, orgSettings);
    const paid = Number(appt.collected_amount || 0);
    if (total <= 0 && paid <= 0 && !appt.notes?.trim()) continue;
    entries.push({
      id: appt.id,
      source: "session",
      code: `APT-${String(appt.id).padStart(4, "0")}`,
      reference_id: appt.id,
      appointment_id: appt.id,
      client_id: appt.client_id,
      client_name: appt.client?.name,
      client_email: appt.client?.email,
      title: titleFromNotes(appt.notes),
      date: appt.scheduled_at,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
      status: appt.payment_status ?? "Unpaid",
      payment_mode: appt.payment_mode,
      currency: orgCurrency,
    });
  }

  for (const quote of filteredQuotes) {
    if (quote.appointment_id) continue;
    const quoteCur = (quote.currency || orgCurrency).toUpperCase();
    const total = ledgerRowMoney(
      { total_amount: quote.amount, paid_amount: 0, currency: quoteCur },
      orgCurrency,
      orgSettings,
    ).total;
    const paid = ledgerRowMoney(
      { total_amount: 0, paid_amount: quote.collected_amount, currency: quoteCur },
      orgCurrency,
      orgSettings,
    ).paid;
    entries.push({
      id: quote.id,
      source: "quote",
      code: quote.code || `INV-${String(quote.id).padStart(4, "0")}`,
      reference_id: quote.id,
      quotation_id: quote.id,
      client_id: quote.client_id,
      client_name: quote.client?.name,
      client_email: quote.client?.email,
      title: quote.title,
      date: quote.created_at,
      total_amount: total,
      paid_amount: paid,
      balance_due: Math.max(0, total - paid),
      status: quote.status,
      currency: orgCurrency,
    });
  }

  const summary = entries.reduce(
    (acc, e) => ({
      total_billed: acc.total_billed + e.total_amount,
      total_paid: acc.total_paid + e.paid_amount,
      balance_due: 0,
    }),
    { total_billed: 0, total_paid: 0, balance_due: 0 },
  );
  summary.balance_due = Math.max(0, summary.total_billed - summary.total_paid);

  return { summary, entries };
}

export async function fetchBillingLedger(clientId?: number): Promise<ClientAccountResponse> {
  const query = clientId ? `?client_id=${clientId}` : "";
  let data: ClientAccountResponse | null = null;

  for (const path of [`/api/billing/ledger${query}`, `/api/appointments/billing/ledger${query}`]) {
    const response = await authenticatedFetch(path, { method: "GET" });
    if (response.ok) {
      data = await response.json();
      break;
    }
    if (response.status !== 404) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Failed to load billing (${response.status})`);
    }
  }

  if (!data) {
    data = await fetchBillingLedgerFallback(clientId);
  } else if (data.entries.length === 0) {
    const fallback = await fetchBillingLedgerFallback(clientId);
    if (fallback.entries.length > 0) {
      data = fallback;
    }
  }

  return data;
}

// Delete an invoice. A quotation-backed invoice deletes the quotation; a pure
// session invoice deletes the appointment. Requires the payment:manage permission.
export async function deleteInvoice(invoice: {
  quotationId?: number;
  appointmentId?: number;
}): Promise<void> {
  const target = invoice.quotationId
    ? `/api/quotations/${invoice.quotationId}`
    : invoice.appointmentId
      ? `/api/appointments/${invoice.appointmentId}`
      : null;
  if (!target) throw new Error("Nothing to delete for this invoice");

  const response = await authenticatedFetch(target, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete invoice (${response.status})`);
  }
}

export type FinancialInvoice = {
  id: number;
  source: "booking" | "session" | "quote";
  code: string;
  clientId: number;
  client: string;
  clientEmail?: string;
  appointmentId?: number;
  quotationId?: number;
  date: string;
  totalAmount: number;
  paidAmount: number;
  status: string;
  items: { description: string; amount: number }[];
  balanceDue?: number;
  sentAt?: string;
  currency?: string;
  examinerName?: string;
};

export function mapLedgerEntryToInvoice(entry: AccountLedgerEntry): FinancialInvoice {
  const date = new Date(entry.date);
  const formattedDate = Number.isNaN(date.getTime())
    ? entry.date
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const paid = Number(entry.paid_amount || 0);
  const total = Number(entry.total_amount || 0);
  const balance = Number(entry.balance_due ?? Math.max(0, total - paid));

  let uiStatus = "Pending";
  const raw = (entry.status || "").toLowerCase();
  if (raw === "paid" || raw === "completed") {
    uiStatus = balance <= 0 && total > 0 ? "Completed" : paid > 0 ? "Partial" : "Completed";
  } else if (raw === "partial") {
    uiStatus = "Partial";
  } else if (balance <= 0 && total > 0) {
    uiStatus = "Completed";
  } else if (raw === "sent") {
    uiStatus = "Sent";
  } else if (raw === "overdue") {
    uiStatus = "Overdue";
  } else if (paid > 0) {
    uiStatus = "Partial";
  }

  return {
    id: entry.quotation_id ?? entry.id,
    source: entry.source,
    code: entry.code,
    clientId: entry.client_id,
    client: entry.client_name || `Client #${entry.client_id}`,
    clientEmail: entry.client_email,
    appointmentId: entry.appointment_id,
    quotationId: entry.quotation_id,
    date: formattedDate,
    totalAmount: total,
    paidAmount: paid,
    balanceDue: balance,
    status: uiStatus,
    items: [{ description: entry.title, amount: total }],
    currency: entry.currency,
    examinerName: entry.examiner_name,
  };
}

export function ledgerEntryCollectTarget(entry: AccountLedgerEntry): {
  kind: "appointment" | "quotation";
  id: number;
} {
  if (entry.appointment_id) {
    return { kind: "appointment", id: entry.appointment_id };
  }
  return { kind: "quotation", id: entry.quotation_id ?? entry.reference_id };
}

export async function bulkEditInvoicePrices(
  targets: {
    source: string;
    id: number;
    appointmentId?: number;
    quotationId?: number;
  }[],
  newPrice: number
): Promise<void> {
  const response = await authenticatedFetch("/api/billing/bulk-edit-prices", {
    method: "POST",
    body: JSON.stringify({
      targets: targets.map((t) => ({
        source: t.source,
        id: t.id,
        appointment_id: t.appointmentId || undefined,
        quotation_id: t.quotationId || undefined,
      })),
      new_price: newPrice,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to bulk edit prices (${response.status})`);
  }
}
