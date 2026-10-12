import { authenticatedFetch } from "@/lib/api-client";

export type BankAccount = {
  id: number;
  /** Internal name, never shown to clients. */
  label: string;
  account_name: string;
  bank_name: string;
  currency: string;
  account_number?: string;
  iban?: string;
  swift_code?: string;
  is_default: boolean;
  archived: boolean;
};

/** Client-facing bank details as printed on an invoice (snapshot taken when picked). */
export type BankDetails = {
  account_name: string;
  bank_name: string;
  currency: string;
  account_number?: string;
  iban?: string;
  swift_code?: string;
};

export type BankAccountInput = Omit<BankAccount, "id">;

async function errorFrom(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null);
  return new Error(payload?.error || `${fallback} (${response.status})`);
}

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  const response = await authenticatedFetch("/api/settings/bank-accounts");
  if (!response.ok) throw await errorFrom(response, "Failed to load bank accounts");
  return response.json();
}

export async function createBankAccount(input: BankAccountInput): Promise<BankAccount> {
  const response = await authenticatedFetch("/api/settings/bank-accounts", {
    method: "POST",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response, "Failed to create bank account");
  return response.json();
}

export async function updateBankAccount(id: number, input: BankAccountInput): Promise<BankAccount> {
  const response = await authenticatedFetch(`/api/settings/bank-accounts/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await errorFrom(response, "Failed to update bank account");
  return response.json();
}

export async function deleteBankAccount(id: number): Promise<void> {
  const response = await authenticatedFetch(`/api/settings/bank-accounts/${id}`, { method: "DELETE" });
  if (!response.ok) throw await errorFrom(response, "Failed to delete bank account");
}

/** Ids of the default (non-archived) account for a currency, used to pre-select on new invoices. */
export function defaultBankAccountIds(accounts: BankAccount[], currency: string): number[] {
  const cur = currency.toUpperCase();
  return accounts.filter((a) => !a.archived && a.is_default && a.currency === cur).map((a) => a.id);
}

/** Plain-text "pay by bank transfer" section for invoice emails. */
export function bankDetailsEmailText(accounts: BankDetails[] | undefined, reference: string): string {
  if (!accounts?.length) return "";
  const blocks = accounts.map((a) =>
    [
      `Account name: ${a.account_name}`,
      `Bank: ${a.bank_name}`,
      `Currency: ${a.currency}`,
      a.account_number ? `Account no.: ${a.account_number}` : "",
      a.iban ? `IBAN: ${a.iban}` : "",
      a.swift_code ? `SWIFT / BIC: ${a.swift_code}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    "Prefer to pay by bank transfer?",
    "",
    blocks.join("\n\n"),
    "",
    `Please quote ${reference} as the payment reference.`,
  ].join("\n");
}
