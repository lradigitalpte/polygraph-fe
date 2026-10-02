import { authenticatedFetch } from "@/lib/api-client";

export type QuotationPaymentEntry = {
  paid_at: string;
  amount: number;
  processing_fee?: number;
  total_charged?: number;
  method: string;
  stripe_session_id?: string;
};

export type QuotationRecord = {
  id: number;
  code: string;
  client_id: number;
  appointment_id?: number;
  title: string;
  description?: string;
  amount: number;
  subtotal_amount?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  collected_amount: number;
  status: string;
  sent_at?: string;
  sent_to_email?: string;
  email_subject?: string;
  email_body?: string;
  created_at: string;
  currency?: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  stripe_payment_link_url?: string;
  payment_history?: QuotationPaymentEntry[];
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

export async function fetchQuotation(id: number): Promise<QuotationRecord> {
  const response = await authenticatedFetch(`/api/quotations/${id}`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load quotation (${response.status})`);
  }
  return response.json();
}

export async function createQuotation(input: {
  client_id: number;
  appointment_id?: number;
  title: string;
  description?: string;
  amount: number;
  subtotal_amount?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
  currency?: string;
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
    charge_amount?: number;
    pass_processing_fee?: boolean;
    processing_fee_percent?: number;
    processing_fee_fixed?: number;
  }
): Promise<{ payment_url?: string; stripe_checkout_session_id?: string }> {
  const response = await authenticatedFetch(`/api/quotations/${id}/send-email`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to send quotation email (${response.status})`);
  }
  return response.json().catch(() => ({}));
}

// Convert a standalone quotation into a booked appointment. The quote's amount
// carries over as the fee and the quotation becomes that booking's invoice.
export async function convertQuotation(
  id: number,
  input: {
    subject_id: number;
    examiner_id: number;
    scheduled_at: string;
    duration: number;
    exam_type_id?: number;
  },
): Promise<{ id: number }> {
  const response = await authenticatedFetch(`/api/quotations/${id}/convert`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to convert quotation (${response.status})`);
  }
  return response.json();
}

export async function updateQuotation(
  id: number,
  input: {
    title?: string;
    amount?: number;
    subtotal_amount?: number;
    discount_amount?: number;
    vat_rate?: number;
    vat_amount?: number;
  },
): Promise<QuotationRecord> {
  const response = await authenticatedFetch(`/api/quotations/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update quotation (${response.status})`);
  }
  return response.json();
}

export async function approveQuotation(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/quotations/${id}/approve`, {
    method: "PATCH",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to approve quotation (${response.status})`);
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

/** Pull paid amount from Stripe when the webhook did not update the invoice. */
export async function syncQuotationStripePayment(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/quotations/${id}/sync-stripe-payment`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to sync Stripe payment (${response.status})`);
  }
}
