import { authenticatedFetch } from "@/lib/api-client";
import type { QuestionCategory } from "@/lib/question-templates";

export type ExamQuestionRecord = {
  id: number;
  exam_id: number;
  text: string;
  category?: QuestionCategory | "";
  response?: string;
};

export async function fetchExamQuestions(examId: number): Promise<ExamQuestionRecord[]> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load exam questions (${response.status})`);
  }
  return response.json();
}

export async function createExamQuestion(
  examId: number,
  input: { text: string; category?: QuestionCategory | "" }
): Promise<ExamQuestionRecord> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to add question (${response.status})`);
  }
  return response.json();
}

export async function updateExamQuestion(
  examId: number,
  questionId: number,
  input: Partial<{ text: string; category: QuestionCategory | ""; response: string }>
): Promise<ExamQuestionRecord> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions/${questionId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update question (${response.status})`);
  }
  return response.json();
}

export async function deleteExamQuestion(examId: number, questionId: number): Promise<void> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions/${questionId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete question (${response.status})`);
  }
}

export async function populateDefaultQuestions(examId: number): Promise<ExamQuestionRecord[]> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions/populate-defaults`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to populate default questions (${response.status})`);
  }
  return response.json();
}
