"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Route } from "next";
import { ArrowUpRight, CalendarPlus, CheckCircle2, ChevronDown, ListChecks, Loader2, PlayCircle, Search, X } from "lucide-react";

import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { Segmented } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import { formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { fetchExamTypes, type AppointmentRecord } from "@/lib/exam-booking";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const PAGE_STEP = 10;

type View = "to_prepare" | "prepared" | "started" | "all";

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
/** Still worth preparing: not cancelled, not already run. */
const needsQuestions = (a: AppointmentRecord) => !isCancelled(a) && !a.exam_id && !a.questions_prepared;

export default function ClientSessionQuestionsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { client, appointments, loading } = useClientDetail();
  const { can } = useCurrentUser();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);
  const [search, setSearch] = React.useState("");
  const [view, setView] = React.useState<View | null>(null);
  const [shown, setShown] = React.useState(PAGE_STEP);
  const [examTypeNames, setExamTypeNames] = React.useState<Record<number, string>>({});

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
    const t = (a: AppointmentRecord) => new Date(a.scheduled_at).getTime();
    const toPrepare = appointments.filter(needsQuestions).sort((a, b) => t(a) - t(b)); // soonest first: prepare what's next
    const prepared = appointments.filter((a) => !isCancelled(a) && !a.exam_id && a.questions_prepared).sort((a, b) => t(a) - t(b));
    const started = appointments.filter((a) => Boolean(a.exam_id)).sort((a, b) => t(b) - t(a));
    const all = [...appointments].sort((a, b) => t(b) - t(a));
    return { to_prepare: toPrepare, prepared, started, all };
  }, [appointments]);

  const activeView: View = view ?? (groups.to_prepare.length > 0 ? "to_prepare" : "all");

  React.useEffect(() => {
    setShown(PAGE_STEP);
  }, [activeView, search]);

  const examTypeOf = (a: AppointmentRecord) =>
    (a.exam_type_id ? examTypeNames[a.exam_type_id] : undefined) || (a.notes || "").trim().split("\n")[0].trim() || "Polygraph examination";

  const filtered = React.useMemo(() => {
    const q = search.toLowerCase().trim();
    return groups[activeView].filter((a) => {
      if (!q) return true;
      const name = a.subject ? `${a.subject.first_name} ${a.subject.last_name}`.toLowerCase() : "";
      return formatAppointmentCode(a.id).toLowerCase().includes(q) || name.includes(q) || examTypeOf(a).toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- examTypeOf reads examTypeNames
  }, [groups, activeView, search, examTypeNames]);

  const visible = filtered.slice(0, shown);
  const nextToPrepare = groups.to_prepare.find((a) => new Date(a.scheduled_at).getTime() >= Date.now());
  const bookHref = `/dashboard/calendar/book?clientId=${clientId}` as Route;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading sessions…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Session questions</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Prepare what you&apos;ll ask in each booking. Questions are copied into the session when it starts, so later edits to the Question Library never change a past session.
        </p>
      </div>

      {appointments.length === 0 ? (
        <section className={cn(CARD, "flex flex-col items-center gap-4 px-6 py-14 text-center")}>
          <span className="flex size-14 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
            <ListChecks aria-hidden="true" className="size-6 text-muted-foreground" />
          </span>
          <div className="max-w-md">
            <p className="text-[17px] font-medium">No sessions to prepare yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Questions are prepared for a specific booking. {client ? `Book ${client.name.split(" ")[0]}'s exam` : "Book an exam"} and it will show up here, ready for questions.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">An invoice on its own isn&apos;t a booking — convert it to a booking from the invoice page if the exam is already agreed.</p>
          </div>
          {can("appointment:create") ? (
            <Link href={bookHref} className="flex h-11 items-center gap-2 rounded-full bg-[#2B2A27] px-5 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
              <CalendarPlus aria-hidden="true" className="size-4" /> Book exam
            </Link>
          ) : null}
        </section>
      ) : (
        <>
          {/* What needs doing */}
          {nextToPrepare ? (
            <section className="flex flex-col gap-3 rounded-[26px] bg-[#2B2A27] p-5 text-[#FAF9F5] sm:flex-row sm:items-center dark:bg-[#1B1B19] dark:ring-1 dark:ring-white/10">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white/10">
                <ListChecks aria-hidden="true" className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">
                  {groups.to_prepare.length === 1 ? "1 session needs questions" : `${groups.to_prepare.length} sessions need questions`}
                </p>
                <p className="text-[13px] text-[#C9C6BC]">
                  Next: {examTypeOf(nextToPrepare)} · {formatClinicDateLabel(nextToPrepare.scheduled_at)} at {formatClinicClock(nextToPrepare.scheduled_at)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setView("to_prepare");
                  setSearch("");
                  setExpandedId(nextToPrepare.id);
                  window.requestAnimationFrame(() => document.getElementById(`session-${nextToPrepare.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
                }}
                className="flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#FAF9F5] px-4 text-[13px] font-semibold text-[#2B2A27] transition-colors hover:bg-white"
              >
                Prepare now
              </button>
            </section>
          ) : groups.to_prepare.length === 0 && groups.prepared.length > 0 ? (
            <section className="flex items-center gap-3 rounded-[26px] bg-[#E7F1E4] px-5 py-4 text-[#2D5A27] dark:bg-emerald-950/60 dark:text-emerald-200">
              <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
              <p className="text-sm font-medium">Every upcoming session has its questions ready.</p>
            </section>
          ) : null}

          <section aria-label="Sessions" className={cn(CARD, "overflow-hidden")}>
            <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
              <Segmented<View>
                label="Show"
                value={activeView}
                onChange={(v) => {
                  setView(v);
                  setExpandedId(null);
                }}
                options={[
                  { value: "to_prepare", label: "To prepare", count: groups.to_prepare.length },
                  { value: "prepared", label: "Ready", count: groups.prepared.length },
                  { value: "started", label: "Started", count: groups.started.length },
                  { value: "all", label: "All", count: appointments.length },
                ]}
              />
              <div className="relative w-full lg:w-64">
                <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  aria-label="Search sessions"
                  placeholder="Code, exam type or examinee…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 rounded-full border-0 bg-[#F3F1EA] pr-9 pl-10 text-sm shadow-none dark:bg-muted"
                />
                {search ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    aria-label="Clear search"
                    className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                  >
                    <X aria-hidden="true" className="size-3.5" />
                  </button>
                ) : null}
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="border-t border-border/50 px-6 py-12 text-center text-sm text-muted-foreground">
                {search
                  ? "No sessions match your search."
                  : activeView === "to_prepare"
                    ? "Nothing left to prepare."
                    : activeView === "prepared"
                      ? "No sessions with questions ready yet."
                      : activeView === "started"
                        ? "No sessions have started yet."
                        : "No sessions."}
              </p>
            ) : (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {visible.map((a) => {
                  const expanded = expandedId === a.id;
                  const date = new Date(a.scheduled_at);
                  const started = Boolean(a.exam_id);
                  const fullHref = `/dashboard/clients/${clientId}/exams/${a.id}/questions` as Route;
                  return (
                    <li key={a.id} id={`session-${a.id}`} className={cn("scroll-mt-4", isCancelled(a) && "opacity-60")}>
                      <div className="flex items-center gap-3 px-3 py-2 sm:px-5">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`questions-${a.id}`}
                          onClick={() => setExpandedId(expanded ? null : a.id)}
                          className="flex min-w-0 flex-1 items-center gap-4 rounded-2xl p-2 text-left transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40"
                        >
                          <span className="flex w-14 shrink-0 flex-col items-center rounded-xl bg-[#F7F6F1] py-2 dark:bg-muted/50">
                            <span className="text-[11px] font-medium text-primary uppercase">{date.toLocaleDateString(undefined, { month: "short" })}</span>
                            <span className="text-xl leading-none font-semibold tabular-nums">{date.getDate()}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {examTypeOf(a)}
                              {a.subject ? <span className="font-normal text-muted-foreground"> · {a.subject.first_name} {a.subject.last_name}</span> : null}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {formatClinicClock(a.scheduled_at)} · <span className="font-mono">{formatAppointmentCode(a.id)}</span>
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              {isCancelled(a) ? (
                                <span className="rounded-full bg-[#ECE9E0] px-2.5 py-0.5 text-xs font-medium text-[#55534C] dark:bg-muted">Cancelled</span>
                              ) : started ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">
                                  <PlayCircle aria-hidden="true" className="size-3" /> Session started
                                </span>
                              ) : a.questions_prepared ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                                  <CheckCircle2 aria-hidden="true" className="size-3" /> Questions ready
                                </span>
                              ) : (
                                <span className="rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Needs questions</span>
                              )}
                            </span>
                          </span>
                          <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-muted-foreground sm:flex">
                            {expanded ? "Close" : started ? "View" : a.questions_prepared ? "Edit" : "Prepare"}
                            <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", expanded && "rotate-180")} />
                          </span>
                        </button>
                        <Link
                          href={fullHref}
                          aria-label={`Open ${formatAppointmentCode(a.id)} questions on their own page`}
                          title="Open full page"
                          className="flex size-9 shrink-0 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                        >
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </Link>
                      </div>
                      {expanded ? (
                        <div id={`questions-${a.id}`} className="mx-3 mb-4 rounded-2xl bg-[#F7F6F1] p-4 sm:mx-5 sm:p-5 dark:bg-muted/40">
                          <SessionQuestionsPanel appointmentId={a.id} examId={a.exam_id} examTypeId={a.exam_type_id ?? null} showResponses={started} />
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}

            {filtered.length > visible.length ? (
              <div className="flex flex-col items-center gap-2 border-t border-border/50 p-4">
                <p className="text-xs text-muted-foreground">
                  Showing {visible.length} of {filtered.length}
                </p>
                <button
                  type="button"
                  onClick={() => setShown((n) => n + PAGE_STEP)}
                  className="flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                >
                  Show {Math.min(PAGE_STEP, filtered.length - visible.length)} more
                </button>
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
