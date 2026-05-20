"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  ShieldCheck,
  Siren,
  TrendingUp,
  Users,
} from "lucide-react";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchSubjects, type SubjectRecord } from "@/lib/subjects";
import { fetchLeads, type LeadRecord } from "@/lib/leads";
import { fetchAuditLogs, type AuditLogRecord } from "@/lib/audit-logs";
import { fetchExaminers, type UserRecord } from "@/lib/users";

type DashboardExam = {
  id: number;
  code: string;
  label: string;
  subject: string;
  owner: string;
  status: "Pending" | "Confirmed" | "Completed" | "Cancelled";
  payment: "Paid" | "Partial" | "Unpaid";
  durationMinutes: number;
  scheduledAt: Date;
};

type CaseMixSegment = {
  label: string;
  value: number;
  tone: string;
};

const caseMixTones = [
  "bg-[color:var(--color-chart-1)]",
  "bg-[color:var(--color-chart-2)]",
  "bg-[color:var(--color-chart-5)]",
  "bg-foreground/35",
];

const quickActions = [
  { title: "Start New Exam", description: "Open intake and assign examiner", href: "/dashboard/calendar/book", icon: Activity },
  { title: "Register Subject", description: "Create subject record and upload ID", href: "/dashboard/clients/new", icon: Users },
  { title: "View Audit Logs", description: "Review access history and security events", href: "/dashboard/settings/audit", icon: ShieldCheck },
] as const;

function toStartOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(date.getDate() + days);
  return next;
}

function isSameDay(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function formatDelta(current: number, previous: number, suffix: string) {
  if (previous === 0) {
    if (current === 0) {
      return `No change ${suffix}`;
    }
    return `+${current} ${suffix}`;
  }

  const delta = current - previous;
  if (delta === 0) {
    return `No change ${suffix}`;
  }

  return `${delta > 0 ? "+" : ""}${delta} ${suffix}`;
}

function getMonthCount<T>(items: T[], getDate: (item: T) => Date | null, monthOffset = 0): number {
  const now = new Date();
  const targetMonth = now.getMonth() + monthOffset;
  const targetYear = now.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  return items.filter((item) => {
    const date = getDate(item);
    if (!date) {
      return false;
    }

    return date.getFullYear() === targetYear && date.getMonth() === normalizedMonth;
  }).length;
}

function buildChart(values: readonly number[]) {
  const width = 320;
  const height = 120;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;

  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const y = height - ((value - min) / range) * (height - 16) - 8;
    return `${x},${y}`;
  });

  return {
    line: points.join(" "),
    area: `M 0,${height} L ${points.join(" L ")} L ${width},${height} Z`,
  };
}

function parseNotes(notes: string): { title: string; reason: string } {
  const lines = (notes || "").split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.length === 0) {
    return { title: "Appointment", reason: "No case background provided." };
  }
  if (lines.length === 1) {
    return { title: lines[0], reason: lines[0] };
  }
  return { title: lines[0], reason: lines.slice(1).join(" ") };
}

function normalizeStatus(value?: string): DashboardExam["status"] {
  const status = (value || "pending").toLowerCase();
  if (status === "confirmed") return "Confirmed";
  if (status === "completed") return "Completed";
  if (status === "cancelled") return "Cancelled";
  return "Pending";
}

function normalizePaymentStatus(value?: string): DashboardExam["payment"] {
  const payment = (value || "Unpaid").toLowerCase();
  if (payment === "paid") return "Paid";
  if (payment === "partial" || payment === "deposit") return "Partial";
  return "Unpaid";
}

function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
}

