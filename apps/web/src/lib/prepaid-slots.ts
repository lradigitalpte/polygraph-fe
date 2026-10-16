import { authenticatedFetch } from "@/lib/api-client";

export type PrepaidSlotSummary = {
  available: number;
  consumed: number;
  total: number;
};

export type PrepaidSlotRecord = {
  id: number;
  client_id: number;
  source_quotation_id: number;
  status: string;
  appointment_id?: number;
  consumed_at?: string;
  created_at: string;
  source_quotation?: {
    id: number;
    code: string;
    title: string;
    line_quantity?: number;
  };
};

export async function fetchPrepaidSlotSummary(clientId: number): Promise<PrepaidSlotSummary> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/prepaid-slots/summary`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load prepaid slots (${response.status})`);
  }
  return response.json();
}

export async function fetchPrepaidSlots(clientId: number): Promise<PrepaidSlotRecord[]> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/prepaid-slots`, {
    method: "GET",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to load prepaid slots (${response.status})`);
  }
  return response.json();
}
