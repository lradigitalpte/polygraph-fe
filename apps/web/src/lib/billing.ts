import { authenticatedFetch } from "@/lib/api-client";
import type { AccountLedgerEntry, AccountSummary, ClientAccountResponse } from "@/lib/client-account";
import { fetchAppointments, fetchExamTypes } from "@/lib/exam-booking";
import { fetchQuotations } from "@/lib/quotations";

function examTypePriceIndex(types: { name: string; price: number }[]) {
  return new Map(types.map((t) => [t.name.trim().toLowerCase(), Number(t.price || 0)]));
}

function titleFromNotes(notes?: string) {
  const line = (notes || "").split("\n")[0]?.trim();
  return line || "Polygraph session";
}

function resolveAppointmentFee(
  appt: { exam_fee?: number; notes?: string },
  prices: Map<string, number>,
) {
  const stored = Number(appt.exam_fee || 0);
  if (stored > 0) return stored;
  const key = titleFromNotes(appt.notes).toLowerCase();
  return prices.get(key) ?? 0;
}

export type { AccountLedgerEntry, AccountSummary };

/** Build ledger client-side when the API server has not been restarted yet. */
async function fetchBillingLedgerFallback(clientId?: number): Promise<ClientAccountResponse> {
  const [quotes, appointments, examTypes] = await Promise.all([
    fetchQuotations(),
    fetchAppointments(),
    fetchExamTypes(),
  ]);
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
    const total = resolveAppointmentFee(appt, typePrices) || Number(quote.amount || 0);
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
    });
  }

  for (const appt of filteredAppts) {
    if (seenAppts.has(appt.id)) continue;
    if (appt.status?.toLowerCase() === "cancelled") continue;
    const total = resolveAppointmentFee(appt, typePrices);
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
    });
  }

  for (const quote of filteredQuotes) {
    if (quote.appointment_id) continue;
    const total = Number(quote.amount || 0);
    const paid = Number(quote.collected_amount || 0);
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
  sentAt?: string;
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
    status: uiStatus,
    items: [{ description: entry.title, amount: total }],
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
