"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Calendar as CalendarIcon,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FileWarning,
  Plus,
  UserRound,
} from "lucide-react";

import { BookingAgreementNotice } from "@/components/agreements/booking-agreement-notice";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlowPanel, StatusPill } from "@/components/dashboard/ui-kit";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { fetchBookingAgreementStatuses, needsAgreementWarning, type BookingAgreementStatus } from "@/lib/agreements";
import { resolveAppointmentParties } from "@/lib/appointment-display";
import { clinicDateKey, clinicNowMinutes, clinicTodayDateString, formatClinicClock, formatClinicGridDate, isSameClinicDay, clinicWeekdayShort } from "@/lib/clinic-time";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchExamByAppointment, type ExamPhaseRecord } from "@/lib/exam-documentation";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & constants                                                   */
/* ------------------------------------------------------------------ */

type View = "month" | "week" | "day";
type Status = "Pending" | "Confirmed" | "Completed" | "Cancelled";

type CalendarDay = { name: string; date: string; dateObj: Date };
type Examiner = { id: string; name: string; initials: string; color: string };
type Session = {
  id: number;
  clientId: number;
  subjectId?: number;
  client: string;
  accountName?: string;
  examinerId: string;
  time: string;
  startMin: number;
  durationMin: number;
  type: string;
  status: Status;
  paymentStatus: string;
  reason: string;
  scheduledAt: Date;
};

const HOUR_PX = 64;
const EXAMINER_COLORS = ["bg-[#C96442]", "bg-[#7C6BD6]", "bg-[#3F7A37]", "bg-[#B8862F]", "bg-[#30302E]", "bg-[#4F7FA8]"];

