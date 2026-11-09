import { authenticatedFetch } from "@/lib/api-client";

export type PrepaidSlotSummary = {
  available: number;
  consumed: number;
  total: number;
  /** Slots (used or not) whose bulk invoice is not fully paid yet. */
  awaiting_payment?: number;
  /** Client agreement: a cancelled exam keeps its slot (counts as used). */
  cancellation_counts_as_used?: boolean;
};

/** Count-only correction, no money changes. mark_used: free → used. restore: hand-marked or cancelled-exam slot → free. */
export async function adjustClientSlotCount(
  clientId: number,
  action: "mark_used" | "restore",
): Promise<PrepaidSlotSummary> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/prepaid-slots/adjust`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to correct slots (${response.status})`);
  }
  return response.json();
}

export async function setCancellationCountsAsUsed(
  clientId: number,
  value: boolean,
): Promise<PrepaidSlotSummary> {
  const response = await authenticatedFetch(`/api/clients/${clientId}/cancellation-policy`, {
    method: "PATCH",
    body: JSON.stringify({ cancellation_counts_as_used: value }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to save cancellation rule (${response.status})`);
  }
  return response.json();
}

/** Move an existing booking onto the client's next free bulk-invoice slot. Its own session invoice is removed. */
export async function applyPrepaidSlotToAppointment(appointmentId: number): Promise<void> {
  const response = await authenticatedFetch(`/api/appointments/${appointmentId}/apply-prepaid-slot`, {
    method: "POST",
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error || `Failed to apply prepaid slot (${response.status})`);
  }
}

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
