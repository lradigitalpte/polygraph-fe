import { authenticatedFetch } from "@/lib/api-client";

export type BackupRecord = {
  id: number;
  created_at: string;
  kind: "manual" | "scheduled";
  status: "running" | "completed" | "failed" | "expired";
  triggered_by: string;
  started_at: string;
  finished_at?: string;
  stage: string;
  file_name: string;
  size_bytes: number;
  database_bytes: number;
  file_count: number;
  files_bytes: number;
  sha256: string;
  encrypted: boolean;
  server_version: string;
  error?: string;
  pruned_at?: string;
};

export type BackupConfig = {
  encrypted: boolean;
  storage_s3: boolean;
  pg_dump_found: boolean;
  pg_dump_version?: string;
  cron_configured: boolean;
  keep_scheduled: number;
  keep_manual: number;
  running: boolean;
};

async function errorOf(res: Response, fallback: string) {
  const payload = await res.json().catch(() => null);
  return new Error(payload?.error || `${fallback} (${res.status})`);
}

export async function fetchBackups(): Promise<{ backups: BackupRecord[]; config: BackupConfig }> {
  const res = await authenticatedFetch("/api/backups");
  if (!res.ok) throw await errorOf(res, "Failed to load backups");
  return res.json();
}

export async function startBackup(): Promise<BackupRecord> {
  const res = await authenticatedFetch("/api/backups", { method: "POST" });
  if (!res.ok) throw await errorOf(res, "Couldn't start the backup");
  return res.json();
}

/** Saves the archive: a short-lived S3 link in production, streamed in local dev. */
export async function downloadBackup(id: number): Promise<void> {
  const res = await authenticatedFetch(`/api/backups/${id}/download`);
  if (!res.ok) throw await errorOf(res, "Couldn't prepare the download");
  const { url, file_name } = (await res.json()) as { url?: string; file_name: string };
  if (url) {
    window.location.assign(url);
    return;
  }
  const fileRes = await authenticatedFetch(`/api/backups/${id}/file`);
  if (!fileRes.ok) throw await errorOf(fileRes, "Download failed");
  const blob = await fileRes.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = file_name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 10_000);
}

export function formatBytes(bytes: number) {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 10 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
