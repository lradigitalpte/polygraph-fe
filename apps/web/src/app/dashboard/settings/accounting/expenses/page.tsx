"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Search,
  Wallet,
  Percent,
  ListOrdered,
  Download,
  CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { ExpenseFormDialog } from "@/components/dashboard/accounting/expense-form-dialog";
import { MetricCard } from "@/components/dashboard/accounting/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteExpense,
  fetchExpenses,
  formatMoney,
  monthRange,
  quarterRange,
  resolveReceiptUrl,
  toDateInputValue,
  type Expense,
} from "@/lib/accounting";
import {
  buildExpensesCsvRows,
  downloadCsvFile,
  expensesExportFilename,
} from "@/lib/accounting-csv";

function paymentSummary(item: Expense) {
  if (item.payment_label) {
    return item.payment_last_four
      ? `${item.payment_label} •••• ${item.payment_last_four}`
      : item.payment_label;
  }
  if (item.payment_last_four) return `•••• ${item.payment_last_four}`;
  return item.payment_type || "—";
}

export default function AccountingExpensesPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const canManage = can("accounting:manage");

  React.useEffect(() => {
    if (!userLoading && !can("accounting:view")) {
      toast.error("You don't have permission to view accounting.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [items, setItems] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Expense | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [editing, setEditing] = React.useState<Expense | null>(null);
  const [search, setSearch] = React.useState("");

  const now = new Date();
  const defaultRange = monthRange(now.getFullYear(), now.getMonth());
  const [from, setFrom] = React.useState(defaultRange.from);
  const [to, setTo] = React.useState(defaultRange.to);

  const displayCurrency = items[0]?.currency || editing?.currency || "AED";

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchExpenses({
        from: from || undefined,
        to: to || undefined,
      });
      setItems(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load expenses");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  React.useEffect(() => {
    if (!userLoading && can("accounting:view")) {
      void load();
    }
  }, [userLoading, can, load]);

  function applyMonth(offset: number) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const r = monthRange(d.getFullYear(), d.getMonth());
    setFrom(r.from);
    setTo(r.to);
  }

  function applyQuarter(q: 1 | 2 | 3 | 4) {
    const r = quarterRange(now.getFullYear(), q);
    setFrom(r.from);
    setTo(r.to);
  }

  function clearPeriod() {
    setFrom("");
    setTo("");
  }

  function exportExpensesCsv() {
    if (filtered.length === 0) {
      toast.error("Nothing to export for the current filters.");
      return;
    }
    const rows = buildExpensesCsvRows(filtered, { from, to, search });
    downloadCsvFile(expensesExportFilename(from, to), rows);
    toast.success(`Exported ${filtered.length} row(s) to CSV (opens in Excel).`);
  }

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (item) =>
        item.vendor.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  const totals = React.useMemo(() => {
    let exVat = 0;
    let inputVat = 0;
    let gross = 0;
    for (const item of items) {
      exVat += item.amount_ex_vat;
      inputVat += item.vat_amount;
      gross += item.amount_inc_vat;
    }
    return { exVat, inputVat, gross, count: items.length };
  }, [items]);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(item: Expense) {
    setEditing(item);
    setDialogOpen(true);
  }

  async function confirmDelete() {
    if (!deleteTarget || !canManage) return;
    setDeleting(true);
    try {
      await deleteExpense(deleteTarget.id);
      toast.success("Expense removed");
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }

  if (userLoading || !can("accounting:view")) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <AccountingShell
      title="Expense log"
      description="Record business purchases with ex-VAT and recoverable VAT. These amounts feed the VAT returns report as input tax."
      actions={
        <>
          <Button variant="outline" onClick={exportExpensesCsv} disabled={loading || filtered.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Export Excel (CSV)
          </Button>
          {canManage ? (
            <Button onClick={openCreate} size="default">
              <Plus className="mr-2 h-4 w-4" />
              Add expense
            </Button>
          ) : (
            <Badge variant="secondary">View only</Badge>
          )}
        </>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            Date range
          </CardTitle>
          <CardDescription>
            List and export only include expenses in this period. Leave both empty for all dates.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => applyMonth(0)}>
              This month
            </Button>
            <Button type="button" variant="secondary" size="sm" onClick={() => applyMonth(-1)}>
              Last month
            </Button>
            {([1, 2, 3, 4] as const).map((q) => (
              <Button key={q} type="button" variant="outline" size="sm" onClick={() => applyQuarter(q)}>
                Q{q} {now.getFullYear()}
              </Button>
            ))}
            <Button type="button" variant="ghost" size="sm" onClick={clearPeriod}>
              All dates
            </Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="exp-from">From</Label>
              <Input id="exp-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="exp-to">To</Label>
              <Input id="exp-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={() => void load()} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Apply range
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Expenses in range"
          value={String(totals.count)}
          hint={from && to ? `${from} → ${to}` : "All dates"}
          icon={ListOrdered}
        />
        <MetricCard
          label="Total ex-VAT"
          value={formatMoney(totals.exVat, displayCurrency)}
          icon={Wallet}
        />
        <MetricCard
          label="Recoverable VAT"
          value={formatMoney(totals.inputVat, displayCurrency)}
          hint="Summed from expense lines"
          icon={Percent}
          variant="emphasis"
        />
        <MetricCard
          label="Total incl. VAT"
          value={formatMoney(totals.gross, displayCurrency)}
          variant="muted"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Ledger</CardTitle>
            <CardDescription className="mt-1">
              Search narrows the table and export. CSV matches what you see here for the selected period.
            </CardDescription>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search expenses…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <Wallet className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                {items.length === 0 ? "No expenses yet" : "No matches for your search"}
              </p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {items.length === 0 && canManage
                  ? "Add your first expense to track input VAT for returns."
                  : "Try a different search term."}
              </p>
              {items.length === 0 && canManage ? (
                <Button variant="outline" onClick={openCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add expense
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Paid with</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Ex-VAT</TableHead>
                    <TableHead className="text-right">VAT</TableHead>
                    <TableHead className="text-right">Incl. VAT</TableHead>
                    <TableHead className="w-[88px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((item) => (
                    <TableRow key={item.id} className="group">
                      <TableCell className="whitespace-nowrap tabular-nums">
                        {toDateInputValue(new Date(item.expense_date))}
                      </TableCell>
                      <TableCell className="font-medium">{item.vendor || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {item.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {item.description || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate">
                        {paymentSummary(item)}
                      </TableCell>
                      <TableCell>
                        {item.receipt_url ? (
                          <a
                            href={resolveReceiptUrl(item.receipt_url)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs underline"
                          >
                            File
                          </a>
                        ) : item.receipt_ref ? (
                          <span className="text-xs text-muted-foreground truncate max-w-[80px] inline-block">
                            Ref
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.amount_ex_vat, item.currency)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(item.vat_amount, item.currency)}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatMoney(item.amount_inc_vat, item.currency)}
                      </TableCell>
                      <TableCell>
                        {canManage ? (
                          <div className="flex justify-end gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeleteTarget(item)}
                              aria-label="Delete"
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ExpenseFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editing={editing}
        currency={displayCurrency}
        canManage={canManage}
        onSaved={() => void load()}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete expense?</DialogTitle>
            <DialogDescription>
              This removes the entry from your expense log and VAT return input totals. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteTarget ? (
            <p className="text-sm text-muted-foreground px-1">
              {deleteTarget.vendor || "Expense"} ·{" "}
              {formatMoney(deleteTarget.amount_inc_vat, deleteTarget.currency)} on{" "}
              {toDateInputValue(new Date(deleteTarget.expense_date))}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountingShell>
  );
}
