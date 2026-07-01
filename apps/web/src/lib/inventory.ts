import { authenticatedFetch } from "@/lib/api-client";

export type InventoryItem = {
  id: number;
  created_at: string;
  updated_at: string;
  name: string;
  serial_number: string;
  category: string;
  status: string;
  quantity: number;
  location: string;
  purchase_date?: string;
  warranty_expiry?: string;
  calibration_due?: string;
  expiration_date?: string;
  notes: string;
};

export async function fetchInventoryItems(filters?: {
  search?: string;
  category?: string;
  status?: string;
}): Promise<InventoryItem[]> {
  const params = new URLSearchParams();
  if (filters?.search) params.append("search", filters.search);
  if (filters?.category) params.append("category", filters.category);
  if (filters?.status) params.append("status", filters.status);

  const response = await authenticatedFetch(`/api/inventory?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to load inventory items (${response.status})`);
  }
  return response.json();
}

export async function fetchInventoryItem(id: number): Promise<InventoryItem> {
  const response = await authenticatedFetch(`/api/inventory/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load item detail (${response.status})`);
  }
  return response.json();
}

export async function createInventoryItem(input: {
  name: string;
  serial_number?: string;
  category?: string;
  status?: string;
  quantity?: number;
  location?: string;
  purchase_date?: string;
  warranty_expiry?: string;
  calibration_due?: string;
  expiration_date?: string;
  notes?: string;
}): Promise<InventoryItem> {
  const response = await authenticatedFetch("/api/inventory", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Failed to create item (${response.status})`);
  }
  return response.json();
}

export async function updateInventoryItem(
  id: number,
  input: {
    name: string;
    serial_number?: string;
    category?: string;
    status?: string;
    quantity?: number;
    location?: string;
    purchase_date?: string;
    warranty_expiry?: string;
    calibration_due?: string;
    expiration_date?: string;
    notes?: string;
  }
): Promise<InventoryItem> {
  const response = await authenticatedFetch(`/api/inventory/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Failed to update item (${response.status})`);
  }
  return response.json();
}

export async function deleteInventoryItem(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/inventory/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || `Failed to delete item (${response.status})`);
  }
}
