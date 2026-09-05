import { authenticatedFetch } from "@/lib/api-client";
import type { QuestionCategory } from "@/lib/question-templates";

export type ExamQuestionRecord = {
  id: number;
  exam_id: number;
  text: string;
  category?: QuestionCategory | "";
  sort_order: number;
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
  input: Partial<{ text: string; category: QuestionCategory | ""; response: string; sort_order: number }>
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

export async function addExamQuestionsFromTemplates(
  examId: number,
  templateIds: number[]
): Promise<ExamQuestionRecord[]> {
  const response = await authenticatedFetch(`/api/exams/${examId}/questions/from-templates`, {
    method: "POST",
    body: JSON.stringify({ template_ids: templateIds }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to add questions (${response.status})`);
  }
  return response.json();
}

/**
 * Persists an edited question list against the exam's per-row API. Rows are
 * created, patched or deleted individually rather than replaced wholesale so
 * that ids — and therefore the forensic record's continuity — survive edits.
 * Rows with a negative id are new (client-side placeholders).
 */
export async function saveExamQuestions(
  examId: number,
  items: ExamQuestionRecord[],
  original: ExamQuestionRecord[]
): Promise<ExamQuestionRecord[]> {
  const keptIds = new Set(items.filter((q) => q.id > 0).map((q) => q.id));
  const removed = original.filter((q) => !keptIds.has(q.id));

  for (const question of removed) {
    await deleteExamQuestion(examId, question.id);
  }

  for (const [index, question] of items.entries()) {
    if (question.id < 0) {
      const created = await createExamQuestion(examId, {
        text: question.text,
        category: question.category,
      });
      // New rows are appended server-side; pull them back to their edited position.
      if (created.sort_order !== index) {
        await updateExamQuestion(examId, created.id, { sort_order: index });
      }
      continue;
    }
    const before = original.find((q) => q.id === question.id);
    const changed =
      !before ||
      before.text !== question.text ||
      (before.category || "") !== (question.category || "") ||
      (before.response || "") !== (question.response || "") ||
      before.sort_order !== index;
    if (changed) {
      await updateExamQuestion(examId, question.id, {
        text: question.text,
        category: question.category,
        response: question.response || "",
        sort_order: index,
      });
    }
  }

  return fetchExamQuestions(examId);
}
