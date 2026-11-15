"use client";

import * as React from "react";
import { Check, ChevronDown, FileUp, Loader2, Package, Paperclip, Receipt, Search, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { PurchaseCatalogDialog } from "@/components/dashboard/accounting/purchase-catalog-dialog";
import { CategoryPicker } from "@/components/dashboard/accounting/category-picker";
import { GlowPanel, Segmented } from "@/components/dashboard/ui-kit";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  computeExpenseTotals,
  createExpense,
  fetchExpenses,
  fetchPaymentMethods,
  fetchPurchaseItems,
  formatMoney,
  resolveReceiptUrl,
  toDateInputValue,
  toDateInputValueUTC,
  updateExpense,
  uploadExpenseReceipt,
  type Expense,
  type ExpensePaymentMethod,
  type ExpensePurchaseItem,
} from "@/lib/accounting";
import { cn } from "@/lib/utils";

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const SELECT = cn(FIELD, "w-full appearance-none pr-10 outline-none focus-visible:ring-2 focus-visible:ring-ring");
const MAX_RECEIPT_BYTES = 15 * 1024 * 1024;

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

/** One control for VAT instead of a checkbox plus a hidden mode (they could disagree). */
type VatChoice = "rate" | "fixed" | "none";

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
    expense_date: toDateInputValueUTC(new Date(item.expense_date)),
    vendor: item.vendor,
    description: item.description,
    category: item.category,
    purchase_item_id: item.purchase_item_id ? String(item.purchase_item_id) : "",
    amount_ex_vat: String(item.amount_ex_vat),
    vat_rate: String(item.vat_rate),
    // A stored VAT amount with no rate was entered as a fixed amount.
    vat_mode: item.vat_rate > 0 ? "rate" : item.vat_amount > 0 ? "fixed" : "none",
    vat_amount_fixed: String(item.vat_amount),
    apply_vat: item.vat_amount > 0 || item.vat_rate > 0,
    payment_method_id: item.payment_method_id ? String(item.payment_method_id) : "",
    payment_type: item.payment_type || "credit_card",
    payment_label: item.payment_label || "",
    payment_last_four: item.payment_last_four || "",
    payment_bank_name: item.payment_method?.bank_name || "",
    save_payment_method: false,
    receipt_ref: item.receipt_ref || "",
  };
}

function vatChoiceOf(form: ExpenseFormState): VatChoice {
  if (!form.apply_vat || form.vat_mode === "none") return "none";
  return form.vat_mode === "fixed" ? "fixed" : "rate";
}

