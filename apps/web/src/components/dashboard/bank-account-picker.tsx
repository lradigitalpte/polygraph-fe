"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { Landmark } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { defaultBankAccountIds, type BankAccount } from "@/lib/bank-accounts";

/**
 * Multi-select of bank accounts to print on an invoice.
 * `value === null` means "follow the currency default" so switching currency re-picks it;
 * use {@link resolveBankAccountIds} to get the ids to send.
 */
export function BankAccountPicker({
  accounts,
  currency,
  value,
  onChange,
  className,
}: {
  accounts: BankAccount[];
  currency: string;
  value: number[] | null;
  onChange: (ids: number[]) => void;
  className?: string;
}) {
  const active = accounts.filter((a) => !a.archived);
  const selected = resolveBankAccountIds(accounts, currency, value);
  const cur = currency.toUpperCase();
  // Matching currency first so the usual choice is at the top.
  const ordered = [...active].sort((a, b) => Number(b.currency === cur) - Number(a.currency === cur));

  if (active.length === 0) {
    return (
      <div className={cn("rounded-xl border border-dashed p-4 text-xs text-muted-foreground", className)}>
        No bank accounts set up yet.{" "}
        <Link href={"/dashboard/settings/bank-accounts" as Route} className="font-semibold text-primary underline">
          Add one in settings
        </Link>{" "}
        to show bank transfer details on invoices.
      </div>
    );
  }

  const toggle = (id: number, checked: boolean) => {
    const next = checked ? [...selected, id] : selected.filter((x) => x !== id);
    // Keep the on-screen order stable regardless of click order.
    onChange(ordered.map((a) => a.id).filter((x) => next.includes(x)));
  };

  return (
    <div className={cn("space-y-2", className)}>
      {ordered.map((account) => {
        const checked = selected.includes(account.id);
        return (
          <label
            key={account.id}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors",
              checked ? "border-primary/50 bg-primary/5" : "border-border hover:bg-muted/30",
            )}
          >
            <Checkbox className="mt-0.5" checked={checked} onCheckedChange={(c) => toggle(account.id, Boolean(c))} />
            <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold">{account.label}</span>
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold">{account.currency}</span>
                {account.is_default ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Default</span>
                ) : null}
              </div>
              <div className="truncate font-mono text-xs text-muted-foreground">
                {account.iban || account.account_number}
              </div>
            </div>
          </label>
        );
      })}
      {selected.length === 0 ? (
        <p className="text-xs text-muted-foreground">No bank details will be printed (card payment only).</p>
      ) : null}
    </div>
  );
}

export function resolveBankAccountIds(accounts: BankAccount[], currency: string, value: number[] | null): number[] {
  return value ?? defaultBankAccountIds(accounts, currency);
}
