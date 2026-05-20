import { authenticatedFetch } from "@/lib/api-client";

export type SubjectRecord = {
  id: number;
  client_id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  employee_ref?: string;
  gender?: string;
  nationality?: string;
  spoken_language?: string;
  written_language?: string;
  id_number?: string;
  dob?: string;
  created_at: string;
  updated_at: string;
};

export type CreateSubjectInput = {
  client_id?: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  employee_ref?: string;
  gender?: string;
  nationality?: string;
  spoken_language?: string;
  written_language?: string;
  id_number?: string;
  dob?: string;
};

export function formatSubjectName(subject: Pick<SubjectRecord, "first_name" | "last_name">) {
  return [subject.first_name, subject.last_name].filter(Boolean).join(" ").trim();
}

export function formatSubjectCode(id: number) {
  return `EXM-${String(id).padStart(4, "0")}`;
}

export async function fetchSubjects(
  search?: string,
  clientId?: number
): Promise<SubjectRecord[]> {
  const params = new URLSearchParams();
  if (search?.trim()) params.set("search", search.trim());
  if (clientId) params.set("client_id", String(clientId));
  const query = params.toString() ? `?${params.toString()}` : "";
  const response = await authenticatedFetch(`/api/subjects${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load subjects (${response.status})`);
  }
  return response.json();
}

export async function createSubject(input: CreateSubjectInput): Promise<SubjectRecord> {
  const response = await authenticatedFetch("/api/subjects", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create subject (${response.status})`);
  }
  return response.json();
}

export async function fetchSubject(id: number): Promise<SubjectRecord> {
  const response = await authenticatedFetch(`/api/subjects/${id}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load examinee (${response.status})`);
  }
  return response.json();
}

export async function updateSubject(
  id: number,
  input: Partial<CreateSubjectInput>
): Promise<SubjectRecord> {
  const response = await authenticatedFetch(`/api/subjects/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update examinee (${response.status})`);
  }
  return response.json();
}

export type SubjectDocumentRecord = {
  id: number;
  created_at: string;
  subject_id: number;
  client_id: number;
  name: string;
  type: string;
  source: string;
  url?: string;
  hash?: string;
  form_data?: string;
};

export async function fetchSubjectDocuments(subjectId: number): Promise<SubjectDocumentRecord[]> {
  const response = await authenticatedFetch(`/api/subjects/${subjectId}/documents`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load documents (${response.status})`);
  }
  return response.json();
}

export async function uploadSubjectDocument(
  subjectId: number,
  file: File,
  type = "upload"
): Promise<SubjectDocumentRecord> {
  const form = new FormData();
  form.append("file", file);
  form.append("type", type);
  form.append("source", "upload");

  const response = await authenticatedFetch(`/api/subjects/${subjectId}/documents`, {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to upload document (${response.status})`);
  }
  return response.json();
}

export async function fetchSubjectAppointments(
  subjectId: number,
  clientId?: number
): Promise<import("@/lib/exam-booking").AppointmentRecord[]> {
  const query = clientId ? `?client_id=${clientId}` : "";
  const response = await authenticatedFetch(`/api/subjects/${subjectId}/appointments${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load sessions (${response.status})`);
  }
  return response.json();
}