const BLOCK_STYLE: Record<Status, string> = {
  Confirmed: "bg-[#E7F1E4] text-[#1F3D1B] ring-[#3F7A37]/25 dark:bg-emerald-950 dark:text-emerald-100 dark:ring-emerald-700/40",
  Pending: "bg-[#EFEBFE] text-[#2A2160] ring-[#7C6BD6]/30 dark:bg-violet-950 dark:text-violet-100 dark:ring-violet-700/40",
  Completed: "bg-[#ECE9E0] text-[#3D3929] ring-black/5 dark:bg-muted dark:text-foreground dark:ring-white/10",
  Cancelled:
    "bg-[repeating-linear-gradient(135deg,#F7F6F1_0_6px,#EEEBE2_6px_12px)] text-[#8E8B82] ring-black/5 dark:bg-[repeating-linear-gradient(135deg,#262624_0_6px,#2e2e2b_6px_12px)] dark:text-muted-foreground",
};
const STATUS_DOT: Record<Status, string> = {
  Confirmed: "bg-[#3F7A37]",
  Pending: "bg-[#7C6BD6]",
  Completed: "bg-[#8E8B82]",
  Cancelled: "bg-[#B5B2A8]",
};

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function CalendarPage() {
  const [view, setView] = React.useState<View>("week");
  const [cursorDate, setCursorDate] = React.useState<Date>(() => startOfDay(new Date()));
  const [examiners, setExaminers] = React.useState<Examiner[]>([]);
  const [sessions, setSessions] = React.useState<Session[]>([]);
  const [hiddenExaminers, setHiddenExaminers] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);
  const [selected, setSelected] = React.useState<Session | null>(null);
  const [isSheetOpen, setIsSheetOpen] = React.useState(false);
  const [phases, setPhases] = React.useState<ExamPhaseRecord[]>([]);
  const [phasesLoading, setPhasesLoading] = React.useState(false);
  const [agreementStatuses, setAgreementStatuses] = React.useState<Record<number, BookingAgreementStatus>>({});
  const [nowMin, setNowMin] = React.useState(() => clinicNowMinutes());
  const { can, loading: userLoading } = useCurrentUser();
  const canViewAgreements = !userLoading && can("agreement:view");

  React.useEffect(() => {
    const timer = window.setInterval(() => setNowMin(clinicNowMinutes()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [examinerRows, appointmentRows] = await Promise.all([fetchExaminers(), fetchAppointments()]);
        if (cancelled) return;
        setExaminers(mapExaminers(examinerRows));
        setSessions(mapSessions(appointmentRows));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to load calendar data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Agreement warnings are advisory: a failed lookup just hides the markers.
  React.useEffect(() => {
    if (!canViewAgreements || sessions.length === 0) return;
    let cancelled = false;
    fetchBookingAgreementStatuses(sessions.map((s) => s.id))
      .then((map) => !cancelled && setAgreementStatuses(map))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [sessions, canViewAgreements]);

  React.useEffect(() => {
    if (!selected) {
      setPhases([]);
      return;
    }
    let cancelled = false;
    setPhasesLoading(true);
    fetchExamByAppointment(selected.id)
      .then((exam) => !cancelled && setPhases(exam?.phases ?? []))
      .catch(() => !cancelled && setPhases([]))
      .finally(() => !cancelled && setPhasesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const hasAgreementWarning = (s: Session) => needsAgreementWarning(agreementStatuses[s.id], { status: s.status, scheduled_at: s.scheduledAt });

  const weekDays = React.useMemo(() => buildWeekDays(cursorDate), [cursorDate]);
  const monthCells = React.useMemo(() => buildMonthCells(cursorDate), [cursorDate]);
  const visibleDays: CalendarDay[] =
    view === "week" ? weekDays : [{ name: clinicWeekdayShort(cursorDate), date: formatClinicGridDate(cursorDate), dateObj: cursorDate }];

  const visible = React.useMemo(() => sessions.filter((s) => !hiddenExaminers.has(s.examinerId)), [sessions, hiddenExaminers]);

  /** Sessions inside the period on screen (the month view counts its own month only). */
  const inPeriod = React.useCallback(
    (s: Session) => {
      if (view === "month") return s.scheduledAt.getMonth() === cursorDate.getMonth() && s.scheduledAt.getFullYear() === cursorDate.getFullYear();
      return visibleDays.some((d) => isSameClinicDay(s.scheduledAt, d.dateObj));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, cursorDate, weekDays],
  );

  const stats = React.useMemo(() => {
    const todayKey = clinicTodayDateString();
    const live = visible.filter((s) => s.status !== "Cancelled");
    return {
      today: live.filter((s) => clinicDateKey(s.scheduledAt) === todayKey).length,
      period: live.filter(inPeriod).length,
      pending: live.filter((s) => s.status === "Pending" && inPeriod(s)).length,
    };
  }, [visible, inPeriod]);

  const perExaminer = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of sessions) if (s.status !== "Cancelled" && inPeriod(s)) counts.set(s.examinerId, (counts.get(s.examinerId) ?? 0) + 1);
    return counts;
  }, [sessions, inPeriod]);

  const periodLabel = React.useMemo(() => {
    if (view === "month") return cursorDate.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    if (view === "week") {
      const start = weekDays[0].dateObj;
      const end = weekDays[6].dateObj;
      const sameMonth = start.getMonth() === end.getMonth();
      return sameMonth
        ? `${start.getDate()} – ${end.getDate()} ${end.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`
        : `${start.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    }
    return cursorDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  }, [view, cursorDate, weekDays]);

  const isCurrentPeriod = (() => {
    const today = startOfDay(new Date());
    if (view === "day") return cursorDate.getTime() === today.getTime();
    if (view === "week") return weekDays.some((d) => isSameClinicDay(d.dateObj, today));
    return cursorDate.getMonth() === today.getMonth() && cursorDate.getFullYear() === today.getFullYear();
  })();

  const openSession = (s: Session) => {
    setSelected(s);
    setIsSheetOpen(true);
  };
  const openDay = (date: Date) => {
    setCursorDate(startOfDay(date));
    setView("day");
  };
  const examinerById = (id: string) => examiners.find((e) => e.id === id);
  const allShown = hiddenExaminers.size === 0;

  /* ---------------- time grid geometry ---------------- */

  const gridSessions = visible.filter((s) => visibleDays.some((d) => isSameClinicDay(s.scheduledAt, d.dateObj)));
  let startHour = 8;
  let endHour = 18;
  for (const s of gridSessions) {
    startHour = Math.min(startHour, Math.floor(s.startMin / 60));
    endHour = Math.max(endHour, Math.ceil((s.startMin + s.durationMin) / 60));
  }
  endHour = Math.min(24, endHour);
  const hours = Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
  const todayIndex = visibleDays.findIndex((d) => isSameClinicDay(d.dateObj, new Date()));
  const nowTop = ((nowMin - startHour * 60) / 60) * HOUR_PX;
  const showNow = todayIndex >= 0 && nowMin >= startHour * 60 && nowMin <= endHour * 60;
  const gridCols = view === "week" ? "grid-cols-[64px_repeat(7,minmax(0,1fr))]" : "grid-cols-[64px_minmax(0,1fr)]";

  return (
    <div className="mx-auto max-w-[1600px] space-y-4 pb-10">
      {/* Header */}
      <GlowPanel tone="terracotta" orb="74%" lineTop={0} className="px-5 pt-6 pb-5 sm:px-7">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <CalendarIcon aria-hidden="true" className="size-4" />
                Calendar
              </span>
              <h1 className="text-3xl leading-tight font-normal tracking-[-0.03em] sm:text-[38px]">{periodLabel}</h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-[#C9C6BC]">
                <span>
                  <span className="font-mono text-[#FAF9F5] tabular-nums">{loading ? "–" : stats.today}</span> today
                </span>
                <span>
                  <span className="font-mono text-[#FAF9F5] tabular-nums">{loading ? "–" : stats.period}</span> {view === "day" ? "this day" : `this ${view}`}
                </span>
                <span className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-chart-2" />
                  <span className="font-mono text-[#FAF9F5] tabular-nums">{loading ? "–" : stats.pending}</span> awaiting confirmation
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-white/[0.07] p-1 ring-1 ring-white/15">
                <button type="button" aria-label={`Previous ${view}`} onClick={() => setCursorDate((d) => shiftDate(d, view, -1))} className="flex size-9 items-center justify-center rounded-full text-[#FAF9F5] hover:bg-white/10">
                  <ChevronLeft aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setCursorDate(startOfDay(new Date()))}
                  disabled={isCurrentPeriod}
                  className="h-9 rounded-full px-4 text-sm font-medium text-[#FAF9F5] hover:bg-white/10 disabled:opacity-40"
                >
                  Today
                </button>
                <button type="button" aria-label={`Next ${view}`} onClick={() => setCursorDate((d) => shiftDate(d, view, 1))} className="flex size-9 items-center justify-center rounded-full text-[#FAF9F5] hover:bg-white/10">
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              </div>
              <div role="group" aria-label="Calendar view" className="flex gap-1 rounded-full bg-white/[0.07] p-1 ring-1 ring-white/15">
                {(["day", "week", "month"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn(
                      "h-9 rounded-full px-4 text-sm capitalize transition-colors",
                      view === v ? "bg-[#FAF9F5] font-semibold text-[#1A1915]" : "text-[#C9C6BC] hover:text-[#FAF9F5]",
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Link href="/dashboard/calendar/book" className="flex h-11 items-center gap-2 rounded-full bg-primary pr-5 pl-2.5 text-sm font-semibold text-[#1A1915] transition-colors hover:bg-primary/90">
                <span className="flex size-6 items-center justify-center rounded-full bg-[#1A1915]/10">
                  <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />
                </span>
                Book exam
              </Link>
            </div>
          </div>
        </div>
      </GlowPanel>

      {/* Examiner filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          aria-pressed={allShown}
          onClick={() => setHiddenExaminers(new Set())}
          className={cn(
            "flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm transition-colors",
            allShown ? "bg-[#30302E] font-semibold text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-white text-foreground ring-1 ring-border/60 hover:bg-[#FAF9F5] dark:bg-card",
          )}
        >
          All examiners
        </button>
        {examiners.map((ex) => {
          const shown = !hiddenExaminers.has(ex.id);
          return (
            <button
              key={ex.id}
              type="button"
              aria-pressed={shown}
              onClick={() =>
                setHiddenExaminers((prev) => {
                  const next = new Set(prev);
                  if (next.has(ex.id)) next.delete(ex.id);
                  else next.add(ex.id);
                  return next;
                })
              }
              className={cn(
                "flex h-11 shrink-0 items-center gap-2.5 rounded-full py-1 pr-4 pl-1 text-sm transition-all",
                shown ? "bg-white ring-1 ring-border/60 dark:bg-card" : "bg-transparent text-muted-foreground opacity-60 ring-1 ring-dashed ring-border hover:opacity-100",
              )}
            >
              <span className={cn("flex size-9 items-center justify-center rounded-full text-xs font-semibold text-white", shown ? ex.color : "bg-[#B5B2A8]")}>{ex.initials}</span>
              <span className="whitespace-nowrap">{ex.name}</span>
              <span className="rounded-full bg-[#F3F1EA] px-1.5 text-[11px] font-semibold tabular-nums dark:bg-muted">{perExaminer.get(ex.id) ?? 0}</span>
            </button>
          );
        })}
      </div>

      {/* Calendar */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        {view === "month" ? (
          <div className="overflow-x-auto">
            <div className="grid min-w-[880px] grid-cols-7">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
                <div key={d} className="border-b border-border/50 px-3 py-3 text-[13px] text-muted-foreground">
                  {d}
                </div>
              ))}
              {monthCells.map(({ dateObj }) => {
                const inMonth = dateObj.getMonth() === cursorDate.getMonth();
                const isToday = isSameClinicDay(dateObj, new Date());
                const daySessions = visible
                  .filter((s) => isSameClinicDay(s.scheduledAt, dateObj))
                  .sort((a, b) => a.startMin - b.startMin);
                const shown = daySessions.slice(0, 3);
                return (
                  <div key={dateObj.toISOString()} className={cn("flex min-h-[128px] flex-col gap-1.5 border-r border-b border-border/40 p-2 nth-[7n]:border-r-0", !inMonth && "bg-[#FAF9F5] dark:bg-muted/20")}>
                    <button
                      type="button"
                      onClick={() => openDay(dateObj)}
                      aria-label={`Open ${dateObj.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}`}
                      className={cn(
                        "flex size-7 items-center justify-center self-start rounded-full text-[13px] tabular-nums transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted",
                        isToday ? "bg-primary font-semibold text-[#1A1915] hover:bg-primary" : inMonth ? "text-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {dateObj.getDate()}
                    </button>
                    {shown.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => openSession(s)}
                        className={cn("flex items-center gap-1.5 rounded-lg px-2 py-1 text-left text-xs ring-1 transition-transform hover:-translate-y-px", BLOCK_STYLE[s.status], s.status === "Cancelled" && "line-through")}
                      >
                        <span className="font-mono tabular-nums opacity-70">{s.time}</span>
                        <span className="truncate font-medium">{s.client}</span>
                        {hasAgreementWarning(s) ? <FileWarning aria-label="Agreements not signed" className="size-3 shrink-0 text-[#B8862F]" /> : null}
                      </button>
                    ))}
                    {daySessions.length > shown.length ? (
                      <button type="button" onClick={() => openDay(dateObj)} className="self-start rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                        +{daySessions.length - shown.length} more
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className={view === "week" ? "min-w-[920px]" : ""}>
              {/* Day headers */}
              <div className={cn("sticky top-0 z-20 grid border-b border-border/50 bg-white dark:bg-card", gridCols)}>
                <div />
                {visibleDays.map((day) => {
                  const isToday = isSameClinicDay(day.dateObj, new Date());
                  const count = visible.filter((s) => s.status !== "Cancelled" && isSameClinicDay(s.scheduledAt, day.dateObj)).length;
                  return (
                    <button
                      key={day.dateObj.toISOString()}
                      type="button"
                      onClick={() => view === "week" && openDay(day.dateObj)}
                      className={cn("flex items-center gap-2.5 border-l border-border/40 px-3 py-3 text-left", view === "week" && "hover:bg-[#FAF9F5] dark:hover:bg-muted/30")}
                    >
                      <span className={cn("flex size-9 items-center justify-center rounded-full text-base tabular-nums", isToday ? "bg-primary font-semibold text-[#1A1915]" : "bg-[#F3F1EA] dark:bg-muted")}>
                        {day.dateObj.getDate()}
                      </span>
                      <span className="flex flex-col">
                        <span className={cn("text-[13px]", isToday ? "font-semibold" : "text-muted-foreground")}>{day.name}</span>
                        <span className="text-xs text-muted-foreground">{count ? `${count} session${count === 1 ? "" : "s"}` : "Free"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Time grid */}
              <div className={cn("relative grid", gridCols)}>
                <div>
                  {hours.map((h) => (
                    <div key={h} className="relative border-b border-transparent" style={{ height: HOUR_PX }}>
                      <span className="absolute -top-2 right-3 font-mono text-[11px] text-muted-foreground">{h === startHour ? "" : `${String(h).padStart(2, "0")}:00`}</span>
                    </div>
                  ))}
                </div>
                {visibleDays.map((day, dayIndex) => {
                  const daySessions = layoutLanes(gridSessions.filter((s) => isSameClinicDay(s.scheduledAt, day.dateObj)));
                  return (
                    <div key={day.dateObj.toISOString()} className={cn("relative border-l border-border/40", dayIndex === todayIndex && "bg-primary/[0.035]")}>
                      {hours.map((h) => (
                        <div key={h} className="border-b border-border/40" style={{ height: HOUR_PX }}>
                          <div className="h-1/2 border-b border-dashed border-border/25" />
                        </div>
                      ))}
                      {daySessions.map(({ session: s, lane, lanes }) => {
                        const top = ((s.startMin - startHour * 60) / 60) * HOUR_PX;
                        const height = Math.max(26, (s.durationMin / 60) * HOUR_PX - 4);
                        const examiner = examinerById(s.examinerId);
                        const compact = height < 56 || lanes > 2;
                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => openSession(s)}
                            title={`${s.time} · ${s.client} · ${s.type}`}
                            className={cn(
                              "absolute flex flex-col overflow-hidden rounded-xl px-2.5 py-1.5 text-left ring-1 transition-[transform,box-shadow] hover:z-30 hover:-translate-y-px hover:shadow-[0_10px_24px_-14px_rgba(40,36,20,0.5)]",
                              BLOCK_STYLE[s.status],
                            )}
                            style={{
                              top: top + 2,
                              height,
                              left: `calc(${(lane / lanes) * 100}% + 3px)`,
                              width: `calc(${100 / lanes}% - 6px)`,
                              zIndex: 10 + lane,
                            }}
                          >
                            <span className="flex items-center gap-1.5 text-[11px]">
                              <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", STATUS_DOT[s.status])} />
                              <span className="font-mono tabular-nums opacity-75">{s.time}</span>
                              <PaymentDot status={s.paymentStatus} />
                              {hasAgreementWarning(s) ? <FileWarning aria-label="Agreements not signed" className="size-3 shrink-0 text-[#B8862F]" /> : null}
                            </span>
                            <span className={cn("truncate text-[13px] leading-tight font-semibold", s.status === "Cancelled" && "line-through")}>{s.client}</span>
                            {!compact ? <span className="truncate text-xs opacity-75">{s.type}</span> : null}
                            {!compact && height > 84 ? (
                              <span className="mt-auto flex items-center gap-1.5 pt-1 text-[11px] opacity-80">
                                <span className={cn("flex size-4 items-center justify-center rounded-full text-[8px] font-semibold text-white", examiner?.color ?? "bg-[#8E8B82]")}>{examiner?.initials}</span>
                                <span className="truncate">{examiner?.name}</span>
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
                {showNow ? (
                  <div aria-hidden="true" className="pointer-events-none absolute right-0 left-16 z-40" style={{ top: nowTop }}>
                    <div
                      className="relative h-0.5 bg-primary"
                      style={
                        view === "week"
                          ? { marginLeft: `${(todayIndex / 7) * 100}%`, width: `${100 / 7}%` }
                          : undefined
                      }
                    >
                      <span className="absolute -top-[5px] -left-1.5 size-3 rounded-full bg-primary ring-2 ring-white dark:ring-card" />
                    </div>
                  </div>
                ) : null}
              </div>
              {!loading && gridSessions.length === 0 ? (
                <p className="border-t border-border/40 px-6 py-4 text-center text-[13px] text-muted-foreground">
                  No sessions {view === "day" ? "on this day" : "this week"}
                  {!allShown ? " for the selected examiners" : ""}.{" "}
                  <Link href="/dashboard/calendar/book" className="font-medium text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
                    Book one
                  </Link>
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-1 text-[13px] text-muted-foreground">
        {(Object.keys(STATUS_DOT) as Status[]).map((st) => (
          <span key={st} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-2 rounded-full", STATUS_DOT[st])} />
            {st}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-1.5 rounded-full bg-[#B94A3E]" /> Unpaid
        </span>
        <span className="flex items-center gap-1.5">
          <FileWarning aria-hidden="true" className="size-3.5 text-[#B8862F]" /> Agreements unsigned
        </span>
      </div>

      {/* Session sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full gap-0 overflow-hidden border-l border-border/50 bg-white p-0 shadow-2xl sm:max-w-[560px] dark:bg-card [&_[data-slot=sheet-close]]:top-5 [&_[data-slot=sheet-close]]:right-5 [&_[data-slot=sheet-close]]:z-30 [&_[data-slot=sheet-close]]:flex [&_[data-slot=sheet-close]]:size-9 [&_[data-slot=sheet-close]]:items-center [&_[data-slot=sheet-close]]:justify-center [&_[data-slot=sheet-close]]:rounded-full [&_[data-slot=sheet-close]]:bg-white/10! [&_[data-slot=sheet-close]]:text-[#FAF9F5] [&_[data-slot=sheet-close]]:opacity-100 [&_[data-slot=sheet-close]]:ring-1 [&_[data-slot=sheet-close]]:ring-white/15">
          {selected ? (
            <div className="flex h-full flex-col">
              <GlowPanel tone={selected.status === "Cancelled" ? "ink" : selected.status === "Pending" ? "lavender" : selected.status === "Confirmed" ? "sage" : "terracotta"} orb="62%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
                <div key={`head-${selected.id}`} className="flex flex-col gap-3 pr-12 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-4 motion-safe:duration-500 motion-safe:fill-mode-both">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={selected.status} onDark />
                    <span className="font-mono text-xs text-[#B5B2A8]">EX-{String(selected.id).padStart(4, "0")}</span>
                  </div>
                  <SheetTitle className="text-2xl leading-tight font-medium tracking-[-0.02em] text-[#FAF9F5]">{selected.client}</SheetTitle>
                  <SheetDescription className="text-sm text-[#C9C6BC]">
                    {selected.type}
                    {selected.accountName ? <span className="text-[#8E8B82]"> · billed to {selected.accountName}</span> : null}
                  </SheetDescription>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-[#C9C6BC]">
                    <span className="flex items-center gap-1.5">
                      <CalendarIcon aria-hidden="true" className="size-3.5" />
                      {selected.scheduledAt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
                      <span className="font-mono text-[#FAF9F5]">
                        {selected.time}–{minutesToClock(selected.startMin + selected.durationMin)}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock aria-hidden="true" className="size-3.5" />
                      {selected.durationMin} min
                    </span>
                    {examinerById(selected.examinerId) ? (
                      <span className="flex items-center gap-1.5">
                        <span className={cn("flex size-5 items-center justify-center rounded-full text-[9px] font-semibold text-white", examinerById(selected.examinerId)?.color)}>
                          {examinerById(selected.examinerId)?.initials}
                        </span>
                        {examinerById(selected.examinerId)?.name}
                      </span>
                    ) : null}
                  </div>
                </div>
              </GlowPanel>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div key={`body-${selected.id}`} className="flex flex-col gap-6 px-4 py-5 sm:px-6">
                  <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-100">
                    <BookingAgreementNotice status={agreementStatuses[selected.id]} booking={{ status: selected.status, scheduled_at: selected.scheduledAt }} clientId={selected.clientId} showSigned />
                  </div>

                  <section className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-150">
                    <h3 className="px-1 text-[13px] font-medium">Case notes</h3>
                    <p className="rounded-xl bg-[#F7F6F1] px-3.5 py-3 text-sm leading-relaxed text-foreground/85 dark:bg-muted/50">{selected.reason || "No case notes recorded."}</p>
                  </section>

                  <section className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-200">
                    <h3 className="px-1 text-[13px] font-medium">Session timeline</h3>
                    {phasesLoading ? (
                      <div className="flex flex-col gap-2">
                        <div className="h-10 animate-pulse rounded-xl bg-muted" />
                        <div className="h-10 animate-pulse rounded-xl bg-muted" />
                      </div>
                    ) : phases.length === 0 ? (
                      <p className="rounded-xl px-3.5 py-3 text-sm text-muted-foreground ring-1 ring-border/60">No phases logged yet. They appear once the examiner starts the session.</p>
                    ) : (
                      <ol className="flex flex-col">
                        {phases.map((phase, i) => (
                          <li key={phase.id} className="relative flex gap-3 pb-4 last:pb-0">
                            {i < phases.length - 1 ? <span aria-hidden="true" className="absolute top-6 bottom-0 left-[11px] w-px bg-border" /> : null}
                            <span className="relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                              <CheckCircle2 aria-hidden="true" className="size-3.5" />
                            </span>
                            <span className="flex min-w-0 flex-col">
                              <span className="text-sm font-medium">{phase.name}</span>
                              <span className="font-mono text-xs text-muted-foreground">{formatClinicClock(phase.start_time)}</span>
                              {phase.notes ? <span className="mt-0.5 text-[13px] text-muted-foreground">{phase.notes}</span> : null}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>

                  <section className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:fill-mode-both motion-safe:delay-[250ms]">
                    <Link
                      href={`/dashboard/clients/${selected.clientId}/exams/${selected.id}`}
                      className="flex h-12 items-center justify-between rounded-2xl bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground"
                    >
                      Open session documentation
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                    </Link>
                    <div className="flex flex-col divide-y divide-border/50 rounded-2xl ring-1 ring-border/60">
                      {selected.subjectId ? (
                        <SheetLink href={`/dashboard/clients/${selected.clientId}/examinees/${selected.subjectId}`} icon={UserRound} label="Examinee profile" />
                      ) : null}
                      <SheetLink href={`/dashboard/clients/${selected.clientId}`} icon={FileText} label={`Billing account${selected.accountName ? ` · ${selected.accountName}` : ""}`} />
                      <SheetLink href="/dashboard/exams" icon={CalendarIcon} label="Reschedule or edit in Exams" />
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces & helpers                                                    */
/* ------------------------------------------------------------------ */

function SheetLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>; label: string }) {
  return (
    <Link href={href} className="group flex h-12 items-center justify-between gap-3 rounded-xl px-3 text-sm transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/60">
      <span className="flex min-w-0 items-center gap-3">
        <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{label}</span>
      </span>
      <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </Link>
  );
}

function PaymentDot({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "paid") return null;
  return (
    <span
      role="img"
      aria-label={s === "partial" ? "Partly paid" : "Unpaid"}
      title={s === "partial" ? "Partly paid" : "Unpaid"}
      className={cn("size-1.5 shrink-0 rounded-full", s === "partial" ? "bg-[#E2B35A]" : "bg-[#B94A3E]")}
    />
  );
}

/** Side-by-side lanes for overlapping sessions within one day column. */
function layoutLanes(list: Session[]): { session: Session; lane: number; lanes: number }[] {
  const sorted = [...list].sort((a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin);
  const result: { session: Session; lane: number; lanes: number }[] = [];
  let cluster: { session: Session; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;
  const flush = () => {
    const lanes = Math.max(1, laneEnds.length);
    for (const item of cluster) result.push({ ...item, lanes });
    cluster = [];
    laneEnds = [];
  };
  for (const s of sorted) {
    const end = s.startMin + s.durationMin;
    if (s.startMin >= clusterEnd && cluster.length) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= s.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ session: s, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length) flush();
  return result;
}

function mapExaminers(rows: UserRecord[]): Examiner[] {
  return rows.map((row, index) => ({
    id: String(row.id),
    name: row.name,
    initials: row.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join(""),
    color: EXAMINER_COLORS[index % EXAMINER_COLORS.length],
  }));
}

function mapSessions(rows: AppointmentRecord[]): Session[] {
  return rows
    .map((row) => {
      const scheduledAt = new Date(row.scheduled_at);
      const time = formatClinicClock(scheduledAt);
      const [h, m] = time.split(":").map(Number);
      const lines = (row.notes || "").split("\n").map((l) => l.trim()).filter(Boolean);
      const parties = resolveAppointmentParties(row);
      const status = (["confirmed", "completed", "cancelled"].includes((row.status || "").toLowerCase())
        ? (row.status.charAt(0).toUpperCase() + row.status.slice(1).toLowerCase())
        : "Pending") as Status;
      return {
        id: row.id,
        clientId: row.client_id,
        subjectId: parties.subjectId,
        client: parties.primaryName,
        accountName: parties.accountName,
        examinerId: String(row.examiner_id),
        time,
        startMin: (h || 0) * 60 + (m || 0),
        durationMin: Number(row.duration) > 0 ? Number(row.duration) : 60,
        type: lines[0] || "Exam",
        status,
        paymentStatus: String(row.payment_status || ""),
        reason: lines.slice(1).join(" "),
        scheduledAt,
      };
    })
    .filter((s) => !Number.isNaN(s.scheduledAt.getTime()));
}

function minutesToClock(total: number) {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDate(date: Date, view: View, direction: -1 | 1): Date {
  const next = new Date(date);
  if (view === "month") {
    next.setDate(1);
    next.setMonth(next.getMonth() + direction);
  } else if (view === "week") next.setDate(next.getDate() + direction * 7);
  else next.setDate(next.getDate() + direction);
  return startOfDay(next);
}

/** Six Monday-first weeks covering the month. */
function buildMonthCells(reference: Date): { dateObj: Date }[] {
  const first = new Date(reference.getFullYear(), reference.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => {
    const dateObj = new Date(start);
    dateObj.setDate(start.getDate() + i);
    return { dateObj };
  });
}

function buildWeekDays(reference: Date): CalendarDay[] {
  const start = new Date(reference);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => {
    const dateObj = new Date(start);
    dateObj.setDate(start.getDate() + i);
    return { name: clinicWeekdayShort(dateObj), date: formatClinicGridDate(dateObj), dateObj };
  });
}
