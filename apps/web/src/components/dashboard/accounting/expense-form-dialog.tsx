"use client";

import * as React from "react";
import { Loader2, Save, Settings2, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { PurchaseCatalogDialog } from "@/components/dashboard/accounting/purchase-catalog-dialog";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  computeExpenseTotals,
  createExpense,
  fetchPaymentMethods,
  fetchPurchaseItems,
  formatMoney,
  resolveReceiptUrl,
  toDateInputValue,
  updateExpense,
  uploadExpenseReceipt,
  type Expense,
  type ExpensePaymentMethod,
  type ExpensePurchaseItem,
} from "@/lib/accounting";

export type ExpenseFormState = {
  expense_date: string;
  vendor: string;
  description: string;
  category: string;
  purchase_item_id: string;
  amount_ex_vat: string;
  vat_rate: string;
  vat_mode: string;
  vat_amount_fixed: string;
  apply_vat: boolean;
  payment_method_id: string;
  payment_type: string;
  payment_label: string;
  payment_last_four: string;
  payment_bank_name: string;
  save_payment_method: boolean;
  receipt_ref: string;
};

export function defaultExpenseForm(): ExpenseFormState {
  return {
    expense_date: toDateInputValue(new Date()),
    vendor: "",
    description: "",
    category: "General",
    purchase_item_id: "",
    amount_ex_vat: "",
    vat_rate: "5",
    vat_mode: "rate",
    vat_amount_fixed: "",
    apply_vat: true,
    payment_method_id: "",
    payment_type: "credit_card",
    payment_label: "",
    payment_last_four: "",
    payment_bank_name: "",
    save_payment_method: false,
    receipt_ref: "",
  };
}

