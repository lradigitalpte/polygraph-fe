import { authenticatedFetch } from "@/lib/api-client";

export type PermissionRecord = {
  id: number;
  name: string;
  description?: string;
  group?: string;
};

export type RoleRecord = {
  id: number;
  name: string;
  description?: string;
  permissions?: PermissionRecord[];
};

export async function fetchRoles(): Promise<RoleRecord[]> {
  const response = await authenticatedFetch("/api/rbac/roles");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load roles (${response.status})`);
  }
  return response.json();
}

export async function fetchPermissions(): Promise<PermissionRecord[]> {
  const response = await authenticatedFetch("/api/rbac/permissions");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load permissions (${response.status})`);
  }
  return response.json();
}

export async function createRole(input: {
  name: string;
  description?: string;
  permission_ids: number[];
}): Promise<RoleRecord> {
  const response = await authenticatedFetch("/api/rbac/roles", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create role (${response.status})`);
  }
  return response.json();
}
