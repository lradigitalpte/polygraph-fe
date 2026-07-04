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
  examiner_name?: string;
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

/**
 * Money rules (keep in sync with backend billing.go):
 * - Exam type catalog `price` is always USD.
 * - Appointment fees / collected amounts are stored in org currency after save.
 * - Ledger API returns amounts already in org currency — do not convert again.
 * - Use catalogPriceInCurrency() to show USD catalog prices in another currency.
 * - Use ledgerRowMoney() for ledger rows; it converts at most once when currencies differ.
 */
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

/** Exam type catalog prices are always stored in USD in the database. */
export const CATALOG_PRICE_CURRENCY = "USD";

export function catalogPriceInCurrency(
  usdPrice: number,
  targetCurrency: string,
  rates: { usd_aed_rate?: number; usd_gbp_rate?: number; usd_eur_rate?: number }
) {
  return convertCurrency(usdPrice, CATALOG_PRICE_CURRENCY, targetCurrency, rates);
}

/** Use ledger row amounts as-is when already in org currency; convert at most once otherwise. */
export function ledgerRowMoney(
  entry: Pick<AccountLedgerEntry, "total_amount" | "paid_amount" | "currency"> & { balance_due?: number },
  orgCurrency: string,
  orgSettings: { usd_aed_rate?: number; usd_gbp_rate?: number; usd_eur_rate?: number }
) {
  const rowCurrency = (entry.currency || orgCurrency).toUpperCase();
  const to = (orgCurrency || "USD").toUpperCase();
  const total = Number(entry.total_amount || 0);
  const paid = Number(entry.paid_amount || 0);
  const balance = Math.max(0, Number(entry.balance_due ?? total - paid));

  if (rowCurrency === to) {
    return { total, paid, balance };
  }

  return {
    total: convertCurrency(total, rowCurrency, to, orgSettings),
    paid: convertCurrency(paid, rowCurrency, to, orgSettings),
    balance: Math.max(0, convertCurrency(balance, rowCurrency, to, orgSettings)),
  };
}