function formFromExpense(item: Expense): ExpenseFormState {
  return {
    expense_date: toDateInputValue(new Date(item.expense_date)),
    vendor: item.vendor,
    description: item.description,
    category: item.category,
    purchase_item_id: item.purchase_item_id ? String(item.purchase_item_id) : "",
    amount_ex_vat: String(item.amount_ex_vat),
    vat_rate: String(item.vat_rate),
    vat_mode: item.vat_rate > 0 || item.vat_amount > 0 ? "rate" : "none",
    vat_amount_fixed: String(item.vat_amount),
    apply_vat: item.vat_amount > 0 || item.vat_rate > 0,
    payment_method_id: item.payment_method_id ? String(item.payment_method_id) : "",
    payment_type: item.payment_type || "credit_card",
    payment_label: item.payment_label || "",
    payment_last_four: item.payment_last_four || "",
    payment_bank_name: "",
    save_payment_method: false,
    receipt_ref: item.receipt_ref || "",
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: Expense | null;
  currency: string;
  canManage: boolean;
  onSaved: () => void;
};

export function ExpenseFormDialog({ open, onOpenChange, editing, currency, canManage, onSaved }: Props) {
  const [form, setForm] = React.useState<ExpenseFormState>(defaultExpenseForm());
  const [saving, setSaving] = React.useState(false);
  const [catalogOpen, setCatalogOpen] = React.useState(false);
  const [purchaseItems, setPurchaseItems] = React.useState<ExpensePurchaseItem[]>([]);
  const [paymentMethods, setPaymentMethods] = React.useState<ExpensePaymentMethod[]>([]);
  const [itemSearch, setItemSearch] = React.useState("");
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);

  const loadMeta = React.useCallback(async (isNew: boolean) => {
    try {
      const [items, methods] = await Promise.all([fetchPurchaseItems(), fetchPaymentMethods()]);
      setPurchaseItems(items);
      setPaymentMethods(methods);
      const def = methods.find((m) => m.is_default);
      if (isNew && def) {
        setForm((f) => ({
          ...f,
          payment_method_id: String(def.id),
          payment_type: def.type,
          payment_label: def.label,
          payment_last_four: def.last_four || "",
        }));
      }
    } catch {
      /* optional */
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setReceiptFile(null);
    const isNew = !editing;
    setForm(editing ? formFromExpense(editing) : defaultExpenseForm());
    void loadMeta(isNew);
  }, [open, editing, loadMeta]);

  const filteredItems = React.useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return purchaseItems;
    return purchaseItems.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q)
    );
  }, [purchaseItems, itemSearch]);

  const preview = React.useMemo(() => {
    const ex = parseFloat(form.amount_ex_vat) || 0;
    const rate = parseFloat(form.vat_rate) || 0;
    const fixed = parseFloat(form.vat_amount_fixed) || 0;
    const mode = form.apply_vat ? form.vat_mode : "none";
    return computeExpenseTotals({
      amountExVat: ex,
      vatRate: rate,
      applyVat: form.apply_vat,
      vatMode: mode,
      vatAmountFixed: fixed,
    });
  }, [form.amount_ex_vat, form.vat_rate, form.vat_amount_fixed, form.vat_mode, form.apply_vat]);

  function applyPurchaseItem(id: string) {
    const item = purchaseItems.find((p) => String(p.id) === id);
    if (!item) {
      setForm((f) => ({ ...f, purchase_item_id: id }));
      return;
    }
    setForm((f) => ({
      ...f,
      purchase_item_id: id,
      description: item.description || item.name,
      category: item.category,
      amount_ex_vat: String(item.default_amount_ex_vat),
      vat_mode: item.vat_mode || "rate",
      vat_rate: String(item.vat_rate ?? 5),
      vat_amount_fixed: String(item.vat_amount_fixed ?? 0),
      apply_vat: item.vat_mode !== "none",
    }));
  }

  function onPaymentMethodPick(id: string) {
    if (id === "manual") {
      setForm((f) => ({ ...f, payment_method_id: "", payment_label: "", payment_last_four: "" }));
      return;
    }
    const pm = paymentMethods.find((m) => String(m.id) === id);
    if (!pm) return;
    setForm((f) => ({
      ...f,
      payment_method_id: id,
      payment_type: pm.type,
      payment_label: pm.label,
      payment_last_four: pm.last_four || "",
      payment_bank_name: pm.bank_name || "",
    }));
  }

  async function handleSave() {
    const ex = parseFloat(form.amount_ex_vat);
    if (!Number.isFinite(ex) || ex <= 0) {
      toast.error("Enter the purchase amount (ex-VAT).");
      return;
    }
    const totals = computeExpenseTotals({
      amountExVat: ex,
      vatRate: parseFloat(form.vat_rate) || 0,
      applyVat: form.apply_vat,
      vatMode: form.apply_vat ? form.vat_mode : "none",
      vatAmountFixed: parseFloat(form.vat_amount_fixed) || 0,
    });

    setSaving(true);
    try {
      const payload = {
        expense_date: form.expense_date,
        vendor: form.vendor,
        description: form.description,
        category: form.category,
        amount_ex_vat: totals.afterDiscount,
        vat_rate: totals.vatRate,
        vat_amount: totals.vatAmount,
        amount_inc_vat: totals.total,
        receipt_ref: form.receipt_ref,
        purchase_item_id: form.purchase_item_id ? Number(form.purchase_item_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        payment_type: form.payment_type,
        payment_label: form.payment_label,
        payment_last_four: form.payment_last_four,
        payment_bank_name: form.payment_bank_name,
        save_payment_method: form.save_payment_method && !form.payment_method_id,
      };

      let saved: Expense;
      if (editing) {
        saved = await updateExpense(editing.id, payload);
      } else {
        saved = await createExpense(payload);
      }
      if (receiptFile) {
        saved = await uploadExpenseReceipt(saved.id, receiptFile);
      }
      toast.success(editing ? "Expense updated" : "Expense recorded");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const existingReceipt = editing?.receipt_url ? resolveReceiptUrl(editing.receipt_url) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
            <DialogTitle>{editing ? "Edit expense" : "New expense"}</DialogTitle>
            <DialogDescription>
              What you bought, how you paid (card/bank + last 4 digits), and optional receipt upload.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-5 px-6 py-5 max-h-[min(75vh,640px)] overflow-y-auto">
            <section className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Purchase</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setCatalogOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  Manage catalog
                </Button>
              </div>
              <div className="grid gap-2">
                <Label>Catalog item</Label>
                <Input
                  placeholder="Search office supplies, services…"
                  value={itemSearch}
                  onChange={(e) => setItemSearch(e.target.value)}
                  className="mb-1"
                />
                <Select value={form.purchase_item_id || "none"} onValueChange={(v) => applyPurchaseItem(v === "none" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select from catalog (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Custom line —</SelectItem>
                    {filteredItems.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name} ({item.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="expense_date">Date</Label>
                  <Input
                    id="expense_date"
                    type="date"
                    value={form.expense_date}
                    onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vendor">Vendor / supplier</Label>
                  <Input
                    id="vendor"
                    placeholder="Who you paid"
                    value={form.vendor}
                    onChange={(e) => setForm((f) => ({ ...f, vendor: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">What was purchased</Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount_ex_vat">Amount ex-VAT</Label>
                  <Input
                    id="amount_ex_vat"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="e.g. 100"
                    value={form.amount_ex_vat}
                    onChange={(e) => setForm((f) => ({ ...f, amount_ex_vat: e.target.value }))}
                  />
                </div>
              </div>
              {form.vat_mode === "fixed" ? (
                <div className="grid gap-2">
                  <Label htmlFor="vat_amount_fixed">VAT amount (fixed)</Label>
                  <Input
                    id="vat_amount_fixed"
                    type="number"
                    min={0}
                    disabled={!form.apply_vat}
                    value={form.vat_amount_fixed}
                    onChange={(e) => setForm((f) => ({ ...f, vat_amount_fixed: e.target.value }))}
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label htmlFor="vat_rate">VAT rate (%)</Label>
                  <Input
                    id="vat_rate"
                    type="number"
                    min={0}
                    disabled={!form.apply_vat || form.vat_mode === "none"}
                    value={form.vat_rate}
                    onChange={(e) => setForm((f) => ({ ...f, vat_rate: e.target.value }))}
                  />
                </div>
              )}
              <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5">
                <Checkbox
                  id="apply_vat"
                  checked={form.apply_vat}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, apply_vat: checked === true }))
                  }
                />
                <Label htmlFor="apply_vat" className="cursor-pointer font-normal">
                  Recoverable VAT on this purchase
                </Label>
              </div>
            </section>

            <section className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Payment</p>
              <div className="grid gap-2">
                <Label>Saved account</Label>
                <Select
                  value={form.payment_method_id || "manual"}
                  onValueChange={onPaymentMethodPick}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Card or bank account" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Enter manually below</SelectItem>
                    {paymentMethods.map((m) => (
                      <SelectItem key={m.id} value={String(m.id)}>
                        {m.label}
                        {m.last_four ? ` •••• ${m.last_four}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {!form.payment_method_id ? (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label>Payment type</Label>
                      <Select
                        value={form.payment_type}
                        onValueChange={(v) => setForm((f) => ({ ...f, payment_type: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="credit_card">Credit card</SelectItem>
                          <SelectItem value="bank">Bank account</SelectItem>
                          <SelectItem value="cash">Cash</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="payment_last_four">Last 4 digits</Label>
                      <Input
                        id="payment_last_four"
                        maxLength={4}
                        inputMode="numeric"
                        placeholder="4242"
                        value={form.payment_last_four}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, payment_last_four: e.target.value.replace(/\D/g, "").slice(-4) }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="payment_label">Label (optional)</Label>
                      <Input
                        id="payment_label"
                        placeholder="e.g. Office Visa"
                        value={form.payment_label}
                        onChange={(e) => setForm((f) => ({ ...f, payment_label: e.target.value }))}
                      />
                    </div>
                    {form.payment_type === "bank" ? (
                      <div className="grid gap-2">
                        <Label htmlFor="payment_bank_name">Bank name</Label>
                        <Input
                          id="payment_bank_name"
                          value={form.payment_bank_name}
                          onChange={(e) => setForm((f) => ({ ...f, payment_bank_name: e.target.value }))}
                        />
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="save_pm"
                      checked={form.save_payment_method}
                      onCheckedChange={(c) => setForm((f) => ({ ...f, save_payment_method: c === true }))}
                    />
                    <Label htmlFor="save_pm" className="font-normal cursor-pointer">
                      Save this card/account for next time
                    </Label>
                  </div>
                </>
              ) : null}
            </section>

            <section className="space-y-3 border-t pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Receipt</p>
              <div className="grid gap-2">
                <Label htmlFor="receipt_file">Upload receipt (PDF, JPG, PNG — max 15MB)</Label>
                <Input
                  id="receipt_file"
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                />
              </div>
              {existingReceipt && !receiptFile ? (
                <a
                  href={existingReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary underline"
                >
                  <Paperclip className="h-4 w-4" />
                  {editing?.receipt_file_name || "View current receipt"}
                </a>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="receipt_ref">External reference (optional)</Label>
                <Input
                  id="receipt_ref"
                  placeholder="Portal link or invoice #"
                  value={form.receipt_ref}
                  onChange={(e) => setForm((f) => ({ ...f, receipt_ref: e.target.value }))}
                />
              </div>
            </section>

            <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-4 text-sm space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Totals preview</p>
              <div className="flex justify-between tabular-nums">
                <span>Ex-VAT</span>
                <span>{formatMoney(preview.afterDiscount, currency)}</span>
              </div>
              <div className="flex justify-between tabular-nums">
                <span>VAT</span>
                <span>{formatMoney(preview.vatAmount, currency)}</span>
              </div>
              <div className="flex justify-between font-semibold tabular-nums pt-1 border-t border-border">
                <span>Total incl. VAT</span>
                <span>{formatMoney(preview.total, currency)}</span>
              </div>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving || !canManage}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {editing ? "Save changes" : "Record expense"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PurchaseCatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        onChanged={() => void loadMeta(false)}
      />
    </>
  );
}
