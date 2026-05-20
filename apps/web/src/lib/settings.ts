import { authenticatedFetch } from "@/lib/api-client";

export type OrganizationSettings = {
  id: number;
  name: string;
  support_email: string;
  address: string;
  created_at: string;
  updated_at: string;
};

export async function fetchOrganizationSettings(): Promise<OrganizationSettings> {
  const response = await authenticatedFetch("/api/settings/organization");
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load organization settings (${response.status})`);
  }
  return response.json();
}

export async function updateOrganizationSettings(input: {
  name: string;
  support_email: string;
  address: string;
}): Promise<OrganizationSettings> {
  const response = await authenticatedFetch("/api/settings/organization", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to save organization settings (${response.status})`);
  }
  return response.json();
}

export async function deleteOrganizationData(confirmName: string): Promise<void> {
  const response = await authenticatedFetch("/api/settings/organization", {
    method: "DELETE",
    body: JSON.stringify({ confirm_name: confirmName }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to delete organization data (${response.status})`);
  }
}
