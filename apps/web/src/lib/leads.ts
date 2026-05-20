export type LeadStatus = "New" | "Contacted" | "Qualified" | "Converted" | "Lost";

export type LeadSource =
  | "Instagram"
  | "Facebook"
  | "LinkedIn"
  | "Referral"
  | "Website"
  | "Phone"
  | "Walk-in";

export type LeadRecord = {
  backendId: number;
  id: string;
  name: string;
  source: LeadSource;
  date: string;
  createdAt: string;
  updatedAt: string;
  status: LeadStatus;
  email: string;
  phone: string;
  interest: string;
  notes: string;
  estimatedValue: number;
  priority: "Low" | "Standard" | "Priority" | "Urgent";
  preferredContact: "Phone" | "Email" | "SMS";
  nextStep: string;
};

// ---------------------------------------------------------------------------
// API client functions (all requests go through RBAC)
// ---------------------------------------------------------------------------

import { authenticatedFetch } from "./api-client";

/** Map a raw API lead (numeric id, snake_case dates) to the shared LeadRecord shape. */
function mapApiLead(raw: Record<string, unknown>): LeadRecord {
  const createdAt = String(raw.created_at ?? "");

  return {
    backendId: Number(raw.id ?? 0),
    id: typeof raw.ref === "string" && raw.ref.length > 0
      ? raw.ref
      : `LD-${String(raw.id).padStart(4, "0")}`,
    name: (raw.name as string) ?? "",
    email: (raw.email as string) ?? "",
    phone: (raw.phone as string) ?? "",
    source: (raw.source as LeadSource) ?? "Website",
    interest: (raw.interest as string) ?? "",
    notes: (raw.notes as string) ?? "",
    status: (raw.status as LeadStatus) ?? "New",
    estimatedValue: Number(raw.estimated_value ?? 0),
    priority: (raw.priority as LeadRecord["priority"]) ?? "Standard",
    preferredContact: (raw.preferred_contact as LeadRecord["preferredContact"]) ?? "Phone",
    nextStep: (raw.next_step as string) ?? "",
    createdAt,
    updatedAt: String(raw.updated_at ?? createdAt),
    date: formatLeadDate(new Date(createdAt || Date.now())),
  };
}

/** Fetch all leads from the backend. Returns empty array on error. */
export async function fetchLeads(): Promise<LeadRecord[]> {
  try {
    const res = await authenticatedFetch("/api/leads");

    if (!res.ok) {
      throw new Error(`GET /api/leads returned ${res.status}`);
    }

    const data: unknown[] = await res.json();
    return data.map((item) => mapApiLead(item as Record<string, unknown>));
  } catch {
    return [];
  }
}

export type CreateLeadPayload = {
  name: string;
  source: LeadSource;
  email: string;
  phone: string;
  interest: string;
  notes: string;
  estimatedValue: number;
  priority: LeadRecord["priority"];
  preferredContact: LeadRecord["preferredContact"];
  nextStep: string;
};

/** POST a new lead to the backend. Throws on failure. */
export async function createLeadAPI(payload: CreateLeadPayload): Promise<LeadRecord> {
  const body = {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    source: payload.source,
    interest: payload.interest,
    notes: payload.notes,
    preferred_contact: payload.preferredContact,
    priority: payload.priority,
    estimated_value: payload.estimatedValue,
    next_step: payload.nextStep,
  };

  const res = await authenticatedFetch("/api/leads", {
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `POST /api/leads returned ${res.status}`);
  }

  const data = await res.json();
  return mapApiLead(data as Record<string, unknown>);
}

export type UpdateLeadPayload = {
  status?: LeadStatus;
  priority?: LeadRecord["priority"];
  notes?: string;
  nextStep?: string;
  estimatedValue?: number;
};

/** PATCH an existing lead. Throws on failure. */
export async function updateLeadAPI(id: number, payload: UpdateLeadPayload): Promise<LeadRecord> {
  const body: Record<string, unknown> = {};

  if (payload.status) {
    body.status = payload.status;
  }

  if (payload.priority) {
    body.priority = payload.priority;
  }

  if (payload.notes !== undefined) {
    body.notes = payload.notes;
  }

  if (payload.nextStep !== undefined) {
    body.next_step = payload.nextStep;
  }

  if (payload.estimatedValue !== undefined) {
    body.estimated_value = payload.estimatedValue;
  }

  const res = await authenticatedFetch(`/api/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `PATCH /api/leads/${id} returned ${res.status}`);
  }

  const data = await res.json();
  return mapApiLead(data as Record<string, unknown>);
}

/** DELETE an existing lead. Throws on failure. */
export async function deleteLeadAPI(id: number): Promise<void> {
  const res = await authenticatedFetch(`/api/leads/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `DELETE /api/leads/${id} returned ${res.status}`);
  }
}

export function formatLeadDate(input: Date) {
  return input.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}