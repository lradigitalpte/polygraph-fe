import { authenticatedFetch } from "@/lib/api-client";
import type { ReportContent, ReportTemplateRecord } from "@/lib/report-template";

export type ReportTemplateInput = {
  slug: string;
  name: string;
  category: string;
  description?: string;
  content_json: string;
  is_default?: boolean;
  active?: boolean;
};

export async function fetchReportTemplates(includeInactive = false): Promise<ReportTemplateRecord[]> {
  const query = includeInactive ? "?include_inactive=true" : "";
  const response = await authenticatedFetch(`/api/reports/templates${query}`);
  if (!response.ok) {
    throw new Error(`Failed to load report templates (${response.status})`);
  }
  return response.json();
}

export async function fetchReportTemplate(id: number): Promise<ReportTemplateRecord> {
  const response = await authenticatedFetch(`/api/reports/templates/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load report template (${response.status})`);
  }
  return response.json();
}

export async function resolveReportTemplate(clientId?: number): Promise<ReportTemplateRecord> {
  const query = clientId ? `?client_id=${clientId}` : "";
  const response = await authenticatedFetch(`/api/reports/templates/resolve${query}`);
  if (!response.ok) {
    throw new Error(`Failed to resolve report template (${response.status})`);
  }
  return response.json();
}

export async function createReportTemplate(input: ReportTemplateInput): Promise<ReportTemplateRecord> {
  const response = await authenticatedFetch("/api/reports/templates", {
    method: "POST",
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Failed to create template (${response.status})`);
  return data;
}

export async function updateReportTemplate(
  id: number,
  input: Partial<ReportTemplateInput>,
): Promise<ReportTemplateRecord> {
  const response = await authenticatedFetch(`/api/reports/templates/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Failed to update template (${response.status})`);
  return data;
}

export async function deactivateReportTemplate(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/reports/templates/${id}`, { method: "DELETE" });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Failed to deactivate template (${response.status})`);
}

export function templateContentToJSON(content: ReportContent): string {
  return JSON.stringify(content);
}

export function parseTemplateEditorContent(raw: string): ReportContent {
  return JSON.parse(raw) as ReportContent;
}
