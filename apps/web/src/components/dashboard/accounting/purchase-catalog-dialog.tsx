"use client";

import * as React from "react";
import { Loader2, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
  createPurchaseItem,
  deletePurchaseItem,
  fetchPurchaseItems,
  formatMoney,
  updatePurchaseItem,
  type ExpensePurchaseItem,
} from "@/lib/accounting";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
  currency?: string;
};

type VatMode = "rate" | "fixed" | "none";

type FormState = {
  name: string;
  description: string;
  category: string;
  amount: string;
  vat_mode: VatMode;
  vat_rate: string;
  vat_fixed: string;
  active: boolean;
};

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

const emptyForm = (): FormState => ({
  name: "",
  description: "",
  category: "Office supplies",
  amount: "",
  vat_mode: "rate",
  vat_rate: "5",
  vat_fixed: "",
  active: true,
});

function formFromItem(item: ExpensePurchaseItem): FormState {
  return {
    name: item.name,
    description: item.description || "",
    category: item.category || "General",
    amount: item.default_amount_ex_vat ? String(item.default_amount_ex_vat) : "",
    vat_mode: item.vat_mode === "fixed" || item.vat_mode === "none" ? item.vat_mode : "rate",
    vat_rate: String(item.vat_rate ?? 5),
    vat_fixed: item.vat_amount_fixed ? String(item.vat_amount_fixed) : "",
    active: item.active !== false,
  };
}

function vatLabel(item: ExpensePurchaseItem, currency: string) {
  if (item.vat_mode === "fixed") return `VAT ${formatMoney(item.vat_amount_fixed, currency)}`;
  if (item.vat_mode === "none") return "No VAT";
  return item.vat_rate > 0 ? `VAT ${item.vat_rate}%` : "No VAT";
}

