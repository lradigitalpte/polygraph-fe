import { authenticatedFetch } from "@/lib/api-client";

export type AgreementKind = "payment" | "reschedule" | "cancellation" | "custom";

export const AGREEMENT_KIND_LABELS: Record<AgreementKind, string> = {
  payment: "Payment",
  reschedule: "Reschedule",
  cancellation: "Cancellation",
  custom: "Custom",
};

export type AgreementTemplate = {
  id: number;
  title: string;
  kind: AgreementKind;
  body_html: string;
  version: number;
  active: boolean;
  sort_order: number;
  updated_by?: string;
  created_at: string;
  updated_at: string;
};

export type AgreementTemplateInput = {
  title: string;
  kind: AgreementKind;
  body_html: string;
  active?: boolean;
  sort_order?: number;
};

async function parseOrThrow<T>(response: Response, fallback: string): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `${fallback} (${response.status})`);
  return data as T;
}

export async function fetchAgreementTemplates(includeInactive = false): Promise<AgreementTemplate[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const response = await authenticatedFetch(`/api/agreements/templates${query}`);
  return parseOrThrow(response, "Failed to load agreements");
}

export async function createAgreementTemplate(input: AgreementTemplateInput): Promise<AgreementTemplate> {
  const response = await authenticatedFetch("/api/agreements/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseOrThrow(response, "Failed to create agreement");
}

export async function updateAgreementTemplate(id: number, input: AgreementTemplateInput): Promise<AgreementTemplate> {
  const response = await authenticatedFetch(`/api/agreements/templates/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return parseOrThrow(response, "Failed to save agreement");
}

export async function setAgreementTemplateActive(id: number, active: boolean): Promise<AgreementTemplate> {
  const response = await authenticatedFetch(`/api/agreements/templates/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
  return parseOrThrow(response, "Failed to update agreement");
}

export async function deleteAgreementTemplate(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/agreements/templates/${id}`, { method: "DELETE" });
  await parseOrThrow(response, "Failed to delete agreement");
}

// --- Agreement requests (sent to clients) ---------------------------------------

export type AgreementRequestStatus = "sent" | "viewed" | "signed" | "declined" | "expired" | "voided";

export const AGREEMENT_STATUS_LABELS: Record<AgreementRequestStatus, string> = {
  sent: "Awaiting signature",
  viewed: "Opened",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
  voided: "Voided",
};

export type AgreementRequestItem = {
  id: number;
  template_id: number;
  template_version: number;
  kind: AgreementKind;
  title: string;
  body_html?: string;
  sort_order: number;
  accepted_at?: string;
};

export type AgreementRequest = {
  id: number;
  created_at: string;
  client_id: number;
  appointment_id?: number;
  recipient_email: string;
  recipient_name: string;
  status: AgreementRequestStatus;
  sent_at: string;
  viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  voided_at?: string;
  voided_by?: string;
  expires_at: string;
  sent_by_email?: string;
  content_hash: string;
  signed_name?: string;
  signature_hash?: string;
  signer_ip?: string;
  signer_user_agent?: string;
  client_document_id?: number;
  items: AgreementRequestItem[];
  /** Signing link; only present while the request is still open. */
  link?: string;
};

export type AgreementRequestDetail = AgreementRequest & { signature_data_url?: string };

export type SendAgreementsInput = {
  appointment_id?: number;
  template_ids: number[];
  recipient_email?: string;
  recipient_name?: string;
};

export type SendAgreementsResult = {
  request: AgreementRequest;
  link: string;
  email_error?: string;
};

export function isAgreementRequestOpen(request: Pick<AgreementRequest, "status">) {
  return request.status === "sent" || request.status === "viewed";
}

export async function fetchClientAgreementRequests(clientId: number): Promise<AgreementRequest[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/agreements`);
  return parseOrThrow(response, "Failed to load agreements");
}

export async function sendClientAgreements(
  clientId: number,
  input: SendAgreementsInput,
): Promise<SendAgreementsResult> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/agreements`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return parseOrThrow(response, "Failed to send agreements");
}

export async function fetchAgreementRequest(id: number): Promise<AgreementRequestDetail> {
  const response = await authenticatedFetch(`/api/agreements/requests/${id}`);
  return parseOrThrow(response, "Failed to load agreement");
}

export async function resendAgreementRequest(id: number): Promise<AgreementRequest> {
  const response = await authenticatedFetch(`/api/agreements/requests/${id}/resend`, { method: "POST" });
  return parseOrThrow(response, "Failed to resend agreements");
}

export async function voidAgreementRequest(id: number): Promise<AgreementRequest> {
  const response = await authenticatedFetch(`/api/agreements/requests/${id}/void`, { method: "POST" });
  return parseOrThrow(response, "Failed to void agreements");
}

// --- Public signing page (no auth) ------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type PublicAgreementView = {
  status: AgreementRequestStatus;
  recipient_name: string;
  expires_at: string;
  signed_at?: string;
  signed_name?: string;
  declined_at?: string;
  organization: {
    name: string;
    website?: string;
    logo_data_url?: string;
    phone?: string;
    support_email?: string;
    address?: string;
  };
  booking?: {
    scheduled_at: string;
    duration: number;
    exam_type?: string;
    exam_fee: number;
    collected_amount: number;
    currency: string;
  };
  items: { id: number; title: string; kind: AgreementKind; body_html: string; accepted_at?: string }[];
};

async function publicRequest(path: string, init?: RequestInit): Promise<PublicAgreementView> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/api/public/agreements/${path}`, {
      ...init,
      headers: { Accept: "application/json", "Content-Type": "application/json" },
    });
  } catch {
    throw new Error("We couldn't reach the server. Check your connection and try again.");
  }
  const data = await response.json().catch(() => null);
  if (response.status === 429) throw new Error("Too many attempts. Please wait a minute and try again.");
  if (!response.ok) throw new Error(data?.error || `Something went wrong (${response.status})`);
  return data as PublicAgreementView;
}

