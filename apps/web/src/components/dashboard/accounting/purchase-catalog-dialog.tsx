"use client";

import * as React from "react";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPurchaseItem,
  deletePurchaseItem,
  fetchPurchaseItems,
  updatePurchaseItem,
  type ExpensePurchaseItem,
} from "@/lib/accounting";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
};

const emptyItem = (): Partial<ExpensePurchaseItem> => ({
  name: "",
  description: "",
  category: "Office supplies",
  default_amount_ex_vat: 0,
  vat_mode: "rate",
  vat_rate: 5,
  vat_amount_fixed: 0,
  active: true,
});

export function PurchaseCatalogDialog({ open, onOpenChange, onChanged }: Props) {
  const [items, setItems] = React.useState<ExpensePurchaseItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [editing, setEditing] = React.useState<ExpensePurchaseItem | null>(null);
  const [form, setForm] = React.useState(emptyItem());
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setItems(await fetchPurchaseItems(search, true));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  }, [search]);

  React.useEffect(() => {
    if (open) void load();
  }, [open, load]);

  function startNew() {
    setEditing(null);
    setForm(emptyItem());
  }

  function startEdit(item: ExpensePurchaseItem) {
    setEditing(item);
    setForm({ ...item });
  }

  async function save() {
    if (!form.name?.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description || "",
        category: form.category || "General",
        default_amount_ex_vat: Number(form.default_amount_ex_vat) || 0,
        vat_mode: form.vat_mode || "rate",
        vat_rate: Number(form.vat_rate) || 0,
        vat_amount_fixed: Number(form.vat_amount_fixed) || 0,
        active: form.active !== false,
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
    if (!confirm("Remove this catalog item?")) return;
    try {
      await deletePurchaseItem(id);
      toast.success("Item removed");
      await load();
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Purchase catalog</DialogTitle>
          <DialogDescription>
            Manage reusable items (e.g. office supplies). Staff pick these when recording expenses.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 lg:grid-cols-2 flex-1 overflow-hidden min-h-0">
          <div className="flex flex-col gap-3 min-h-0">
            <Input
              placeholder="Search catalog…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="flex-1 overflow-y-auto border rounded-md divide-y">
              {loading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No items yet.</p>
              ) : (
                items.map((item) => (
                  <div key={item.id} className="flex items-start gap-2 p-3 text-sm hover:bg-muted/40">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.name}</p>
                      <p className="text-muted-foreground text-xs truncate">
                        {item.category} · ex-VAT {item.default_amount_ex_vat}
                        {item.vat_mode === "rate" && item.vat_rate > 0 ? ` · VAT ${item.vat_rate}%` : ""}
                        {item.vat_mode === "fixed" ? ` · VAT fixed ${item.vat_amount_fixed}` : ""}
                        {!item.active ? " · inactive" : ""}
                      </p>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => startEdit(item)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => void remove(item.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="space-y-3 overflow-y-auto pr-1">
            <p className="text-sm font-medium">{editing ? "Edit item" : "New catalog item"}</p>
            <div className="grid gap-2">
              <Label>Name</Label>
              <Input value={form.name || ""} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="grid gap-2">
              <Label>Category</Label>
              <Input
                value={form.category || ""}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={form.description || ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid gap-2">
              <Label>Default amount (ex-VAT)</Label>
              <Input
                type="number"
                min={0}
                value={form.default_amount_ex_vat ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, default_amount_ex_vat: Number(e.target.value) }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>VAT</Label>
              <Select
                value={form.vat_mode || "rate"}
                onValueChange={(v) => setForm((f) => ({ ...f, vat_mode: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="rate">Percentage rate</SelectItem>
                  <SelectItem value="fixed">Fixed VAT amount</SelectItem>
                  <SelectItem value="none">No VAT</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.vat_mode === "rate" ? (
              <div className="grid gap-2">
                <Label>VAT rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.vat_rate ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, vat_rate: Number(e.target.value) }))}
                />
              </div>
            ) : null}
            {form.vat_mode === "fixed" ? (
              <div className="grid gap-2">
                <Label>Fixed VAT amount</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.vat_amount_fixed ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, vat_amount_fixed: Number(e.target.value) }))
                  }
                />
              </div>
            ) : null}
            <div className="flex gap-2 pt-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save" : "Add to catalog"}
              </Button>
              {editing ? (
                <Button variant="outline" onClick={startNew}>
                  Cancel edit
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button variant="secondary" onClick={startNew}>
            <Plus className="mr-2 h-4 w-4" />
            New item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
