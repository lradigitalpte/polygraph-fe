import { authenticatedFetch } from "@/lib/api-client";

export type AuditLogRecord = {
  id: number;
  createdAt: string;
  userId: number | null;
  userEmail: string | null;
  action: string;
  method: string;
  path: string;
  status: number;
  ip: string;
  userAgent: string;
  payload: string;
};

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapApiAuditLog(raw: Record<string, unknown>): AuditLogRecord {
  return {
    id: toNumber(raw.id),
    createdAt: String(raw.created_at ?? ""),
    userId: raw.user_id == null ? null : toNumber(raw.user_id),
    userEmail: raw.user_email == null ? null : String(raw.user_email),
    action: String(raw.action ?? ""),
    method: String(raw.method ?? ""),
    path: String(raw.path ?? ""),
    status: toNumber(raw.status),
    ip: String(raw.ip ?? ""),
    userAgent: String(raw.user_agent ?? ""),
    payload: String(raw.payload ?? ""),
  };
}

export async function fetchAuditLogs(limit = 150): Promise<AuditLogRecord[]> {
  const res = await authenticatedFetch(`/api/audit-logs?limit=${limit}`);
  if (!res.ok) {
    throw new Error("Failed to fetch audit logs");
  }

  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    .map(mapApiAuditLog);
}

export async function fetchAuditLogById(id: number): Promise<AuditLogRecord> {
  const res = await authenticatedFetch(`/api/audit-logs/${id}`);
  if (!res.ok) {
    throw new Error("Failed to fetch audit log details");
  }

  const data = (await res.json()) as unknown;
  if (!data || typeof data !== "object") {
    throw new Error("Invalid audit log payload");
  }

  return mapApiAuditLog(data as Record<string, unknown>);
}
