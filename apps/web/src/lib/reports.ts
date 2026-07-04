import { authenticatedFetch } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type SecureReportShare = {
  id: number;
  created_at: string;
  updated_at: string;
  exam_report_id: number;
  exam_report?: {
    id: number;
    verdict: string;
  };
  client_id: number;
  subject_id: number;
  subject?: {
    id: number;
    first_name: string;
    last_name: string;
  };
  recipient_email: string;
  token: string;
  password?: string;
  pdf_url: string;
  status: "sent" | "viewed";
  expires_at: string;
};

export type ConsolidatedReportStats = {
  total_reports: number;
  ndi_count: number;
  di_count: number;
  inconclusive_count: number;
};

export type ExamReportRecord = {
  id: number;
  exam_id: number;
  verdict: string;
  content: string;
  created_at: string;
  is_locked: boolean;
  locked_at?: string | null;
  signature_examiner?: string;
  signature_client?: string;
};

export async function fetchSecureShares(filters?: {
  search?: string;
  client_id?: number;
  subject_id?: number;
}): Promise<SecureReportShare[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.client_id) params.append("client_id", String(filters.client_id));
  if (filters?.subject_id) params.append("subject_id", String(filters.subject_id));

  const response = await authenticatedFetch(`/api/reports/shares?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load report shares (${response.status})`);
  }
  return response.json();
}

export async function createSecureShare(
  examReportId: number | null,
  recipientEmail: string,
  examId?: number,
  expiresInDays = 7
): Promise<SecureReportShare> {
  const response = await authenticatedFetch("/api/reports/shares", {
    method: "POST",
    body: JSON.stringify({
      exam_report_id: examReportId || undefined,
      exam_id: examId || undefined,
      recipient_email: recipientEmail,
      expires_in_days: expiresInDays,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to share report (${response.status})`);
  }
  return data;
}

export async function regenerateSecureShare(id: number, expiresInDays = 7): Promise<SecureReportShare> {
  const response = await authenticatedFetch(`/api/reports/shares/${id}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ expires_in_days: expiresInDays }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to regenerate link (${response.status})`);
  }
  return data;
}

export async function fetchConsolidatedStats(): Promise<ConsolidatedReportStats> {
  const response = await authenticatedFetch("/api/reports/stats");
  if (!response.ok) {
    throw new Error(`Failed to load report stats (${response.status})`);
  }
  return response.json();
}

export async function fetchPublicSharedReport(token: string): Promise<SecureReportShare> {
  const response = await fetch(`${API_BASE}/api/public/shared-reports/${encodeURIComponent(token)}`, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Unable to load shared report (${response.status})`);
  }
  return data as SecureReportShare;
}

export type StructuredReportData = {
  purpose: string;
  instrument: string;
  pre_test_notes: string;
  questions: {
    text: string;
    answer: string;
    evaluation: string;
  }[];
  post_test_notes: string;
  conclusion: string;
};

export async function fetchReport(examId: number): Promise<ExamReportRecord | null> {
  const response = await authenticatedFetch(`/api/reports/${examId}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to fetch report (${response.status})`);
  }
  return response.json();
}

export async function saveDetailedReport(
  examId: number,
  verdict: string,
  data: StructuredReportData
): Promise<any> {
  const response = await authenticatedFetch("/api/reports", {
    method: "POST",
    body: JSON.stringify({
      exam_id: examId,
      verdict,
      content: JSON.stringify(data),
    }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to save report (${response.status})`);
  }
  return payload;
}

export async function finalizeReport(examId: number): Promise<{
  id: number;
  exam_id: number;
  is_locked: boolean;
  locked_at?: string | null;
}> {
  const response = await authenticatedFetch(`/api/reports/${examId}/finalize`, {
    method: "POST",
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to finalize report (${response.status})`);
  }
  return payload;
}

export const REPORT_SHARE_EXPIRY_OPTIONS = [
  { label: "3 days", value: 3 },
  { label: "7 days (recommended)", value: 7 },
  { label: "14 days", value: 14 },
  { label: "30 days", value: 30 },
] as const;

export const DEFAULT_REPORT_SHARE_EXPIRY_DAYS = 7;

export type ReportWorkflowStatus = "none" | "draft" | "locked" | "sent";

export function resolveReportWorkflowStatus(input: {
  reportExists: boolean;
  isLocked: boolean;
  hasShare: boolean;
}): ReportWorkflowStatus {
  if (input.hasShare) return "sent";
  if (input.isLocked) return "locked";
  if (input.reportExists) return "draft";
  return "none";
}

export async function requestReportOverrideUnlock(examId: number, reason: string): Promise<void> {
  const response = await authenticatedFetch(`/api/reports/${examId}/override-unlock`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Failed to unlock report (${response.status})`);
  }
}
