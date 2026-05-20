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

export function formatMoney(amount: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}
