"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { ArrowRight, CalendarClock, ClipboardList, Info, ListChecks, Lock } from "lucide-react";

import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { formatClinicDateTime } from "@/lib/clinic-time";
import { fetchExamByAppointment, formatAppointmentCode, type ExamRecord } from "@/lib/exam-documentation";
import { fetchExamTypes } from "@/lib/exam-booking";
import { formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { useSessionRoute } from "@/components/dashboard/session-route";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

export default function SessionQuestionsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const appointmentId = Number(params.appointmentId);
  const { appointments, loading: clientLoading } = useClientDetail();
  const route = useSessionRoute();
  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;

  const [exam, setExam] = React.useState<ExamRecord | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [examTypeName, setExamTypeName] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    if (!Number.isFinite(appointmentId)) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    fetchExamByAppointment(appointmentId)
      .then((data) => {
        if (!cancelled) setExam(data);
      })
      .catch((err) => {
        // Don't fall back to "not started": that would edit the booking's prepared
        // questions instead of the session's own record.
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load the session");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [appointmentId, attempt]);

  // Exam type name for the header (the booking only carries its id).
  const examTypeId = exam?.exam_type?.id ?? appointment?.exam_type_id ?? null;
  React.useEffect(() => {
    if (exam?.exam_type?.name) {
      setExamTypeName(exam.exam_type.name);
      return;
    }
    if (!examTypeId) return;
    let cancelled = false;
    fetchExamTypes()
      .then((types) => {
        if (!cancelled) setExamTypeName(types.find((t) => t.id === examTypeId)?.name ?? null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [exam, examTypeId]);

  if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
    return <p className="py-12 text-center text-destructive">Invalid session link.</p>;
  }

  const started = Boolean(exam);
  const code = formatAppointmentCode(appointmentId);
  const examinee = appointment?.subject ? formatSubjectName(appointment.subject) : null;
  const status = appointment?.status?.toLowerCase() ?? "";
  const cancelled = ["cancelled", "canceled", "no_show", "no-show"].includes(status);

  return (
    <div className="space-y-5">
      {/* Session header */}
      <div className={cn(CARD, "p-5 sm:p-6")}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-[13px] font-medium tracking-[0.08em] text-muted-foreground uppercase">
              <ListChecks aria-hidden="true" className="size-4" /> Session questions
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
              {examinee ?? (clientLoading ? "Loading…" : "Session")} <span className="font-mono text-lg font-normal text-muted-foreground">· {code}</span>
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-muted-foreground">
              {appointment ? (
                <span className="inline-flex items-center gap-1.5">
                  <CalendarClock aria-hidden="true" className="size-3.5" /> {formatClinicDateTime(appointment.scheduled_at)}
                </span>
              ) : null}
              {examTypeName ? (
                <span className="inline-flex items-center gap-1.5">
                  <ClipboardList aria-hidden="true" className="size-3.5" /> {examTypeName}
                </span>
              ) : null}
              {appointment ? (
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize",
                    cancelled
                      ? "bg-destructive/10 text-destructive"
                      : status === "completed"
                        ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
                  )}
                >
                  {appointment.status.replace(/[_-]+/g, " ")}
                </span>
              ) : null}
            </div>
          </div>
          {started ? (
            <Link
              href={route.base as Route}
              className="flex h-10 shrink-0 items-center gap-1.5 self-start rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
            >
              Back to documentation <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {/* What editing here means */}
        {!loading && !loadError ? (
          <div
            className={cn(
              "mt-5 flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
              started ? "bg-[#E8E4F7]/60 text-[#3F3577] dark:bg-violet-950/40 dark:text-violet-100" : "bg-[#F7F6F1] text-muted-foreground dark:bg-muted/40",
            )}
          >
            {started ? <Lock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
            <span>
              {started
                ? "Documentation has started, so these questions belong to this session only. Record each response as you go; changes here never touch the Question Library."
                : "Prepare what you'll ask. When documentation starts, these are copied into the session — later Question Library edits won't change them."}
              {cancelled ? <strong className="mt-1 block font-medium text-destructive">This session was {status.replace(/[_-]+/g, " ")}.</strong> : null}
            </span>
          </div>
        ) : null}
      </div>

      {/* Editor */}
      <div className={cn(CARD, "p-4 sm:p-6")}>
        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading session">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-[92px] animate-pulse rounded-[20px] bg-[#F3F1EA] dark:bg-muted" />
            ))}
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 rounded-[20px] bg-destructive/5 px-6 py-10 text-center">
            <p className="text-sm text-destructive">{loadError}</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="flex h-10 items-center rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Try again
            </button>
          </div>
        ) : (
          <SessionQuestionsPanel appointmentId={appointmentId} examId={exam?.id} examTypeId={examTypeId} showResponses={started} />
        )}
      </div>
    </div>
  );
}
