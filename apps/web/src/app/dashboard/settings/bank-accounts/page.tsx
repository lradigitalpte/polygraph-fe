"use client";

import * as React from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import {
  createBankAccount,
  deleteBankAccount,
  fetchBankAccounts,
  updateBankAccount,
  type BankAccount,
  type BankAccountInput,
} from "@/lib/bank-accounts";

const CURRENCIES = ["AED", "USD", "GBP", "EUR"];

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

  const load = React.useCallback(async () => {
    setLoading(true);
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

  const openCreate = () => {
    setEditingId(null);
    // First account in a currency becomes its default automatically.
    setForm({ ...emptyForm, is_default: !accounts.some((a) => a.currency === "AED" && a.is_default) });
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

  const set = <K extends keyof BankAccountInput>(key: K, value: BankAccountInput[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingId) {
        await updateBankAccount(editingId, form);
        toast.success("Bank account updated");
      } else {
        await createBankAccount(form);
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
    try {
      await deleteBankAccount(deleting.id);
      toast.success("Bank account deleted");
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete bank account");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-medium">Bank Accounts</h3>
          <p className="text-sm text-muted-foreground">
            Accounts clients can pay into by bank transfer. Pick one or more on each invoice or quotation.
          </p>
        </div>
        {canManage ? (
          <Button className="gap-2" onClick={openCreate}>
            <Plus className="h-4 w-4" />
            Add Bank Account
          </Button>
        ) : null}
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading bank accounts…</CardContent>
        </Card>
      ) : accounts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No bank accounts yet. Add your AED and USD accounts so they print on invoices.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {accounts.map((account) => (
            <Card key={account.id} className={account.archived ? "opacity-60" : undefined}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{account.label}</CardTitle>
                    <CardDescription>{account.bank_name}</CardDescription>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    <Badge variant="outline">{account.currency}</Badge>
                    {account.is_default ? <Badge variant="success">Default</Badge> : null}
                    {account.archived ? <Badge variant="outline">Archived</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">Account name</dt>
                  <dd className="font-medium break-words">{account.account_name}</dd>
                  {account.account_number ? (
                    <>
                      <dt className="text-muted-foreground">Account no.</dt>
                      <dd className="font-mono">{account.account_number}</dd>
                    </>
                  ) : null}
                  {account.iban ? (
                    <>
                      <dt className="text-muted-foreground">IBAN</dt>
                      <dd className="font-mono break-all">{account.iban}</dd>
                    </>
                  ) : null}
                  {account.swift_code ? (
                    <>
                      <dt className="text-muted-foreground">SWIFT / BIC</dt>
                      <dd className="font-mono">{account.swift_code}</dd>
                    </>
                  ) : null}
                </dl>
                {canManage ? (
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openEdit(account)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="destructive" className="gap-2" onClick={() => setDeleting(account)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Bank Account" : "Add Bank Account"}</DialogTitle>
            <DialogDescription>
              Invoices already issued keep the details they were created with. Changes only affect new invoices.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="bank-label">Label (internal)</Label>
              <Input
                id="bank-label"
                placeholder="Mashreq – USD"
                value={form.label}
                onChange={(e) => set("label", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-account-name">Account name</Label>
              <Input
                id="bank-account-name"
                placeholder="Polygraph International Hr Consultancy L.L.C"
                value={form.account_name}
                onChange={(e) => set("account_name", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_140px]">
              <div className="grid gap-2">
                <Label htmlFor="bank-name">Bank name</Label>
                <Input
                  id="bank-name"
                  placeholder="Mashreq"
                  value={form.bank_name}
                  onChange={(e) => set("bank_name", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="bank-currency">Currency</Label>
                <Select value={form.currency} onValueChange={(val) => set("currency", val as string)}>
                  <SelectTrigger id="bank-currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-account-number">Account number</Label>
              <Input
                id="bank-account-number"
                className="font-mono"
                value={form.account_number}
                onChange={(e) => set("account_number", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-iban">IBAN</Label>
              <Input
                id="bank-iban"
                className="font-mono"
                placeholder="AE00 0000 0000 0000 0000 000"
                value={form.iban}
                onChange={(e) => set("iban", e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="bank-swift">
                SWIFT / BIC <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="bank-swift"
                className="font-mono"
                placeholder="BOMLAEAD"
                value={form.swift_code}
                onChange={(e) => set("swift_code", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Needed by clients sending money from outside the UAE.</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.is_default}
                disabled={form.archived}
                onCheckedChange={(checked) => set("is_default", Boolean(checked))}
              />
              <div>
                <div className="text-sm font-medium">Default for {form.currency} invoices</div>
                <div className="text-xs text-muted-foreground">
                  Pre-selected on new {form.currency} invoices, and shown on older invoices that never had one picked.
                </div>
              </div>
            </label>
            {editingId ? (
              <label className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  checked={form.archived}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      archived: Boolean(checked),
                      is_default: checked ? false : current.is_default,
                    }))
                  }
                />
                <div>
                  <div className="text-sm font-medium">Archived</div>
                  <div className="text-xs text-muted-foreground">
                    Can no longer be picked. Invoices already using it are unchanged.
                  </div>
                </div>
              </label>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Save Changes" : "Add Bank Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleting !== null} onOpenChange={(next) => !next && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {deleting?.label}?</DialogTitle>
            <DialogDescription>
              Invoices that already show this account keep their copy. To stop using it without deleting, edit it and
              mark it archived.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => void handleDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
