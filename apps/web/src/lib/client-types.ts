import type { ClientRecord } from "@/lib/clients";

export function isOrganizationClient(client?: ClientRecord | null): boolean {
  if (!client) return false;
  const type = client.client_type.trim().toLowerCase();
  return type === "corporate" || type === "law firm" || type === "lawfirm";
}

/** Primary label for an organization account (name + contact when available). */
export function formatOrganizationAccountLabel(client: ClientRecord): string {
  const contact = client.contact_person?.trim();
  if (contact) {
    return `${client.name} · ${contact}`;
  }
  return client.name;
}

/** Short subtitle under the org name in navigation (contact or account type). */
export function getOrganizationAccountSubtitle(client: ClientRecord): string | undefined {
  const contact = client.contact_person?.trim();
  if (contact) return contact;
  const type = client.client_type?.trim();
  return type || undefined;
}
