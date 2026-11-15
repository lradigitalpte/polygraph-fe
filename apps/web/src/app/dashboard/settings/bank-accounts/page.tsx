"use client";

import * as React from "react";
import { AlertTriangle, Archive, Check, Copy, Landmark, Loader2, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/dashboard/ui-kit";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import {
  createBankAccount,
  deleteBankAccount,
  fetchBankAccounts,
  updateBankAccount,
  type BankAccount,
  type BankAccountInput,
} from "@/lib/bank-accounts";
import { cn } from "@/lib/utils";

const CURRENCIES = ["AED", "USD", "GBP", "EUR"] as const;

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

const emptyForm: BankAccountInput = {
  label: "",
  account_name: "",
  bank_name: "",
  currency: "AED",
  account_number: "",
  iban: "",
  swift_code: "",
  is_default: false,
  archived: false,
};

/** IBANs read far more easily in groups of four. Copy still uses the raw value. */
function groupIban(iban: string) {
  return iban.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export default function BankAccountsPage() {
  const { can } = useCurrentUser();
  const canManage = can("role:manage");
  const [accounts, setAccounts] = React.useState<BankAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<BankAccountInput>(emptyForm);
  const [deleting, setDeleting] = React.useState<BankAccount | null>(null);
  const [deletingBusy, setDeletingBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      setAccounts(await fetchBankAccounts());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load bank accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const hasDefaultFor = React.useCallback(
    (currency: string, exceptId?: number | null) => accounts.some((a) => a.currency === currency && a.is_default && !a.archived && a.id !== exceptId),
    [accounts],
  );

  const openCreate = () => {
    setEditingId(null);
    // The first account in a currency becomes its default automatically.
    setForm({ ...emptyForm, is_default: !hasDefaultFor("AED") });
    setOpen(true);
  };

  const openEdit = (account: BankAccount) => {
    setEditingId(account.id);
    setForm({
      label: account.label,
      account_name: account.account_name,
      bank_name: account.bank_name,
      currency: account.currency,
      account_number: account.account_number ?? "",
      iban: account.iban ?? "",
      swift_code: account.swift_code ?? "",
      is_default: account.is_default,
      archived: account.archived,
    });
    setOpen(true);
  };

  const set = <K extends keyof BankAccountInput>(key: K, value: BankAccountInput[K]) => setForm((current) => ({ ...current, [key]: value }));

  const changeCurrency = (currency: string) =>
    setForm((current) => ({
      ...current,
      currency,
      // When adding, keep the "first account in a currency is default" rule as the currency changes.
      is_default: editingId ? current.is_default : !hasDefaultFor(currency),
    }));

  const missingRequired = !form.label.trim() || !form.account_name.trim() || !form.bank_name.trim();

  const handleSave = async () => {
    if (missingRequired) {
      toast.error("Label, account name and bank name are required");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, iban: (form.iban ?? "").replace(/\s+/g, "").toUpperCase(), swift_code: (form.swift_code ?? "").trim().toUpperCase() };
      if (editingId) {
        await updateBankAccount(editingId, payload);
        toast.success("Bank account updated");
      } else {
        await createBankAccount(payload);
        toast.success("Bank account added");
      }
      setOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save bank account");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingBusy(true);
    try {
      await deleteBankAccount(deleting.id);
      toast.success("Bank account deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bank account");
    } finally {
      setDeletingBusy(false);
    }
  };

  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const currenciesInUse = CURRENCIES.filter((c) => active.some((a) => a.currency === c));
  const currenciesWithoutDefault = currenciesInUse.filter((c) => !active.some((a) => a.currency === c && a.is_default));
  const replacingDefault = form.is_default && !form.archived && hasDefaultFor(form.currency, editingId);

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Bank accounts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Accounts clients can pay into by bank transfer. Pick one or more on each invoice or quotation.
          </p>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={openCreate}
            className="flex h-10 items-center gap-2 self-start rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] sm:self-auto dark:bg-secondary dark:text-secondary-foreground"
          >
            <Plus aria-hidden="true" className="size-4" />
            Add bank account
          </button>
        ) : null}
      </div>

      {currenciesWithoutDefault.length > 0 ? (
        <div className="flex gap-3 rounded-2xl bg-[#F8EEDB] px-4 py-3 dark:bg-amber-950/60">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#8A5A12] dark:text-amber-300" />
          <p className="text-[13px] text-[#5C3D0C] dark:text-amber-100">
            No default account for {currenciesWithoutDefault.join(", ")}. New invoices in{" "}
            {currenciesWithoutDefault.length === 1 ? "that currency" : "those currencies"} won&apos;t have bank details pre-selected.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} aria-hidden="true" className="h-64 animate-pulse rounded-[26px] bg-white ring-1 ring-border/50 dark:bg-card" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[26px] bg-white px-6 py-14 text-center ring-1 ring-border/50 dark:bg-card">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <Landmark aria-hidden="true" className="size-5 text-muted-foreground" />
          </span>
          <div>
            <p className="font-medium">No bank accounts yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your AED and USD accounts so they print on invoices.</p>
          </div>
          {canManage ? (
            <button
              type="button"
              onClick={openCreate}
              className="mt-1 flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              <Plus aria-hidden="true" className="size-4" />
              Add bank account
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {active.map((account) => (
              <AccountCard key={account.id} account={account} canManage={canManage} onEdit={() => openEdit(account)} onDelete={() => setDeleting(account)} />
            ))}
          </div>

          {archived.length > 0 ? (
            <section aria-labelledby="archived-title" className="space-y-3 pt-2">
              <h2 id="archived-title" className="flex items-center gap-2 px-1 text-sm font-medium text-muted-foreground">
                <Archive aria-hidden="true" className="size-4" />
                Archived · {archived.length}
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {archived.map((account) => (
                  <AccountCard key={account.id} account={account} canManage={canManage} onEdit={() => openEdit(account)} onDelete={() => setDeleting(account)} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}

      {/* Add / edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit bank account" : "Add bank account"}</DialogTitle>
            <DialogDescription>Invoices already issued keep the details they were created with. Changes only affect new invoices.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <Field id="bank-label" label="Label" hint="Internal only — clients never see it.">
              <Input id="bank-label" placeholder="Mashreq – USD" className={FIELD} value={form.label} onChange={(e) => set("label", e.target.value)} />
            </Field>
            <Field id="bank-account-name" label="Account name" hint="Exactly as the bank holds it. Printed on invoices.">
              <Input
                id="bank-account-name"
                placeholder="Polygraph International Hr Consultancy L.L.C"
                className={FIELD}
                value={form.account_name}
                onChange={(e) => set("account_name", e.target.value)}
              />
            </Field>
            <Field id="bank-name" label="Bank">
              <Input id="bank-name" placeholder="Mashreq" className={FIELD} value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            </Field>
            <div className="grid gap-1.5">
              <span className="px-1 text-[13px] font-medium">Currency</span>
              <Segmented label="Currency" value={form.currency} onChange={changeCurrency} options={CURRENCIES.map((c) => ({ value: c, label: c }))} className="w-fit" />
            </div>
            <Field id="bank-account-number" label="Account number">
              <Input
                id="bank-account-number"
                inputMode="numeric"
                className={cn(FIELD, "font-mono")}
                value={form.account_number}
                onChange={(e) => set("account_number", e.target.value)}
              />
            </Field>
            <Field id="bank-iban" label="IBAN">
              <Input
                id="bank-iban"
                className={cn(FIELD, "font-mono uppercase")}
                placeholder="AE00 0000 0000 0000 0000 000"
                value={form.iban}
                onChange={(e) => set("iban", e.target.value)}
              />
            </Field>
            <Field id="bank-swift" label="SWIFT / BIC" optional hint="Needed by clients sending money from outside the UAE.">
              <Input
                id="bank-swift"
                className={cn(FIELD, "font-mono uppercase")}
                placeholder="BOMLAEAD"
                value={form.swift_code}
                onChange={(e) => set("swift_code", e.target.value)}
              />
            </Field>

            <SwitchRow
              label={`Default for ${form.currency} invoices`}
              description={`Pre-selected on new ${form.currency} invoices, and shown on older ones that never had an account picked.`}
              checked={form.is_default}
              disabled={form.archived}
              onChange={(v) => set("is_default", v)}
            />
            {replacingDefault ? (
              <p className="-mt-2 px-1 text-xs text-[#8A5A12] dark:text-amber-300">This replaces the current {form.currency} default.</p>
            ) : null}
            {editingId ? (
              <SwitchRow
                label="Archived"
                description="Can no longer be picked. Invoices already using it are unchanged."
                checked={form.archived}
                onChange={(v) => setForm((current) => ({ ...current, archived: v, is_default: v ? false : current.is_default }))}
              />
            ) : null}
          </div>

          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || missingRequired}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : editingId ? "Save changes" : "Add bank account"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent className="rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Delete {deleting?.label}?</DialogTitle>
            <DialogDescription>
              Invoices that already show this account keep their copy. To stop using it without deleting, edit it and turn on Archived instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <button
              type="button"
              onClick={() => setDeleting(null)}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deletingBusy}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-destructive px-5 text-sm font-semibold text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {deletingBusy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function AccountCard({
  account,
  canManage,
  onEdit,
  onDelete,
}: {
  account: BankAccount;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const needsSwift = !account.swift_code && account.currency !== "AED" && !account.archived;
  return (
    <article
      className={cn(
        "flex flex-col gap-5 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-6 dark:bg-card",
        account.archived && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#30302E] text-[13px] font-semibold tracking-wide text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground">
            {account.currency}
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-medium" title={account.label}>
              {account.label}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 text-[13px] text-muted-foreground">
              <Landmark aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{account.bank_name}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {account.is_default ? (
            <span className="mr-1 inline-flex items-center gap-1 rounded-full bg-[#E7F1E4] px-2.5 py-1 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
              <Star aria-hidden="true" className="size-3 fill-current" />
              Default
            </span>
          ) : null}
          {account.archived ? (
            <span className="mr-1 inline-flex items-center rounded-full bg-[#ECE9E0] px-2.5 py-1 text-xs font-medium text-[#3D3929] dark:bg-muted dark:text-foreground">
              Archived
            </span>
          ) : null}
          {canManage ? (
            <>
              <IconButton label={`Edit ${account.label}`} onClick={onEdit}>
                <Pencil aria-hidden="true" className="size-4" />
              </IconButton>
              <IconButton label={`Delete ${account.label}`} onClick={onDelete} danger>
                <Trash2 aria-hidden="true" className="size-4" />
              </IconButton>
            </>
          ) : null}
        </div>
      </div>

      <dl className="grid gap-1 rounded-2xl bg-[#F7F6F1] p-2 dark:bg-muted/40">
        <DetailRow label="Account name" value={account.account_name} />
        {account.account_number ? <DetailRow label="Account no." value={account.account_number} mono copy /> : null}
        {account.iban ? <DetailRow label="IBAN" value={account.iban} display={groupIban(account.iban)} mono copy /> : null}
        {account.swift_code ? <DetailRow label="SWIFT / BIC" value={account.swift_code} mono copy /> : null}
      </dl>

      {needsSwift ? (
        <p className="-mt-2 flex items-center gap-2 px-1 text-xs text-[#8A5A12] dark:text-amber-300">
          <AlertTriangle aria-hidden="true" className="size-3.5 shrink-0" />
          No SWIFT / BIC — clients paying from abroad usually need it.
        </p>
      ) : null}
    </article>
  );
}

function DetailRow({ label, value, display, mono, copy }: { label: string; value: string; display?: string; mono?: boolean; copy?: boolean }) {
  const [copied, setCopied] = React.useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value.replace(/\s+/g, mono ? "" : " "));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };
  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2">
      <dt className="w-24 shrink-0 text-[13px] text-muted-foreground">{label}</dt>
      <dd className={cn("min-w-0 flex-1 text-sm break-words", mono ? "font-mono text-[13px] tracking-tight" : "font-medium")}>{display ?? value}</dd>
      {copy ? (
        <button
          type="button"
          onClick={() => void handleCopy()}
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          title={copied ? "Copied" : `Copy ${label}`}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground focus-visible:opacity-100 dark:hover:bg-card",
            copied ? "text-[#2D5A27] opacity-100 dark:text-emerald-300" : "opacity-60 group-hover:opacity-100",
          )}
        >
          {copied ? <Check aria-hidden="true" className="size-3.5" /> : <Copy aria-hidden="true" className="size-3.5" />}
        </button>
      ) : null}
    </div>
  );
}

function IconButton({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function Field({ id, label, hint, optional, children }: { id: string; label: string; hint?: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40", disabled && "opacity-60")}>
      <div className="min-w-0">
        <label htmlFor={id} className={cn("text-sm font-medium", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
          {label}
        </label>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed",
          checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
        )}
      >
        <span
          aria-hidden="true"
          className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")}
        />
      </button>
    </div>
  );
}