export function fetchPublicAgreement(token: string) {
  return publicRequest(encodeURIComponent(token), { method: "GET" });
}

export function signPublicAgreement(
  token: string,
  input: { signed_name: string; signature_data_url: string; accepted_item_ids: number[] },
) {
  return publicRequest(`${encodeURIComponent(token)}/sign`, { method: "POST", body: JSON.stringify(input) });
}

export function declinePublicAgreement(token: string, reason: string) {
  return publicRequest(`${encodeURIComponent(token)}/decline`, { method: "POST", body: JSON.stringify({ reason }) });
}

/** Direct download URL for the client's signed PDF (public, via their signing link). */
export function publicAgreementPdfUrl(token: string) {
  return `${API_BASE}/api/public/agreements/${encodeURIComponent(token)}/pdf`;
}

/** Downloads the signed PDF for staff (authenticated). */
export async function downloadAgreementPdf(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/agreements/requests/${id}/pdf`);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Failed to download PDF (${response.status})`);
  }
  const blob = await response.blob();
  const match = (response.headers.get("Content-Disposition") || "").match(/filename="([^"]+)"/i);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = match?.[1] || `Signed-agreement-AGR-${String(id).padStart(6, "0")}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// --- Agreement state per booking (warnings only) ----------------------------------

export type BookingAgreementState = "signed" | "awaiting" | "declined" | "not_sent";

export type BookingAgreementStatus = {
  state: BookingAgreementState;
  request_id?: number;
  sent_at?: string;
  signed_at?: string;
};

const BOOKING_STATUS_BATCH = 500;

/**
 * Agreement state keyed by appointment id. Bookings under corporate/law-firm accounts
 * are absent from the result: they don't sign agreements online.
 */
export async function fetchBookingAgreementStatuses(
  appointmentIds: number[],
): Promise<Record<number, BookingAgreementStatus>> {
  const ids = Array.from(new Set(appointmentIds.filter((id) => id > 0)));
  const result: Record<number, BookingAgreementStatus> = {};
  for (let i = 0; i < ids.length; i += BOOKING_STATUS_BATCH) {
    const batch = ids.slice(i, i + BOOKING_STATUS_BATCH).join(",");
    const response = await authenticatedFetch(`/api/agreements/booking-status?appointment_ids=${batch}`);
    Object.assign(result, await parseOrThrow<Record<number, BookingAgreementStatus>>(response, "Failed to load agreement statuses"));
  }
  return result;
}

/** A booking needs attention when it is still upcoming and agreements aren't signed. */
export function needsAgreementWarning(
  status: BookingAgreementStatus | undefined,
  booking: { status?: string; scheduled_at: string | Date },
): boolean {
  if (!status || status.state === "signed") return false;
  const bookingStatus = (booking.status ?? "").toLowerCase();
  if (bookingStatus === "cancelled" || bookingStatus === "completed") return false;
  const scheduled = new Date(booking.scheduled_at).getTime();
  // Keep warning through the session day itself.
  return Number.isNaN(scheduled) || scheduled > Date.now() - 24 * 60 * 60 * 1000;
}
