import { authenticatedFetch } from "@/lib/api-client";

export type RoleRecord = {
  id: number;
  name: string;
  description?: string;
  permissions?: Array<{
    id: number;
    name: string;
    description?: string;
    group?: string;
  }>;
};

export type UserRecord = {
  id: number;
  name: string;
  email: string;
  status: string;
  role_id: number;
  role?: RoleRecord;
  invited_at?: string;
  last_active_at?: string;
  suspended_at?: string;
  password_reset_required: boolean;
  password_reset_sent_at?: string;
  created_at: string;
  updated_at: string;
};

export type UserActivityRecord = {
  id: number;
  created_at: string;
  action: string;
  method: string;
  path: string;
  status: number;
  ip: string;
  user_agent: string;
  payload: string;
};

export async function fetchUsers(): Promise<UserRecord[]> {
  const response = await authenticatedFetch("/api/users");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load users (${response.status})`);
  }
  return response.json();
}

export async function fetchExaminers(search?: string): Promise<UserRecord[]> {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const response = await authenticatedFetch(`/api/users/examiners${query}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load examiners (${response.status})`);
  }
  return response.json();
}

export async function fetchUser(id: number): Promise<UserRecord> {
  const response = await authenticatedFetch(`/api/users/${id}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load user (${response.status})`);
  }
  return response.json();
}

export async function createUser(input: { name: string; email: string; role_id: number }): Promise<UserRecord> {
  const response = await authenticatedFetch("/api/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to create user (${response.status})`);
  }
  return response.json();
}

export async function fetchRoles(): Promise<RoleRecord[]> {
  const response = await authenticatedFetch("/api/rbac/roles");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load roles (${response.status})`);
  }
  return response.json();
}

export async function updateUserStatus(id: number, status: string): Promise<UserRecord> {
  const response = await authenticatedFetch(`/api/users/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update status (${response.status})`);
  }
  return response.json();
}

export async function updateUserRole(id: number, role_id: number): Promise<UserRecord> {
  const response = await authenticatedFetch(`/api/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role_id }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to update role (${response.status})`);
  }
  return response.json();
}

export async function requirePasswordReset(id: number): Promise<UserRecord> {
  const response = await authenticatedFetch(`/api/users/${id}/require-password-reset`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to request password reset (${response.status})`);
  }
  return response.json();
}

export async function deleteUser(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/users/${id}`, { method: "DELETE" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete user (${response.status})`);
  }
}

export async function fetchUserActivity(id: number, limit = 25): Promise<UserActivityRecord[]> {
  const response = await authenticatedFetch(`/api/users/${id}/activity?limit=${limit}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load user activity (${response.status})`);
  }
  return response.json();
}
