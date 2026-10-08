"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Loader2,
  CalendarRange,
  FileBarChart,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { AccountingShell } from "@/components/dashboard/accounting/accounting-shell";
import { MetricCard } from "@/components/dashboard/accounting/metric-card";
import {
  AccountingTablePagination,
  useAccountingPagination,
} from "@/components/dashboard/accounting/table-pagination";
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
  fetchSalesReport,
  formatMoney,
  monthRange,
  quarterRange,
  toDateInputValueUTC,
  type SalesReport,
} from "@/lib/accounting";
import { buildSalesReportCsvRows, downloadCsvFile } from "@/lib/accounting-csv";
import { cn } from "@/lib/utils";

type VatFilter = "all" | "with" | "without";

export default function SalesReportPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  const now = new Date();
  const defaultRange = monthRange(now.getFullYear(), now.getMonth());

  const [from, setFrom] = React.useState(defaultRange.from);
  const [to, setTo] = React.useState(defaultRange.to);
  const [report, setReport] = React.useState<SalesReport | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [initialLoad, setInitialLoad] = React.useState(true);
  const [vatFilter, setVatFilter] = React.useState<VatFilter>("all");
  const [pageSize, setPageSize] = React.useState(10);

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
      const data = await fetchSalesReport(from, to);
      setReport(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load sales report");
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

  const visibleLines = React.useMemo(() => {
    if (!report) return [];
    const lines = report.lines ?? [];
    if (vatFilter === "with") return lines.filter((l) => l.has_vat);
    if (vatFilter === "without") return lines.filter((l) => !l.has_vat);
    return lines;
  }, [report, vatFilter]);

  const visibleTotals = React.useMemo(() => {
    let gross = 0;
    let ex = 0;
    let vat = 0;
    for (const l of visibleLines) {
      gross += l.gross_paid;
      ex += l.ex_vat_portion;
      vat += l.vat_portion;
    }
    return { gross, ex, vat, count: visibleLines.length };
  }, [visibleLines]);

  const { page, setPage, totalPages, sliceStart, sliceEnd } = useAccountingPagination(
    visibleLines.length,
    pageSize
  );
  const pagedLines = visibleLines.slice(sliceStart, sliceEnd);

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
    const exportReport: SalesReport =
      vatFilter === "all"
        ? report
        : {
            ...report,
            lines: visibleLines,
            summary: {
              ...report.summary,
              total_gross_incl_vat: visibleTotals.gross,
              total_ex_vat: visibleTotals.ex,
              total_vat: visibleTotals.vat,
              payment_line_count: visibleTotals.count,
              with_vat_line_count: visibleLines.filter((l) => l.has_vat).length,
              without_vat_line_count: visibleLines.filter((l) => !l.has_vat).length,
            },
          };
    const suffix = vatFilter === "all" ? "" : `-${vatFilter}-vat`;
    const rows = buildSalesReportCsvRows(exportReport, from, to);
    downloadCsvFile(`sales-report-${from}-to-${to}${suffix}.csv`, rows);
    toast.success("Exported sales report (opens in Excel).");
  }

  if (userLoading || !can("accounting:view")) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const currency = report?.summary.currency || "AED";

  return (
    <AccountingShell
      title="Sales report"
      description="All invoice payments in the period: gross (incl. VAT where applicable), ex-VAT portion, and VAT portion. Includes invoices with and without VAT."
      actions={
        <Button variant="outline" onClick={exportCsv} disabled={!report || loading || visibleLines.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Export Excel (CSV)
        </Button>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarRange className="h-4 w-4" />
            Reporting period
          </CardTitle>
          <CardDescription>Payment date determines inclusion (UTC). Same basis as VAT returns.</CardDescription>
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
              <Label htmlFor="sr-from">From</Label>
              <Input id="sr-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="sr-to">To</Label>
              <Input id="sr-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
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
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: "all" as const, label: "All payments" },
                { id: "with" as const, label: "With VAT" },
                { id: "without" as const, label: "Without VAT" },
              ] as const
            ).map((tab) => (
              <Button
                key={tab.id}
                type="button"
                size="sm"
                variant={vatFilter === tab.id ? "default" : "outline"}
                onClick={() => setVatFilter(tab.id)}
              >
                {tab.label}
                {tab.id === "with" && report.summary.with_vat_line_count > 0
                  ? ` (${report.summary.with_vat_line_count})`
                  : ""}
                {tab.id === "without" && report.summary.without_vat_line_count > 0
                  ? ` (${report.summary.without_vat_line_count})`
                  : ""}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Gross collected (incl. VAT)"
              value={formatMoney(visibleTotals.gross, currency)}
              hint={`${visibleTotals.count} payment line(s)`}
              icon={Banknote}
            />
            <MetricCard
              label="Ex-VAT"
              value={formatMoney(visibleTotals.ex, currency)}
              icon={FileBarChart}
            />
            <MetricCard
              label="VAT"
              value={formatMoney(visibleTotals.vat, currency)}
              variant="emphasis"
            />
            <MetricCard
              label="Split"
              value={`${report.summary.with_vat_line_count} / ${report.summary.without_vat_line_count}`}
              hint="With VAT / without VAT lines (full period)"
              variant="muted"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payment lines</CardTitle>
              <CardDescription>
                <span className="font-medium text-foreground">Paid</span> dates are UTC. Booking collections without a
                payment timestamp use the exam date (same day as the invoice date on Payments).{" "}
                <span className="font-medium text-foreground">Incl. VAT</span> = gross paid ·{" "}
                <span className="font-medium text-foreground">Ex-VAT</span> and{" "}
                <span className="font-medium text-foreground">VAT</span> split proportionally on VAT invoices; non-VAT
                rows show full amount as ex-VAT.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-0">
              {visibleLines.length === 0 ? (
                <div className="py-14 text-center text-sm text-muted-foreground">
                  No payments match this filter in the selected period.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Client</TableHead>
                        <TableHead>Paid (UTC)</TableHead>
                        <TableHead>VAT</TableHead>
                        <TableHead className="text-right">Incl. VAT (gross)</TableHead>
                        <TableHead className="text-right">Ex-VAT</TableHead>
                        <TableHead className="text-right">VAT</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedLines.map((line, i) => (
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
                            {toDateInputValueUTC(new Date(line.paid_at))}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={line.has_vat ? "default" : "secondary"}
                              className={cn("font-normal", !line.has_vat && "text-muted-foreground")}
                            >
                              {line.has_vat ? `${line.vat_rate}% VAT` : "No VAT"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums font-medium">
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
                          Filtered total
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(visibleTotals.gross, currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(visibleTotals.ex, currency)}
                        </TableCell>
                        <TableCell className="text-right font-medium tabular-nums">
                          {formatMoney(visibleTotals.vat, currency)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                  <AccountingTablePagination
                    currentPage={page}
                    totalPages={totalPages}
                    totalItems={visibleLines.length}
                    pageSize={pageSize}
                    onPageChange={setPage}
                    onPageSizeChange={setPageSize}
                    label="payment lines"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </AccountingShell>
  );
}
