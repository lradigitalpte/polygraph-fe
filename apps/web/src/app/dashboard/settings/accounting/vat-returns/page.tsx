"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Loader2,
  FileSpreadsheet,
  CalendarRange,
  Info,
  TrendingUp,
  Receipt,
  Scale,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { MetricCard } from "@/components/dashboard/accounting/metric-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchVatReturn,
  formatMoney,
  monthRange,
  quarterRange,
  toDateInputValue,
  type VatReturnReport,
} from "@/lib/accounting";
import { buildVatReturnCsvRows, downloadCsvFile } from "@/lib/accounting-csv";

export default function VatReturnsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  const now = new Date();
  const defaultRange = monthRange(now.getFullYear(), now.getMonth());

  const [from, setFrom] = React.useState(defaultRange.from);
  const [to, setTo] = React.useState(defaultRange.to);
  const [report, setReport] = React.useState<VatReturnReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [initialLoad, setInitialLoad] = React.useState(true);

  React.useEffect(() => {
    if (!userLoading && !can("accounting:view")) {
      toast.error("You don't have permission to view accounting.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const load = React.useCallback(async () => {
    if (!from || !to) return;
    setLoading(true);
    try {
      const data = await fetchVatReturn(from, to);
      setReport(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load VAT return");
      setReport(null);
    } finally {
      setLoading(false);
      setInitialLoad(false);
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

  function exportCsv() {
    if (!report) {
      toast.error("Load a report for your date range before exporting.");
      return;
    }
    const rows = buildVatReturnCsvRows(report, from, to);
    downloadCsvFile(`vat-return-${from}-to-${to}.csv`, rows);
    toast.success("Exported VAT return for the selected period (opens in Excel).");
  }

  if (userLoading || !can("accounting:view")) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currency = report?.summary.currency || "AED";
  const netPayable = report?.summary.net_vat_payable ?? 0;
  const netLabel =
    netPayable > 0 ? "Payable to authority" : netPayable < 0 ? "Recoverable (credit)" : "Balanced";

  return (
    <AccountingShell
      title="VAT returns"
      description="Worksheet for your accountant: output VAT from invoice payments (VAT-enabled only), minus input VAT from expenses. Payment date drives the period; partial payments are split proportionally."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!report || loading}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel (CSV)
        </Button>
      }
    >
      <div className="flex gap-3 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
        <p>
          Figures are for internal reporting and FTA preparation—not a filed return. Dates use{" "}
          <span className="font-medium text-foreground">UTC</span>. Have your accountant validate
          before submission.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            Reporting period
          </CardTitle>
          <CardDescription>
            Choose a period, then Refresh. Export downloads exactly that range (summary + all line items).
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
          </div>
          <div className="grid sm:grid-cols-3 gap-4 items-end">
            <div className="grid gap-2">
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button onClick={() => void load()} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && initialLoad ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : report ? (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline" className="font-normal">
              {from} → {to}
            </Badge>
            <span>{report.output_lines.length} payment lines · {report.input_lines.length} expenses</span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Taxable supplies (ex-VAT)"
              value={formatMoney(report.summary.taxable_supplies_ex_vat, currency)}
              icon={TrendingUp}
            />
            <MetricCard
              label="Output VAT"
              value={formatMoney(report.summary.output_vat, currency)}
              icon={FileSpreadsheet}
            />
            <MetricCard
              label="Input VAT"
              value={formatMoney(report.summary.input_vat, currency)}
              icon={Receipt}
            />
            <MetricCard
              label="Net VAT"
              value={formatMoney(report.summary.net_vat_payable, currency)}
              hint={netLabel}
              icon={Scale}
              variant="emphasis"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sales (output VAT)</CardTitle>
              <CardDescription>Each row is one payment on a VAT invoice in the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {report.output_lines.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  No VAT invoice payments in this period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead className="text-right">Gross</TableHead>
                        <TableHead className="text-right">Ex-VAT</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.output_lines.map((line, i) => (
                        <TableRow key={`${line.quotation_id}-${line.paid_at}-${i}`}>
                          <TableCell>
                            <Link
                              href={`/dashboard/payments/q/${line.quotation_id}`}
                              className="font-medium underline underline-offset-2"
                            >
                              {line.invoice_code}
                            </Link>
                          </TableCell>
                          <TableCell>{line.client_name || "—"}</TableCell>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            {toDateInputValue(new Date(line.paid_at))}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-normal capitalize">
                              {line.method || "manual"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.gross_paid, line.currency || currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.ex_vat_portion, line.currency || currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.vat_portion, line.currency || currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={4} className="font-medium">
                          Period total
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(
                            report.output_lines.reduce((s, l) => s + l.gross_paid, 0),
                            currency
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(report.summary.taxable_supplies_ex_vat, currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(report.summary.output_vat, currency)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expenses (input VAT)</CardTitle>
              <CardDescription>Purchases recorded in the expense log with expense date in range.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {report.input_lines.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  No expenses in this period.{" "}
                  <Link href="/dashboard/settings/accounting/expenses" className="underline">
                    Add expenses
                  </Link>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vendor</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Ex-VAT</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                        <TableHead className="text-right">Incl. VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.input_lines.map((line) => (
                        <TableRow key={line.expense_id}>
                          <TableCell className="tabular-nums whitespace-nowrap">
                            {toDateInputValue(new Date(line.expense_date))}
                          </TableCell>
                          <TableCell>{line.vendor || "—"}</TableCell>
                          <TableCell>{line.category}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.amount_ex_vat, line.currency || currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.vat_amount, line.currency || currency)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(line.amount_inc_vat, line.currency || currency)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3} className="font-medium">
                          Period total
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(
                            report.input_lines.reduce((s, l) => s + l.amount_ex_vat, 0),
                            currency
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(report.summary.input_vat, currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(
                            report.input_lines.reduce((s, l) => s + l.amount_inc_vat, 0),
                            currency
                          )}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </AccountingShell>
  );
}