function formatExamWindow(status: DashboardExam["status"], scheduledAt: Date) {
  if (status === "Completed") {
    const diffMs = Date.now() - scheduledAt.getTime();
    const hours = Math.max(1, Math.round(diffMs / (1000 * 60 * 60)));
    return `Completed ${hours}h ago`;
  }

  const now = new Date();
  if (isSameDay(scheduledAt, now)) {
    return `Interview at ${scheduledAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }

  const tomorrow = addDays(toStartOfDay(now), 1);
  if (isSameDay(scheduledAt, tomorrow)) {
    return `Tomorrow, ${scheduledAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
  }

  return scheduledAt.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function badgeVariantForStatus(status: DashboardExam["status"]): "success" | "warning" | "outline" | "destructive" {
  if (status === "Completed") return "success";
  if (status === "Cancelled") return "destructive";
  if (status === "Confirmed") return "outline";
  return "warning";
}

export default function DashboardPage() {
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [subjects, setSubjects] = React.useState<SubjectRecord[]>([]);
  const [leads, setLeads] = React.useState<LeadRecord[]>([]);
  const [auditLogs, setAuditLogs] = React.useState<AuditLogRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [lastSync, setLastSync] = React.useState<Date | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      const [appointmentsResult, subjectsResult, leadsResult, logsResult, examinersResult] = await Promise.allSettled([
        fetchAppointments(),
        fetchSubjects(),
        fetchLeads(),
        fetchAuditLogs(200),
        fetchExaminers(),
      ]);

      if (cancelled) {
        return;
      }

      setAppointments(appointmentsResult.status === "fulfilled" ? appointmentsResult.value : []);
      setSubjects(subjectsResult.status === "fulfilled" ? subjectsResult.value : []);
      setLeads(leadsResult.status === "fulfilled" ? leadsResult.value : []);
      setAuditLogs(logsResult.status === "fulfilled" ? logsResult.value : []);
      setExaminers(examinersResult.status === "fulfilled" ? examinersResult.value : []);
      setLastSync(new Date());

      const failed = [appointmentsResult, subjectsResult, leadsResult, logsResult, examinersResult].filter((item) => item.status === "rejected").length;
      if (failed > 0) {
        toast.warning(`Loaded with partial data (${failed} source${failed > 1 ? "s" : ""} unavailable).`);
      }

      setIsLoading(false);
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  const mappedExams = React.useMemo<DashboardExam[]>(() => {
    const examinerMap = new Map<number, string>();
    examiners.forEach((examiner) => {
      examinerMap.set(examiner.id, examiner.name);
    });

    return appointments.map((appointment) => {
      const parsed = parseNotes(appointment.notes || "");
      const scheduledAt = new Date(appointment.scheduled_at);

      return {
        id: appointment.id,
        code: `EX-${String(appointment.id).padStart(4, "0")}`,
        label: parsed.title,
        subject: appointment.client?.name || `Client #${appointment.client_id}`,
        owner: examinerMap.get(appointment.examiner_id) || `Examiner ${initials(String(appointment.examiner_id))}`,
        status: normalizeStatus(appointment.status),
        payment: normalizePaymentStatus(appointment.payment_status),
        durationMinutes: Number(appointment.duration || 0),
        scheduledAt,
      };
    });
  }, [appointments, examiners]);

  const analytics = React.useMemo(() => {
    const now = new Date();
    const today = toStartOfDay(now);
    const sevenDays = Array.from({ length: 7 }, (_, index) => addDays(today, index - 6));

    const throughput = sevenDays.map((day) => (
      mappedExams.filter((exam) => isSameDay(exam.scheduledAt, day)).length
    ));

    const intakeLast7Days = leads.filter((lead) => {
      const timestamp = Date.parse(lead.createdAt);
      return Number.isFinite(timestamp) && timestamp >= addDays(today, -6).getTime();
    }).length;

    const previousWindowStart = addDays(today, -13);
    const previousWindowEnd = addDays(today, -7);
    const intakePrevious7Days = leads.filter((lead) => {
      const timestamp = Date.parse(lead.createdAt);
      return Number.isFinite(timestamp) && timestamp >= previousWindowStart.getTime() && timestamp < previousWindowEnd.getTime();
    }).length;

    const completed = mappedExams.filter((exam) => exam.status === "Completed").length;
    const confirmed = mappedExams.filter((exam) => exam.status === "Confirmed" || exam.status === "Pending").length;
    const deferred = mappedExams.filter((exam) => exam.status === "Cancelled").length;

    const completedLast7 = mappedExams.filter((exam) => (
      exam.status === "Completed" && exam.scheduledAt >= addDays(today, -6)
    )).length;
    const confirmedLast7 = mappedExams.filter((exam) => (
      (exam.status === "Confirmed" || exam.status === "Pending") && exam.scheduledAt >= addDays(today, -6)
    )).length;
    const deferredLast7 = mappedExams.filter((exam) => (
      exam.status === "Cancelled" && exam.scheduledAt >= addDays(today, -6)
    )).length;

    const cycleHours = mappedExams.length === 0
      ? 0
      : mappedExams.reduce((sum, exam) => sum + exam.durationMinutes, 0) / mappedExams.length / 60;

    const clearanceRate = mappedExams.length === 0 ? 0 : Math.round((completed / mappedExams.length) * 100);

    const riskAlerts = auditLogs.filter((log) => {
      const created = Date.parse(log.createdAt);
      return Number.isFinite(created)
        && created >= Date.now() - 24 * 60 * 60 * 1000
        && log.status >= 400;
    }).length;

    const recentExams = [...mappedExams]
      .sort((left, right) => right.scheduledAt.getTime() - left.scheduledAt.getTime())
      .slice(0, 4);

    const todaysQueue = [...mappedExams]
      .filter((exam) => isSameDay(exam.scheduledAt, now) && exam.status !== "Cancelled")
      .sort((left, right) => left.scheduledAt.getTime() - right.scheduledAt.getTime())
      .slice(0, 5);

    const thisMonthMixItems = mappedExams.filter((exam) => (
      exam.scheduledAt.getFullYear() === now.getFullYear() && exam.scheduledAt.getMonth() === now.getMonth()
    ));
    const mixByType = thisMonthMixItems.reduce<Record<string, number>>((acc, exam) => {
      acc[exam.label] = (acc[exam.label] ?? 0) + 1;
      return acc;
    }, {});

    const mixEntries = Object.entries(mixByType)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4);

    const caseMix: CaseMixSegment[] = mixEntries.length === 0
      ? [{ label: "No exam data", value: 100, tone: caseMixTones[0] }]
      : mixEntries.map(([label, count], index) => ({
          label,
          value: Math.max(1, Math.round((count / thisMonthMixItems.length) * 100)),
          tone: caseMixTones[index % caseMixTones.length],
        }));

    const totalCasesCurrentMonth = getMonthCount(mappedExams, (item) => item.scheduledAt, 0);
    const totalCasesPreviousMonth = getMonthCount(mappedExams, (item) => item.scheduledAt, -1);

    const subjectsCurrentMonth = getMonthCount(subjects, (item) => {
      const value = Date.parse(item.created_at);
      return Number.isFinite(value) ? new Date(value) : null;
    }, 0);
    const subjectsPreviousMonth = getMonthCount(subjects, (item) => {
      const value = Date.parse(item.created_at);
      return Number.isFinite(value) ? new Date(value) : null;
    }, -1);

    const reportsCurrentMonth = mappedExams.filter((exam) => (
      exam.status === "Completed"
      && exam.scheduledAt.getFullYear() === now.getFullYear()
      && exam.scheduledAt.getMonth() === now.getMonth()
    )).length;
    const reportsPreviousMonth = mappedExams.filter((exam) => {
      const previousMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
      const previousYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
      return exam.status === "Completed"
        && exam.scheduledAt.getFullYear() === previousYear
        && exam.scheduledAt.getMonth() === previousMonth;
    }).length;

    const activeExams = mappedExams.filter((exam) => exam.status === "Pending" || exam.status === "Confirmed").length;
    const activeYesterday = mappedExams.filter((exam) => {
      const yesterday = addDays(today, -1);
      return isSameDay(exam.scheduledAt, yesterday)
        && (exam.status === "Pending" || exam.status === "Confirmed");
    }).length;

    const tomorrow = addDays(today, 1);
    const tomorrowBookings = mappedExams.filter((exam) => isSameDay(exam.scheduledAt, tomorrow) && exam.status !== "Cancelled").length;
    const capacityPercent = examiners.length === 0 ? 0 : Math.round((tomorrowBookings / (examiners.length * 4)) * 100);
    const awaitingRelease = mappedExams.filter((exam) => exam.status === "Completed" && exam.payment !== "Paid").length;

    const alerts = [
      mappedExams.filter((exam) => exam.status === "Pending").length > 0,
      capacityPercent >= 80,
      awaitingRelease > 0,
    ].filter(Boolean).length;

    const intakeGrowth = intakePrevious7Days === 0
      ? (intakeLast7Days > 0 ? 100 : 0)
      : ((intakeLast7Days - intakePrevious7Days) / intakePrevious7Days) * 100;

    return {
      weeklyLabels: sevenDays.map((day) => day.toLocaleDateString(undefined, { weekday: "short" })),
      throughput,
      completed,
      confirmed,
      deferred,
      completedLast7,
      confirmedLast7,
      deferredLast7,
      intakeGrowth,
      clearanceRate,
      avgDurationHours: cycleHours,
      riskAlerts,
      recentExams,
      todaysQueue,
      caseMix,
      totalCasesCurrentMonth,
      totalCasesPreviousMonth,
      subjectsCurrentMonth,
      subjectsPreviousMonth,
      reportsCurrentMonth,
      reportsPreviousMonth,
      activeExams,
      activeYesterday,
      totalCases: mappedExams.length,
      totalSubjects: subjects.length,
      totalReports: completed,
      alerts,
      tomorrowBookings,
      capacityPercent,
      awaitingRelease,
    };
  }, [auditLogs, examiners.length, leads, mappedExams, subjects]);

  const throughputPath = React.useMemo(() => buildChart(analytics.throughput), [analytics.throughput]);

  const metrics = [
    {
      title: "Total Cases",
      value: String(analytics.totalCases),
      delta: formatDelta(analytics.totalCasesCurrentMonth, analytics.totalCasesPreviousMonth, "vs last month"),
      detail: `${analytics.completed} cleared for delivery`,
      icon: ShieldCheck,
      accent: "from-primary/20 via-primary/8 to-transparent",
    },
    {
      title: "Active Exams",
      value: String(analytics.activeExams),
      delta: formatDelta(analytics.activeExams, analytics.activeYesterday, "from yesterday"),
      detail: `${analytics.todaysQueue.length} currently in today's queue`,
      icon: Activity,
      accent: "from-amber-500/20 via-amber-500/8 to-transparent",
    },
    {
      title: "Subjects",
      value: String(analytics.totalSubjects),
      delta: formatDelta(analytics.subjectsCurrentMonth, analytics.subjectsPreviousMonth, "vs last month"),
      detail: `${analytics.totalSubjects} total registered profiles`,
      icon: Users,
      accent: "from-sky-500/20 via-sky-500/8 to-transparent",
    },
    {
      title: "Reports Generated",
      value: String(analytics.totalReports),
      delta: formatDelta(analytics.reportsCurrentMonth, analytics.reportsPreviousMonth, "vs last month"),
      detail: `${analytics.avgDurationHours.toFixed(1)}h average exam duration`,
      icon: FileText,
      accent: "from-emerald-500/20 via-emerald-500/8 to-transparent",
    },
  ] as const;

  return (
    <div className="space-y-6 pb-6">
      <section className="relative overflow-hidden border border-border/70 bg-card">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(214,107,51,0.18),transparent_34%),radial-gradient(circle_at_right,rgba(19,145,214,0.12),transparent_30%)]" />
        <div className="relative grid gap-6 p-5 lg:grid-cols-[1.35fr_0.9fr] lg:p-7">
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3">
              <Badge className="rounded-none px-3 py-1 uppercase tracking-[0.24em]" variant="outline">
                Live Operations
              </Badge>
              <span className="text-muted-foreground text-xs uppercase tracking-[0.24em]">
                Polygraph Command Center
              </span>
            </div>

            <div className="max-w-2xl space-y-3">
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Dashboard Overview
              </h1>
              <p className="text-muted-foreground max-w-xl text-sm sm:text-base">
                Live intelligence from appointments, subjects, leads, and audit activity.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-border/70 bg-background/70 p-4 backdrop-blur-sm">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.24em]">Clearance Rate</p>
                <p className="mt-2 text-3xl font-semibold">{analytics.clearanceRate}%</p>
                <p className="text-muted-foreground mt-1 text-xs">Completed exams out of all tracked cases</p>
              </div>
              <div className="border border-border/70 bg-background/70 p-4 backdrop-blur-sm">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.24em]">Avg. Exam Duration</p>
                <p className="mt-2 text-3xl font-semibold">{analytics.avgDurationHours.toFixed(1)}h</p>
                <p className="text-muted-foreground mt-1 text-xs">Based on appointment durations</p>
              </div>
              <div className="border border-border/70 bg-background/70 p-4 backdrop-blur-sm">
                <p className="text-muted-foreground text-[11px] uppercase tracking-[0.24em]">Risk Alerts</p>
                <p className="mt-2 text-3xl font-semibold">{analytics.riskAlerts}</p>
                <p className="text-muted-foreground mt-1 text-xs">Audit events with HTTP status 400+ in last 24h</p>
              </div>
            </div>
          </div>

          <Card className="border-border/70 bg-background/80 backdrop-blur-sm">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Weekly Throughput</CardTitle>
                  <CardDescription>Appointment load over the last 7 days</CardDescription>
                </div>
                <Badge className="rounded-none" variant="secondary">
                  <TrendingUp className="mr-1 h-3.5 w-3.5" />
                  {analytics.intakeGrowth >= 0 ? "+" : ""}{analytics.intakeGrowth.toFixed(0)}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border border-border/70 bg-card p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Completed</p>
                  <p className="mt-2 text-2xl font-semibold">{analytics.completedLast7}</p>
                </div>
                <div className="border border-border/70 bg-card p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Scheduled</p>
                  <p className="mt-2 text-2xl font-semibold">{analytics.confirmedLast7}</p>
                </div>
                <div className="border border-border/70 bg-card p-3">
                  <p className="text-muted-foreground text-[11px] uppercase tracking-[0.2em]">Deferred</p>
                  <p className="mt-2 text-2xl font-semibold">{analytics.deferredLast7}</p>
                </div>
              </div>

              <div className="border border-border/70 bg-card p-3">
                <svg aria-label="Weekly throughput chart" className="h-40 w-full" viewBox="0 0 320 120" preserveAspectRatio="none" role="img">
                  <defs>
                    <linearGradient id="throughput-fill" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.45" />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.05" />
                    </linearGradient>
                  </defs>
                  <path d={throughputPath.area} fill="url(#throughput-fill)" />
                  <polyline fill="none" points={throughputPath.line} stroke="var(--color-primary)" strokeWidth="3" />
                </svg>
                <div className="text-muted-foreground mt-2 grid grid-cols-7 text-[11px] uppercase tracking-[0.2em]">
                  {analytics.weeklyLabels.map((label, index) => (
                    <span key={`${label}-${index}`} className={index === analytics.weeklyLabels.length - 1 ? "text-right" : undefined}>
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;

          return (
            <Card key={metric.title} className="border-border/70 bg-card/80">
              <CardContent className="relative p-0">
                <div className={`absolute inset-x-0 top-0 h-24 bg-linear-to-br ${metric.accent}`} />
                <div className="relative space-y-4 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-muted-foreground text-[11px] uppercase tracking-[0.22em]">{metric.title}</p>
                      <p className="mt-3 text-4xl font-semibold tracking-tight">{isLoading ? "..." : metric.value}</p>
                    </div>
                    <span className="border border-border/70 bg-background/80 p-2">
                      <Icon className="text-muted-foreground h-4 w-4" />
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{metric.delta}</p>
                    <p className="text-muted-foreground text-xs">{metric.detail}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Recent Exams</CardTitle>
                <CardDescription>Latest movement across active forensic work</CardDescription>
              </div>
              <Badge className="rounded-none" variant="outline">
                {analytics.recentExams.length} active updates
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.recentExams.length === 0 ? (
              <div className="border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                No exam records yet.
              </div>
            ) : analytics.recentExams.map((exam) => (
              <div
                key={exam.id}
                className="grid gap-3 border border-border/70 bg-background/60 p-4 lg:grid-cols-[1.1fr_0.9fr_auto] lg:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{exam.code}</p>
                    <Badge className="rounded-none" variant={badgeVariantForStatus(exam.status)}>
                      {exam.status}
                    </Badge>
                  </div>
                  <p className="text-sm">{exam.label}</p>
                  <p className="text-muted-foreground text-xs">Subject: {exam.subject}</p>
                </div>
                <div className="text-muted-foreground space-y-1 text-xs">
                  <p>Lead examiner: {exam.owner}</p>
                  <p>{formatExamWindow(exam.status, exam.scheduledAt)}</p>
                </div>
                <ArrowRight className="text-muted-foreground h-4 w-4 justify-self-end" />
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="grid gap-4">
          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Case Mix</CardTitle>
              <CardDescription>Distribution by exam type this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex h-4 overflow-hidden border border-border/70 bg-muted">
                {analytics.caseMix.map((segment) => (
                  <div key={segment.label} className={segment.tone} style={{ width: `${segment.value}%` }} />
                ))}
              </div>
              <div className="space-y-3">
                {analytics.caseMix.map((segment) => (
                  <div key={segment.label} className="flex items-center gap-3">
                    <span className={`${segment.tone} h-2.5 w-2.5 shrink-0`} />
                    <span className="flex-1 text-sm">{segment.label}</span>
                    <span className="text-muted-foreground text-xs">{segment.value}%</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80">
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
              <CardDescription>Common tasks for the operations team</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((item) => {
                const Icon = item.icon;

                return (
                  <Link
                    key={item.title}
                    className="group flex w-full items-center gap-3 border border-border/70 bg-background/60 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                    href={item.href}
                  >
                    <span className="border border-border/70 bg-card p-2">
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{item.title}</span>
                      <span className="text-muted-foreground block text-xs">{item.description}</span>
                    </span>
                    <ArrowRight className="text-muted-foreground h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">Operational Watchlist</CardTitle>
                <CardDescription>Items that may slow delivery or require intervention</CardDescription>
              </div>
              <Badge className="rounded-none" variant="warning">
                {analytics.alerts} alerts
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-3">
            <div className="border border-border/70 bg-background/60 p-4">
              <Siren className="mb-3 h-4 w-4 text-amber-500" />
              <p className="text-sm font-medium">Interview backlog</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {mappedExams.filter((exam) => exam.status === "Pending").length} pending interviews need assignment follow-up.
              </p>
            </div>
            <div className="border border-border/70 bg-background/60 p-4">
              <CalendarClock className="mb-3 h-4 w-4 text-sky-500" />
              <p className="text-sm font-medium">Scheduling pressure</p>
              <p className="text-muted-foreground mt-1 text-xs">
                Tomorrow has {analytics.tomorrowBookings} bookings ({analytics.capacityPercent}% estimated capacity).
              </p>
            </div>
            <div className="border border-border/70 bg-background/60 p-4">
              <CheckCircle2 className="mb-3 h-4 w-4 text-emerald-500" />
              <p className="text-sm font-medium">Report approvals</p>
              <p className="text-muted-foreground mt-1 text-xs">
                {analytics.awaitingRelease} completed exams are awaiting final paid release.
              </p>
            </div>
          </CardContent>
          <CardFooter className="justify-between border-border/70 bg-background/40">
            <span className="text-muted-foreground text-xs">
              Last sync {lastSync ? lastSync.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "--"}
            </span>
            <span className="text-xs font-medium">Security posture {analytics.riskAlerts > 0 ? "watch" : "stable"}</span>
          </CardFooter>
        </Card>

        <Card className="border-border/70 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Today&apos;s Queue</CardTitle>
            <CardDescription>Upcoming milestones and live checkpoints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {analytics.todaysQueue.length === 0 ? (
              <div className="border border-border/70 bg-background/60 p-4 text-sm text-muted-foreground">
                No appointments scheduled for today.
              </div>
            ) : analytics.todaysQueue.map((item) => (
              <div key={`${item.code}-${item.scheduledAt.toISOString()}`} className="flex gap-4 border-l border-border pl-4">
                <div className="w-14 shrink-0 text-sm font-semibold">
                  {item.scheduledAt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                </div>
                <div className="min-w-0 flex-1 border border-border/70 bg-background/60 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{item.label}</p>
                    <Badge className="rounded-none" variant="outline">
                      {item.status}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">Examiner: {item.owner}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
