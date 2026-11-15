"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, CalendarClock, CalendarPlus, CheckCircle2, ClipboardList, FileText, Loader2, PanelRightOpen, XCircle } from "lucide-react";

import { AppointmentDetailSheet } from "@/components/dashboard/appointment-detail-sheet";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, HeroAction, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, TableSearch, usePager } from "@/components/dashboard/table-pager";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { fetchExamTypes, type AppointmentRecord } from "@/lib/exam-booking";
import { formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { sessionBase } from "@/components/dashboard/session-route";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const SMALL = "flex h-8 items-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted";

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  confirmed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  scheduled: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  pending: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
};
const NEUTRAL = "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground";
const CANCELLED = "bg-destructive/10 text-destructive";

type View = "all" | "upcoming" | "completed" | "overdue" | "cancelled";

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isCompleted = (a: AppointmentRecord) => a.status.toLowerCase() === "completed";
const isFuture = (a: AppointmentRecord) => new Date(a.scheduled_at).getTime() >= Date.now();

function viewOf(a: AppointmentRecord): Exclude<View, "all"> {
  if (isCancelled(a)) return "cancelled";
  if (isCompleted(a)) return "completed";
  return isFuture(a) ? "upcoming" : "overdue";
}

function minutesLabel(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

export default function ExamineeExamHistoryPage() {
  const { clientId, subject, appointments, loading, error, refresh } = useSubjectDetail();
  const { can } = useCurrentUser();
  const [selected, setSelected] = React.useState<AppointmentRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [view, setView] = React.useState<View>("all");
  const [query, setQuery] = React.useState("");
  const [typeNames, setTypeNames] = React.useState<Record<number, string>>({});
  const tableRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetchExamTypes()
      .then((types) => {
        if (!cancelled) setTypeNames(Object.fromEntries(types.map((t) => [t.id, t.name])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = React.useMemo(() => [...appointments].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()), [appointments]);

  const counts = React.useMemo(() => {
    const c = { all: sorted.length, upcoming: 0, completed: 0, overdue: 0, cancelled: 0 };
    for (const a of sorted) c[viewOf(a)] += 1;
    return c;
  }, [sorted]);

  const q = query.trim().toLowerCase();
  const rows = React.useMemo(
    () =>
      sorted.filter((a) => {
        if (view !== "all" && viewOf(a) !== view) return false;
        if (!q) return true;
        const hay = [formatAppointmentCode(a.id), formatClinicDateLabel(a.scheduled_at), a.status, a.exam_type_id ? (typeNames[a.exam_type_id] ?? "") : "", a.notes ?? ""];
        return hay.some((v) => v.toLowerCase().includes(q));
      }),
    [sorted, view, q, typeNames],
  );
  const pager = usePager(rows, [view, q]);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading sessions…
      </div>
    );
  }

  if (error || !subject) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Examinee not found."}</div>;
  }

  const name = formatSubjectName(subject).trim() || "this examinee";
  const bookHref = `/dashboard/calendar/book?clientId=${clientId}&subjectId=${subject.id}`;
  const next = sorted.filter((a) => viewOf(a) === "upcoming").at(-1);

  const openSheet = (a: AppointmentRecord) => {
    setSelected(a);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-5">
      <PageHero
        tone="lavender"
        icon={FileText}
        eyebrow="Exam history"
        title={
          <>
            Every session for <strong className="font-semibold">{name}</strong>
          </>
        }
        description="Bookings under this account only. Open one to see its details, or go straight to its documentation."
        actions={
          can("appointment:create") ? (
            <HeroAction variant="primary" icon={CalendarPlus} href={bookHref}>
              Book session
            </HeroAction>
          ) : null
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Booked" value={counts.all - counts.cancelled} hint={counts.cancelled ? `${counts.cancelled} cancelled not counted` : "All sessions"} icon={ClipboardList} />
          <GlassStat label="Completed" value={counts.completed} hint="Finished sessions" icon={CheckCircle2} accent="sage" />
          <GlassStat label="Upcoming" value={counts.upcoming} hint={next ? `Next ${formatClinicDateLabel(next.scheduled_at)}` : "Nothing scheduled"} icon={CalendarClock} accent="lavender" />
          <GlassStat label="Not closed" value={counts.overdue} hint={counts.overdue ? "Past, still open" : "All up to date"} icon={XCircle} accent="amber" />
        </div>
      </PageHero>

      <section ref={tableRef} aria-labelledby="sessions-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 id="sessions-title" className="text-[15px] font-medium">
              Sessions
            </h3>
            <p className="text-[13px] text-muted-foreground">Newest first.</p>
          </div>
          {sorted.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Segmented<View>
                label="Show"
                value={view}
                onChange={setView}
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "upcoming", label: "Upcoming", count: counts.upcoming },
                  { value: "completed", label: "Completed", count: counts.completed },
                  ...(counts.overdue ? [{ value: "overdue" as const, label: "Not closed", count: counts.overdue, title: "Date has passed but the session isn't marked completed" }] : []),
                  { value: "cancelled", label: "Cancelled", count: counts.cancelled },
                ]}
              />
              <TableSearch value={query} onChange={setQuery} label="Search sessions" placeholder="Code, date or exam type…" />
            </div>
          ) : null}
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <CalendarClock aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">No sessions booked yet.</p>
            {can("appointment:create") ? (
              <Link href={bookHref as Route} className="flex h-10 items-center gap-2 rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                <CalendarPlus aria-hidden="true" className="size-4" /> Book first session
              </Link>
            ) : null}
          </div>
        ) : rows.length === 0 ? (
          <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">{q ? `Nothing matches “${query.trim()}”.` : "No sessions in this view."}</p>
        ) : (
          <div className="overflow-x-auto border-t border-border/50">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
                    Date
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Session
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Length
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Payment
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Documentation
                  </th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pager.rows.map((a) => {
                  const kind = viewOf(a);
                  const cancelled = kind === "cancelled";
                  const statusKey = a.status.toLowerCase().replace(/[\s-]+/g, "_");
                  const pay = (a.payment_status || "").toLowerCase();
                  const docHref = sessionBase(clientId, a.id, subject.id) as Route;
                  const typeName = a.exam_type_id ? typeNames[a.exam_type_id] : undefined;
                  return (
                    <tr key={a.id} className={cn("align-middle transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30", cancelled && "text-muted-foreground")}>
                      <td className="py-3 pr-3 pl-5 whitespace-nowrap tabular-nums">
                        <span className="block font-medium text-foreground">{formatClinicDateLabel(a.scheduled_at)}</span>
                        <span className="text-xs text-muted-foreground">{formatClinicClock(a.scheduled_at)}</span>
                      </td>
                      <td className="max-w-[240px] px-3 py-3">
                        <button type="button" onClick={() => openSheet(a)} className="block text-left font-mono text-[13px] font-medium hover:underline hover:underline-offset-4">
                          {formatAppointmentCode(a.id)}
                        </button>
                        <span className="block truncate text-xs text-muted-foreground" title={typeName}>
                          {typeName ?? "Exam type not set"}
                        </span>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap text-muted-foreground tabular-nums">{minutesLabel(a.duration)}</td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap capitalize", cancelled ? CANCELLED : (STATUS_STYLE[statusKey] ?? NEUTRAL))}>
                          {a.status.replace(/[_-]+/g, " ")}
                        </span>
                        {kind === "overdue" ? <span className="mt-1 block text-[11px] text-[#8A5A12] dark:text-amber-300">Date passed — not closed</span> : null}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {cancelled ? (
                          <span className="text-muted-foreground">—</span>
                        ) : a.prepaid_slot_id ? (
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", NEUTRAL)}>Prepaid</span>
                        ) : pay === "paid" ? (
                          <span className="rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">Paid</span>
                        ) : pay ? (
                          <span className="rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] capitalize dark:bg-amber-950/60 dark:text-amber-200">{a.payment_status}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        {a.exam_id ? (
                          <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">Started</span>
                        ) : cancelled ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">{a.questions_prepared ? "Questions ready" : "Not started"}</span>
                        )}
                      </td>
                      <td className="py-3 pr-5 pl-3">
                        <div className="flex items-center justify-end gap-1.5">
                          <button type="button" onClick={() => openSheet(a)} className={cn(SMALL, "w-8 justify-center px-0")} aria-label={`Booking details for ${formatAppointmentCode(a.id)}`} title="Booking details">
                            <PanelRightOpen aria-hidden="true" className="size-3.5" />
                          </button>
                          {!cancelled || a.exam_id ? (
                            <Link href={docHref} className={cn(SMALL, "px-3")}>
                              {a.exam_id ? "Open" : "Document"} <ArrowUpRight aria-hidden="true" className="size-3.5" />
                            </Link>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePager label="Sessions" page={pager.page} perPage={pager.perPage} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} onPerPage={pager.setPerPage} scrollTo={tableRef} />
      </section>

      <AppointmentDetailSheet clientId={clientId} appointment={selected} open={sheetOpen} onOpenChange={setSheetOpen} onUpdated={() => void refresh()} />
    </div>
  );
}
