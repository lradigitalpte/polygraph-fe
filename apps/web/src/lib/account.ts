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
