import type { ClientRecord } from "@/lib/clients";

export function isOrganizationClient(client?: ClientRecord | null): boolean {
  if (!client) return false;
  const type = client.client_type.trim().toLowerCase();
  return type === "corporate" || type === "law firm" || type === "lawfirm";
}