export function PurchaseCatalogDialog({ open, onOpenChange, onChanged, currency = "AED" }: Props) {
  const [items, setItems] = React.useState<ExpensePurchaseItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<ExpensePurchaseItem | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [confirmId, setConfirmId] = React.useState<number | null>(null);
  const [removing, setRemoving] = React.useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPurchaseItems("", true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setSearch("");
    setEditing(null);
    setForm(emptyForm());
    setConfirmId(null);
    void load();
  }, [open, load]);

  // Filter in the browser: typing no longer reloads (and flashes) the whole list.
  const visible = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...items].sort((a, b) => a.name.localeCompare(b.name));
    if (!q) return sorted;
    return sorted.filter((i) => [i.name, i.category, i.description].some((v) => (v || "").toLowerCase().includes(q)));
  }, [items, search]);

  const knownCategories = React.useMemo(() => items.map((i) => i.category).filter(Boolean), [items]);

  function startNew() {
    setEditing(null);
    setForm(emptyForm());
  }

  function startEdit(item: ExpensePurchaseItem) {
    setEditing(item);
    setForm(formFromItem(item));
    setConfirmId(null);
  }

  async function save() {
    if (!form.name.trim()) {
      toast.error("Give the item a name");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "General",
        default_amount_ex_vat: parseFloat(form.amount) || 0,
        vat_mode: form.vat_mode,
        vat_rate: form.vat_mode === "rate" ? parseFloat(form.vat_rate) || 0 : 0,
        vat_amount_fixed: form.vat_mode === "fixed" ? parseFloat(form.vat_fixed) || 0 : 0,
        active: form.active,
      };
      if (editing) {
        await updatePurchaseItem(editing.id, payload);
        toast.success("Item updated");
      } else {
        await createPurchaseItem(payload);
        toast.success("Item added to catalog");
      }
      startNew();
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: number) {
    setRemoving(true);
    try {
      await deletePurchaseItem(id);
      toast.success("Item removed");
      if (editing?.id === id) startNew();
      setConfirmId(null);
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setRemoving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="flex max-h-[92vh] flex-col gap-0 overflow-hidden rounded-[26px] p-0 sm:max-w-4xl [&_[data-slot=dialog-close]]:top-5 [&_[data-slot=dialog-close]]:right-5 [&_[data-slot=dialog-close]]:z-30 [&_[data-slot=dialog-close]]:flex [&_[data-slot=dialog-close]]:size-9 [&_[data-slot=dialog-close]]:items-center [&_[data-slot=dialog-close]]:justify-center [&_[data-slot=dialog-close]]:rounded-full [&_[data-slot=dialog-close]]:bg-white/10 [&_[data-slot=dialog-close]]:text-[#FAF9F5] [&_[data-slot=dialog-close]]:opacity-100 [&_[data-slot=dialog-close]]:ring-1 [&_[data-slot=dialog-close]]:ring-white/15">
        <GlowPanel tone="sage" orb="82%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
          <div className="flex flex-col gap-1.5 pr-12">
            <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
              <Package aria-hidden="true" className="size-4" />
              Accounting
            </span>
            <DialogTitle className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] text-[#FAF9F5]">
              Purchase <span className="font-semibold">catalog</span>
            </DialogTitle>
            <DialogDescription className="max-w-xl text-[15px] text-[#C9C6BC]">
              Things you buy often. Pick one when recording an expense and the amount, category and VAT fill in for you.
            </DialogDescription>
          </div>
        </GlowPanel>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 sm:p-6 lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
          {/* Items */}
          <section aria-label="Catalog items" className="flex min-h-0 flex-col gap-3">
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search catalog" placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} className={cn(FIELD, "pl-10")} />
            </div>

            <div className="min-h-48 flex-1 overflow-y-auto rounded-2xl ring-1 ring-border/60 lg:min-h-0">
              {loading && items.length === 0 ? (
                <div className="flex justify-center p-10">
                  <Loader2 aria-label="Loading" className="size-6 animate-spin text-muted-foreground" />
                </div>
              ) : visible.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                    <Package aria-hidden="true" className="size-5 text-muted-foreground" />
                  </span>
                  <p className="font-medium">{items.length === 0 ? "No items yet" : "Nothing matches"}</p>
                  <p className="text-sm text-muted-foreground">{items.length === 0 ? "Add your first item using the form." : "Try a different search."}</p>
                </div>
              ) : (
                <ul className="divide-y divide-border/50">
                  {visible.map((item) => {
                    const isEditing = editing?.id === item.id;
                    const confirming = confirmId === item.id;
                    return (
                      <li key={item.id} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", isEditing && "bg-primary/10", !item.active && "opacity-60")}>
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#30302E] text-xs font-semibold text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground">
                          {item.name.slice(0, 1).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                            {!item.active ? <span className="ml-2 rounded-full bg-[#ECE9E0] px-2 py-0.5 text-[11px] font-medium text-[#3D3929] dark:bg-muted dark:text-foreground">Inactive</span> : null}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {item.category} · {item.default_amount_ex_vat > 0 ? formatMoney(item.default_amount_ex_vat, currency) : "No default amount"} · {vatLabel(item, currency)}
                          </p>
                        </div>
                        {confirming ? (
                          <div className="flex shrink-0 items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void remove(item.id)}
                              disabled={removing}
                              className="bg-destructive hover:bg-destructive/90 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              {removing ? <Loader2 aria-hidden="true" className="size-3 animate-spin" /> : null}
                              Remove
                            </button>
                            <button type="button" onClick={() => setConfirmId(null)} className="flex h-8 items-center rounded-full px-3 text-xs font-medium ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted">
                              Keep
                            </button>
                          </div>
                        ) : (
                          <div className="flex shrink-0 gap-0.5">
                            <IconButton label={`Edit ${item.name}`} onClick={() => startEdit(item)}>
                              <Pencil aria-hidden="true" className="size-4" />
                            </IconButton>
                            <IconButton label={`Remove ${item.name}`} onClick={() => setConfirmId(item.id)} danger>
                              <Trash2 aria-hidden="true" className="size-4" />
                            </IconButton>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </section>

          {/* Form */}
          <form
            aria-label={editing ? "Edit item" : "New item"}
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex min-h-0 flex-col gap-4 overflow-y-auto rounded-2xl bg-[#F7F6F1] p-4 sm:p-5 dark:bg-muted/40"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[15px] font-medium">{editing ? `Edit “${editing.name}”` : "New item"}</h3>
              {editing ? (
                <button type="button" onClick={startNew} className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium ring-1 ring-border hover:bg-white dark:hover:bg-muted">
                  <Plus aria-hidden="true" className="size-3.5" />
                  New instead
                </button>
              ) : null}
            </div>

            <Field id="item-name" label="Name">
              <Input id="item-name" placeholder="Printer paper" value={form.name} onChange={(e) => set("name", e.target.value)} className={cn(FIELD, "bg-white dark:bg-card")} />
            </Field>

            <CategoryPicker value={form.category} onChange={(c) => set("category", c)} known={knownCategories} />

            <Field id="item-description" label="Description" optional>
              <Textarea
                id="item-description"
                rows={2}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="min-h-16 rounded-xl border-0 bg-white px-3.5 py-3 text-sm shadow-none dark:bg-card"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="item-amount" label={`Default amount, ex-VAT (${currency})`} optional>
                <Input
                  id="item-amount"
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.01"
                  placeholder="0"
                  value={form.amount}
                  onChange={(e) => set("amount", e.target.value)}
                  className={cn(FIELD, "bg-white tabular-nums dark:bg-card")}
                />
              </Field>
              <div className="grid gap-1.5">
                <span className="px-1 text-[13px] font-medium">VAT</span>
                <Segmented<VatMode>
                  label="VAT"
                  value={form.vat_mode}
                  onChange={(v) => set("vat_mode", v)}
                  className="w-fit"
                  options={[
                    { value: "rate", label: "Rate %" },
                    { value: "fixed", label: "Amount" },
                    { value: "none", label: "None" },
                  ]}
                />
              </div>
            </div>

            {form.vat_mode === "rate" ? (
              <Field id="item-vat-rate" label="VAT rate (%)">
                <Input id="item-vat-rate" type="number" inputMode="decimal" min={0} step="0.01" value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} className={cn(FIELD, "bg-white tabular-nums sm:w-40 dark:bg-card")} />
              </Field>
            ) : form.vat_mode === "fixed" ? (
              <Field id="item-vat-fixed" label={`VAT amount (${currency})`}>
                <Input id="item-vat-fixed" type="number" inputMode="decimal" min={0} step="0.01" value={form.vat_fixed} onChange={(e) => set("vat_fixed", e.target.value)} className={cn(FIELD, "bg-white tabular-nums sm:w-40 dark:bg-card")} />
              </Field>
            ) : null}

            {editing ? <ActiveSwitch checked={form.active} onChange={(v) => set("active", v)} /> : null}

            <div className="mt-auto flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving || !form.name.trim()}
                className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
              >
                {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
                {saving ? "Saving…" : editing ? "Save changes" : "Add to catalog"}
              </button>
            </div>
          </form>
        </div>

        <DialogFooter className="border-t border-border/50 px-5 py-3 sm:px-6">
          <p className="mr-auto self-center text-xs text-muted-foreground">
            {items.length} {items.length === 1 ? "item" : "items"}
          </p>
          <button type="button" onClick={() => onOpenChange(false)} className="flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
            Done
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
        "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors",
        danger ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
      )}
    >
      {children}
    </button>
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

function ActiveSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = React.useId();
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white px-4 py-3 dark:bg-card">
      <div>
        <label htmlFor={id} className="cursor-pointer text-sm font-medium">
          Available when recording expenses
        </label>
        <p className="text-xs text-muted-foreground">Turn off to hide it without deleting it.</p>
      </div>
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