function hasFraction(value: string) {
  const n = parseFloat(value);
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) > 1e-9;
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
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [historyCategories, setHistoryCategories] = React.useState<string[]>([]);
  const [receiptFile, setReceiptFile] = React.useState<File | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);
  // Tracks whether the person has touched the payment fields, so the default
  // card (which loads asynchronously) never overwrites what they typed.
  const paymentTouched = React.useRef(false);

  const set = <K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const loadMeta = React.useCallback(async (isNew: boolean) => {
    try {
      const [items, methods, past] = await Promise.all([fetchPurchaseItems(), fetchPaymentMethods(), fetchExpenses().catch(() => [] as Expense[])]);
      setPurchaseItems(items);
      setPaymentMethods(methods);
      setHistoryCategories(Array.from(new Set(past.map((e) => e.category).filter(Boolean))));
      const def = methods.find((m) => m.is_default);
      if (isNew && def && !paymentTouched.current) {
        setForm((f) => ({
          ...f,
          payment_method_id: String(def.id),
          payment_type: def.type,
          payment_label: def.label,
          payment_last_four: def.last_four || "",
          payment_bank_name: def.bank_name || "",
        }));
      }
    } catch {
      /* catalog and saved cards are optional */
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setReceiptFile(null);
    setItemSearch("");
    setPickerOpen(false);
    paymentTouched.current = false;
    setForm(editing ? formFromExpense(editing) : defaultExpenseForm());
    void loadMeta(!editing);
  }, [open, editing, loadMeta]);

  const filteredItems = React.useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    const list = purchaseItems.filter((i) => i.active !== false || String(i.id) === form.purchase_item_id);
    if (!q) return list;
    // Keep the selected item in the list even when the search would hide it.
    return list.filter((i) => String(i.id) === form.purchase_item_id || [i.name, i.category, i.description].some((v) => (v || "").toLowerCase().includes(q)));
  }, [purchaseItems, itemSearch, form.purchase_item_id]);

  // What past expenses and the catalog already use; the picker adds sensible defaults.
  const knownCategories = React.useMemo(() => [...historyCategories, ...purchaseItems.map((i) => i.category)].filter(Boolean), [historyCategories, purchaseItems]);

  const selectedItem = purchaseItems.find((i) => String(i.id) === form.purchase_item_id) ?? null;
  const vatChoice = vatChoiceOf(form);

  const preview = React.useMemo(
    () =>
      computeExpenseTotals({
        amountExVat: parseFloat(form.amount_ex_vat) || 0,
        vatRate: parseFloat(form.vat_rate) || 0,
        applyVat: vatChoice !== "none",
        vatMode: vatChoice,
        vatAmountFixed: parseFloat(form.vat_amount_fixed) || 0,
      }),
    [form.amount_ex_vat, form.vat_rate, form.vat_amount_fixed, vatChoice],
  );

  const rounded = hasFraction(form.amount_ex_vat) || (vatChoice === "fixed" && hasFraction(form.vat_amount_fixed)) || (vatChoice === "rate" && preview.vatAmount > 0 && hasFraction(String(((parseFloat(form.amount_ex_vat) || 0) * (parseFloat(form.vat_rate) || 0)) / 100)));

  function setVatChoice(choice: VatChoice) {
    setForm((f) => ({ ...f, vat_mode: choice, apply_vat: choice !== "none" }));
  }

  function applyPurchaseItem(id: string) {
    setPickerOpen(false);
    setItemSearch("");
    const item = purchaseItems.find((p) => String(p.id) === id);
    if (!item) {
      set("purchase_item_id", id);
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
    paymentTouched.current = true;
    if (id === "manual") {
      setForm((f) => ({ ...f, payment_method_id: "", payment_label: "", payment_last_four: "", payment_bank_name: "" }));
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

  function pickFile(file: File | null) {
    if (file && file.size > MAX_RECEIPT_BYTES) {
      toast.error("That file is larger than 15 MB.");
      if (fileInput.current) fileInput.current.value = "";
      return;
    }
    setReceiptFile(file);
  }

  const amountValid = (parseFloat(form.amount_ex_vat) || 0) > 0;
  const canSave = canManage && !saving && amountValid && Boolean(form.expense_date);

  async function handleSave() {
    if (!form.expense_date) {
      toast.error("Choose the date of the purchase.");
      return;
    }
    const ex = parseFloat(form.amount_ex_vat);
    if (!Number.isFinite(ex) || ex <= 0) {
      toast.error("Enter the purchase amount (ex-VAT).");
      return;
    }

    setSaving(true);
    let saved: Expense | null = null;
    try {
      const payload = {
        expense_date: form.expense_date,
        vendor: form.vendor.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "General",
        amount_ex_vat: preview.afterDiscount,
        vat_rate: preview.vatRate,
        vat_amount: preview.vatAmount,
        amount_inc_vat: preview.total,
        receipt_ref: form.receipt_ref.trim(),
        purchase_item_id: form.purchase_item_id ? Number(form.purchase_item_id) : undefined,
        payment_method_id: form.payment_method_id ? Number(form.payment_method_id) : undefined,
        payment_type: form.payment_type,
        payment_label: form.payment_label.trim(),
        payment_last_four: form.payment_last_four,
        payment_bank_name: form.payment_bank_name.trim(),
        save_payment_method: form.save_payment_method && !form.payment_method_id,
      };
      saved = editing ? await updateExpense(editing.id, payload) : await createExpense(payload);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
      setSaving(false);
      return;
    }

    // The expense exists now. A failed upload must not leave the dialog open, or
    // pressing save again would record the same purchase twice.
    if (receiptFile) {
      try {
        await uploadExpenseReceipt(saved.id, receiptFile);
      } catch (e) {
        toast.warning(`Expense saved, but the receipt didn't upload${e instanceof Error ? `: ${e.message}` : ""}. Edit the expense to attach it again.`);
        setSaving(false);
        onOpenChange(false);
        onSaved();
        return;
      }
    }

    toast.success(editing ? "Expense updated" : "Expense recorded");
    setSaving(false);
    onOpenChange(false);
    onSaved();
  }

  const existingReceipt = editing?.receipt_url ? resolveReceiptUrl(editing.receipt_url) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
        <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[26px] p-0 sm:max-w-2xl [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:z-30 [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-9 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-white/10 [&_[data-slot=dialog-close]]:text-[#FAF9F5] [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:ring-1 [&_[data-slot=dialog-close]]:ring-white/15">
          <GlowPanel tone={editing ? "lavender" : "amber"} orb="84%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
            <div className="flex items-end justify-between gap-4 pr-12">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                  <Receipt aria-hidden="true" className="size-4" />
                  Expense log
                </span>
                <DialogTitle className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] text-[#FAF9F5]">
                  {editing ? "Edit" : "New"} <span className="font-semibold">expense</span>
                </DialogTitle>
                <DialogDescription className="text-sm text-[#C9C6BC]">What you bought, how you paid, and the receipt.</DialogDescription>
              </div>
              <div className="hidden shrink-0 text-right sm:block" aria-live="polite">
                <p className="text-[13px] text-[#C9C6BC]">Total incl. VAT</p>
                <p className="text-2xl font-medium tracking-[-0.02em] text-[#FAF9F5] tabular-nums">{formatMoney(preview.total, currency)}</p>
              </div>
            </div>
          </GlowPanel>

          <form
            id="expense-form"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pb-5"
          >
            {/* Purchase */}
            <Section title="Purchase">
              <div className="grid gap-1.5">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[13px] font-medium">
                    From catalog <span className="font-normal text-muted-foreground">(optional)</span>
                  </span>
                  <button type="button" onClick={() => setCatalogOpen(true)} className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                    <Settings2 aria-hidden="true" className="size-3.5" />
                    Manage catalog
                  </button>
                </div>

                {selectedItem ? (
                  <div className="flex items-center gap-3 rounded-xl bg-[#F3F1EA] px-3.5 py-2.5 dark:bg-muted">
                    <span className="bg-primary/15 text-primary flex size-8 shrink-0 items-center justify-center rounded-lg">
                      <Package aria-hidden="true" className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{selectedItem.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{selectedItem.category}</span>
                    </span>
                    <button type="button" onClick={() => setPickerOpen((v) => !v)} className="text-xs font-medium text-muted-foreground hover:text-foreground">
                      Change
                    </button>
                    <button
                      type="button"
                      onClick={() => applyPurchaseItem("")}
                      aria-label="Clear catalog item"
                      className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                    >
                      <X aria-hidden="true" className="size-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPickerOpen((v) => !v)}
                    aria-expanded={pickerOpen}
                    className="flex h-11 items-center gap-2.5 rounded-xl bg-[#F3F1EA] px-3.5 text-left text-sm text-muted-foreground transition-colors hover:bg-[#ECE9E0] dark:bg-muted dark:hover:bg-muted/80"
                  >
                    <Package aria-hidden="true" className="size-4 shrink-0" />
                    <span className="flex-1">{purchaseItems.length > 0 ? "Pick something you buy often…" : "No catalog items yet"}</span>
                    <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 transition-transform", pickerOpen && "rotate-180")} />
                  </button>
                )}

                {pickerOpen ? (
                  <div className="overflow-hidden rounded-xl ring-1 ring-border">
                    <div className="relative border-b border-border/60">
                      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        autoFocus
                        aria-label="Search the catalog"
                        placeholder="Search name or category…"
                        value={itemSearch}
                        onChange={(e) => setItemSearch(e.target.value)}
                        className="h-11 w-full bg-transparent pr-3 pl-10 text-sm outline-none"
                      />
                    </div>
                    <ul className="max-h-56 overflow-y-auto py-1">
                      {filteredItems.length === 0 ? (
                        <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                          {purchaseItems.length === 0 ? "Add the things you buy often in the catalog." : "Nothing matches your search."}
                        </li>
                      ) : (
                        filteredItems.map((item) => {
                          const active = String(item.id) === form.purchase_item_id;
                          return (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => applyPurchaseItem(String(item.id))}
                                className={cn("flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/50", active && "bg-primary/10")}
                              >
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium">{item.name}</span>
                                  <span className="block truncate text-xs text-muted-foreground">{item.category}</span>
                                </span>
                                {item.default_amount_ex_vat > 0 ? (
                                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatMoney(item.default_amount_ex_vat, currency)}</span>
                                ) : null}
                                {active ? <Check aria-hidden="true" className="text-primary size-4 shrink-0" /> : null}
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="expense_date" label="Date">
                  <Input id="expense_date" type="date" required value={form.expense_date} onChange={(e) => set("expense_date", e.target.value)} className={FIELD} />
                </Field>
                <Field id="vendor" label="Vendor / supplier">
                  <Input id="vendor" placeholder="Who you paid" value={form.vendor} onChange={(e) => set("vendor", e.target.value)} className={FIELD} />
                </Field>
              </div>
              <Field id="description" label="What was purchased">
                <Textarea
                  id="description"
                  rows={2}
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  className="min-h-16 rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm shadow-none dark:bg-muted"
                />
              </Field>
              <CategoryPicker value={form.category} onChange={(c) => set("category", c)} known={knownCategories} />
            </Section>

            {/* Amount & VAT */}
            <Section title="Amount & VAT">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="amount_ex_vat" label={`Amount ex-VAT (${currency})`}>
                  <Input
                    id="amount_ex_vat"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={form.amount_ex_vat}
                    onChange={(e) => set("amount_ex_vat", e.target.value)}
                    className={cn(FIELD, "tabular-nums")}
                  />
                </Field>
                <div className="grid gap-1.5">
                  <span className="px-1 text-[13px] font-medium">Recoverable VAT</span>
                  <Segmented<VatChoice>
                    label="Recoverable VAT"
                    value={vatChoice}
                    onChange={setVatChoice}
                    className="w-fit"
                    options={[
                      { value: "rate", label: "Rate %" },
                      { value: "fixed", label: "Amount" },
                      { value: "none", label: "None" },
                    ]}
                  />
                </div>
              </div>
              {vatChoice === "rate" ? (
                <Field id="vat_rate" label="VAT rate (%)">
                  <Input id="vat_rate" type="number" inputMode="decimal" min={0} step="0.01" value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} className={cn(FIELD, "tabular-nums sm:w-40")} />
                </Field>
              ) : vatChoice === "fixed" ? (
                <Field id="vat_amount_fixed" label={`VAT amount (${currency})`}>
                  <Input
                    id="vat_amount_fixed"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={form.vat_amount_fixed}
                    onChange={(e) => set("vat_amount_fixed", e.target.value)}
                    className={cn(FIELD, "tabular-nums sm:w-40")}
                  />
                </Field>
              ) : (
                <p className="px-1 text-xs text-muted-foreground">No input VAT will be claimed for this purchase.</p>
              )}
            </Section>

            {/* Payment */}
            <Section title="Payment">
              {paymentMethods.length > 0 ? (
                <Field id="payment_method" label="Paid with">
                  <SelectField id="payment_method" value={form.payment_method_id || "manual"} onChange={onPaymentMethodPick}>
                    {paymentMethods.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                        {m.last_four ? ` •••• ${m.last_four}` : ""}
                      </option>
                    ))}
                    <option value="manual">Something else…</option>
                  </SelectField>
                </Field>
              ) : null}
              {!form.payment_method_id ? (
                <>
                  <div className="grid gap-1.5">
                    <span className="px-1 text-[13px] font-medium">Payment type</span>
                    <Segmented
                      label="Payment type"
                      value={form.payment_type}
                      onChange={(v) => {
                        paymentTouched.current = true;
                        set("payment_type", v);
                      }}
                      className="w-fit"
                      options={[
                        { value: "credit_card", label: "Card" },
                        { value: "bank", label: "Bank" },
                        { value: "cash", label: "Cash" },
                        { value: "other", label: "Other" },
                      ]}
                    />
                  </div>
                  {form.payment_type !== "cash" ? (
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field id="payment_label" label="Label" optional>
                        <Input
                          id="payment_label"
                          placeholder="Office Visa"
                          value={form.payment_label}
                          onChange={(e) => {
                            paymentTouched.current = true;
                            set("payment_label", e.target.value);
                          }}
                          className={FIELD}
                        />
                      </Field>
                      <Field id="payment_last_four" label="Last 4 digits" optional>
                        <Input
                          id="payment_last_four"
                          maxLength={4}
                          inputMode="numeric"
                          placeholder="4242"
                          value={form.payment_last_four}
                          onChange={(e) => {
                            paymentTouched.current = true;
                            set("payment_last_four", e.target.value.replace(/\D/g, "").slice(0, 4));
                          }}
                          className={cn(FIELD, "font-mono tracking-widest")}
                        />
                      </Field>
                      {form.payment_type === "bank" ? (
                        <Field id="payment_bank_name" label="Bank name" optional>
                          <Input id="payment_bank_name" value={form.payment_bank_name} onChange={(e) => set("payment_bank_name", e.target.value)} className={FIELD} />
                        </Field>
                      ) : null}
                    </div>
                  ) : null}
                  {form.payment_type !== "cash" ? (
                    <SwitchRow label="Save this card or account for next time" checked={form.save_payment_method} onChange={(v) => set("save_payment_method", v)} />
                  ) : null}
                </>
              ) : null}
            </Section>

            {/* Receipt */}
            <Section title="Receipt">
              <input
                ref={fileInput}
                id="receipt_file"
                type="file"
                accept="image/*,.pdf"
                className="sr-only"
                onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
              />
              {receiptFile ? (
                <div className="flex items-center gap-3 rounded-xl bg-[#F3F1EA] px-3.5 py-2.5 dark:bg-muted">
                  <Paperclip aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{receiptFile.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{(receiptFile.size / 1024 / 1024).toFixed(1)} MB</span>
                  <button
                    type="button"
                    onClick={() => {
                      setReceiptFile(null);
                      if (fileInput.current) fileInput.current.value = "";
                    }}
                    aria-label="Remove file"
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              ) : (
                <label
                  htmlFor="receipt_file"
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3.5 text-sm transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40"
                >
                  <FileUp aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block font-medium">{existingReceipt ? "Replace receipt" : "Upload receipt"}</span>
                    <span className="block text-xs text-muted-foreground">PDF, JPG or PNG, up to 15 MB</span>
                  </span>
                </label>
              )}
              {existingReceipt && !receiptFile ? (
                <a href={existingReceipt} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 self-start px-1 text-[13px] font-medium underline-offset-4 hover:underline">
                  <Paperclip aria-hidden="true" className="size-3.5" />
                  {editing?.receipt_file_name || "View current receipt"}
                </a>
              ) : null}
              <Field id="receipt_ref" label="Reference" optional>
                <Input id="receipt_ref" placeholder="Invoice number or portal link" value={form.receipt_ref} onChange={(e) => set("receipt_ref", e.target.value)} className={FIELD} />
              </Field>
            </Section>
          </form>

          {/* Totals + actions */}
          <DialogFooter className="flex-col gap-3 border-t border-border/50 bg-[#F7F6F1] px-6 py-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/40">
            <div className="min-w-0 text-sm">
              <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
                <span className="text-muted-foreground">
                  {formatMoney(preview.afterDiscount, currency)} + {formatMoney(preview.vatAmount, currency)} VAT
                </span>
                <span className="text-base font-semibold">= {formatMoney(preview.total, currency)}</span>
              </p>
              {rounded ? <p className="mt-0.5 text-xs text-[#8A5A12] dark:text-amber-300">Amounts are rounded up to whole {currency}.</p> : null}
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-white dark:hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="expense-form"
                disabled={!canSave}
                className="flex h-10 min-w-36 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
              >
                {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {saving ? "Saving…" : editing ? "Save changes" : "Record expense"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PurchaseCatalogDialog open={catalogOpen} onOpenChange={setCatalogOpen} onChanged={() => void loadMeta(false)} currency={currency} />
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-4 rounded-2xl p-4 ring-1 ring-border/50">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

function Field({ id, label, optional, children }: { id: string; label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted-foreground">(optional)</span> : null}
      </label>
      {children}
    </div>
  );
}

function SelectField({ id, value, onChange, children }: { id: string; value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return (
    <div className="relative">
      <select id={id} className={SELECT} value={value} onChange={(e) => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function SwitchRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-[#F7F6F1] px-4 py-3 dark:bg-muted/40">
      <label htmlFor={id} className="cursor-pointer text-sm">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
        )}
      >
        <span aria-hidden="true" className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")} />
      </button>
    </div>
  );
}
