"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, ArrowUpRight, CalendarClock, ChevronDown, ClipboardList, ListChecks, Loader2, Lock, PlayCircle } from "lucide-react";

import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { GlassStat, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, TableSearch, usePager } from "@/components/dashboard/table-pager";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { fetchExamTypes, type AppointmentRecord } from "@/lib/exam-booking";
import { CLINIC_TIMEZONE, formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { sessionBase } from "@/components/dashboard/session-route";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const SMALL = "flex h-8 items-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted";

type View = "todo" | "ready" | "started" | "all";

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isFuture = (a: AppointmentRecord) => new Date(a.scheduled_at).getTime() >= Date.now();

/** Upcoming, not cancelled, not started and nothing prepared yet — the ones to work on. */
const needsQuestions = (a: AppointmentRecord) => !isCancelled(a) && !a.exam_id && !a.questions_prepared && isFuture(a) && a.status.toLowerCase() !== "completed";

/** Month and day in clinic time, so a late-evening session never lands on the wrong day. */
function clinicDateTile(iso: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, day: "numeric", month: "short" }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { month: get("month"), day: get("day") };
}

function matchesView(a: AppointmentRecord, view: View) {
  if (view === "all") return true;
  if (view === "started") return Boolean(a.exam_id);
  if (view === "ready") return !a.exam_id && Boolean(a.questions_prepared) && !isCancelled(a);
  return needsQuestions(a);
}

