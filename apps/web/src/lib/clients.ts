import { authenticatedFetch } from "@/lib/api-client";
import type { AppointmentRecord } from "@/lib/exam-booking";
import type { SubjectRecord } from "@/lib/subjects";

export type ExamineeRosterEntry = {
  subject: SubjectRecord;
  session_count: number;
  completed_count: number;
  last_scheduled_at?: string;
};

export type ClientRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  client_type: string;
  gender?: string;
  contact_person?: string;
  phone?: string;
  email: string;
  address?: string;
  tax_id?: string;
  preferred_payment_method?: string;
  notes?: string;
};

export type ClientDocumentRecord = {
  id: number;
  created_at: string;
  client_id: number;
  name: string;
  type: string;
  source: string;
  url?: string;
  hash?: string;
  form_data?: string;
};

export type CreateClientInput = {
  name: string;
  client_type: string;
  gender?: string;
  contact_person?: string;
  phone?: string;
  email: string;
  address?: string;
  tax_id?: string;
  preferred_payment_method?: string;
  notes?: string;
};

export type UpdateClientInput = CreateClientInput;

export async function fetchClients(search?: string): Promise<ClientRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await authenticatedFetch(`/api/clients${query}`, {
    method: "GET",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Failed to load clients (${response.status})`);
  }

  return response.json();
}

export async function createClient(input: CreateClientInput): Promise<ClientRecord> {
  const response = await authenticatedFetch("/api/clients", {
    method: "POST",
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message = payload?.error || `Failed to create client (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

export async function updateClient(id: number, input: UpdateClientInput): Promise<ClientRecord> {
  const response = await authenticatedFetch(`/api/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update client (${response.status})`);
  }
  return response.json();
}

export async function deleteClient(id: number, confirmName: string): Promise<void> {
  const response = await authenticatedFetch(`/api/clients/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ confirm_name: confirmName }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete client (${response.status})`);
  }
}

export async function fetchClient(id: number): Promise<ClientRecord> {
  const response = await authenticatedFetch(`/api/clients/${id}`, { method: "GET" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load client (${response.status})`);
  }
  return response.json();
}

export async function bulkCreateExaminees(
  clientId: number,
  examinees: Array<{
    first_name: string;
    last_name: string;
    email?: string;
    phone?: string;
    employee_ref?: string;
  }>
): Promise<{ created: number }> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/examinees`, {
    method: "POST",
    body: JSON.stringify({ examinees }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to import examinees (${response.status})`);
  }
  const data = await response.json();
  return { created: data.created ?? examinees.length };
}

export async function fetchClientExaminees(clientId: number): Promise<ExamineeRosterEntry[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/examinees`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load examinee roster (${response.status})`);
  }
  return response.json();
}

export async function fetchClientAppointments(clientId: number): Promise<AppointmentRecord[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/appointments`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load appointments (${response.status})`);
  }
  return response.json();
}

export async function fetchClientDocuments(clientId: number): Promise<ClientDocumentRecord[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/documents`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load documents (${response.status})`);
  }
  return response.json();
}

export async function uploadClientDocument(
  clientId: number,
  file: File,
  type = "upload"
): Promise<ClientDocumentRecord> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  form.append("source", "upload");

  const response = await authenticatedFetch(`/api/clients/${clientId}/documents`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to upload document (${response.status})`);
  }
  return response.json();
}

export async function submitClientFormDocument(
  clientId: number,
  input: {
    name: string;
    type: string;
    form_data: Record<string, string>;
  }
): Promise<ClientDocumentRecord> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/documents/form`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to save form (${response.status})`);
  }
  return response.json();
}

export function formatClientCode(id: number): string {
  return `CL-${String(id).padStart(3, "0")}`;
}

export function getClientInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "--";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
