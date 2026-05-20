import { authenticatedFetch } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type FormField = {
  key: string;
  label: string;
  type: string;
  required: boolean;
  options?: string[];
  help?: string;
};

export type FormSchema = {
  fields: FormField[];
};

export type FormTemplateRecord = {
  id: number;
  slug: string;
  name: string;
  category: string;
  description?: string;
  audience: string;
  schema_json: string;
  version: number;
  active: boolean;
};

export type FormRequestRecord = {
  id: number;
  token: string;
  template_id: number;
  template?: FormTemplateRecord;
  client_id: number;
  subject_id?: number;
  recipient_email: string;
  recipient_name?: string;
  status: string;
  sent_at: string;
  opened_at?: string;
  completed_at?: string;
  expires_at: string;
  client_document_id?: number;
  subject_document_id?: number;
};

export type PublicFormView = {
  request: FormRequestRecord;
  template: FormTemplateRecord;
  schema: FormSchema;
};

export function parseTemplateSchema(template: FormTemplateRecord): FormSchema {
  try {
    return JSON.parse(template.schema_json) as FormSchema;
  } catch {
    return { fields: [] };
  }
}

export async function fetchPendingFormRequests(): Promise<FormRequestRecord[]> {
  const response = await authenticatedFetch("/api/forms/requests/pending");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load pending forms (${response.status})`);
  }
  return response.json();
}

export async function fetchFormTemplates(audience?: string): Promise<FormTemplateRecord[]> {
  const query = audience ? `?audience=${encodeURIComponent(audience)}` : "";
  const response = await authenticatedFetch(`/api/forms/templates${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load form templates (${response.status})`);
  }
  return response.json();
}

export async function fetchClientFormRequests(clientId: number): Promise<FormRequestRecord[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/form-requests`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load form requests (${response.status})`);
  }
  return response.json();
}

export async function sendClientFormRequest(
  clientId: number,
  input: {
    template_id: number;
    subject_id?: number;
    recipient_email?: string;
    recipient_name?: string;
  }
): Promise<FormRequestRecord> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/form-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to send form (${response.status})`);
  }
  return response.json();
}

export async function fetchSubjectFormRequests(subjectId: number): Promise<FormRequestRecord[]> {
  const response = await authenticatedFetch(`/api/subjects/${subjectId}/form-requests`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load form requests (${response.status})`);
  }
  return response.json();
}

export async function sendSubjectFormRequest(
  subjectId: number,
  input: {
    template_id: number;
    client_id: number;
    recipient_email?: string;
    recipient_name?: string;
  }
): Promise<FormRequestRecord> {
  const response = await authenticatedFetch(`/api/subjects/${subjectId}/form-requests`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to send form (${response.status})`);
  }
  return response.json();
}

export async function resendFormRequest(requestId: number): Promise<FormRequestRecord> {
  const response = await authenticatedFetch(`/api/forms/requests/${requestId}/resend`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to resend (${response.status})`);
  }
  return response.json();
}

export async function fetchPublicForm(token: string): Promise<PublicFormView> {
  const response = await fetch(`${API_BASE}/api/public/forms/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Unable to load form (${response.status})`);
  }
  return response.json();
}

export async function submitPublicForm(
  token: string,
  formData: Record<string, string | boolean>
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/public/forms/${encodeURIComponent(token)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ form_data: formData }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to submit form (${response.status})`);
  }
}

export function formRequestStatusLabel(status: string) {
  const labels: Record<string, string> = {
    sent: "Awaiting",
    opened: "Opened",
    completed: "Completed",
    expired: "Expired",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

export function formatFormDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
