import { authenticatedFetch } from "@/lib/api-client";

export type ExamTypeRecord = {
  id: number;
  name: string;
  description?: string;
  category?: string;
  duration: number;
  price: number;
  active: boolean;
};

export type AvailabilityBlockRecord = {
  id: number;
  examiner_id: number;
  date: string;
  start_time?: string;
  end_time?: string;
  is_full_day: boolean;
  reason?: string;
};

export type BusyPeriodRecord = {
  start_time?: string;
  end_time?: string;
  source: "block" | "appointment";
  reason?: string;
  is_full_day?: boolean;
};

export type ExaminerAvailabilityRecord = {
  examiner_id: number;
  date: string;
  is_blocked: boolean;
  blocks: AvailabilityBlockRecord[];
  busy_periods?: BusyPeriodRecord[];
};

export type CreateAppointmentInput = {
  client_id: number;
  subject_id: number;
  examiner_id: number;
  scheduled_at: string;
  duration: number;
  exam_fee?: number;
  collected_amount?: number;
  payment_status?: string;
  payment_mode: string;
  notes: string;
  status?: string;
};

export type AppointmentRecord = {
  id: number;
  created_at?: string;
  updated_at?: string;
  client_id: number;
  subject_id: number;
  examiner_id: number;
  scheduled_at: string;
  duration: number;
  exam_fee?: number;
  collected_amount?: number;
  status: string;
  payment_mode?: string;
  payment_status?: string;
  questions_prepared?: boolean;
  notes: string;
  exam_id?: number;
  client?: {
    id: number;
    name: string;
    email?: string;
  };
};

export async function fetchExamTypes(): Promise<ExamTypeRecord[]> {
  const response = await authenticatedFetch("/api/exams/types");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load exam types (${response.status})`);
  }
  return response.json();
}

export async function createExamType(input: {
  name: string;
  description?: string;
  category?: string;
  duration: number;
  price: number;
  active: boolean;
}): Promise<ExamTypeRecord> {
  const response = await authenticatedFetch("/api/exams/types", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create exam type (${response.status})`);
  }
  return response.json();
}

export async function updateExamType(
  id: number,
  input: Partial<{
    name: string;
    description: string;
    category: string;
    duration: number;
    price: number;
    active: boolean;
  }>
): Promise<ExamTypeRecord> {
  const response = await authenticatedFetch(`/api/exams/types/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update exam type (${response.status})`);
  }
  return response.json();
}

export async function deleteExamType(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/exams/types/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete exam type (${response.status})`);
  }
}

export async function fetchExaminerAvailability(examinerId: number, date: string): Promise<ExaminerAvailabilityRecord> {
  const response = await authenticatedFetch(`/api/availability/examiners/${examinerId}?date=${encodeURIComponent(date)}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load examiner availability (${response.status})`);
  }
  return response.json();
}

export async function fetchAvailabilityBlocks(filters?: {
  examiner_id?: number;
  date?: string;
}): Promise<AvailabilityBlockRecord[]> {
  const params = new URLSearchParams();
  if (filters?.examiner_id) {
    params.set("examiner_id", String(filters.examiner_id));
  }
  if (filters?.date) {
    params.set("date", filters.date);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await authenticatedFetch(`/api/availability/blocks${suffix}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load availability blocks (${response.status})`);
  }
  return response.json();
}

export async function createAvailabilityBlock(input: {
  examiner_id: number;
  date: string;
  start_time?: string;
  end_time?: string;
  is_full_day: boolean;
  reason?: string;
}): Promise<AvailabilityBlockRecord> {
  const response = await authenticatedFetch("/api/availability/blocks", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create availability block (${response.status})`);
  }
  return response.json();
}

export async function updateAvailabilityBlock(
  id: number,
  input: Partial<{
    examiner_id: number;
    date: string;
    start_time: string;
    end_time: string;
    is_full_day: boolean;
    reason: string;
  }>
): Promise<AvailabilityBlockRecord> {
  const response = await authenticatedFetch(`/api/availability/blocks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update availability block (${response.status})`);
  }
  return response.json();
}

export async function deleteAvailabilityBlock(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/availability/blocks/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete availability block (${response.status})`);
  }
}

export async function createAppointment(input: CreateAppointmentInput) {
  const response = await authenticatedFetch("/api/appointments", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create appointment (${response.status})`);
  }
  return response.json();
}

export async function fetchAppointments(): Promise<AppointmentRecord[]> {
  const response = await authenticatedFetch("/api/appointments", {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load appointments (${response.status})`);
  }
  return response.json();
}

export async function updateAppointmentPayment(
  id: number,
  input: {
    payment_status: string;
    exam_fee?: number;
  }
): Promise<void> {
  const response = await authenticatedFetch(`/api/appointments/${id}/payment`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update payment (${response.status})`);
  }
}
