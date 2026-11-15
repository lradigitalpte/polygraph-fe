"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarCheck2,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileSignature,
  Plus,
} from "lucide-react";
import {
  fetchAppointments,
  fetchExamTypes,
  type AppointmentRecord,
  type ExamTypeRecord,
} from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import {
  fetchConsolidatedStats,
  fetchReportWorkflowStatuses,
  type ConsolidatedReportStats,
  type ReportWorkflowStatusRow,
} from "@/lib/reports";
import { formatSubjectName } from "@/lib/subjects";
import {
  CLINIC_TIMEZONE,
  DUBAI_UTC_OFFSET_MS,
  formatClinicClock,
  isSameClinicDay,
  utcToDubaiParts,
} from "@/lib/clinic-time";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Types & helpers                                                     */
/* ------------------------------------------------------------------ */

type SessionStatus = "pending" | "confirmed" | "completed" | "cancelled";

type Session = {
  id: number;
  examId?: number;
  examinerId: number;
  examinerName: string;
  subjectName: string;
  examType: string;
  status: SessionStatus;
  start: Date;
  end: Date;
  questionsPrepared: boolean;
  paymentStatus: string;
};

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Filled buttons use a deeper terracotta so white text passes 4.5:1 contrast.
const PRIMARY_BUTTON =
  "bg-[oklch(0.53_0.13_39)] text-white hover:bg-[oklch(0.49_0.13_39)] dark:bg-primary dark:text-primary-foreground dark:hover:bg-primary/90";

const CARD = "rounded-[28px] bg-white dark:bg-card shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/60";

function normalizeStatus(value?: string): SessionStatus {
  const status = (value || "pending").toLowerCase();
  if (status === "confirmed" || status === "completed" || status === "cancelled") return status;
  return "pending";
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function minutesOfDay(date: Date) {
  const parts = utcToDubaiParts(date);
  return parts ? parts.hour * 60 + parts.minute : 0;
}

function monthKey(date: Date) {
  const parts = utcToDubaiParts(date);
  return parts ? parts.year * 12 + (parts.month - 1) : 0;
}

function greeting(now: Date) {
  const hour = Math.floor(minutesOfDay(now) / 60);
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function formatLongDate(now: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: CLINIC_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
}

function formatDayLabel(date: Date, now: Date) {
  if (isSameClinicDay(date, now)) return "Today";
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  if (isSameClinicDay(date, tomorrow)) return "Tomorrow";
  return new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, weekday: "short", day: "numeric", month: "short" }).format(date);
}

function formatCountdown(target: Date, now: Date) {
  const minutes = Math.round((target.getTime() - now.getTime()) / 60000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours}h ${minutes % 60}m`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? "" : "s"}`;
}

function isLive(session: Session, now: Date) {
  return (
    session.status !== "completed" &&
    session.status !== "cancelled" &&
    session.start <= now &&
    session.end > now
  );
}

/* ------------------------------------------------------------------ */
/* Period filter (clinic time: Dubai, weeks start Monday)              */
/* ------------------------------------------------------------------ */

type Period = "day" | "week" | "month";
type Range = { start: Date; end: Date };
type DayBucket = {
  start: Date;
  dayOffset: number;
  label: string;
  isToday: boolean;
  completed: number;
  confirmed: number;
  pending: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC instant of Dubai midnight for the clinic day containing `date`. */
function clinicMidnight(date: Date) {
  const parts = utcToDubaiParts(date);
  if (!parts) return date;
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day) - DUBAI_UTC_OFFSET_MS);
}

function periodRange(period: Period, offset: number, now: Date): Range {
  const today = clinicMidnight(now).getTime();
  if (period === "day") {
    const start = today + offset * DAY_MS;
    return { start: new Date(start), end: new Date(start + DAY_MS) };
  }
  const parts = utcToDubaiParts(now);
  if (period === "week") {
    const sinceMonday = parts ? (parts.weekday + 6) % 7 : 0;
    const start = today - sinceMonday * DAY_MS + offset * 7 * DAY_MS;
    return { start: new Date(start), end: new Date(start + 7 * DAY_MS) };
  }
  const year = parts?.year ?? now.getUTCFullYear();
  const month = (parts?.month ?? now.getUTCMonth() + 1) - 1 + offset;
  return {
    start: new Date(Date.UTC(year, month, 1) - DUBAI_UTC_OFFSET_MS),
    end: new Date(Date.UTC(year, month + 1, 1) - DUBAI_UTC_OFFSET_MS),
  };
}

