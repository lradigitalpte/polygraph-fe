import { authenticatedFetch } from "@/lib/api-client";

export type QuotationRecord = {
  id: number;
  code: string;
  client_id: number;
  appointment_id?: number;
  title: string;
  description?: string;
  amount: number;
  collected_amount: number;
  status: string;
  sent_at?: string;
  sent_to_email?: string;
  email_subject?: string;
  email_body?: string;
  created_at: string;
  client?: {
    id: number;
    name: string;
    email?: string;
  };
};

export async function fetchQuotations(search?: string): Promise<QuotationRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await authenticatedFetch(`/api/quotations${query}`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load quotations (${response.status})`);
  }
  return response.json();
}

export async function createQuotation(input: {
  client_id: number;
  appointment_id?: number;
  title: string;
  description?: string;
  amount: number;
}): Promise<QuotationRecord> {
  const response = await authenticatedFetch("/api/quotations", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create quotation (${response.status})`);
  }
  return response.json();
}

export async function sendQuotationEmail(
  id: number,
  input: {
    to_email: string;
    subject?: string;
    body?: string;
  }
): Promise<void> {
  const response = await authenticatedFetch(`/api/quotations/${id}/send-email`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to send quotation email (${response.status})`);
  }
}

export async function collectQuotationPayment(
  id: number,
  input: { amount: number }
): Promise<void> {
  const response = await authenticatedFetch(`/api/quotations/${id}/collect-payment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to collect payment (${response.status})`);
  }
}
