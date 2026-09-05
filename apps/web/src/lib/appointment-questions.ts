import { authenticatedFetch } from "@/lib/api-client";
import type { QuestionCategory } from "@/lib/question-templates";

/**
 * Questions prepared for a booking before its examination record exists. Once
 * documentation starts these are copied into exam questions and become frozen
 * history — writes here then return 409.
 */
export type AppointmentQuestionRecord = {
  id: number;
  appointment_id: number;
  text: string;
  category?: QuestionCategory | "";
  sort_order: number;
};

export type AppointmentQuestionInput = {
  text: string;
  category?: QuestionCategory | "";
};

export async function fetchAppointmentQuestions(
  appointmentId: number
): Promise<AppointmentQuestionRecord[]> {
  const response = await authenticatedFetch(`/api/appointments/${appointmentId}/questions`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load prepared questions (${response.status})`);
  }
  return response.json();
}

/** Overwrites the booking's prepared questions with the given list, in order. */
export async function replaceAppointmentQuestions(
  appointmentId: number,
  questions: AppointmentQuestionInput[]
): Promise<AppointmentQuestionRecord[]> {
  const response = await authenticatedFetch(`/api/appointments/${appointmentId}/questions`, {
    method: "PUT",
    body: JSON.stringify({ questions }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to save prepared questions (${response.status})`);
  }
  return response.json();
}

export async function addAppointmentQuestionsFromTemplates(
  appointmentId: number,
  templateIds: number[]
): Promise<AppointmentQuestionRecord[]> {
  const response = await authenticatedFetch(
    `/api/appointments/${appointmentId}/questions/from-templates`,
    {
      method: "POST",
      body: JSON.stringify({ template_ids: templateIds }),
    }
  );
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to add questions (${response.status})`);
  }
  return response.json();
}
