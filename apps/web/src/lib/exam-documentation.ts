import { authenticatedFetch } from "@/lib/api-client";
import type { AppointmentRecord } from "@/lib/exam-booking";

export type ExamDocumentRecord = {
  id: number;
  created_at: string;
  exam_id: number;
  name: string;
  type: string;
  url: string;
  hash?: string;
};

export type ExamPhaseRecord = {
  id: number;
  exam_id: number;
  name: string;
  start_time: string;
  end_time: string;
  notes: string;
};

export type ExamRecord = {
  id: number;
  created_at: string;
  updated_at: string;
  client_id: number;
  subject_id: number;
  examiner_id: number;
  appointment_id?: number;
  date: string;
  type: string;
  status: string;
  notes: string;
  documents?: ExamDocumentRecord[];
  phases?: ExamPhaseRecord[];
};

export async function fetchAppointment(id: number): Promise<AppointmentRecord> {
  const response = await authenticatedFetch(`/api/appointments/${id}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load appointment (${response.status})`);
  }
  return response.json();
}

export async function updateAppointment(
  id: number,
  input: Partial<{
    notes: string;
    status: string;
    questions_prepared: boolean;
  }>
): Promise<AppointmentRecord> {
  const response = await authenticatedFetch(`/api/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update appointment (${response.status})`);
  }
  return response.json();
}

export async function fetchExamByAppointment(appointmentId: number): Promise<ExamRecord | null> {
  const response = await authenticatedFetch(`/api/exams/appointment/${appointmentId}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load exam (${response.status})`);
  }
  const data = await response.json();
  return data ?? null;
}

export async function startExamDocumentation(appointmentId: number): Promise<ExamRecord> {
  const response = await authenticatedFetch(`/api/exams/appointment/${appointmentId}/start`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to start documentation (${response.status})`);
  }
  return response.json();
}

export async function updateExam(
  examId: number,
  input: Partial<{ notes: string; status: string; type: string }>
): Promise<ExamRecord> {
  const response = await authenticatedFetch(`/api/exams/${examId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update exam (${response.status})`);
  }
  return response.json();
}

export async function addExamPhase(input: {
  exam_id: number;
  name: string;
  notes?: string;
}): Promise<ExamPhaseRecord> {
  const now = new Date().toISOString();
  const response = await authenticatedFetch("/api/exams/phase", {
    method: "POST",
    body: JSON.stringify({
      exam_id: input.exam_id,
      name: input.name,
      start_time: now,
      end_time: now,
      notes: input.notes ?? "",
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to add phase (${response.status})`);
  }
  return response.json();
}

export async function fetchExamDocuments(examId: number): Promise<ExamDocumentRecord[]> {
  const response = await authenticatedFetch(`/api/reports/${examId}/documents`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load documents (${response.status})`);
  }
  return response.json();
}

export async function uploadExamDocument(
  examId: number,
  file: File,
  type: string
): Promise<ExamDocumentRecord> {
  const form = new FormData();
  form.append("exam_id", String(examId));
  form.append("type", type);
  form.append("file", file);

  const response = await authenticatedFetch("/api/reports/documents", {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to upload document (${response.status})`);
  }
  return response.json();
}

export function formatAppointmentCode(id: number): string {
  return `APT-${String(id).padStart(4, "0")}`;
}
