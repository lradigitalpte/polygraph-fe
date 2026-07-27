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
  protection_mode?: "password" | "secure_link";
  pdf_url: string;
  status: "sent" | "viewed";
  expires_at: string;
  archived_at?: string | null;
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
  signer_name?: string;
  signer_caption?: string;
  signer_title?: string;
  signer_organization?: string;
};

export type FinalizeReportInput = {
  examinerId: number;
  authorizationConfirmed: boolean;
  signerDisplayName?: string;
  signerCaptionLines?: string;
};

export async function fetchSecureShares(filters?: {
  search?: string;
  client_id?: number;
  subject_id?: number;
  archive?: "active" | "archived" | "all";
}): Promise<SecureReportShare[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.client_id) params.append("client_id", String(filters.client_id));
  if (filters?.subject_id) params.append("subject_id", String(filters.subject_id));
  if (filters?.archive) params.append("archive", filters.archive);

  const response = await authenticatedFetch(`/api/reports/shares?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load report shares (${response.status})`);
  }
  return response.json();
}

export async function setSecureShareArchived(id: number, archived: boolean): Promise<SecureReportShare> {
  const response = await authenticatedFetch(`/api/reports/shares/${id}/${archived ? "archive" : "restore"}`, {
    method: "POST",
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Failed to ${archived ? "archive" : "restore"} report (${response.status})`);
  return data;
}

export async function createSecureShare(
  examReportId: number | null,
  recipientEmail: string,
  examId?: number,
  expiresInDays = 7,
  protectionMode: "password" | "secure_link" = "password"
): Promise<SecureReportShare> {
  const response = await authenticatedFetch("/api/reports/shares", {
    method: "POST",
    body: JSON.stringify({
      exam_report_id: examReportId || undefined,
      exam_id: examId || undefined,
      recipient_email: recipientEmail,
      expires_in_days: expiresInDays,
      protection_mode: protectionMode,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to share report (${response.status})`);
  }
  return data;
}

export async function regenerateSecureShare(id: number, expiresInDays = 7, protectionMode?: "password" | "secure_link"): Promise<SecureReportShare> {
  const response = await authenticatedFetch(`/api/reports/shares/${id}/regenerate`, {
    method: "POST",
    body: JSON.stringify({ expires_in_days: expiresInDays, protection_mode: protectionMode }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to regenerate link (${response.status})`);
  }
  return data;
}

export async function fetchConsolidatedStats(examinerId?: number): Promise<ConsolidatedReportStats> {
	const query = examinerId ? `?examiner_id=${examinerId}` : "";
	const response = await authenticatedFetch(`/api/reports/stats${query}`);
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

export type ReportVerificationResult = {
  valid: boolean;
  verification_code?: string;
  issued_at?: string;
  report_locked?: boolean;
  message?: string;
  error?: string;
};

export async function fetchReportVerification(code: string): Promise<ReportVerificationResult> {
  const response = await fetch(`${API_BASE}/api/public/report-verification/${encodeURIComponent(code)}`, {
    headers: { Accept: "application/json" },
  });
  const data = (await response.json().catch(() => ({}))) as ReportVerificationResult;
  if (!response.ok) throw new Error(data.error || "Verification record not found");
  return data;
}

export async function verifyReportPDF(code: string, file: File): Promise<ReportVerificationResult> {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(`${API_BASE}/api/public/report-verification/${encodeURIComponent(code)}`, {
    method: "POST",
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as ReportVerificationResult;
  if (!response.ok) throw new Error(data.error || "Unable to verify this PDF");
  return data;
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
  reference_no?: string;
  exam_date?: string;
  report_date?: string;
  section_4_follow_up?: string;
  limestone_notes?: string;
  pre_test_phase_text?: string;
  exam_phase_text?: string;
  opinion_phase_text?: string;
  identity_document_type?: "passport" | "emirates_id" | "";
  identity_verification_text?: string;
  exam_start_time?: string;
  exam_end_time?: string;
  cooperation_mode?: "cooperated" | "counter_measures";
  pre_exam_question_count_text?: string;
  response_legend_text?: string;
  source_template_id?: number;
  /** @deprecated Removed from builder UI; kept optional for older saved reports. */
  conclusion?: string;
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

export async function finalizeReport(
  examId: number,
  input: FinalizeReportInput,
): Promise<{
  id: number;
  exam_id: number;
  is_locked: boolean;
  locked_at?: string | null;
}> {
  const response = await authenticatedFetch(`/api/reports/${examId}/finalize`, {
    method: "POST",
    body: JSON.stringify({
      examiner_id: input.examinerId,
      authorization_confirmed: input.authorizationConfirmed,
      signer_display_name: input.signerDisplayName?.trim() || undefined,
      signer_caption_lines: input.signerCaptionLines?.trim() || undefined,
    }),
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

export type ReportWorkflowStatusRow = {
  exam_id: number;
  report_exists: boolean;
  is_locked: boolean;
  has_share: boolean;
};

export type LegacyImportMeta = {
  reference?: string;
  caseLabel?: string;
  legacyStatus?: string;
  legacyResults?: string;
  legacyMail?: string;
};

/** Parse reference fields stored in appointment notes during historical import. */
export function parseLegacyImportNotes(notes?: string | null): LegacyImportMeta {
  if (!notes?.trim()) return {};
  const pick = (label: string) => {
    const match = notes.match(new RegExp(`${label}:\\s*([^|]+)`, "i"));
    return match?.[1]?.trim() || undefined;
  };
  return {
    reference: pick("Ref"),
    caseLabel: pick("Case"),
    legacyStatus: pick("Legacy status"),
    legacyResults: pick("Legacy results"),
    legacyMail: pick("Legacy mail"),
  };
}

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

export function reportWorkflowStatusLabel(status: ReportWorkflowStatus): string {
  switch (status) {
    case "sent":
      return "Sent";
    case "locked":
      return "Locked — pending send";
    case "draft":
      return "Draft";
    default:
      return "Needs report";
  }
}

/** Build exam_id → workflow status map from a single bulk API response. */
export function buildReportWorkflowMap(
  rows: ReportWorkflowStatusRow[],
  examIds?: Iterable<number>,
): Record<number, ReportWorkflowStatus> {
  const allowed =
    examIds === undefined ? null : new Set(Array.from(examIds).filter((id) => id > 0));

  const map: Record<number, ReportWorkflowStatus> = {};
  for (const row of rows) {
    if (allowed && !allowed.has(row.exam_id)) continue;
    map[row.exam_id] = resolveReportWorkflowStatus({
      reportExists: row.report_exists,
      isLocked: row.is_locked,
      hasShare: row.has_share,
    });
  }
  return map;
}

export async function fetchReportWorkflowStatuses(): Promise<ReportWorkflowStatusRow[]> {
  const response = await authenticatedFetch("/api/reports/workflow-status");
  if (!response.ok) {
    throw new Error(`Failed to load report workflow statuses (${response.status})`);
  }
  return response.json();
}

export async function downloadLockedReportPreview(examId: number): Promise<void> {
  const response = await authenticatedFetch(`/api/reports/${examId}/pdf-preview`);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || `Failed to download report preview (${response.status})`);
  }

  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const fileName = match?.[1] || `Forensic_Report_Exam_${examId}_PREVIEW.pdf`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
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
