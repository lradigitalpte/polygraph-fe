"use client";

import * as React from "react";
import { BarChart3, CalendarCheck2, CheckCircle2, CircleSlash, Clock3, Download } from "lucide-react";
import { GlassStat, GlowPanel, Segmented } from "@/components/dashboard/ui-kit";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { fetchConsolidatedStats, type ConsolidatedReportStats, type SecureReportShare } from "@/lib/reports";

type Range = "week" | "month" | "6months" | "year" | "all";
type Props = {
  appointments: AppointmentRecord[];
  shares: SecureReportShare[];
  examiners?: Array<{ id: number; name: string }>;
  stats: ConsolidatedReportStats | null;
  loading?: boolean;
  canFilterExaminer?: boolean;
};

const RANGES: { value: Range; label: string }[] = [
  { value: "week", label: "7 days" },
  { value: "month", label: "30 days" },
  { value: "6months", label: "6 months" },
  { value: "year", label: "12 months" },
  { value: "all", label: "All time" },
];

const CANCELLED = new Set(["cancelled", "canceled", "no-show", "no show"]);
const OPEN = new Set(["pending", "confirmed"]);

/** Verdict order: clear results, then concerning, then undecided. */
const VERDICTS = [
  { key: "ndi_count", code: "NDI", label: "No deception indicated", bar: "bg-[#3F7A37] dark:bg-emerald-400" },
  { key: "nsr_count", code: "NSR", label: "No significant response", bar: "bg-[#8CC596] dark:bg-emerald-700" },
  { key: "di_count", code: "DI", label: "Deception indicated", bar: "bg-[#B94A3E] dark:bg-red-400" },
  { key: "sr_count", code: "SR", label: "Significant response", bar: "bg-[#E2B35A] dark:bg-amber-400" },
  { key: "inconclusive_count", code: "INC", label: "Inconclusive", bar: "bg-[#A8A496] dark:bg-zinc-500" },
] as const;

const PIPELINE_TONE: Record<string, string> = {
  completed: "bg-[#30302E] dark:bg-[#ECE9E0]",
  confirmed: "bg-[#7FBF8A]",
  pending: "bg-chart-2",
  cancelled: "bg-[#E58A7E]",
  canceled: "bg-[#E58A7E]",
  "no-show": "bg-[#E2B35A]",
};

const isCompleted = (item: AppointmentRecord) => Boolean(item.exam_id) || item.status.toLowerCase() === "completed";

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Month-based ranges start on the 1st so the first bar is a whole month. */
function startFor(range: Range) {
  const now = new Date();
  if (range === "week") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  if (range === "month") return new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  if (range === "6months") return new Date(now.getFullYear(), now.getMonth() - 5, 1);
  if (range === "year") return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  return null;
}

type Bucket = { label: string; title: string; start: Date; end: Date; partial: boolean };

function bucketsFor(range: Range, earliest: Date | null): { buckets: Bucket[]; unit: string } {
  const now = new Date();
  const today = startOfDay(now);
  const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);

  if (range === "week") {
    const buckets = Array.from({ length: 7 }, (_, i) => {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + i);
      const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
      return {
        start,
        end,
        label: start.toLocaleDateString("en", { weekday: "short" }),
        title: start.toLocaleDateString("en", { weekday: "long", day: "numeric", month: "short" }),
        partial: i === 6,
      };
    });
    return { buckets, unit: "day" };
  }

  if (range === "month") {
    const first = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 29);
    const buckets = Array.from({ length: 5 }, (_, i) => {
      const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + i * 7);
      const fullEnd = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
      const end = fullEnd < tomorrow ? fullEnd : tomorrow;
      return {
        start,
        end,
        label: start.toLocaleDateString("en", { day: "numeric", month: "short" }),
        title: `Week of ${start.toLocaleDateString("en", { day: "numeric", month: "long" })}`,
        partial: end.getTime() !== fullEnd.getTime(),
      };
    });
    return { buckets, unit: "week" };
  }

  let months = range === "6months" ? 6 : range === "year" ? 12 : 12;
  if (range === "all" && earliest) {
    months = Math.max(1, (now.getFullYear() - earliest.getFullYear()) * 12 + now.getMonth() - earliest.getMonth() + 1);
  }

  // Long histories read better as years than as dozens of thin monthly bars.
  if (months > 24 && earliest) {
    const years = now.getFullYear() - earliest.getFullYear() + 1;
    const buckets = Array.from({ length: years }, (_, i) => {
      const year = earliest.getFullYear() + i;
      return {
        start: new Date(year, 0, 1),
        end: new Date(year + 1, 0, 1),
        label: String(year),
        title: String(year),
        partial: year === now.getFullYear(),
      };
    });
    return { buckets, unit: "year" };
  }

  const buckets = Array.from({ length: months }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (months - 1 - i), 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    const multiYear = months > 12 || start.getFullYear() !== now.getFullYear();
    return {
      start,
      end,
      label: start.toLocaleDateString("en", { month: "short" }),
      title: start.toLocaleDateString("en", { month: "long", year: "numeric" }),
      partial: i === months - 1,
      ...(multiYear && start.getMonth() === 0 ? { label: `${start.toLocaleDateString("en", { month: "short" })} ’${String(start.getFullYear()).slice(2)}` } : {}),
    };
  });
  return { buckets, unit: "month" };
}

