import { authenticatedFetch } from "@/lib/api-client";

export type QuestionCategory = "relevant" | "comparison" | "irrelevant";

export type QuestionTemplateRecord = {
  id: number;
  exam_type_id: number;
  exam_type?: {
    id: number;
    name: string;
  };
  category: QuestionCategory;
  text: string;
  sort_order: number;
  active: boolean;
};

export type QuestionTemplateInput = {
  exam_type_id: number;
  category: QuestionCategory;
  text: string;
  sort_order: number;
  active: boolean;
};

export async function fetchQuestionTemplates(filters?: {
  examTypeId?: number;
  includeInactive?: boolean;
}): Promise<QuestionTemplateRecord[]> {
  const params = new URLSearchParams();
  if (filters?.examTypeId) {
    params.set("exam_type_id", String(filters.examTypeId));
  }
  if (filters?.includeInactive) {
    params.set("include_inactive", "true");
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  const response = await authenticatedFetch(`/api/exams/question-templates${suffix}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load question templates (${response.status})`);
  }
  return response.json();
}

export async function createQuestionTemplate(input: QuestionTemplateInput): Promise<QuestionTemplateRecord> {
  const response = await authenticatedFetch("/api/exams/question-templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create question template (${response.status})`);
  }
  return response.json();
}

export async function updateQuestionTemplate(
  id: number,
  input: Partial<QuestionTemplateInput>
): Promise<QuestionTemplateRecord> {
  const response = await authenticatedFetch(`/api/exams/question-templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update question template (${response.status})`);
  }
  return response.json();
}

export async function deleteQuestionTemplate(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/exams/question-templates/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete question template (${response.status})`);
  }
}
