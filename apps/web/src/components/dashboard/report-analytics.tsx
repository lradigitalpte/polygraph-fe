"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Building2, CalendarCheck2, CheckCircle2, Download, FileCheck2, TrendingUp, UserRoundSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { fetchConsolidatedStats, type ConsolidatedReportStats, type SecureReportShare } from "@/lib/reports";

type Range = "week" | "month" | "6months" | "year" | "all";
type Props = {
  appointments: AppointmentRecord[];
  shares: SecureReportShare[];
  stats: ConsolidatedReportStats | null;
  loading?: boolean;
  canFilterExaminer?: boolean;
};

const ranges: { value: Range; label: string }[] = [
  { value: "week", label: "7 days" }, { value: "month", label: "30 days" },
  { value: "6months", label: "6 months" }, { value: "year", label: "1 year" }, { value: "all", label: "All time" },
];

function startFor(range: Range) {
  const date = new Date();
  if (range === "all") return null;
  const days = range === "week" ? 7 : range === "month" ? 30 : range === "6months" ? 183 : 365;
  date.setDate(date.getDate() - days);
  return date;
}

function pct(value: number, total: number) { return total ? Math.round((value / total) * 100) : 0; }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export function ReportAnalytics({ appointments, shares, stats, loading, canFilterExaminer }: Props) {
  const [range, setRange] = React.useState<Range>("6months");
  const [examiner, setExaminer] = React.useState("all");
  const [outcomeStats, setOutcomeStats] = React.useState(stats);
  const [outcomesLoading, setOutcomesLoading] = React.useState(false);
  React.useEffect(() => { if (examiner === "all") setOutcomeStats(stats); }, [stats, examiner]);
  React.useEffect(() => {
    if (!canFilterExaminer || examiner === "all") return;
    let cancelled = false;
    setOutcomesLoading(true);
    void fetchConsolidatedStats(Number(examiner)).then((data) => { if (!cancelled) setOutcomeStats(data); }).finally(() => { if (!cancelled) setOutcomesLoading(false); });
    return () => { cancelled = true; };
  }, [canFilterExaminer, examiner]);
  const examinerIds = React.useMemo(() => [...new Set(appointments.map((item) => item.examiner_id))].sort((a, b) => a - b), [appointments]);
  const filtered = React.useMemo(() => {
    const start = startFor(range);
    return appointments.filter((item) => {
      const inRange = !start || new Date(item.scheduled_at) >= start;
      return inRange && (examiner === "all" || item.examiner_id === Number(examiner));
    });
  }, [appointments, examiner, range]);

  const completed = filtered.filter((item) => Boolean(item.exam_id) || item.status.toLowerCase() === "completed");
  const booked = filtered.length;
  const cancelled = filtered.filter((item) => ["cancelled", "canceled", "no-show", "no show"].includes(item.status.toLowerCase())).length;
  const statusVolume = React.useMemo(() => {
    const totals = new Map<string, number>();
    filtered.forEach((item) => {
      const status = item.status?.trim() || "Unknown";
      totals.set(status, (totals.get(status) || 0) + 1);
    });
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);
  const providerVolume = React.useMemo(() => {
    const totals = new Map<string, number>();
    filtered.forEach((item) => {
      const name = item.client?.name?.trim() || "Direct / private";
      totals.set(name, (totals.get(name) || 0) + 1);
    });
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 5);
  }, [filtered]);
  const examinerVolume = React.useMemo(() => {
    const totals = new Map<number, { booked: number; completed: number }>();
    filtered.forEach((item) => {
      const current = totals.get(item.examiner_id) || { booked: 0, completed: 0 };
      current.booked += 1;
      if (item.exam_id || item.status.toLowerCase() === "completed") current.completed += 1;
      totals.set(item.examiner_id, current);
    });
    return [...totals].map(([id, values]) => ({ id, ...values })).sort((a, b) => b.booked - a.booked).slice(0, 4);
  }, [filtered]);

  const activity = React.useMemo(() => {
    const count = range === "week" ? 7 : range === "month" ? 4 : range === "6months" ? 6 : 12;
    const daily = range === "week";
    const now = new Date();
    return Array.from({ length: count }, (_, index) => {
      const date = daily
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - (count - 1 - index))
        : new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1);
      const total = completed.filter((item) => {
        const itemDate = new Date(item.scheduled_at);
        if (daily) return itemDate.toDateString() === date.toDateString();
        if (range === "month") {
          const diff = Math.floor((now.getTime() - itemDate.getTime()) / 86400000);
          return Math.floor(Math.max(diff, 0) / 7) === count - 1 - index;
        }
        return itemDate.getFullYear() === date.getFullYear() && itemDate.getMonth() === date.getMonth();
      }).length;
      const label = daily ? date.toLocaleDateString("en", { weekday: "short" }) : range === "month" ? `W${index + 1}` : date.toLocaleDateString("en", { month: "short" });
      return { label, total };
    });
  }, [completed, range]);

  const exportCsv = () => {
    const headings = ["Appointment ID", "Date", "Examiner", "Examinee", "Provider", "Booking status", "Exam completed", "Report ready"];
    const rows = filtered.map((item) => [item.id, item.scheduled_at, `Examiner #${item.examiner_id}`,
      item.subject ? `${item.subject.first_name} ${item.subject.last_name}` : `Subject #${item.subject_id}`,
      item.client?.name || "Direct / private", item.status, item.exam_id || item.status.toLowerCase() === "completed" ? "Yes" : "No", item.exam_id ? "Yes" : "No"]);
    const blob = new Blob([[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `exam-report-${range}-${examiner === "all" ? "all-examiners" : `examiner-${examiner}`}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const maxActivity = Math.max(...activity.map((item) => item.total), 1);
  const maxProvider = Math.max(...providerVolume.map((item) => item.count), 1);
  const totalOutcomes = (outcomeStats?.ndi_count || 0) + (outcomeStats?.di_count || 0) + (outcomeStats?.inconclusive_count || 0);
  const ndi = pct(outcomeStats?.ndi_count || 0, totalOutcomes);
  const di = pct(outcomeStats?.di_count || 0, totalOutcomes);

  return <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .4 }} className="space-y-6">
    <Card className="rounded-3xl border-border/50 bg-card/80 shadow-sm">
      <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">{ranges.map((item) => <Button key={item.value} size="sm" variant={range === item.value ? "default" : "ghost"} className="rounded-xl" onClick={() => setRange(item.value)}>{item.label}</Button>)}</div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {canFilterExaminer && <select aria-label="Filter by examiner" value={examiner} onChange={(event) => setExaminer(event.target.value)} className="h-9 rounded-xl border border-border bg-background px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/30">
            <option value="all">All examiners</option>{examinerIds.map((id) => <option key={id} value={id}>Examiner #{id}</option>)}
          </select>}
          <Button size="sm" variant="outline" className="rounded-xl" onClick={exportCsv} disabled={!filtered.length}><Download className="mr-2 h-4 w-4" />Export filtered data</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
      ["Exams booked", booked, CalendarCheck2, "text-blue-600 bg-blue-500/10"],
      ["Exams completed", completed.length, CheckCircle2, "text-emerald-600 bg-emerald-500/10"],
      ["Cancelled / no-show", cancelled, FileCheck2, "text-rose-600 bg-rose-500/10"],
      ["Completion rate", `${pct(completed.length, booked)}%`, TrendingUp, "text-amber-600 bg-amber-500/10"],
    ].map(([label, value, Icon, color], index) => <motion.div key={String(label)} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .06 }}><Card className="rounded-2xl border-border/50"><CardContent className="flex items-center justify-between p-5"><div><p className="text-xs font-bold text-muted-foreground">{String(label)}</p><p className="mt-2 text-3xl font-black">{loading ? "--" : String(value)}</p></div><div className={cn("rounded-xl p-3", String(color))}>{React.createElement(Icon as React.ElementType, { className: "h-5 w-5" })}</div></CardContent></Card></motion.div>)}</div>

    <div className="grid gap-6 xl:grid-cols-[1.35fr_.9fr]">
      <Card className="rounded-3xl border-border/50"><CardHeader><CardTitle className="text-xl">Monthly booking performance</CardTitle><p className="text-sm text-muted-foreground">Completed examinations over the selected period.</p></CardHeader><CardContent><div className="flex h-52 items-end gap-2 sm:gap-4">{activity.map((item, index) => <div key={`${item.label}-${index}`} className="flex h-full min-w-0 flex-1 flex-col justify-end gap-2"><div className="flex flex-1 items-end justify-center rounded-xl bg-muted/40"><motion.div initial={{ height: 0 }} animate={{ height: `${Math.max(item.total / maxActivity * 100, item.total ? 12 : 3)}%` }} transition={{ duration: .55, delay: index * .035 }} className={cn("relative w-full max-w-10 rounded-t-lg bg-primary", !item.total && "bg-muted-foreground/15")}><span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-black">{item.total}</span></motion.div></div><span className="truncate text-center text-[10px] font-bold text-muted-foreground">{item.label}</span></div>)}</div></CardContent></Card>
      <Card className="rounded-3xl border-border/50"><CardHeader><CardTitle className="text-xl">Report outcomes</CardTitle><p className="text-xs text-muted-foreground">{canFilterExaminer && examiner === "all" ? "All examiners" : examiner === "all" ? "Your finalized reports" : `Examiner #${examiner}`}</p></CardHeader><CardContent className={cn("flex items-center gap-6 transition-opacity", outcomesLoading && "opacity-50")}><motion.div initial={{ scale: .8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="h-36 w-36 shrink-0 rounded-full p-5" style={{ background: totalOutcomes ? `conic-gradient(#10b981 0 ${ndi}%, #f43f5e ${ndi}% ${ndi + di}%, #f59e0b ${ndi + di}% 100%)` : "hsl(var(--muted))" }}><div className="flex h-full items-center justify-center rounded-full bg-card text-2xl font-black">{totalOutcomes}</div></motion.div><div className="w-full space-y-3">{[["NDI", outcomeStats?.ndi_count || 0, "bg-emerald-500"], ["DI", outcomeStats?.di_count || 0, "bg-rose-500"], ["Inconclusive", outcomeStats?.inconclusive_count || 0, "bg-amber-500"]].map(([label, value, color]) => <div key={String(label)} className="flex justify-between text-sm"><span className="flex items-center gap-2"><i className={cn("h-2.5 w-2.5 rounded-full", color)} />{label}</span><b>{value}</b></div>)}</div></CardContent></Card>
      <Card className="rounded-3xl border-border/50"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Top providers</CardTitle><p className="text-xs text-muted-foreground">Bookings in this view</p></div><Building2 className="h-5 w-5 text-primary" /></CardHeader><CardContent className="space-y-4">{providerVolume.length ? providerVolume.map((item, index) => <div key={item.name}><div className="mb-1.5 flex justify-between text-xs"><span className="truncate font-semibold">{item.name}</span><b>{item.count}</b></div><div className="h-2 rounded-full bg-muted"><motion.div initial={{ width: 0 }} animate={{ width: `${item.count / maxProvider * 100}%` }} transition={{ delay: index * .06 }} className="h-full rounded-full bg-primary" /></div></div>) : <p className="py-8 text-center text-sm text-muted-foreground">No provider activity in this period.</p>}</CardContent></Card>
      <Card className="rounded-3xl border-border/50"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="text-base">Examiner performance</CardTitle><p className="text-xs text-muted-foreground">Booked and completed</p></div><UserRoundSearch className="h-5 w-5 text-primary" /></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">{examinerVolume.length ? examinerVolume.map((item) => <div key={item.id} className="rounded-2xl border border-border/50 bg-muted/25 p-4"><p className="text-xs font-bold text-muted-foreground">Examiner #{item.id}</p><div className="mt-3 flex items-end justify-between"><b className="text-2xl">{item.completed}/{item.booked}</b><span className="text-[10px] font-bold uppercase text-muted-foreground">{pct(item.completed, item.booked)}% complete</span></div></div>) : <p className="col-span-2 py-8 text-center text-sm text-muted-foreground">No examiner activity in this period.</p>}</CardContent></Card>
      <Card className="rounded-3xl border-border/50 xl:col-span-2"><CardHeader><CardTitle className="text-base">Booking pipeline and drop-off</CardTitle><p className="text-xs text-muted-foreground">See where bookings currently sit and where business is being lost.</p></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{statusVolume.map((item) => <div key={item.name} className="rounded-2xl bg-muted/35 p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold capitalize text-muted-foreground">{item.name}</span><b>{item.count}</b></div><div className="mt-3 h-2 rounded-full bg-background"><div className="h-full rounded-full bg-primary" style={{ width: `${pct(item.count, booked)}%` }} /></div><p className="mt-2 text-[10px] font-bold text-muted-foreground">{pct(item.count, booked)}% of bookings</p></div>)}</CardContent></Card>
    </div>
  </motion.section>;
}