function formatRange(period: Period, range: Range, now: Date) {
  const fmt = (date: Date, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, ...options }).format(date);
  if (period === "day") {
    const day = formatDayLabel(range.start, now);
    return day === "Today" || day === "Tomorrow" ? `${day}, ${fmt(range.start, { day: "numeric", month: "short" })}` : fmt(range.start, { weekday: "long", day: "numeric", month: "short" });
  }
  if (period === "week") {
    const last = new Date(range.end.getTime() - DAY_MS);
    return `${fmt(range.start, { day: "numeric", month: "short" })} – ${fmt(last, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return fmt(range.start, { month: "long", year: "numeric" });
}

const PERIOD_NOUN: Record<Period, string> = { day: "day", week: "week", month: "month" };

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export function OverviewDashboard() {
  const { user, showExaminerWorkspace: examinerView } = useCurrentUser();
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [workflow, setWorkflow] = React.useState<ReportWorkflowStatusRow[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [now, setNow] = React.useState(() => new Date());
  const [period, setPeriodState] = React.useState<Period>("day");
  const [offset, setOffset] = React.useState(0);

  // Remember the viewer's preferred period (per browser; optional).
  React.useEffect(() => {
    try {
      const saved = window.localStorage.getItem("dashboard-period");
      if (saved === "day" || saved === "week" || saved === "month") setPeriodState(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const setPeriod = React.useCallback((next: Period) => {
    setPeriodState(next);
    setOffset(0);
    try {
      window.localStorage.setItem("dashboard-period", next);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const openDay = React.useCallback((dayOffset: number) => {
    setPeriodState("day");
    setOffset(dayOffset);
  }, []);

  // Keep the "now" line, countdowns and live sessions current.
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    if (!user) return;
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      const results = await Promise.allSettled([
        fetchAppointments(),
        fetchExaminers(),
        fetchExamTypes(),
        fetchConsolidatedStats(examinerView && user ? user.id : undefined),
        fetchReportWorkflowStatuses(),
      ] as const);
      if (cancelled) return;

      const [appts, examinerList, types, reportStats, workflowRows] = results;
      setAppointments(appts.status === "fulfilled" ? appts.value : []);
      setExaminers(examinerList.status === "fulfilled" ? examinerList.value : []);
      setExamTypes(types.status === "fulfilled" ? types.value : []);
      setStats(reportStats.status === "fulfilled" ? reportStats.value : null);
      setWorkflow(workflowRows.status === "fulfilled" ? workflowRows.value : []);

      if (results.some((result) => result.status === "rejected")) {
        toast.error("Some dashboard data could not be loaded.");
      }
      setIsLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, examinerView]);

  const sessions = React.useMemo<Session[]>(() => {
    const examinerNames = new Map(examiners.map((examiner) => [examiner.id, examiner.name]));
    const typeNames = new Map(examTypes.map((type) => [type.id, type.name]));

    return appointments
      .filter((appointment) => !(examinerView && user) || appointment.examiner_id === user.id)
      .map((appointment) => {
        const start = new Date(appointment.scheduled_at);
        const duration = Number(appointment.duration) > 0 ? Number(appointment.duration) : 60;
        const subjectName = appointment.subject ? formatSubjectName(appointment.subject) : "";
        return {
          id: appointment.id,
          examId: appointment.exam_id,
          examinerId: appointment.examiner_id,
          examinerName: examinerNames.get(appointment.examiner_id) || "Unassigned",
          subjectName: subjectName || appointment.client?.name || `Subject #${appointment.subject_id}`,
          examType: (appointment.exam_type_id && typeNames.get(appointment.exam_type_id)) || "Exam",
          status: normalizeStatus(appointment.status),
          start,
          end: new Date(start.getTime() + duration * 60_000),
          questionsPrepared: Boolean(appointment.questions_prepared),
          paymentStatus: appointment.payment_status || "",
        };
      })
      .filter((session) => !Number.isNaN(session.start.getTime()));
  }, [appointments, examiners, examTypes, examinerView, user]);

  const data = React.useMemo(() => {
    const active = sessions.filter((session) => session.status !== "cancelled");
    const open = active.filter((session) => session.status === "pending" || session.status === "confirmed");
    const today = active
      .filter((session) => isSameClinicDay(session.start, now))
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const upcoming = open
      .filter((session) => session.end > now)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const next = upcoming.find((session) => session.start > now) ?? upcoming[0] ?? null;

    const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const confirmedThisWeek = upcoming.filter((session) => session.status === "confirmed" && session.start <= weekAhead).length;
    const pendingBookings = upcoming.filter((session) => session.status === "pending").length;

    const examIds = new Set(sessions.map((session) => session.examId).filter((id): id is number => Boolean(id)));
    const unsignedReports = workflow.filter(
      (row) => row.report_exists && !row.is_locked && (!examinerView || examIds.has(row.exam_id)),
    );

    // Last five clinic months, oldest first.
    const currentMonth = monthKey(now);
    const months = Array.from({ length: 5 }, (_, index) => currentMonth - 4 + index).map((key) => ({
      key,
      label: MONTH_SHORT[key % 12],
      count: active.filter((session) => monthKey(session.start) === key).length,
    }));

    // Everything inside the selected Day / Week / Month.
    const range = periodRange(period, offset, now);
    const inRange = sessions
      .filter((session) => session.start >= range.start && session.start < range.end)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
    const rangeActive = inRange.filter((session) => session.status !== "cancelled");
    const periodStats = {
      sessions: rangeActive.length,
      completed: rangeActive.filter((session) => session.status === "completed").length,
      open: rangeActive.filter((session) => session.status === "pending" || session.status === "confirmed").length,
    };

    const todayStart = clinicMidnight(now).getTime();
    const dayCount = Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS);
    const dayBuckets: DayBucket[] = Array.from({ length: dayCount }, (_, index) => {
      const start = new Date(range.start.getTime() + index * DAY_MS);
      const end = start.getTime() + DAY_MS;
      const daySessions = rangeActive.filter((s) => s.start >= start && s.start.getTime() < end);
      const parts = utcToDubaiParts(start);
      return {
        start,
        dayOffset: Math.round((start.getTime() - todayStart) / DAY_MS),
        label:
          period === "week"
            ? new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, weekday: "short" }).format(start)
            : String(parts?.day ?? index + 1),
        isToday: start.getTime() === todayStart,
        completed: daySessions.filter((s) => s.status === "completed").length,
        confirmed: daySessions.filter((s) => s.status === "confirmed").length,
        pending: daySessions.filter((s) => s.status === "pending").length,
      };
    });

    const typeCounts = new Map<string, number>();
    for (const session of rangeActive) {
      if (session.examType === "Exam") continue;
      typeCounts.set(session.examType, (typeCounts.get(session.examType) ?? 0) + 1);
    }
    const topTypes = [...typeCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

    const totalReports = stats?.total_reports ?? 0;
    const clearCount = (stats?.ndi_count ?? 0) + (stats?.nsr_count ?? 0);
    // Rate over reports that actually have a verdict; drafts without one would drag it down.
    const decidedReports =
      clearCount + (stats?.di_count ?? 0) + (stats?.sr_count ?? 0) + (stats?.inconclusive_count ?? 0);
    const clearanceRate = decidedReports > 0 ? Math.round((clearCount / decidedReports) * 100) : null;

    return {
      totalExams: active.length,
      openExams: open.length,
      clearanceRate,
      today,
      upcoming,
      next,
      confirmedThisWeek,
      pendingBookings,
      unsignedReports,
      months,
      topTypes,
      range,
      inRange,
      rangeActive,
      periodStats,
      dayBuckets,
    };
  }, [sessions, workflow, stats, now, examinerView, period, offset]);

  const rangeLabel = formatRange(period, data.range, now);

  const firstName = user?.name?.split(" ")[0] || "there";
  const nextToday = data.today.find((session) => session.start > now && session.status !== "completed");
  const summary = isLoading
    ? "Loading today's schedule…"
    : data.today.length === 0
      ? "No sessions on the calendar today."
      : `${data.today.length} session${data.today.length === 1 ? "" : "s"} today.${nextToday ? ` The next one starts at ${formatClinicClock(nextToday.start)}.` : ""}`;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-4 pb-8">
      {/* Hero */}
      <section className="flex flex-wrap items-end justify-between gap-6 px-1 pt-2 pb-2">
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-muted-foreground text-[15px]">{formatLongDate(now)}</span>
          <h1 className="text-4xl leading-none font-normal tracking-[-0.035em] sm:text-5xl">
            {greeting(now)}, <span className="font-semibold">{firstName}</span>
          </h1>
          <span className="text-muted-foreground text-base">{summary}</span>
        </div>
        <div className="flex flex-wrap items-end gap-6 sm:gap-8">
          <HeroStat label={examinerView ? "My sessions" : "Sessions"} value={isLoading ? "–" : String(data.periodStats.sessions)} />
          <span aria-hidden="true" className="bg-border hidden h-12 w-px sm:block" />
          <HeroStat label="Completed" value={isLoading ? "–" : String(data.periodStats.completed)} />
          <span aria-hidden="true" className="bg-border hidden h-12 w-px sm:block" />
          <HeroStat label="Open" value={isLoading ? "–" : String(data.periodStats.open)} />
          <Link
            href={examinerView ? "/dashboard/calendar" : "/dashboard/calendar/book"}
            className="flex h-13 items-center gap-2.5 rounded-full bg-[#30302E] px-6 text-[15px] font-semibold text-[#FAF9F5] shadow-[0_8px_20px_-8px_rgba(48,48,46,0.6)] transition-colors hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground"
          >
            <span className="bg-primary flex size-6 items-center justify-center rounded-full text-[#1A1915]">
              {examinerView ? <CalendarDays aria-hidden="true" className="size-3.5" /> : <Plus aria-hidden="true" className="size-3.5" strokeWidth={3} />}
            </span>
            {examinerView ? "My schedule" : "New exam"}
          </Link>
        </div>
      </section>

      <PeriodControls
        period={period}
        offset={offset}
        label={rangeLabel}
        onPeriod={setPeriod}
        onStep={(step) => setOffset((value) => value + step)}
        onReset={() => setOffset(0)}
      />

      {/* Schedule + next */}
      <section className="flex flex-wrap gap-4">
        {period === "day" ? (
          <SessionsTimeline
            sessions={data.rangeActive}
            now={now}
            isLoading={isLoading}
            singleExaminer={examinerView}
            title={offset === 0 ? "Today's sessions" : `Sessions · ${rangeLabel}`}
            showNow={offset === 0}
          />
        ) : (
          <SessionsByDay
            buckets={data.dayBuckets}
            period={period}
            label={rangeLabel}
            isLoading={isLoading}
            onOpenDay={openDay}
            sessions={data.inRange}
            now={now}
            singleExaminer={examinerView}
          />
        )}
        <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-4">
          <UpNextCard session={data.next} now={now} isLoading={isLoading} />
          <AttentionList
            isLoading={isLoading}
            unsigned={data.unsignedReports.length}
            pending={data.pendingBookings}
            confirmed={data.confirmedThisWeek}
          />
        </div>
      </section>

      {/* Analytics */}
      <section className="flex flex-wrap gap-4">
        <VolumeChart months={data.months} isLoading={isLoading} />
        <VerdictDonut stats={stats} clearanceRate={data.clearanceRate} isLoading={isLoading} />
        <TopExamTypes types={data.topTypes} isLoading={isLoading} periodLabel={rangeLabel} period={period} />
      </section>

      <AppointmentsTable
        sessions={data.inRange}
        now={now}
        isLoading={isLoading}
        showExaminer={!examinerView}
        title={`Appointments · ${rangeLabel}`}
        emptyNoun={PERIOD_NOUN[period]}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function HeroStat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[13px]">{label}</span>
      <span className="text-[40px] leading-none font-medium tracking-[-0.03em] tabular-nums">
        {value}
        {suffix ? <span className="text-2xl">{suffix}</span> : null}
      </span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("bg-muted animate-pulse rounded-2xl", className)} />;
}

