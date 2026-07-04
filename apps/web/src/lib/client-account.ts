import { authenticatedFetch } from "@/lib/api-client";
import { fetchBillingLedger } from "@/lib/billing";
import type { AppointmentRecord } from "@/lib/exam-booking";

export type AccountSummary = {
  total_billed: number;
  total_paid: number;
  balance_due: number;
};

export type AccountLedgerEntry = {
  id: number;
  source: "booking" | "session" | "quote";
  code: string;
  reference_id: number;
  appointment_id?: number;
  quotation_id?: number;
  client_id: number;
  client_name?: string;
  client_email?: string;
  title: string;
  date: string;
  total_amount: number;
  paid_amount: number;
  balance_due: number;
  status: string;
  payment_mode?: string;
  currency?: string;
};

export type ClientAccountResponse = {
  summary: AccountSummary;
  entries: AccountLedgerEntry[];
};

export async function fetchClientAccount(clientId: number): Promise<ClientAccountResponse> {
  return fetchBillingLedger(clientId);
}

export async function collectAppointmentPayment(
  appointmentId: number,
  input: { amount: number }
): Promise<AppointmentRecord> {
  const response = await authenticatedFetch(`/api/appointments/${appointmentId}/collect-payment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to record payment (${response.status})`);
  }
  return response.json();
}

export async function sendAppointmentPaymentReminder(
  appointmentId: number,
  input: {
    to_email?: string;
    subject?: string;
    body?: string;
  }
): Promise<void> {
  const response = await authenticatedFetch(
    `/api/appointments/${appointmentId}/send-payment-reminder`,
    {
      method: "PATCH",
      body: JSON.stringify(input),
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to send reminder (${response.status})`);
  }
}

export function paymentBalance(total: number, paid: number) {
  const balance = total - paid;
  return balance > 0 ? balance : 0;
}

export function formatMoney(amount: number, currency = "USD") {
  const cleanCurrency = (currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: cleanCurrency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch (e) {
    return `${cleanCurrency} ${amount.toFixed(2)}`;
  }
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: { usd_aed_rate?: number; usd_gbp_rate?: number; usd_eur_rate?: number }
) {
  const cleanFrom = (from || "USD").toUpperCase();
  const cleanTo = (to || "USD").toUpperCase();
  if (cleanFrom === cleanTo) return amount;

  const rateMap: Record<string, number> = {
    USD: 1,
    AED: rates.usd_aed_rate ?? 3.6725,
    GBP: rates.usd_gbp_rate ?? 0.7850,
    EUR: rates.usd_eur_rate ?? 0.9250,
  };

  const rateFrom = rateMap[cleanFrom] ?? 1;
  const rateTo = rateMap[cleanTo] ?? 1;

  const amountInUSD = amount / rateFrom;
  return amountInUSD * rateTo;
}

/** Normalize a ledger row to org currency; amounts from the API are usually already normalized. */
export function ledgerRowMoney(
  entry: Pick<AccountLedgerEntry, "total_amount" | "paid_amount" | "balance_due" | "currency">,
  orgCurrency: string,
  orgSettings: { usd_aed_rate?: number; usd_gbp_rate?: number; usd_eur_rate?: number }
) {
  const from = (entry.currency || orgCurrency).toUpperCase();
  const to = (orgCurrency || "USD").toUpperCase();
  const total = convertCurrency(Number(entry.total_amount || 0), from, to, orgSettings);
  const paid = convertCurrency(Number(entry.paid_amount || 0), from, to, orgSettings);
  const balance = Math.max(0, Number(entry.balance_due ?? total - paid));
  return { total, paid, balance };
}
