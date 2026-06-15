import { authenticatedFetch } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type DocumentShareRecord = {
  id: number;
  created_at: string;
  token: string;
  client_id: number;
  subject_id?: number;
  scope: "client" | "subject";
  document_id: number;
  name: string;
  url?: string;
  recipient_email: string;
  recipient_name?: string;
  status: "sent" | "viewed";
  sent_at: string;
  viewed_at?: string;
  expires_at: string;
};

export type CreateDocumentShareInput = {
  scope: "client" | "subject";
  client_id?: number;
  subject_id?: number;
  document_id: number;
  recipient_email?: string;
  recipient_name?: string;
};

export async function createDocumentShare(
  input: CreateDocumentShareInput
): Promise<DocumentShareRecord> {
  const response = await authenticatedFetch("/api/document-shares", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to send document (${response.status})`);
  }
  // The API returns { share, warning } when the row was created but email failed.
  return (data?.share ?? data) as DocumentShareRecord;
}

export async function fetchDocumentShares(filter: {
  client_id?: number;
  subject_id?: number;
}): Promise<DocumentShareRecord[]> {
  const params = new URLSearchParams();
  if (filter.subject_id) params.set("subject_id", String(filter.subject_id));
  else if (filter.client_id) params.set("client_id", String(filter.client_id));
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await authenticatedFetch(`/api/document-shares${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load shared documents (${response.status})`);
  }
  return response.json();
}

export async function resendDocumentShare(id: number): Promise<DocumentShareRecord> {
  const response = await authenticatedFetch(`/api/document-shares/${id}/resend`, {
    method: "POST",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to resend (${response.status})`);
  }
  return data as DocumentShareRecord;
}

export type PublicSharedDocument = {
  name: string;
  url: string;
  status: string;
  recipient_name?: string;
  expires_at: string;
};

export async function fetchPublicSharedDoc(token: string): Promise<PublicSharedDocument> {
  const response = await fetch(`${API_BASE}/api/public/shared-docs/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Unable to load document (${response.status})`);
  }
  return data as PublicSharedDocument;
}

export function shareStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    sent: "Sent",
    viewed: "Viewed",
  };
  return labels[status] ?? status;
}
