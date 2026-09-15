import { authenticatedFetch } from "@/lib/api-client";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export type OrganizationSettings = {
  id: number;
  name: string;
  support_email: string;
  phone?: string;
  address: string;
  currency?: string;
  usd_aed_rate?: number;
  usd_gbp_rate?: number;
  usd_eur_rate?: number;
  sunday_bookings_enabled?: boolean;
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
  phone?: string;
  address: string;
  currency?: string;
  usd_aed_rate?: number;
  usd_gbp_rate?: number;
  usd_eur_rate?: number;
  sunday_bookings_enabled?: boolean;
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

export type PublicOrganizationContact = {
  name: string;
  phone?: string;
  support_email?: string;
  address?: string;
};

/** Unauthenticated — for the public marketing/booking site footer. */
export async function fetchPublicOrganizationContact(): Promise<PublicOrganizationContact | null> {
  try {
    const response = await fetch(`${API_BASE}/api/public/organization`);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
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
