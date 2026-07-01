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

export async function fetchSecureShares(filters?: {
  search?: string;
  client_id?: number;
}): Promise<SecureReportShare[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.client_id) params.append("client_id", String(filters.client_id));

  const response = await authenticatedFetch(`/api/reports/shares?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load report shares (${response.status})`);
  }
  return response.json();
}

export async function createSecureShare(
  examReportId: number | null,
  recipientEmail: string,
  examId?: number
): Promise<SecureReportShare> {
  const response = await authenticatedFetch("/api/reports/shares", {
    method: "POST",
    body: JSON.stringify({
      exam_report_id: examReportId || undefined,
      exam_id: examId || undefined,
      recipient_email: recipientEmail,
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `Failed to share report (${response.status})`);
  }
  return data;
}

export async function regenerateSecureShare(id: number): Promise<SecureReportShare> {
  const response = await authenticatedFetch(`/api/reports/shares/${id}/regenerate`, {
    method: "POST",
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