function pct(value: number, total: number) {
  return total ? Math.round((value / total) * 100) : 0;
}

/** Never show "0%" for something that exists. */
function pctLabel(value: number, total: number) {
  if (!total || !value) return "0%";
  const p = (value / total) * 100;
  return p < 1 ? "<1%" : `${Math.round(p)}%`;
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function ReportAnalytics({ appointments, examiners = [], stats, loading, canFilterExaminer }: Props) {
  const [range, setRange] = React.useState<Range>("6months");
  const [examiner, setExaminer] = React.useState("all");
  const [outcomeStats, setOutcomeStats] = React.useState(stats);
  const [outcomesLoading, setOutcomesLoading] = React.useState(false);

  React.useEffect(() => {
    if (examiner === "all") setOutcomeStats(stats);
  }, [stats, examiner]);

  React.useEffect(() => {
    if (!canFilterExaminer || examiner === "all") return;
    let cancelled = false;
    setOutcomesLoading(true);
    void fetchConsolidatedStats(Number(examiner))
      .then((data) => {
        if (!cancelled) setOutcomeStats(data);
      })
      .finally(() => {
        if (!cancelled) setOutcomesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canFilterExaminer, examiner]);

  const examinerNames = React.useMemo(() => new Map(examiners.map((item) => [item.id, item.name])), [examiners]);
  const examinerName = React.useCallback((id: number) => examinerNames.get(id) || `Examiner #${id}`, [examinerNames]);
  const examinerIds = React.useMemo(
    () => [...new Set(appointments.map((item) => item.examiner_id))].sort((a, b) => examinerName(a).localeCompare(examinerName(b))),
    [appointments, examinerName],
  );

  const byExaminer = React.useMemo(
    () => appointments.filter((item) => examiner === "all" || item.examiner_id === Number(examiner)),
    [appointments, examiner],
  );

  const filtered = React.useMemo(() => {
    const start = startFor(range);
    return start ? byExaminer.filter((item) => new Date(item.scheduled_at) >= start) : byExaminer;
  }, [byExaminer, range]);

  const earliest = React.useMemo(() => {
    let min: number | null = null;
    for (const item of byExaminer) {
      const t = new Date(item.scheduled_at).getTime();
      if (!Number.isNaN(t) && (min === null || t < min)) min = t;
    }
    return min === null ? null : new Date(min);
  }, [byExaminer]);

  /* ---------------- headline numbers ---------------- */

  const booked = filtered.length;
  const completedCount = filtered.filter(isCompleted).length;
  const cancelledCount = filtered.filter((item) => CANCELLED.has(item.status.toLowerCase())).length;
  const openCount = filtered.filter((item) => !isCompleted(item) && OPEN.has(item.status.toLowerCase())).length;
  const rangeLabel = RANGES.find((r) => r.value === range)?.label.toLowerCase() ?? "";
  const scopeLabel = examiner === "all" ? (canFilterExaminer ? "All examiners" : "Your bookings") : examinerName(Number(examiner));

  /* ---------------- chart ---------------- */

  const { buckets, unit } = React.useMemo(() => bucketsFor(range, earliest), [range, earliest]);
  const series = React.useMemo(
    () =>
      buckets.map((bucket) => {
        let bookedIn = 0;
        let completedIn = 0;
        for (const item of filtered) {
          const t = new Date(item.scheduled_at);
          if (t >= bucket.start && t < bucket.end) {
            bookedIn += 1;
            if (isCompleted(item)) completedIn += 1;
          }
        }
        return { ...bucket, booked: bookedIn, completed: completedIn };
      }),
    [buckets, filtered],
  );
  const maxBooked = Math.max(...series.map((s) => s.booked), 1);
  const busiest = series.reduce<(typeof series)[number] | null>((best, s) => (s.completed > (best?.completed ?? 0) ? s : best), null);

  /* ---------------- breakdowns ---------------- */

  const statusVolume = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of filtered) {
      const status = item.status?.trim().toLowerCase() || "unknown";
      totals.set(status, (totals.get(status) || 0) + 1);
    }
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);

  // Bookings with an exam on file but a status other than "completed" — explains
  // why "completed" in the pipeline can be lower than the headline number.
  const examNotMarked = filtered.filter((item) => item.exam_id && item.status.toLowerCase() !== "completed").length;

  const providerVolume = React.useMemo(() => {
    const totals = new Map<string, number>();
    for (const item of filtered) {
      const name = item.client?.name?.trim() || "Direct / private";
      totals.set(name, (totals.get(name) || 0) + 1);
    }
    return [...totals].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  }, [filtered]);
  const topProviders = providerVolume.slice(0, 6);
  const maxProvider = Math.max(...topProviders.map((p) => p.count), 1);

  const examinerVolume = React.useMemo(() => {
    const totals = new Map<number, { booked: number; completed: number }>();
    for (const item of filtered) {
      const current = totals.get(item.examiner_id) || { booked: 0, completed: 0 };
      current.booked += 1;
      if (isCompleted(item)) current.completed += 1;
      totals.set(item.examiner_id, current);
    }
    return [...totals].map(([id, values]) => ({ id, ...values })).sort((a, b) => b.booked - a.booked);
  }, [filtered]);

  const outcomeTotal = VERDICTS.reduce((sum, v) => sum + (outcomeStats?.[v.key] ?? 0), 0);
  const clearCount = (outcomeStats?.ndi_count ?? 0) + (outcomeStats?.nsr_count ?? 0);
  const maxOutcome = Math.max(...VERDICTS.map((v) => outcomeStats?.[v.key] ?? 0), 1);

  /* ---------------- export ---------------- */

  const exportCsv = () => {
    const headings = ["Appointment ID", "Date", "Examiner", "Examinee", "Provider", "Booking status", "Exam completed", "Report ready"];
    const rows = filtered.map((item) => [
      item.id,
      item.scheduled_at,
      examinerName(item.examiner_id),
      item.subject ? `${item.subject.first_name} ${item.subject.last_name}` : `Subject #${item.subject_id}`,
      item.client?.name || "Direct / private",
      item.status,
      isCompleted(item) ? "Yes" : "No",
      item.exam_id ? "Yes" : "No",
    ]);
    const blob = new Blob([[headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `exam-report-${range}-${examiner === "all" ? "all-examiners" : `examiner-${examiner}`}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const empty = !loading && booked === 0;

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="lavender" orb="78%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <BarChart3 aria-hidden="true" className="size-4" />
                Analytics
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Practice <span className="font-semibold">analytics</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">
                Booking demand, completion and drop-off, where work comes from, and how examinations turn out.
              </p>
            </div>
            <button
              type="button"
              onClick={exportCsv}
              disabled={!filtered.length}
              className="flex h-11 items-center gap-2 self-start rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50 md:self-auto"
            >
              <Download aria-hidden="true" className="size-4" />
              Export CSV
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat label="Exams booked" value={booked.toLocaleString()} hint={`${scopeLabel} · ${rangeLabel}`} icon={CalendarCheck2} accent="lavender" loading={loading} />
            <GlassStat
              label="Completed"
              value={completedCount.toLocaleString()}
              hint={booked ? `${pct(completedCount, booked)}% of bookings` : "No bookings yet"}
              icon={CheckCircle2}
              accent="sage"
              loading={loading}
            />
            <GlassStat
              label="Cancelled / no-show"
              value={cancelledCount.toLocaleString()}
              hint={booked ? `${pctLabel(cancelledCount, booked)} drop-off` : "No bookings yet"}
              icon={CircleSlash}
              accent="terracotta"
              loading={loading}
            />
            <GlassStat
              label="Still open"
              value={openCount.toLocaleString()}
              hint="Pending or confirmed, not yet examined"
              icon={Clock3}
              accent="amber"
              loading={loading}
            />
          </div>
        </div>
      </GlowPanel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:bg-card">
        <Segmented label="Date range" value={range} onChange={setRange} options={RANGES} />
        {canFilterExaminer ? (
          <Select value={examiner} onValueChange={(v) => setExaminer(String(v ?? "all"))}>
            <SelectTrigger
              aria-label="Filter by examiner"
              className="h-11 w-full rounded-full border-0 bg-[#F3F1EA] px-4 text-sm shadow-none lg:w-64 dark:bg-muted"
            >
              <SelectValue>{examiner === "all" ? "All examiners" : examinerName(Number(examiner))}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All examiners</SelectItem>
              {examinerIds.map((id) => (
                <SelectItem key={id} value={String(id)}>
                  {examinerName(id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr]">
        {/* Bookings over time */}
        <Card
          title="Bookings over time"
          subtitle={`Booked and completed per ${unit}${range === "all" ? "" : ` · last ${rangeLabel}`}`}
          aside={
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <LegendSwatch className="bg-[#E3DFD3] dark:bg-zinc-700" label="Booked" />
              <LegendSwatch className="bg-[#30302E] dark:bg-[#ECE9E0]" label="Completed" />
            </div>
          }
        >
          {loading ? (
            <ChartSkeleton />
          ) : empty ? (
            <EmptyNote>No bookings in this period.</EmptyNote>
          ) : (
            <>
              <div className="relative flex h-60 items-end gap-1.5 border-b border-border/70 pt-6 sm:gap-3">
                {/* Recessive guides at 50% and 100% of the busiest bucket */}
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-6 border-t border-dashed border-border/60" />
                <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-[calc(50%+12px)] border-t border-dashed border-border/40" />
                <span aria-hidden="true" className="absolute top-1 right-0 text-[11px] text-muted-foreground tabular-nums">
                  {maxBooked}
                </span>
                {series.map((s) => {
                  const bookedH = (s.booked / maxBooked) * 100;
                  const completedH = s.booked ? (s.completed / s.booked) * 100 : 0;
                  return (
                    <div key={s.start.toISOString()} className="group relative flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                      {/* Hover tooltip */}
                      <div
                        role="tooltip"
                        className="pointer-events-none absolute bottom-full z-10 mb-1 hidden w-max rounded-xl bg-[#1E1D1B] px-3 py-2 text-xs text-[#FAF9F5] shadow-lg group-hover:block"
                      >
                        <p className="font-medium">
                          {s.title}
                          {s.partial ? " (to date)" : ""}
                        </p>
                        <p className="mt-0.5 text-[#C9C6BC] tabular-nums">
                          {s.completed} completed · {s.booked} booked
                        </p>
                      </div>
                      <div
                        className="relative w-full max-w-12 transition-[height] duration-500"
                        style={{ height: `${Math.max(bookedH, s.booked ? 2 : 0)}%` }}
                        role="img"
                        aria-label={`${s.title}: ${s.completed} completed of ${s.booked} booked`}
                      >
                        <span className="absolute inset-x-0 -top-5 text-center text-xs font-medium tabular-nums">{s.completed || ""}</span>
                        <div className="flex h-full flex-col justify-end overflow-hidden rounded-t-[4px] bg-[#E3DFD3] dark:bg-zinc-700">
                          <div
                            className={cn(
                              "w-full rounded-t-[4px] bg-[#30302E] transition-[height] duration-500 dark:bg-[#ECE9E0]",
                              s.partial && "opacity-60",
                            )}
                            style={{ height: `${completedH}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-1.5 sm:gap-3">
                {series.map((s) => (
                  <span key={s.start.toISOString()} className="min-w-0 flex-1 truncate text-center text-[11px] text-muted-foreground">
                    {s.label}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                {busiest ? (
                  <>
                    Busiest {unit}: <span className="font-medium text-foreground">{busiest.title}</span> with {busiest.completed} completed.{" "}
                  </>
                ) : null}
                The latest {unit} is still in progress, so it&apos;s shown lighter.
              </p>
            </>
          )}
        </Card>

        {/* Report outcomes */}
        <Card
          title="Report outcomes"
          subtitle={`${scopeLabel} · all time`}
          aside={
            !loading && outcomeTotal ? (
              <span className="text-sm tabular-nums">
                <span className="font-medium">{outcomeTotal.toLocaleString()}</span>
                <span className="text-muted-foreground"> reports</span>
              </span>
            ) : null
          }
        >
          {loading ? (
            <RowsSkeleton rows={5} />
          ) : outcomeTotal === 0 ? (
            <EmptyNote>No finalized reports yet.</EmptyNote>
          ) : (
            <div className={cn("flex flex-col gap-4 transition-opacity", outcomesLoading && "opacity-50")}>
              <div className="rounded-2xl bg-[#F7F6F1] px-4 py-3 dark:bg-muted/40">
                <p className="text-2xl font-medium tracking-[-0.02em] tabular-nums">{pct(clearCount, outcomeTotal)}%</p>
                <p className="text-xs text-muted-foreground">
                  clear results (NDI or NSR) · {clearCount.toLocaleString()} of {outcomeTotal.toLocaleString()}
                </p>
              </div>
              <ul className="flex flex-col gap-3">
                {VERDICTS.map((v) => {
                  const count = outcomeStats?.[v.key] ?? 0;
                  return (
                    <li key={v.code} className="grid grid-cols-[3rem_1fr_auto] items-center gap-3">
                      <span className="font-mono text-xs font-semibold" title={v.label}>
                        {v.code}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-xs text-muted-foreground">{v.label}</p>
                        <div className="mt-1 h-2 rounded-full bg-[#F3F1EA] dark:bg-muted">
                          <div className={cn("h-full rounded-full transition-[width] duration-500", v.bar)} style={{ width: `${(count / maxOutcome) * 100}%` }} />
                        </div>
                      </div>
                      <span className="w-16 text-right text-sm tabular-nums">
                        <span className="font-medium">{count}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground">{pctLabel(count, outcomeTotal)}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs text-muted-foreground">Counts every finalized report — the date range doesn&apos;t apply here.</p>
            </div>
          )}
        </Card>

        {/* Top providers */}
        <Card
          title="Top providers"
          subtitle={providerVolume.length > topProviders.length ? `Top ${topProviders.length} of ${providerVolume.length} · bookings in this view` : "Bookings in this view"}
        >
          {loading ? (
            <RowsSkeleton rows={5} />
          ) : topProviders.length === 0 ? (
            <EmptyNote>No provider activity in this period.</EmptyNote>
          ) : (
            <ol className="flex flex-col gap-3.5">
              {topProviders.map((p, index) => (
                <li key={p.name} className="grid grid-cols-[1.5rem_1fr_auto] items-center gap-3">
                  <span className="text-xs text-muted-foreground tabular-nums">{index + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={p.name}>
                      {p.name}
                    </p>
                    <div className="mt-1.5 h-1.5 rounded-full bg-[#F3F1EA] dark:bg-muted">
                      <div className="h-full rounded-full bg-[#30302E] transition-[width] duration-500 dark:bg-[#ECE9E0]" style={{ width: `${(p.count / maxProvider) * 100}%` }} />
                    </div>
                  </div>
                  <span className="w-16 text-right text-sm tabular-nums">
                    <span className="font-medium">{p.count}</span>
                    <span className="ml-1.5 text-xs text-muted-foreground">{pctLabel(p.count, booked)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>

        {/* Examiner performance */}
        <Card title="Examiner performance" subtitle="Completed out of booked, in this view">
          {loading ? (
            <RowsSkeleton rows={3} />
          ) : examinerVolume.length === 0 ? (
            <EmptyNote>No examiner activity in this period.</EmptyNote>
          ) : (
            <ul className="flex flex-col divide-y divide-border/50">
              {examinerVolume.slice(0, 6).map((e) => {
                const name = examinerName(e.id);
                const rate = pct(e.completed, e.booked);
                return (
                  <li key={e.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#F3F1EA] text-xs font-semibold dark:bg-muted">
                      {initials(name) || "?"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="truncate text-sm font-medium" title={name}>
                          {name}
                        </p>
                        <span className="shrink-0 text-sm font-medium tabular-nums">{rate}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 rounded-full bg-[#F3F1EA] dark:bg-muted">
                        <div className="h-full rounded-full bg-[#3F7A37] transition-[width] duration-500 dark:bg-emerald-400" style={{ width: `${rate}%` }} />
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                        {e.completed} of {e.booked} completed
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Pipeline */}
        <Card className="xl:col-span-2" title="Booking pipeline" subtitle="Where bookings in this view currently sit, by booking status">
          {loading ? (
            <RowsSkeleton rows={2} />
          ) : empty ? (
            <EmptyNote>No bookings in this period.</EmptyNote>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label={statusVolume.map((s) => `${s.name} ${s.count}`).join(", ")}>
                {statusVolume.map((s) => (
                  <div
                    key={s.name}
                    title={`${s.name}: ${s.count}`}
                    className={cn("h-full min-w-[3px] first:rounded-l-full last:rounded-r-full", PIPELINE_TONE[s.name] ?? "bg-[#A8A496]")}
                    style={{ flexGrow: s.count, flexBasis: 0 }}
                  />
                ))}
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
                {statusVolume.map((s) => (
                  <div key={s.name} className="flex min-w-0 flex-col gap-1">
                    <dt className="flex items-center gap-2 text-[13px] text-muted-foreground capitalize">
                      <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", PIPELINE_TONE[s.name] ?? "bg-[#A8A496]")} />
                      <span className="truncate">{s.name}</span>
                    </dt>
                    <dd className="flex items-baseline gap-2 pl-4">
                      <span className="text-xl font-medium tabular-nums">{s.count.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">{pctLabel(s.count, booked)}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              {examNotMarked > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {examNotMarked} {examNotMarked === 1 ? "booking has" : "bookings have"} an exam recorded but {examNotMarked === 1 ? "isn't" : "aren't"} marked
                  completed, so they count as completed in the headline numbers.
                </p>
              ) : null}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Card({
  title,
  subtitle,
  aside,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <section
      aria-labelledby={id}
      className={cn("flex min-w-0 flex-col gap-5 rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-6 dark:bg-card", className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={id} className="text-[17px] font-medium tracking-[-0.01em]">
            {title}
          </h2>
          {subtitle ? <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className={cn("size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <p className="flex min-h-32 items-center justify-center rounded-2xl bg-[#F7F6F1] px-4 text-center text-sm text-muted-foreground dark:bg-muted/40">{children}</p>;
}

function ChartSkeleton() {
  return (
    <div aria-hidden="true" className="flex h-[17.5rem] items-end gap-3 pb-6">
      {[45, 70, 60, 40, 85, 25].map((h, i) => (
        <div key={i} className="flex-1 animate-pulse rounded-t-[4px] bg-[#F3F1EA] dark:bg-muted" style={{ height: `${h}%` }} />
      ))}
    </div>
  );
}

function RowsSkeleton({ rows }: { rows: number }) {
  return (
    <div aria-hidden="true" className="flex flex-col gap-4">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="h-3 w-1/3 animate-pulse rounded bg-[#F3F1EA] dark:bg-muted" />
          <div className="h-2 animate-pulse rounded-full bg-[#F3F1EA] dark:bg-muted" />
        </div>
      ))}
    </div>
  );
}