export default function ExamineeSessionQuestionsPage() {
  const { clientId, subject, appointments, loading, error } = useSubjectDetail();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [query, setQuery] = React.useState("");
  const [typeNames, setTypeNames] = React.useState<Record<number, string>>({});
  const listRef = React.useRef<HTMLElement>(null);

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

  // Newest first — the sessions you are most likely preparing for.
  const sessions = React.useMemo(() => [...appointments].sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()), [appointments]);

  const counts = React.useMemo(
    () => ({
      todo: sessions.filter((a) => matchesView(a, "todo")).length,
      ready: sessions.filter((a) => matchesView(a, "ready")).length,
      started: sessions.filter((a) => matchesView(a, "started")).length,
      all: sessions.length,
    }),
    [sessions],
  );

  // Open on the work to do when there is some; otherwise show everything.
  const [view, setView] = React.useState<View | null>(null);
  const activeView: View = view ?? (counts.todo > 0 ? "todo" : "all");

  const q = query.trim().toLowerCase();
  const rows = React.useMemo(
    () =>
      sessions.filter((a) => {
        if (!matchesView(a, activeView)) return false;
        if (!q) return true;
        return [formatAppointmentCode(a.id), formatClinicDateLabel(a.scheduled_at), a.exam_type_id ? (typeNames[a.exam_type_id] ?? "") : ""].some((v) => v.toLowerCase().includes(q));
      }),
    [sessions, activeView, q, typeNames],
  );
  const pager = usePager(rows, [activeView, q]);

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

  return (
    <div className="space-y-5">
      <PageHero
        tone="sage"
        icon={ListChecks}
        eyebrow="Session questions"
        title={
          <>
            What you&apos;ll ask <strong className="font-semibold">{name}</strong>
          </>
        }
        description="Prepare questions for each booking. They're copied into the session when documentation starts, so later Question Library edits never change a past session."
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Need questions" value={counts.todo} hint={counts.todo ? "Upcoming, nothing prepared" : "All upcoming sessions ready"} icon={AlertTriangle} accent="amber" />
          <GlassStat label="Prepared" value={counts.ready} hint="Ready, not started" icon={ClipboardList} accent="sage" />
          <GlassStat label="In session" value={counts.started} hint="Locked to the session record" icon={PlayCircle} accent="lavender" />
          <GlassStat label="Sessions" value={counts.all} hint="Under this account" icon={CalendarClock} />
        </div>
      </PageHero>

      <section ref={listRef} aria-labelledby="questions-list-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 id="questions-list-title" className="text-[15px] font-medium">
              Sessions
            </h3>
            <p className="text-[13px] text-muted-foreground">Expand one to edit its questions here, or open it full size.</p>
          </div>
          {sessions.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Segmented<View>
                label="Show"
                value={activeView}
                onChange={setView}
                options={[
                  { value: "todo", label: "Need questions", count: counts.todo },
                  { value: "ready", label: "Prepared", count: counts.ready },
                  { value: "started", label: "In session", count: counts.started },
                  { value: "all", label: "All", count: counts.all },
                ]}
              />
              <TableSearch value={query} onChange={setQuery} label="Search sessions" placeholder="Code, date or exam type…" />
            </div>
          ) : null}
        </div>

        {sessions.length === 0 ? (
          <p className="border-t border-border/50 px-6 py-14 text-center text-sm text-muted-foreground">No sessions booked for this examinee yet.</p>
        ) : rows.length === 0 ? (
          <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">
            {q ? `Nothing matches “${query.trim()}”.` : activeView === "todo" ? "Nothing to prepare — every upcoming session has questions." : "No sessions in this view."}
          </p>
        ) : (
          <ul className="divide-y divide-border/50 border-t border-border/50">
            {pager.rows.map((a) => {
              const expanded = expandedId === a.id;
              const cancelled = isCancelled(a);
              const started = Boolean(a.exam_id);
              const typeName = a.exam_type_id ? typeNames[a.exam_type_id] : undefined;
              const panelId = `session-questions-${a.id}`;
              const tile = clinicDateTile(a.scheduled_at);
              return (
                <li key={a.id} className={cn(expanded && "bg-[#FAF9F5] dark:bg-muted/20")}>
                  <div className={cn("flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center", cancelled && !expanded && "opacity-70")}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={panelId}
                      onClick={() => setExpandedId(expanded ? null : a.id)}
                      className="flex min-w-0 flex-1 items-center gap-4 text-left"
                    >
                      <span className="flex w-14 shrink-0 flex-col items-center rounded-2xl bg-[#F3F1EA] py-1.5 text-center dark:bg-muted">
                        <span className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">{tile.month}</span>
                        <span className="text-lg leading-tight font-semibold tabular-nums">{tile.day}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-x-2 text-sm">
                          <span className="font-mono font-medium">{formatAppointmentCode(a.id)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {formatClinicDateLabel(a.scheduled_at)} · {formatClinicClock(a.scheduled_at)}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{typeName ?? "Exam type not set"}</span>
                      </span>
                      <ChevronDown aria-hidden="true" className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} />
                    </button>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
                      {cancelled ? (
                        <span className="rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive capitalize">{a.status.replace(/[_-]+/g, " ")}</span>
                      ) : null}
                      {started ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#E8E4F7] px-2.5 py-0.5 text-xs font-medium text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200">
                          <Lock aria-hidden="true" className="size-3" /> In session
                        </span>
                      ) : a.questions_prepared ? (
                        <span className="rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">Prepared</span>
                      ) : needsQuestions(a) ? (
                        <span className="rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Needs questions</span>
                      ) : (
                        <span className="rounded-full bg-[#ECE9E0] px-2.5 py-0.5 text-xs font-medium text-[#55534C] dark:bg-muted dark:text-muted-foreground">No questions</span>
                      )}
                      <Link
                        href={`${sessionBase(clientId, a.id, subject.id)}/questions` as Route}
                        aria-label={`Open questions for ${formatAppointmentCode(a.id)} full size`}
                        title="Open full size"
                        className={cn(SMALL, "w-8 justify-center px-0")}
                      >
                        <ArrowUpRight aria-hidden="true" className="size-4" />
                      </Link>
                    </div>
                  </div>
                  {expanded ? (
                    <div id={panelId} className="px-5 pb-5">
                      <div className="rounded-[22px] bg-white p-4 ring-1 ring-border/50 sm:p-5 dark:bg-card">
                        <SessionQuestionsPanel appointmentId={a.id} examId={a.exam_id} examTypeId={a.exam_type_id ?? null} showResponses={started} />
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        <TablePager label="Sessions" page={pager.page} perPage={pager.perPage} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} onPerPage={pager.setPerPage} scrollTo={listRef} />
      </section>
    </div>
  );
}