const BAR_STYLES: Record<"live" | SessionStatus, string> = {
  live: "border-[1.5px] border-dashed border-[#8E8B82] bg-transparent text-[#ECE9E0]",
  confirmed: "bg-primary text-[#1A1915]",
  pending: "bg-chart-2 text-[#1A1915]",
  completed: "bg-[#ECE9E0] text-[#1A1915]",
  cancelled: "hidden",
};

function SessionsTimeline({
  sessions,
  now,
  isLoading,
  singleExaminer,
  title,
  showNow: allowNow,
}: {
  sessions: Session[];
  now: Date;
  isLoading: boolean;
  singleExaminer: boolean;
  title: string;
  showNow: boolean;
}) {
  // Fit the window to the day's sessions (and "now" on today): pad an hour
  // either side and show at least 6 hours, so short sessions stay readable.
  const startMinute = (session: Session) => minutesOfDay(session.start);
  const endMinute = (session: Session) =>
    Math.min(24 * 60, startMinute(session) + Math.round((session.end.getTime() - session.start.getTime()) / 60000));
  const nowMinute = minutesOfDay(now);
  let first = Number.POSITIVE_INFINITY;
  let last = Number.NEGATIVE_INFINITY;
  for (const session of sessions) {
    first = Math.min(first, startMinute(session));
    last = Math.max(last, endMinute(session));
  }
  if (allowNow && sessions.length > 0) {
    first = Math.min(first, nowMinute);
    last = Math.max(last, nowMinute);
  }
  if (!Number.isFinite(first)) {
    first = 8 * 60;
    last = 18 * 60;
  }
  let startHour = Math.max(0, Math.floor(first / 60) - 1);
  let endHour = Math.min(24, Math.ceil(last / 60) + 1);
  while (endHour - startHour < 6 && !(startHour === 0 && endHour === 24)) {
    if (endHour < 24) endHour += 1;
    if (endHour - startHour < 6 && startHour > 0) startHour -= 1;
  }
  const hours = endHour - startHour;
  const span = hours * 60;
  const position = (minute: number) => ((minute - startHour * 60) / span) * 100;
  const labelStep = hours <= 8 ? 1 : 2;
  const hourMarks = Array.from({ length: Math.floor(hours / labelStep) + 1 }, (_, i) => startHour + i * labelStep);

  const lanes = new Map<number, { name: string; sessions: Session[] }>();
  for (const session of sessions) {
    const lane = lanes.get(session.examinerId) ?? { name: session.examinerName, sessions: [] };
    lane.sessions.push(session);
    lanes.set(session.examinerId, lane);
  }
  const laneList = [...lanes.values()];
  const laneTones = ["bg-primary", "bg-chart-2", "bg-[#ECE9E0]"];
  const laneHeight = laneList.length <= 2 ? "h-[84px]" : laneList.length <= 4 ? "h-[70px]" : "h-[58px]";

  const nowPos = position(nowMinute);
  const showNow = allowNow && nowPos >= 0 && nowPos <= 100;

  const agenda = sessions.slice(0, 6);
  const hiddenCount = sessions.length - agenda.length;

  return (
    <div className="flex min-w-0 flex-[2_1_600px] flex-col gap-5 rounded-[30px] bg-[#2B2A27] p-6 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] dark:bg-card dark:ring-1 dark:ring-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] uppercase">{title}</h2>
          <span className="text-sm text-[#C9C6BC]">
            {singleExaminer
              ? `${sessions.length} session${sessions.length === 1 ? "" : "s"} assigned to you`
              : `${laneList.length} examiner${laneList.length === 1 ? "" : "s"} · ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
          </span>
        </div>
        <Link
          href="/dashboard/calendar"
          className="flex h-10 items-center rounded-full border border-[#4A4944] px-4 text-sm text-[#FAF9F5] transition-colors hover:bg-white/5"
        >
          Open calendar
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-[84px] animate-pulse rounded-2xl bg-white/5" />
          ))}
          <div className="h-32 animate-pulse rounded-2xl bg-white/5" />
        </div>
      ) : laneList.length === 0 ? (
        <div className="flex min-h-[220px] flex-1 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#4A4944] text-center">
          <CalendarClock aria-hidden="true" className="size-6 text-[#C9C6BC]" />
          <p className="text-[15px]">{allowNow ? "No sessions scheduled today" : "No sessions scheduled this day"}</p>
          <Link href="/dashboard/calendar" className="text-sm text-[#C9C6BC] underline-offset-4 hover:underline">
            View the week ahead
          </Link>
        </div>
      ) : (
        <>
          {/* Timeline */}
          <div className="overflow-x-auto pb-1 [scrollbar-color:#4A4944_transparent] [scrollbar-width:thin]">
            <div className="flex min-w-[560px]">
              <div className="flex w-[150px] shrink-0 flex-col gap-3 pt-8">
                {laneList.map((lane, index) => (
                  <div key={lane.name + index} className={cn("flex items-center gap-2.5 pr-3", laneHeight)}>
                    <span
                      className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-[#1A1915]",
                        laneTones[index % laneTones.length],
                      )}
                    >
                      {initials(lane.name)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="line-clamp-2 text-sm leading-tight">{lane.name}</span>
                      <span className="text-xs text-[#B5B2A8]">
                        {lane.sessions.length} session{lane.sessions.length === 1 ? "" : "s"}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="relative min-w-0 flex-1">
                <div className="relative mb-4 h-4 font-mono text-xs text-[#B5B2A8]">
                  {hourMarks.map((hour, index) => (
                    <span
                      key={hour}
                      className="absolute"
                      style={{
                        left: `${((hour - startHour) / hours) * 100}%`,
                        transform:
                          index === 0
                            ? "none"
                            : index === hourMarks.length - 1 && hour === endHour
                              ? "translateX(-100%)"
                              : "translateX(-50%)",
                      }}
                    >
                      {String(hour % 24).padStart(2, "0")}:00
                    </span>
                  ))}
                </div>
                <div className="flex flex-col gap-3">
                  {laneList.map((lane, index) => (
                    <div
                      key={lane.name + index}
                      className={cn("relative rounded-2xl bg-[#34332F]/60", laneHeight)}
                      style={{
                        backgroundImage: `repeating-linear-gradient(90deg, #3A3935 0 1px, transparent 1px ${100 / hours}%)`,
                      }}
                    >
                      {lane.sessions.map((session) => {
                        const left = Math.max(0, position(startMinute(session)));
                        const width = Math.max(6, Math.min(100 - left, position(endMinute(session)) - left));
                        const tone = isLive(session, now) ? "live" : session.status;
                        return (
                          <div
                            key={session.id}
                            title={`${session.subjectName} · ${session.examType} · ${formatClinicClock(session.start)}–${formatClinicClock(session.end)}`}
                            className={cn(
                              "absolute top-1.5 bottom-1.5 flex flex-col justify-center gap-0.5 overflow-hidden rounded-xl px-3",
                              BAR_STYLES[tone],
                            )}
                            style={{ left: `${left}%`, width: `${width}%` }}
                          >
                            <span className="truncate text-[13px] leading-tight font-semibold">{session.subjectName}</span>
                            <span className="truncate font-mono text-[11px] opacity-80">
                              {formatClinicClock(session.start)}–{formatClinicClock(session.end)}
                            </span>
                            {laneList.length <= 2 ? <span className="truncate text-xs">{session.examType}</span> : null}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                {showNow ? (
                  <div aria-hidden="true" className="pointer-events-none absolute top-6 bottom-0" style={{ left: `${nowPos}%` }}>
                    <div className="absolute top-2 bottom-0 w-0.5 -translate-x-1/2 bg-[#FAF9F5]" />
                    <span className="absolute -top-1.5 -translate-x-1/2 rounded-full bg-[#FAF9F5] px-2 py-0.5 font-mono text-[11px] font-medium text-[#1A1915]">
                      {formatClinicClock(now)}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {/* Agenda: full details for every session, readable at any width */}
          <div className="flex flex-1 flex-col gap-2">
            <h3 className="text-xs font-semibold tracking-[0.1em] text-[#B5B2A8] uppercase">Agenda</h3>
            <ul className="flex flex-col gap-1.5">
              {agenda.map((session) => {
                const live = isLive(session, now);
                const done = session.status === "completed" || (!live && session.end <= now);
                return (
                  <li key={session.id}>
                    <Link
                      href="/dashboard/calendar"
                      className={cn(
                        "flex items-center gap-4 rounded-2xl px-4 py-3 transition-colors hover:bg-white/[0.07]",
                        live ? "bg-white/[0.06] ring-1 ring-[#8E8B82]/60" : "bg-white/[0.03]",
                      )}
                    >
                      <span
                        className={cn(
                          "w-[92px] shrink-0 font-mono text-[13px] tabular-nums",
                          done ? "text-[#8E8B82]" : "text-[#FAF9F5]",
                        )}
                      >
                        {formatClinicClock(session.start)}–{formatClinicClock(session.end)}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-8 w-1 shrink-0 rounded-full",
                          live
                            ? "bg-[#FAF9F5]"
                            : session.status === "confirmed"
                              ? "bg-primary"
                              : session.status === "pending"
                                ? "bg-chart-2"
                                : "bg-[#ECE9E0]",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={cn("truncate text-[15px] font-medium", done && "text-[#C9C6BC]")}>
                          {session.subjectName}
                        </span>
                        <span className="truncate text-[13px] text-[#B5B2A8]">
                          {session.examType}
                          {singleExaminer ? "" : ` · ${session.examinerName}`}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:inline-flex",
                          live
                            ? "bg-[#FAF9F5] text-[#1A1915]"
                            : session.status === "confirmed"
                              ? "bg-primary/20 text-[#F2C6B4]"
                              : session.status === "pending"
                                ? "bg-chart-2/20 text-[#D9D0FB]"
                                : "bg-white/10 text-[#C9C6BC]",
                        )}
                      >
                        {live ? "In progress" : STATUS_CHIP[session.status].label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {hiddenCount > 0 ? (
              <Link
                href="/dashboard/calendar"
                className="self-start px-1 text-[13px] text-[#C9C6BC] underline-offset-4 hover:underline"
              >
                +{hiddenCount} more in the calendar
              </Link>
            ) : null}
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-5 text-[13px] text-[#C9C6BC]">
        <LegendSwatch className="bg-primary" label="Confirmed" />
        <LegendSwatch className="bg-chart-2" label="Pending" />
        <LegendSwatch className="bg-[#ECE9E0]" label="Completed" />
        <LegendSwatch className="border-[1.5px] border-dashed border-[#8E8B82]" label="In progress" />
      </div>
    </div>
  );
}

function PeriodControls({
  period,
  offset,
  label,
  onPeriod,
  onStep,
  onReset,
}: {
  period: Period;
  offset: number;
  label: string;
  onPeriod: (period: Period) => void;
  onStep: (step: number) => void;
  onReset: () => void;
}) {
  const options: { id: Period; label: string }[] = [
    { id: "day", label: "Day" },
    { id: "week", label: "Week" },
    { id: "month", label: "Month" },
  ];
  const noun = PERIOD_NOUN[period];
  const stepButton =
    "flex size-10 items-center justify-center rounded-full bg-white text-[#3D3929] ring-1 ring-border/50 transition-colors hover:bg-[#FAF9F5] dark:bg-card dark:text-foreground";

  return (
    <div className="flex flex-wrap items-center gap-3 px-1">
      <div role="group" aria-label="Dashboard period" className="flex gap-1 rounded-full bg-[#E9E6DD] p-1 dark:bg-muted">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={period === option.id}
            onClick={() => onPeriod(option.id)}
            className={cn(
              "h-9 rounded-full px-4 text-sm transition-colors",
              period === option.id
                ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(40,36,20,0.08)] dark:bg-card"
                : "text-[#3D3929] hover:text-foreground dark:text-muted-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Previous ${noun}`} onClick={() => onStep(-1)} className={stepButton}>
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <span aria-live="polite" className="min-w-[180px] text-center text-[15px] font-medium tabular-nums">
          {label}
        </span>
        <button type="button" aria-label={`Next ${noun}`} onClick={() => onStep(1)} className={stepButton}>
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      {offset !== 0 ? (
        <button
          type="button"
          onClick={onReset}
          className="h-10 rounded-full px-4 text-sm font-medium text-[oklch(0.45_0.12_39)] transition-colors hover:bg-primary/10 dark:text-primary"
        >
          Back to {period === "day" ? "today" : `this ${noun}`}
        </button>
      ) : null}
    </div>
  );
}

function SessionsByDay({
  buckets,
  period,
  label,
  isLoading,
  onOpenDay,
  sessions,
  now,
  singleExaminer,
}: {
  buckets: DayBucket[];
  period: Period;
  label: string;
  isLoading: boolean;
  onOpenDay: (dayOffset: number) => void;
  sessions: Session[];
  now: Date;
  singleExaminer: boolean;
}) {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const summary = [
    { label: "Completed", value: active.filter((s) => s.status === "completed").length },
    { label: "Still to come", value: active.filter((s) => s.status !== "completed" && s.end > now).length },
    { label: "Cancelled", value: sessions.length - active.length },
  ];

  // Breakdown: by examiner for staff, by exam type for an examiner's own view.
  const groups = new Map<string, { completed: number; confirmed: number; pending: number }>();
  for (const s of active) {
    const key = singleExaminer ? s.examType : s.examinerName;
    const group = groups.get(key) ?? { completed: 0, confirmed: 0, pending: 0 };
    if (s.status === "completed") group.completed += 1;
    else if (s.status === "confirmed") group.confirmed += 1;
    else group.pending += 1;
    groups.set(key, group);
  }
  const breakdown = [...groups.entries()]
    .map(([name, g]) => ({ name, ...g, total: g.completed + g.confirmed + g.pending }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  const breakdownMax = Math.max(1, ...breakdown.map((row) => row.total));
  const max = Math.max(1, ...buckets.map((b) => b.completed + b.confirmed + b.pending));
  const total = buckets.reduce((sum, b) => sum + b.completed + b.confirmed + b.pending, 0);
  const busiest = buckets.reduce<DayBucket | null>((best, b) => {
    const count = b.completed + b.confirmed + b.pending;
    return count > 0 && (!best || count > best.completed + best.confirmed + best.pending) ? b : best;
  }, null);
  const chartHeight = 180;
  const isMonth = period === "month";

  return (
    <div className="flex min-w-0 flex-[2_1_600px] flex-col gap-5 rounded-[30px] bg-[#2B2A27] p-6 text-[#FAF9F5] shadow-[0_20px_40px_-24px_rgba(20,20,19,0.6)] dark:bg-card dark:ring-1 dark:ring-border">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-[13px] font-semibold tracking-[0.1em] uppercase">Sessions by day</h2>
          <span className="text-sm text-[#C9C6BC]">
            {isLoading
              ? label
              : `${total} session${total === 1 ? "" : "s"} · ${label}${busiest ? ` · busiest ${new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, weekday: "short", day: "numeric" }).format(busiest.start)}` : ""}`}
          </span>
        </div>
        <Link
          href="/dashboard/calendar"
          className="flex h-10 items-center rounded-full border border-[#4A4944] px-4 text-sm text-[#FAF9F5] transition-colors hover:bg-white/5"
        >
          Open calendar
        </Link>
      </div>

      {isLoading ? (
        <div className="h-[230px] animate-pulse rounded-2xl bg-white/5" />
      ) : (
        <div className="overflow-x-auto [scrollbar-color:#4A4944_transparent] [scrollbar-width:thin] sm:overflow-visible">
          <div
            className={cn("flex items-end", isMonth ? "min-w-[440px] gap-0.5 sm:min-w-0" : "min-w-[360px] gap-3 sm:min-w-0")}
            style={{ height: chartHeight + 64 }}
          >
            {buckets.map((bucket, index) => {
              const count = bucket.completed + bucket.confirmed + bucket.pending;
              const showLabel = !isMonth || index === 0 || bucket.isToday || (index + 1) % 5 === 0;
              const dateText = new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(bucket.start);
              const segment = (value: number) => (value / max) * chartHeight;
              return (
                <button
                  key={bucket.start.toISOString()}
                  type="button"
                  onClick={() => onOpenDay(bucket.dayOffset)}
                  aria-label={`${dateText}: ${count} session${count === 1 ? "" : "s"} (${bucket.completed} completed, ${bucket.confirmed} confirmed, ${bucket.pending} pending). Open day view.`}
                  className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2 rounded-xl pt-1 transition-colors hover:bg-white/5"
                >
                  {!isMonth || count > 0 ? (
                    <span className={cn("font-mono text-xs tabular-nums", count === 0 ? "text-[#8E8B82]" : "text-[#FAF9F5]")}>{count}</span>
                  ) : null}
                  <span
                    className={cn("flex w-full flex-col-reverse overflow-hidden", isMonth ? "max-w-5 rounded-md" : "max-w-14 rounded-xl")}
                    style={{ height: Math.max(count > 0 ? 6 : 3, segment(count)) }}
                  >
                    {count === 0 ? <span className="h-full w-full bg-[#3A3935]" /> : null}
                    {bucket.completed > 0 ? <span className="w-full bg-[#ECE9E0]" style={{ height: segment(bucket.completed) }} /> : null}
                    {bucket.confirmed > 0 ? <span className="bg-primary w-full" style={{ height: segment(bucket.confirmed) }} /> : null}
                    {bucket.pending > 0 ? <span className="bg-chart-2 w-full" style={{ height: segment(bucket.pending) }} /> : null}
                  </span>
                  <span
                    className={cn(
                      "flex h-5 items-center rounded-full px-1.5 text-xs",
                      bucket.isToday ? "bg-[#FAF9F5] font-semibold text-[#1A1915]" : "text-[#B5B2A8]",
                      !showLabel && "invisible",
                    )}
                  >
                    {bucket.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-5 text-[13px] text-[#C9C6BC]">
        <LegendSwatch className="bg-primary" label="Confirmed" />
        <LegendSwatch className="bg-chart-2" label="Pending" />
        <LegendSwatch className="bg-[#ECE9E0]" label="Completed" />
        <span className="text-[#8E8B82]">Select a day to see its timeline</span>
      </div>

      {!isLoading ? (
        <div className="flex flex-1 flex-col gap-5 border-t border-[#3A3935] pt-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {summary.map((item) => (
              <div key={item.label} className="flex flex-col gap-1 rounded-2xl bg-white/[0.04] px-4 py-3">
                <span className="text-xs text-[#B5B2A8]">{item.label}</span>
                <span className="text-2xl font-medium tabular-nums">{item.value}</span>
              </div>
            ))}
            <div className="flex flex-col gap-1 rounded-2xl bg-white/[0.04] px-4 py-3">
              <span className="text-xs text-[#B5B2A8]">Busiest day</span>
              <span className="truncate text-2xl font-medium">
                {busiest
                  ? new Intl.DateTimeFormat("en-GB", { timeZone: CLINIC_TIMEZONE, weekday: "short", day: "numeric" }).format(busiest.start)
                  : "–"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold tracking-[0.1em] text-[#B5B2A8] uppercase">
              {singleExaminer ? "By exam type" : "By examiner"}
            </h3>
            {breakdown.length === 0 ? (
              <p className="text-sm text-[#B5B2A8]">No sessions this {PERIOD_NOUN[period]}.</p>
            ) : (
              <ul className="flex flex-col gap-3">
                {breakdown.map((row) => (
                  <li key={row.name} className="grid grid-cols-[minmax(0,160px)_1fr_auto] items-center gap-4">
                    <span className="truncate text-sm">{row.name}</span>
                    <span
                      role="img"
                      aria-label={`${row.name}: ${row.completed} completed, ${row.confirmed} confirmed, ${row.pending} pending`}
                      className="flex h-2.5 overflow-hidden rounded-full bg-[#3A3935]"
                    >
                      <span className="flex h-full" style={{ width: `${(row.total / breakdownMax) * 100}%` }}>
                        <span className="h-full bg-[#ECE9E0]" style={{ flexGrow: row.completed }} />
                        <span className="bg-primary h-full" style={{ flexGrow: row.confirmed }} />
                        <span className="bg-chart-2 h-full" style={{ flexGrow: row.pending }} />
                      </span>
                    </span>
                    <span className="font-mono text-sm tabular-nums">{row.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function LegendSwatch({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className={cn("box-border size-2.5 rounded-[3px]", className)} />
      {label}
    </span>
  );
}

function UpNextCard({ session, now, isLoading }: { session: Session | null; now: Date; isLoading: boolean }) {
  return (
    <div className={cn(CARD, "flex flex-col gap-4.5 p-6")}>
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold tracking-[0.1em] uppercase">Up next</span>
        {session ? (
          <span className="bg-primary/12 rounded-full px-2.5 py-1 text-[13px] font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">
            {isLive(session, now) ? "In progress" : formatCountdown(session.start, now)}
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : !session ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-[15px]">Nothing booked yet. New bookings will show up here.</p>
          <Link href="/dashboard/calendar/book" className={cn(PRIMARY_BUTTON, "flex h-12 items-center justify-center rounded-full text-[15px] font-semibold")}>
            Book an exam
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground font-mono text-[15px]">
              {formatDayLabel(session.start, now)} · {formatClinicClock(session.start)} – {formatClinicClock(session.end)}
            </span>
            <span className="truncate text-[28px] font-medium tracking-[-0.02em]">{session.subjectName}</span>
            <span className="text-muted-foreground text-[15px]">{session.examType}</span>
          </div>
          <div className="flex flex-wrap gap-2 text-[13px]">
            <span className="bg-muted flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-1.5">
              <span className="bg-secondary flex size-[18px] items-center justify-center rounded-full text-[9px] font-semibold">
                {initials(session.examinerName)}
              </span>
              {session.examinerName}
            </span>
            <StatusChip status={session.status} />
            {session.questionsPrepared ? (
              <span className="rounded-full bg-[#E7F1E4] px-2.5 py-1.5 font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">
                Questions ready
              </span>
            ) : (
              <span className="bg-muted text-muted-foreground rounded-full px-2.5 py-1.5">Questions not prepared</span>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/exams" className={cn(PRIMARY_BUTTON, "flex h-12 flex-1 items-center justify-center rounded-full text-[15px] font-semibold")}>
              Start exam
            </Link>
            <Link
              href="/dashboard/calendar"
              className="bg-card hover:bg-muted flex h-12 flex-1 items-center justify-center rounded-full border text-[15px] font-medium transition-colors"
            >
              Reschedule
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function AttentionList({
  isLoading,
  unsigned,
  pending,
  confirmed,
}: {
  isLoading: boolean;
  unsigned: number;
  pending: number;
  confirmed: number;
}) {
  const items = [
    {
      label: "Reports to sign",
      hint: "Unlocked drafts",
      value: unsigned,
      href: "/dashboard/reports",
      icon: FileSignature,
      tone: "bg-chart-2/15 text-[oklch(0.42_0.14_290)] dark:text-chart-2",
    },
    {
      label: "Bookings to confirm",
      hint: "Waiting on client",
      value: pending,
      href: "/dashboard/calendar",
      icon: CalendarClock,
      tone: "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary",
    },
    {
      label: "Confirmed this week",
      hint: "Ready to conduct",
      value: confirmed,
      href: "/dashboard/calendar",
      icon: CalendarCheck2,
      tone: "bg-muted text-foreground",
    },
  ];

  return (
    <div className={cn(CARD, "flex flex-col p-2.5")}>
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.label} href={item.href} className="hover:bg-muted/60 flex items-center gap-3.5 rounded-[20px] px-3.5 py-3 transition-colors">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-[14px]", item.tone)}>
              <Icon aria-hidden="true" className="size-[18px]" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[15px] font-medium">{item.label}</span>
              <span className="text-muted-foreground text-[13px]">{item.hint}</span>
            </span>
            <span className="text-[22px] font-medium tabular-nums">{isLoading ? "–" : item.value}</span>
          </Link>
        );
      })}
    </div>
  );
}

function VolumeChart({ months, isLoading }: { months: { key: number; label: string; count: number }[]; isLoading: boolean }) {
  const width = 460;
  const top = 21;
  const bottom = 170;
  const max = Math.max(1, ...months.map((month) => month.count));
  const step = (width - 40) / Math.max(1, months.length - 1);
  const points = months.map((month, index) => ({
    x: 20 + index * step,
    y: bottom - (month.count / max) * (bottom - top),
    ...month,
  }));

  const segment = (from: (typeof points)[number], to: (typeof points)[number]) => {
    const mid = (to.x - from.x) / 2;
    return `C${from.x + mid},${from.y} ${to.x - mid},${to.y} ${to.x},${to.y}`;
  };
  const complete = points.slice(0, -1);
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  const solidPath = complete.length
    ? `M${complete[0].x},${complete[0].y} ${complete.slice(1).map((p, i) => segment(complete[i], p)).join(" ")}`
    : "";
  const areaPath = complete.length > 1 ? `${solidPath} L${complete[complete.length - 1].x},${bottom} L${complete[0].x},${bottom} Z` : "";
  const dashedPath = previous && current ? `M${previous.x},${previous.y} ${segment(previous, current)}` : "";

  // Headline: the last complete month vs the one before it.
  const latest = months[months.length - 2];
  const before = months[months.length - 3];
  const change = latest && before && before.count > 0 ? Math.round(((latest.count - before.count) / before.count) * 100) : null;

  const [hovered, setHovered] = React.useState<number | null>(null);
  const hoverPoint = hovered !== null ? points[hovered] : null;
  const hoverPrev = hovered !== null && hovered > 0 ? points[hovered - 1] : null;
  const hoverChange =
    hoverPoint && hoverPrev && hoverPrev.count > 0 ? Math.round(((hoverPoint.count - hoverPrev.count) / hoverPrev.count) * 100) : null;
  const hoverIsCurrent = hovered !== null && hovered === points.length - 1;

  return (
    <div className={cn(CARD, "flex min-w-0 flex-[5_1_420px] flex-col gap-4 p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Exam volume</h2>
          <span className="text-muted-foreground text-[13px]">Sessions booked per month</span>
        </div>
        {latest ? (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums">{isLoading ? "–" : latest.count}</span>
            {change !== null && !isLoading ? (
              <span className={cn("text-[13px] font-medium", change >= 0 ? "text-[#2D5A27] dark:text-emerald-400" : "text-[oklch(0.45_0.12_39)] dark:text-primary")}>
                {latest.label} · {change >= 0 ? "up" : "down"} {Math.abs(change)}% on {before?.label}
              </span>
            ) : (
              <span className="text-muted-foreground text-[13px]">{latest.label}</span>
            )}
          </div>
        ) : null}
      </div>
      {isLoading ? (
        <Skeleton className="h-[180px] w-full" />
      ) : (
        <div className="relative" onMouseLeave={() => setHovered(null)}>
        <svg
          role="img"
          aria-label={`Sessions per month: ${months.map((m, i) => `${m.label} ${m.count}${i === months.length - 1 ? " so far" : ""}`).join(", ")}`}
          viewBox={`0 0 ${width} 200`}
          className="block h-auto w-full"
        >
          {hoverPoint ? (
            <line
              x1={hoverPoint.x}
              x2={hoverPoint.x}
              y1={top - 6}
              y2={bottom}
              className="stroke-foreground/25"
              strokeWidth={1.5}
              strokeDasharray="3 4"
            />
          ) : null}
          <line x1="0" x2={width} y1={top} y2={top} className="stroke-border/60" />
          <line x1="0" x2={width} y1={(top + bottom) / 2} y2={(top + bottom) / 2} className="stroke-border/60" />
          <line x1="0" x2={width} y1={bottom} y2={bottom} className="stroke-border" />
          {areaPath ? <path d={areaPath} className="fill-primary/15" /> : null}
          {solidPath ? <path d={solidPath} fill="none" className="stroke-primary" strokeWidth={3} strokeLinecap="round" /> : null}
          {dashedPath ? <path d={dashedPath} fill="none" className="stroke-primary" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 7" /> : null}
          {points.map((point, index) => {
            const highlighted = index === points.length - 2;
            return (
              <circle
                key={point.key}
                cx={point.x}
                cy={point.y}
                r={highlighted ? 7 : 5}
                strokeWidth={3}
                className={highlighted ? "fill-primary stroke-card" : "fill-card stroke-primary"}
              />
            );
          })}
          {points.map((point, index) => (
            <text
              key={`label-${point.key}`}
              x={point.x}
              y={194}
              textAnchor="middle"
              fontSize={13}
              className={index === points.length - 2 ? "fill-foreground font-semibold" : "fill-muted-foreground"}
            >
              {point.label}
              {index === points.length - 1 ? "*" : ""}
            </text>
          ))}
          {/* Hit columns: wider than the dots so hovering anywhere in a month's slot works. */}
          {points.map((point, index) => (
            <rect
              key={`hit-${point.key}`}
              x={point.x - step / 2}
              y={0}
              width={step}
              height={200}
              fill="transparent"
              onMouseEnter={() => setHovered(index)}
            />
          ))}
        </svg>
        {hoverPoint ? (
          <div
            role="status"
            className="bg-popover text-popover-foreground ring-border/60 pointer-events-none absolute z-10 min-w-[150px] rounded-2xl px-3.5 py-2.5 shadow-lg ring-1"
            style={{
              left: `${(hoverPoint.x / width) * 100}%`,
              top: `calc(${(hoverPoint.y / 200) * 100}% - 14px)`,
              transform: `translate(${hovered === 0 ? "-12%" : hoverIsCurrent ? "-88%" : "-50%"}, -100%)`,
            }}
          >
            <p className="text-muted-foreground text-xs">
              {hoverPoint.label}
              {hoverIsCurrent ? " · month to date" : ""}
            </p>
            <p className="text-lg leading-tight font-medium tabular-nums">
              {hoverPoint.count} {hoverPoint.count === 1 ? "session" : "sessions"}
            </p>
            {hoverPrev ? (
              <p className="text-muted-foreground text-xs tabular-nums">
                {hoverChange === null
                  ? `${hoverPrev.label}: ${hoverPrev.count}`
                  : `${hoverChange >= 0 ? "+" : "−"}${Math.abs(hoverChange)}% vs ${hoverPrev.label} (${hoverPrev.count})`}
              </p>
            ) : null}
          </div>
        ) : null}
        </div>
      )}
      <span className="text-muted-foreground text-xs">
        *{current?.label ?? "This month"} is month to date{current && !isLoading ? ` (${current.count} so far)` : ""}
      </span>
    </div>
  );
}

function VerdictDonut({
  stats,
  clearanceRate,
  isLoading,
}: {
  stats: ConsolidatedReportStats | null;
  clearanceRate: number | null;
  isLoading: boolean;
}) {
  const total = stats?.total_reports ?? 0;
  const segments = [
    { code: "NDI", label: "No deception", value: stats?.ndi_count ?? 0, stroke: "stroke-primary", dot: "bg-primary" },
    { code: "DI", label: "Deception", value: stats?.di_count ?? 0, stroke: "stroke-[#30302E] dark:stroke-foreground", dot: "bg-[#30302E] dark:bg-foreground" },
    { code: "NSR", label: "No sig. response", value: stats?.nsr_count ?? 0, stroke: "stroke-chart-2", dot: "bg-chart-2" },
    { code: "SR", label: "Sig. response", value: stats?.sr_count ?? 0, stroke: "stroke-[#5B4BB0]", dot: "bg-[#5B4BB0]" },
    { code: "", label: "Inconclusive", value: stats?.inconclusive_count ?? 0, stroke: "stroke-[#A8A496] dark:stroke-zinc-500", dot: "bg-[#A8A496] dark:bg-zinc-500" },
  ];
  // Reports without a verdict yet (mostly drafts). Shown explicitly so the ring and legend add up to the total.
  const decided = segments.reduce((sum, s) => sum + s.value, 0);
  const pending = Math.max(0, total - decided);
  if (pending > 0) {
    segments.push({
      code: "",
      label: "No verdict yet",
      value: pending,
      stroke: "stroke-[#E4E0D5] dark:stroke-zinc-700",
      dot: "bg-[#E4E0D5] dark:bg-zinc-700",
    });
  }
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
  let offset = 0;

  const [active, setActive] = React.useState<string | null>(null);
  const [cursor, setCursor] = React.useState<{ x: number; y: number } | null>(null);
  const activeSegment = segments.find((s) => s.label === active) ?? null;
  const share = (value: number) => (total > 0 ? Math.round((value / total) * 1000) / 10 : 0);
  const describe = (s: (typeof segments)[number]) =>
    s.label === "No verdict yet"
      ? "Reports still in draft without an outcome"
      : s.code === "NDI" || s.code === "NSR"
        ? "Counts toward the clearance rate"
        : decided > 0
          ? `${Math.round((s.value / decided) * 100)}% of reports with a verdict`
          : "";

  return (
    <div className={cn(CARD, "flex min-w-0 flex-[4_1_340px] flex-col gap-4 p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Report verdicts</h2>
          <span className="text-muted-foreground text-[13px]">All time · signed and draft</span>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-[28px] leading-none font-medium tracking-[-0.02em] tabular-nums">
            {isLoading || clearanceRate === null ? "–" : `${clearanceRate}%`}
          </span>
          <span className="text-muted-foreground text-[13px]">Clearance rate</span>
          {!isLoading && decided > 0 ? (
            <span className="text-muted-foreground text-[11px] tabular-nums">of {decided} with a verdict</span>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-6">
        <div
          className="relative size-[150px] shrink-0"
          onMouseMove={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            setCursor({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          }}
          onMouseLeave={() => {
            setActive(null);
            setCursor(null);
          }}
        >
          {isLoading ? (
            <Skeleton className="size-[150px] rounded-full" />
          ) : (
            <svg
              role="img"
              aria-label={`Verdicts: ${segments.map((s) => `${s.code || s.label} ${s.value}`).join(", ")}`}
              viewBox="0 0 140 140"
              className="size-[150px] -rotate-90"
            >
              {total === 0 ? <circle cx="70" cy="70" r={radius} fill="none" strokeWidth={18} className="stroke-muted" /> : null}
              {total > 0
                ? segments.map((segment) => {
                    const length = (segment.value / total) * circumference;
                    const dash = Math.max(0, length - gap);
                    const element = (
                      <circle
                        key={segment.label}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="none"
                        strokeWidth={active === segment.label ? 22 : 18}
                        className={cn(
                          segment.stroke,
                          "cursor-pointer transition-[opacity,stroke-width] duration-150",
                          active && active !== segment.label && "opacity-35",
                        )}
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={-offset}
                        onMouseEnter={() => setActive(segment.label)}
                      />
                    );
                    offset += length;
                    return segment.value > 0 ? element : null;
                  })
                : null}
            </svg>
          )}
          {!isLoading ? (
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl leading-none font-medium tracking-[-0.02em] tabular-nums">
                {activeSegment ? `${share(activeSegment.value)}%` : total}
              </span>
              <span className="text-muted-foreground text-xs">{activeSegment ? activeSegment.code || activeSegment.label : "reports"}</span>
            </div>
          ) : null}
          {activeSegment && cursor ? (
            <div
              role="status"
              className="bg-popover text-popover-foreground ring-border/60 pointer-events-none absolute z-20 w-[200px] rounded-2xl px-3.5 py-2.5 shadow-lg ring-1"
              style={{ left: cursor.x + 14, top: cursor.y + 14 }}
            >
              <p className="flex items-center gap-2 text-xs font-medium">
                <span aria-hidden="true" className={cn("size-2 rounded-full", activeSegment.dot)} />
                {activeSegment.code ? `${activeSegment.code} · ` : ""}
                {activeSegment.label}
              </p>
              <p className="mt-0.5 text-lg leading-tight font-medium tabular-nums">
                {activeSegment.value} <span className="text-muted-foreground text-sm font-normal">of {total} · {share(activeSegment.value)}%</span>
              </p>
              {describe(activeSegment) ? <p className="text-muted-foreground mt-0.5 text-xs">{describe(activeSegment)}</p> : null}
            </div>
          ) : null}
        </div>
        <ul className="flex min-w-[140px] flex-1 flex-col gap-1 text-sm" onMouseLeave={() => setActive(null)}>
          {segments.map((segment) => (
            <li
              key={segment.label}
              onMouseEnter={() => setActive(segment.label)}
              className={cn(
                "-mx-2 flex items-center gap-2.5 rounded-lg px-2 py-1 transition-colors",
                active === segment.label && "bg-muted/60",
                active && active !== segment.label && "opacity-60",
              )}
            >
              <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", segment.dot)} />
              <span className="flex-1">
                {segment.code ? <b className="font-semibold">{segment.code} </b> : null}
                {segment.label}
              </span>
              {active === segment.label && !isLoading ? (
                <span className="text-muted-foreground text-xs tabular-nums">{share(segment.value)}%</span>
              ) : null}
              <span className="font-mono tabular-nums">{isLoading ? "–" : segment.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function TopExamTypes({
  types,
  isLoading,
  periodLabel,
  period,
}: {
  types: [string, number][];
  isLoading: boolean;
  periodLabel: string;
  period: Period;
}) {
  const max = Math.max(1, ...types.map(([, count]) => count));
  return (
    <div className="bg-primary/10 flex min-w-0 flex-[3_1_280px] flex-col gap-4 rounded-[28px] p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-base font-semibold">Top exam types</h2>
          <span className="text-muted-foreground truncate text-[13px]">{periodLabel}</span>
        </div>
        <Link href="/dashboard/settings" className="text-[13px] font-semibold text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
          Manage types
        </Link>
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="bg-card/70 h-8 w-full" />
          ))}
        </div>
      ) : types.length === 0 ? (
        <p className="text-muted-foreground text-sm">No typed sessions this {PERIOD_NOUN[period]}.</p>
      ) : (
        <ul className="flex flex-col gap-3.5 text-sm">
          {types.map(([name, count]) => (
            <li key={name} className="flex flex-col gap-1.5">
              <div className="flex justify-between gap-3">
                <span className="truncate">{name}</span>
                <span className="font-mono tabular-nums">{count}</span>
              </div>
              <div className="bg-card h-2 rounded-full">
                <div className="h-full rounded-full bg-[oklch(0.53_0.13_39)] dark:bg-primary" style={{ width: `${Math.max(4, (count / max) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_CHIP: Record<SessionStatus, { label: string; chip: string; dot: string }> = {
  confirmed: { label: "Confirmed", chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
  pending: { label: "Pending", chip: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary", dot: "bg-primary" },
  completed: { label: "Completed", chip: "bg-muted text-foreground", dot: "bg-foreground/50" },
  cancelled: { label: "Cancelled", chip: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

function StatusChip({ status }: { status: SessionStatus }) {
  const style = STATUS_CHIP[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium", style.chip)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {style.label}
    </span>
  );
}

type TableFilter = "all" | "confirmed" | "pending" | "completed";

function AppointmentsTable({
  sessions,
  now,
  isLoading,
  showExaminer,
  title,
  emptyNoun,
}: {
  sessions: Session[];
  now: Date;
  isLoading: boolean;
  showExaminer: boolean;
  title: string;
  emptyNoun: string;
}) {
  const [filter, setFilter] = React.useState<TableFilter>("all");
  const filtered = sessions.filter((session) => filter === "all" || session.status === filter);
  const rows = filtered.slice(0, 10);
  const filters: { id: TableFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "confirmed", label: "Confirmed" },
    { id: "pending", label: "Pending" },
    { id: "completed", label: "Completed" },
  ];

  return (
    <section className={cn(CARD, "flex flex-col gap-3 p-6")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="bg-muted rounded-full px-2.5 py-0.5 text-[13px] font-semibold tabular-nums">{isLoading ? "–" : sessions.length}</span>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter appointments">
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                "h-9 rounded-full px-3.5 text-[13px] transition-colors",
                filter === item.id
                  ? "bg-[#30302E] font-semibold text-[#FAF9F5] dark:bg-foreground dark:text-background"
                  : "bg-card hover:bg-muted border",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr className="text-muted-foreground text-left text-[13px]">
              <th className="px-3.5 py-2.5 font-medium">When</th>
              <th className="px-3.5 py-2.5 font-medium">Subject</th>
              <th className="px-3.5 py-2.5 font-medium">Exam type</th>
              {showExaminer ? <th className="px-3.5 py-2.5 font-medium">Examiner</th> : null}
              <th className="px-3.5 py-2.5 font-medium">Status</th>
              <th className="relative px-3.5 py-2.5">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [0, 1, 2].map((i) => (
                <tr key={i}>
                  <td colSpan={showExaminer ? 6 : 5} className="border-t px-3.5 py-3">
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={showExaminer ? 6 : 5} className="text-muted-foreground border-t px-3.5 py-8 text-center">
                  No {filter === "all" ? "" : `${filter} `}appointments this {emptyNoun}.
                </td>
              </tr>
            ) : (
              rows.map((session) => (
                <tr key={session.id} className="hover:bg-muted/40 transition-colors">
                  <td className="border-t px-3.5 py-3.5 whitespace-nowrap">
                    <span className="font-mono">{formatClinicClock(session.start)}</span>{" "}
                    <span className="text-muted-foreground">{formatDayLabel(session.start, now)}</span>
                  </td>
                  <td className="border-t px-3.5 py-3.5 font-medium">{session.subjectName}</td>
                  <td className="border-t px-3.5 py-3.5">{session.examType}</td>
                  {showExaminer ? <td className="border-t px-3.5 py-3.5">{session.examinerName}</td> : null}
                  <td className="border-t px-3.5 py-3.5">
                    <StatusChip status={isLive(session, now) ? "confirmed" : session.status} />
                  </td>
                  <td className="border-t px-3.5 py-3.5 text-right">
                    <Link href="/dashboard/calendar" className="text-[13px] font-semibold hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {!isLoading && filtered.length > rows.length ? (
        <Link href="/dashboard/calendar" className="text-muted-foreground self-start px-3.5 text-[13px] font-medium hover:underline">
          View all {filtered.length} in the calendar
        </Link>
      ) : null}
    </section>
  );
}
