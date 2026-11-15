"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, CalendarPlus, CheckCircle2, ClipboardCheck, Clock, FileCheck2, Loader2, Search, User, X } from "lucide-react";

import { AppointmentDetailSheet } from "@/components/dashboard/appointment-detail-sheet";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, usePager } from "@/components/dashboard/table-pager";
import { isOrganizationClient } from "@/lib/client-types";
import { CLINIC_TIMEZONE, formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { fetchExamTypes, type AppointmentRecord } from "@/lib/exam-booking";
import { formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

type ExamFilter = "upcoming" | "past" | "cancelled" | "all";

/** Month / day / year of a session in clinic time, so a late-evening session never shows on the wrong day. */
function clinicDateTile(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, day: "numeric", month: "short", year: "numeric" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { month: get("month"), day: get("day"), year: get("year") };
}


function formatDuration(minutes: number) {
  if (!minutes || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isUpcoming = (a: AppointmentRecord) => !isCancelled(a) && a.status.toLowerCase() !== "completed" && new Date(a.scheduled_at).getTime() >= Date.now();

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  confirmed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  scheduled: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  pending: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  in_progress: "bg-primary/15 text-[oklch(0.45_0.12_39)] dark:text-primary",
};
const NEUTRAL = "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground";

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", className)}>{children}</span>;
}

function paymentPill(a: AppointmentRecord) {
  if (isCancelled(a)) return null;
  if (a.prepaid_slot_id) return <Pill className={NEUTRAL}>Prepaid</Pill>;
  const status = (a.payment_status || "").toLowerCase();
  if (status === "paid") return <Pill className="bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">Paid</Pill>;
  if (status === "partial") return <Pill className="bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Part paid</Pill>;
  if ((a.exam_fee ?? 0) > 0) return <Pill className="bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Unpaid</Pill>;
  return null;
}

function examTypeOfRaw(a: AppointmentRecord, names: Record<number, string>) {
  return (a.exam_type_id ? names[a.exam_type_id] : undefined) || (a.notes || "").trim().split("\n")[0].trim() || "Polygraph examination";
}

export default function ClientExamHistoryPage() {
  const { client, appointments, loading, error, refresh } = useClientDetail();
  const { can } = useCurrentUser();
  const [selected, setSelected] = React.useState<AppointmentRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<ExamFilter | null>(null);
  const [examTypeNames, setExamTypeNames] = React.useState<Record<number, string>>({});
  const [query, setQuery] = React.useState("");
  const listTopRef = React.useRef<HTMLElement>(null);


  React.useEffect(() => {
    let cancelled = false;
    fetchExamTypes()
      .then((types) => {
        if (!cancelled) setExamTypeNames(Object.fromEntries(types.map((t) => [t.id, t.name])));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = React.useMemo(() => {
    const byTime = (a: AppointmentRecord) => new Date(a.scheduled_at).getTime();
    const upcoming = appointments.filter(isUpcoming).sort((a, b) => byTime(a) - byTime(b)); // soonest first
    const cancelled = appointments.filter(isCancelled).sort((a, b) => byTime(b) - byTime(a));
    const past = appointments.filter((a) => !isUpcoming(a) && !isCancelled(a)).sort((a, b) => byTime(b) - byTime(a)); // newest first
    const all = [...appointments].sort((a, b) => byTime(b) - byTime(a));
    return { upcoming, past, cancelled, all };
  }, [appointments]);

  // Filter + search + paging (hooks must run before the early returns below).
  const filterForList: ExamFilter = filter ?? (groups.upcoming.length > 0 ? "upcoming" : "past");
  const q = query.trim().toLowerCase();
  const matched = React.useMemo(() => {
    const inFilter = groups[filterForList];
    if (!q) return inFilter;
    return inFilter.filter((a) =>
      [examTypeOfRaw(a, examTypeNames), formatAppointmentCode(a.id), a.subject ? formatSubjectName(a.subject) : "", a.status, formatClinicDateLabel(a.scheduled_at)].some((v) => v.toLowerCase().includes(q)),
    );
  }, [groups, filterForList, q, examTypeNames]);
  const pager = usePager(matched, [filterForList, q]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading exam history…
      </div>
    );
  }

  if (error || !client) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Client record not found."}</div>;
  }

  // Open on Upcoming when there is something coming up, otherwise on Past.
  const activeFilter: ExamFilter = filter ?? (groups.upcoming.length > 0 ? "upcoming" : "past");
  const visible = pager.rows;
  const showExaminee = isOrganizationClient(client);
  const documented = appointments.filter((a) => a.exam_id).length;
  const completed = appointments.filter((a) => a.status.toLowerCase() === "completed").length;
  const examTypeOf = (a: AppointmentRecord) => examTypeOfRaw(a, examTypeNames);

  const emptyMessage: Record<ExamFilter, string> = {
    upcoming: "Nothing scheduled.",
    past: "No past sessions yet.",
    cancelled: "No cancelled sessions.",
    all: "No sessions yet.",
  };

  const open = (a: AppointmentRecord) => {
    setSelected(a);
    setSheetOpen(true);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-[-0.02em]">{showExaminee ? "All sessions" : "Exam history"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {showExaminee ? `Every session billed to ${client.name}.` : `Every session for ${client.name}. Select one for booking details, or open its documentation.`}
          </p>
        </div>
        {can("appointment:create") ? (
          <Link
            href={`/dashboard/calendar/book?clientId=${client.id}` as Route}
            className="flex h-10 shrink-0 items-center gap-2 self-start rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] sm:self-auto dark:bg-foreground dark:text-background"
          >
            <CalendarPlus aria-hidden="true" className="size-4" /> Book exam
          </Link>
        ) : null}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Sessions", value: appointments.length - groups.cancelled.length, hint: groups.cancelled.length ? `${groups.cancelled.length} cancelled` : "None cancelled", icon: ClipboardCheck },
          { label: "Upcoming", value: groups.upcoming.length, hint: groups.upcoming[0] ? `Next ${formatClinicDateLabel(groups.upcoming[0].scheduled_at)}` : "Nothing scheduled", icon: Clock },
          { label: "Completed", value: completed, hint: "Sessions finished", icon: CheckCircle2 },
          { label: "Documented", value: documented, hint: "With exam documentation", icon: FileCheck2 },
        ].map((s) => (
          <div key={s.label} className={cn(CARD, "p-4")}>
            <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
              <s.icon aria-hidden="true" className="size-3.5" />
              {s.label}
            </p>
            <p className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">{s.value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.hint}</p>
          </div>
        ))}
      </div>

      {/* Sessions */}
      <section ref={listTopRef} aria-labelledby="sessions-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
            <h3 id="sessions-title" className="text-[15px] font-medium">
              Sessions
            </h3>
            <div className="relative w-full sm:w-64">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search sessions"
                placeholder={showExaminee ? "Examinee, APT code, type…" : "APT code, type, date…"}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="h-10 w-full rounded-full bg-[#F3F1EA] pr-9 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted"
              />
              {query ? (
                <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
                  <X aria-hidden="true" className="size-3.5" />
                </button>
              ) : null}
            </div>
          </div>
          <Segmented<ExamFilter>
            label="Show sessions"
            value={activeFilter}
            onChange={setFilter}
            options={[
              { value: "upcoming", label: "Upcoming", count: groups.upcoming.length },
              { value: "past", label: "Past", count: groups.past.length },
              ...(groups.cancelled.length ? [{ value: "cancelled" as const, label: "Cancelled", count: groups.cancelled.length }] : []),
              { value: "all", label: "All", count: appointments.length },
            ]}
          />
        </div>

        {visible.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <ClipboardCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="text-sm text-muted-foreground">{q ? `No sessions match “${query.trim()}”.` : emptyMessage[activeFilter]}</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/50 border-t border-border/50">
            {visible.map((a) => {
              const docHref = `/dashboard/clients/${client.id}/exams/${a.id}` as Route;
              const hasDoc = Boolean(a.exam_id);
              const date = clinicDateTile(a.scheduled_at);
              const statusKey = a.status.toLowerCase().replace(/[\s-]+/g, "_");
              return (
                <li key={a.id} className={cn("flex items-center gap-3 px-3 py-2 sm:gap-4 sm:px-5", isCancelled(a) && "opacity-70")}>
                  {/* Whole left part opens the booking sheet */}
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl p-2 text-left transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40"
                  >
                    <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-[#F7F6F1] py-2 dark:bg-muted/50">
                      <span className="text-[11px] font-medium text-primary uppercase">{date.month}</span>
                      <span className="text-xl leading-none font-semibold tabular-nums">{date.day}</span>
                      <span className="mt-0.5 text-[10px] text-muted-foreground tabular-nums">{date.year}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{examTypeOf(a)}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span className="tabular-nums">{formatClinicClock(a.scheduled_at)}</span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDuration(a.duration)}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{formatAppointmentCode(a.id)}</span>
                        {showExaminee ? (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-foreground/80">
                              <User aria-hidden="true" className="size-3" />
                              {a.subject ? formatSubjectName(a.subject) : `Examinee #${a.subject_id}`}
                            </span>
                          </>
                        ) : null}
                      </span>
                      <span className="mt-1.5 flex flex-wrap gap-1.5">
                        <Pill className={STATUS_STYLE[statusKey] ?? NEUTRAL}>
                          <span className="capitalize">{a.status.replace(/[_-]+/g, " ")}</span>
                        </Pill>
                        {paymentPill(a)}
                        {hasDoc ? (
                          <Pill className="bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary">
                            <FileCheck2 aria-hidden="true" className="size-3" /> Documented
                          </Pill>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {/* Separate link: never nested inside the row button */}
                  <Link
                    href={docHref}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                  >
                    <span className="hidden sm:inline">{hasDoc ? "Open" : "Document"}</span>
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                    <span className="sr-only">{hasDoc ? `Open documentation for ${formatAppointmentCode(a.id)}` : `Document ${formatAppointmentCode(a.id)}`}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        <TablePager
          label="Sessions"
          page={pager.page}
          perPage={pager.perPage}
          totalPages={pager.totalPages}
          total={pager.total}
          onPage={pager.setPage}
          onPerPage={pager.setPerPage}
          scrollTo={listTopRef}
        />
      </section>

      <AppointmentDetailSheet clientId={client.id} appointment={selected} open={sheetOpen} onOpenChange={setSheetOpen} onUpdated={() => void refresh()} />
    </div>
  );
}
