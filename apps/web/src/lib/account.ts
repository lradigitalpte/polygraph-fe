import { authenticatedFetch } from "@/lib/api-client";
import type { UserRecord } from "@/lib/users";

export async function fetchMe(): Promise<UserRecord> {
  const response = await authenticatedFetch("/api/me");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load profile (${response.status})`);
  }
  return response.json();
}

export async function fetchMyPermissions(): Promise<string[]> {
  const response = await authenticatedFetch("/api/me/permissions");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load permissions (${response.status})`);
  }
  const data = await response.json();
  return Array.isArray(data?.permissions) ? data.permissions : [];
}

export async function updateMe(input: { name: string }): Promise<UserRecord> {
  const response = await authenticatedFetch("/api/me", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update profile (${response.status})`);
  }
  return response.json();
}

export async function deleteMyAccount(): Promise<void> {
  const response = await authenticatedFetch("/api/me", { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete account (${response.status})`);
  }
}

export type ExaminerSignature = { image: string; title: string; organization: string };

export async function fetchMySignature(): Promise<ExaminerSignature | null> {
  const response = await authenticatedFetch("/api/me/signature");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Failed to load signature");
  return response.json();
}

export async function uploadMySignature(file: File, title: string, organization: string): Promise<void> {
  const form = new FormData();
  form.append("signature", file);
  form.append("title", title);
  form.append("organization", organization);
  const response = await authenticatedFetch("/api/me/signature", { method: "POST", body: form });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error || "Failed to upload signature");
}

export async function deleteMySignature(): Promise<void> {
  const response = await authenticatedFetch("/api/me/signature", { method: "DELETE" });
  if (!response.ok) throw new Error("Failed to delete signature");
}
