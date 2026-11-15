"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowUpRight,
  Ban,
  CalendarClock,
  Check,
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Languages,
  ListChecks,
  Loader2,
  Paperclip,
  PlayCircle,
  RotateCcw,
  Save,
  Upload,
  User,
} from "lucide-react";

import { BookingAgreementNotice, useBookingAgreementStatus } from "@/components/agreements/booking-agreement-notice";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import {
  addExamPhase,
  fetchExamByAppointment,
  formatAppointmentCode,
  startExamDocumentation,
  updateAppointment,
  updateExam,
  uploadExamDocument,
  type ExamRecord,
} from "@/lib/exam-documentation";
import { fetchSubject, formatSubjectName, type SubjectRecord } from "@/lib/subjects";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { formatClinicClock, formatClinicDateTime } from "@/lib/clinic-time";
import { cn } from "@/lib/utils";
import { useSessionRoute } from "@/components/dashboard/session-route";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const OUTLINE = "flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";
const DARK = "flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] disabled:opacity-50 dark:bg-foreground dark:text-background";
const FIELD = "w-full rounded-2xl border-0 bg-[#F3F1EA] px-4 py-3 text-[15px] leading-relaxed outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted";

const DOC_TYPES = [
  { value: "chart", label: "Polygraph chart" },
  { value: "consent", label: "Consent form" },
  { value: "report", label: "Examiner report" },
  { value: "audio", label: "Audio / video" },
  { value: "other", label: "Other" },
] as const;
const DOC_LABEL: Record<string, string> = Object.fromEntries(DOC_TYPES.map((t) => [t.value, t.label]));

const PHASES = [
  { name: "Pre-Test", hint: "Interview, rights, consent, question review", dot: "bg-[#5B8DB8]" },
  { name: "In-Test", hint: "Charts running — observations, countermeasures", dot: "bg-[#3F7A37]" },
  { name: "Post-Test", hint: "Results discussed, admissions, follow-up", dot: "bg-[#7A6BC4]" },
] as const;

const STATUS: Record<string, { label: string; chip: string }> = {
  scheduled: { label: "Not started", chip: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" },
  in_progress: { label: "In progress", chip: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" },
  completed: { label: "Completed", chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" },
  cancelled: { label: "Cancelled", chip: "bg-destructive/10 text-destructive" },
};
const statusOf = (s?: string) => STATUS[s ?? ""] ?? { label: (s ?? "").replace(/_/g, " "), chip: STATUS.scheduled.chip };

function phaseDot(name: string) {
  return PHASES.find((p) => p.name === name)?.dot ?? "bg-primary";
}

function formatDuration(minutes: number) {
  if (!minutes) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

type Confirm = null | "complete" | "cancel" | "reopen";

export default function ExaminationDocumentationPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const appointmentId = Number(params.appointmentId);
  const { client, appointments, loading: clientLoading, refresh } = useClientDetail();
  const route = useSessionRoute();

  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;
  const agreementStatus = useBookingAgreementStatus(Number.isFinite(appointmentId) ? appointmentId : null);

  const [exam, setExam] = React.useState<ExamRecord | null>(null);
  const [subject, setSubject] = React.useState<SubjectRecord | null>(null);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");
  const [phaseName, setPhaseName] = React.useState<string>(PHASES[0].name);
  const [phaseNotes, setPhaseNotes] = React.useState("");
  const [loggingPhase, setLoggingPhase] = React.useState(false);
  const [docType, setDocType] = React.useState("chart");
  const [dragging, setDragging] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const subjectIdHint = appointment?.subject_id;
  const loadExam = React.useCallback(async () => {
    if (!Number.isFinite(appointmentId)) return;
    setLoading(true);
    setLoadError(null);
    try {
      const [examData, examinerList] = await Promise.all([fetchExamByAppointment(appointmentId), fetchExaminers().catch(() => [] as UserRecord[])]);
      setExam(examData);
      setExaminers(examinerList);
      setNotes(examData?.notes ?? "");
      const sid = examData?.subject_id ?? subjectIdHint;
      if (sid) setSubject(await fetchSubject(sid).catch(() => null));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load the examination");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, subjectIdHint]);

  React.useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const savedNotes = exam?.notes ?? "";
  const dirty = Boolean(exam) && notes !== savedNotes;

  // Don't lose typed findings on a reload or tab close.
  React.useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const phases = React.useMemo(() => [...(exam?.phases ?? [])].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()), [exam?.phases]);
  const files = exam?.documents ?? [];
  const status = exam?.status ?? "scheduled";
  const completed = status === "completed";
  const cancelled = status === "cancelled";
  const locked = completed || cancelled;

  // Suggest the next phase that hasn't been logged yet.
  const loggedNames = phases.map((p) => p.name);
  const suggested = PHASES.find((p) => !loggedNames.includes(p.name))?.name;
  React.useEffect(() => {
    if (suggested) setPhaseName(suggested);
  }, [suggested]);

  const examinerName = examiners.find((e) => e.id === appointment?.examiner_id)?.name ?? (appointment?.examiner_id ? `Examiner #${appointment.examiner_id}` : null);
  const examTypeName = exam?.exam_type?.name || exam?.type || null;
  const name = subject ? formatSubjectName(subject).trim() : appointment?.subject ? formatSubjectName(appointment.subject).trim() : "";

  const checklist = [
    { key: "timeline", label: "Phases logged", done: phases.length > 0, detail: phases.length ? `${phases.length} logged` : "None yet" },
    { key: "notes", label: "Findings written", done: savedNotes.trim().length > 0, detail: savedNotes.trim() ? `${savedNotes.trim().split(/\s+/).length} words` : "Empty" },
    { key: "files", label: "Charts & files attached", done: files.length > 0, detail: files.length ? `${files.length} file${files.length === 1 ? "" : "s"}` : "None yet" },
  ];
  const missing = checklist.filter((c) => !c.done);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const handleStart = async () => {
    setStarting(true);
    try {
      const created = await startExamDocumentation(appointmentId);
      setExam(created);
      setNotes(created.notes ?? "");
      if (appointment?.status === "pending") await updateAppointment(appointmentId, { status: "confirmed" });
      toast.success("Examination record started");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start the examination record");
    } finally {
      setStarting(false);
    }
  };

  const save = async (patch: { notes?: string; status?: string }, done: string) => {
    if (!exam) return false;
    setSaving(true);
    try {
      const updated = await updateExam(exam.id, patch);
      setExam(updated);
      if (patch.notes !== undefined) setNotes(updated.notes ?? patch.notes);
      toast.success(done);
      if (patch.status) void refresh();
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveNotes = () => save({ notes }, "Findings saved");

  // Ctrl/Cmd+S saves the findings.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s" && dirty && !saving) {
        e.preventDefault();
        void saveNotes();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const runConfirm = async () => {
    const action = confirm;
    if (!action) return;
    const next = action === "complete" ? "completed" : action === "cancel" ? "cancelled" : "in_progress";
    // Unsaved findings go in with the status change.
    const ok = await save(
      dirty ? { notes, status: next } : { status: next },
      action === "complete" ? "Documentation complete — the report can be written now" : action === "cancel" ? "Session cancelled" : "Reopened for editing",
    );
    if (ok) setConfirm(null);
  };

  const handleAddPhase = async () => {
    if (!exam || loggingPhase || !phaseName.trim()) return;
    setLoggingPhase(true);
    try {
      await addExamPhase({ exam_id: exam.id, name: phaseName.trim(), notes: phaseNotes.trim() });
      setExam(await fetchExamByAppointment(appointmentId));
      setPhaseNotes("");
      toast.success(`${phaseName} logged`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log the phase");
    } finally {
      setLoggingPhase(false);
    }
  };

  const uploadFile = async (file: File) => {
    if (!exam || uploading) return;
    setUploading(true);
    try {
      await uploadExamDocument(exam.id, file, docType);
      setExam(await fetchExamByAppointment(appointmentId));
      toast.success(`${file.name} attached`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
    return <p className="py-12 text-center text-destructive">Invalid session link.</p>;
  }

  if (!appointment && !loading && !clientLoading) {
    return (
      <div className={cn(CARD, "flex flex-col items-center gap-4 px-6 py-14 text-center")}>
        <p className="text-muted-foreground">This session isn&apos;t booked under this account.</p>
        <Link href={route.back as Route} className={OUTLINE}>
          Back to {route.backLabel.toLowerCase()}
        </Link>
      </div>
    );
  }

  const st = statusOf(exam ? status : undefined);
  const examineeHref = subject ? (`/dashboard/clients/${clientId}/examinees/${subject.id}` as Route) : null;

  return (
    <div className={cn("space-y-5", dirty && "pb-24")}>
      {/* Header */}
      <PageHero
        tone={completed ? "sage" : cancelled ? "ink" : "terracotta"}
        icon={FileText}
        eyebrow={`Session documentation · ${formatAppointmentCode(appointmentId)}`}
        title={name ? <strong className="font-semibold">{name}</strong> : <span className="text-[#C9C6BC]">{clientLoading ? "Loading…" : "Session"}</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {appointment ? (
              <span className="inline-flex items-center gap-1.5">
                <CalendarClock aria-hidden="true" className="size-3.5" /> {formatClinicDateTime(appointment.scheduled_at)}
              </span>
            ) : null}
            {appointment ? (
              <span className="inline-flex items-center gap-1.5">
                <Clock aria-hidden="true" className="size-3.5" /> {formatDuration(appointment.duration)}
              </span>
            ) : null}
            {examinerName ? (
              <span className="inline-flex items-center gap-1.5">
                <User aria-hidden="true" className="size-3.5" /> {examinerName}
              </span>
            ) : null}
            {examTypeName ? <span>{examTypeName}</span> : null}
            {client ? <span className="text-[#9C998F]">{client.name}</span> : null}
          </span>
        }
        actions={
          exam ? (
            <>
              <span className={cn("flex h-11 items-center rounded-full px-4 text-sm font-medium", st.chip)}>{st.label}</span>
              {completed ? (
                <HeroAction variant="primary" icon={FileSignature} href={`/dashboard/reports/${exam.id}`}>
                  Write report
                </HeroAction>
              ) : !cancelled ? (
                <HeroAction variant="primary" icon={Check} onClick={() => setConfirm("complete")} disabled={saving}>
                  Mark complete
                </HeroAction>
              ) : null}
            </>
          ) : null
        }
      >
        {exam ? (
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {[
              { id: "questions", label: "Ask questions", done: null as boolean | null, detail: "Record each answer" },
              ...checklist.map((c) => ({ id: c.key, label: c.label, done: c.done as boolean | null, detail: c.detail })),
              { id: "finish", label: completed ? "Report" : "Complete", done: completed, detail: completed ? "Ready to write" : "Then write the report" },
            ].map((step, i) => (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => scrollTo(step.id)}
                  className="flex w-full items-start gap-2.5 rounded-[18px] bg-white/[0.06] p-3 text-left ring-1 ring-white/10 transition-colors hover:bg-white/[0.1]"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                      step.done ? "bg-[#7FBF8A] text-[#1A1915]" : "bg-white/10 text-[#C9C6BC]",
                    )}
                  >
                    {step.done ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-[#FAF9F5]">{step.label}</span>
                    <span className="block truncate text-xs text-[#9C998F]">{step.detail}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        ) : null}
      </PageHero>

      {appointment ? <BookingAgreementNotice status={agreementStatus} booking={completed ? { ...appointment, status: "completed" } : appointment} clientId={clientId} className="max-w-2xl" /> : null}

      {subject?.interpreter_required ? (
        <div className="flex items-start gap-2.5 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Interpreter required.</strong> English level: {subject.english_proficiency || "not assessed"}. Make sure one is present before the Pre-Test.
          </span>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" /> Loading examination…
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-center gap-3 rounded-[26px] bg-destructive/5 px-6 py-12 text-center ring-1 ring-destructive/20">
          <p className="text-sm text-destructive">{loadError}</p>
          <button type="button" onClick={() => void loadExam()} className={OUTLINE}>
            Try again
          </button>
        </div>
      ) : !exam ? (
        /* Not started yet */
        <section className={cn(CARD, "grid gap-6 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center")}>
          <div className="max-w-xl">
            <h2 className="text-xl font-semibold tracking-[-0.01em]">Start the case file for this session</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Testing runs on your polygraph instrument — this page holds the record of it: the questions and answers, a Pre-Test / In-Test / Post-Test timeline, your findings and the exported charts. Once it&apos;s complete, the report is written from it.
            </p>
            <p className="mt-3 text-[13px] text-muted-foreground">
              Starting copies the prepared questions into the session.{" "}
              <Link href={`${route.base}/questions` as Route} className="font-medium text-foreground underline underline-offset-4">
                Review them first
              </Link>
              .
            </p>
          </div>
          <button type="button" onClick={handleStart} disabled={starting} className={cn(DARK, "h-12 px-6 text-sm")}>
            {starting ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <PlayCircle aria-hidden="true" className="size-4" />}
            Start examination record
          </button>
        </section>
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            {locked ? (
              <div className={cn("flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px]", completed ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-200" : "bg-destructive/5 text-destructive")}>
                {completed ? <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : <Ban aria-hidden="true" className="mt-0.5 size-4 shrink-0" />}
                <span>
                  {completed ? "Documentation is complete. Reopen it if something needs correcting before the report goes out." : "This session was cancelled. Reopen it to continue documenting."}
                </span>
              </div>
            ) : null}

            {/* 1. Questions */}
            <section id="questions" aria-labelledby="questions-title" className={cn(CARD, "scroll-mt-4 p-5 sm:p-6")}>
              <h3 id="questions-title" className="flex items-center gap-2 text-[15px] font-medium">
                <ListChecks aria-hidden="true" className="size-4 text-muted-foreground" /> Questions &amp; responses
              </h3>
              <p className="mb-4 text-[13px] text-muted-foreground">Copied from what was prepared for this booking. Record each answer as you go — the report can pull them in.</p>
              <SessionQuestionsPanel appointmentId={appointmentId} examId={exam.id} examTypeId={exam.exam_type?.id ?? appointment?.exam_type_id ?? null} showResponses />
            </section>

            {/* 2. Timeline */}
            <section id="timeline" aria-labelledby="timeline-title" className={cn(CARD, "scroll-mt-4 p-5 sm:p-6")}>
              <h3 id="timeline-title" className="flex items-center gap-2 text-[15px] font-medium">
                <Clock aria-hidden="true" className="size-4 text-muted-foreground" /> Session timeline
              </h3>
              <p className="mb-4 text-[13px] text-muted-foreground">Log each phase as you finish it. The time is stamped automatically.</p>

              {phases.length > 0 ? (
                <ol className="relative mb-5 space-y-3 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-px before:bg-border">
                  {phases.map((phase) => (
                    <li key={phase.id} className="relative pl-7">
                      <span aria-hidden="true" className={cn("absolute top-4 left-0 size-[15px] rounded-full ring-4 ring-white dark:ring-card", phaseDot(phase.name))} />
                      <div className="rounded-[18px] bg-[#F7F6F1] px-4 py-3 dark:bg-muted/40">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium">{phase.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">{formatClinicClock(phase.start_time)}</span>
                        </div>
                        {phase.notes ? <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">{phase.notes}</p> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              ) : null}

              {!locked ? (
                <div className="space-y-3 rounded-[20px] p-1">
                  <div role="radiogroup" aria-label="Phase" className="flex flex-wrap gap-1.5">
                    {PHASES.map((p) => {
                      const active = phaseName === p.name;
                      const logged = loggedNames.includes(p.name);
                      return (
                        <button
                          key={p.name}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setPhaseName(p.name)}
                          className={cn(
                            "flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                            active ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
                          )}
                        >
                          <span aria-hidden="true" className={cn("size-2 rounded-full", p.dot)} />
                          {p.name}
                          {logged ? <Check aria-hidden="true" className="size-3.5 opacity-70" strokeWidth={3} /> : null}
                        </button>
                      );
                    })}
                  </div>
                  <textarea
                    aria-label={`${phaseName} notes`}
                    className={cn(FIELD, "min-h-[96px] resize-y")}
                    placeholder={PHASES.find((p) => p.name === phaseName)?.hint ?? "What happened during this phase…"}
                    value={phaseNotes}
                    onChange={(e) => setPhaseNotes(e.target.value)}
                    onKeyDown={(e) => {
                      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                        e.preventDefault();
                        void handleAddPhase();
                      }
                    }}
                  />
                  <div className="flex items-center justify-between gap-3">
                    <span className="hidden text-xs text-muted-foreground sm:block">Ctrl + Enter to log</span>
                    <button type="button" onClick={() => void handleAddPhase()} disabled={loggingPhase} className={DARK}>
                      {loggingPhase ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Check aria-hidden="true" className="size-3.5" />}
                      Log {phaseName}
                    </button>
                  </div>
                </div>
              ) : phases.length === 0 ? (
                <p className="rounded-2xl bg-[#F7F6F1] py-6 text-center text-sm text-muted-foreground dark:bg-muted/40">No phases were logged.</p>
              ) : null}
            </section>

            {/* 3. Findings */}
            <section id="notes" aria-labelledby="notes-title" className={cn(CARD, "scroll-mt-4 p-5 sm:p-6")}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="notes-title" className="flex items-center gap-2 text-[15px] font-medium">
                    <FileText aria-hidden="true" className="size-4 text-muted-foreground" /> Findings &amp; examiner notes
                  </h3>
                  <p className="text-[13px] text-muted-foreground">Pre-test interview, test summary, conclusions and referral notes.</p>
                </div>
                {dirty ? <span className="rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200">Unsaved</span> : null}
              </div>
              <textarea
                aria-label="Findings and examiner notes"
                className={cn(FIELD, "min-h-[280px] resize-y", locked && "opacity-80")}
                placeholder="Pre-test interview, in-test observations, post-test discussion and your conclusion…"
                value={notes}
                readOnly={locked}
                onChange={(e) => setNotes(e.target.value)}
              />
              {!locked ? (
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="hidden text-xs text-muted-foreground sm:block">Ctrl + S to save</span>
                  <button type="button" onClick={() => void saveNotes()} disabled={!dirty || saving} className={OUTLINE}>
                    {saving ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Save aria-hidden="true" className="size-3.5" />}
                    {dirty ? "Save findings" : "Saved"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>

          {/* Side column */}
          <div className="space-y-5 xl:sticky xl:top-4">
            {/* Finish */}
            <section id="finish" aria-labelledby="finish-title" className="scroll-mt-4 rounded-[26px] bg-[#2B2A27] p-5 text-[#FAF9F5] dark:bg-[#1B1B19]">
              <h3 id="finish-title" className="text-[15px] font-medium">
                {completed ? "Ready for the report" : cancelled ? "Session cancelled" : "Finish documentation"}
              </h3>
              <p className="mt-0.5 text-[13px] text-[#C9C6BC]">
                {completed ? "Write, lock and send the report from the Report Builder." : cancelled ? "Nothing more is needed unless it's reopened." : "Mark it complete when the record is finished. The report comes after."}
              </p>
              <ul className="mt-4 space-y-2">
                {checklist.map((c) => (
                  <li key={c.key}>
                    <button type="button" onClick={() => scrollTo(c.key)} className="flex w-full items-center gap-2.5 rounded-xl px-1 py-0.5 text-left text-[13px] hover:bg-white/[0.06]">
                      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-full", c.done ? "bg-[#7FBF8A] text-[#1A1915]" : "ring-1 ring-white/25")}>
                        {c.done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
                      </span>
                      <span className="flex-1">{c.label}</span>
                      <span className="text-xs text-[#9C998F]">{c.detail}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex flex-col gap-2">
                {completed ? (
                  <Link href={`/dashboard/reports/${exam.id}` as Route} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] text-sm font-semibold text-[#1A1915] hover:bg-white">
                    <FileSignature aria-hidden="true" className="size-4" /> Open Report Builder
                  </Link>
                ) : !cancelled ? (
                  <button type="button" onClick={() => setConfirm("complete")} disabled={saving} className="flex h-11 items-center justify-center gap-2 rounded-full bg-[#FAF9F5] text-sm font-semibold text-[#1A1915] hover:bg-white disabled:opacity-50">
                    <Check aria-hidden="true" className="size-4" strokeWidth={3} /> Mark complete
                  </button>
                ) : null}
                <div className="flex gap-2">
                  {locked ? (
                    <button type="button" onClick={() => setConfirm("reopen")} disabled={saving} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-[#C9C6BC] ring-1 ring-white/15 hover:bg-white/10 hover:text-[#FAF9F5]">
                      <RotateCcw aria-hidden="true" className="size-3.5" /> Reopen
                    </button>
                  ) : (
                    <button type="button" onClick={() => setConfirm("cancel")} disabled={saving} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium text-[#C9C6BC] ring-1 ring-white/15 hover:bg-white/10 hover:text-[#F0A99F]">
                      <Ban aria-hidden="true" className="size-3.5" /> Cancel session
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* Files */}
            <section id="files" aria-labelledby="files-title" className={cn(CARD, "scroll-mt-4 p-5")}>
              <h3 id="files-title" className="flex items-center gap-2 text-[15px] font-medium">
                <Paperclip aria-hidden="true" className="size-4 text-muted-foreground" /> Charts &amp; files
              </h3>
              <p className="mb-3 text-[13px] text-muted-foreground">Exported from the instrument, plus consent and audio.</p>
              {files.length > 0 ? (
                <ul className="mb-4 divide-y divide-border/50 rounded-2xl bg-[#F7F6F1] px-3 dark:bg-muted/40">
                  {files.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" title={doc.name}>
                          {doc.name}
                        </p>
                        <p className="text-xs text-muted-foreground">{DOC_LABEL[doc.type] ?? doc.type}</p>
                      </div>
                      {doc.url ? (
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${doc.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-full ring-1 ring-border hover:bg-white dark:hover:bg-card">
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!cancelled ? (
                <>
                  <div role="radiogroup" aria-label="File type" className="mb-3 flex flex-wrap gap-1.5">
                    {DOC_TYPES.map((t) => {
                      const active = docType === t.value;
                      return (
                        <button
                          key={t.value}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setDocType(t.value)}
                          className={cn(
                            "flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium transition-colors",
                            active ? "bg-[#2B2A27] text-[#FAF9F5] dark:bg-foreground dark:text-background" : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
                          )}
                        >
                          {active ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadFile(f);
                    }}
                  />
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void uploadFile(f);
                    }}
                    className={cn(
                      "flex w-full flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-colors disabled:opacity-60",
                      dragging ? "border-primary bg-primary/5" : "border-border bg-[#F7F6F1] hover:bg-[#F3F1EA] dark:bg-muted/40 dark:hover:bg-muted",
                    )}
                  >
                    {uploading ? <Loader2 aria-hidden="true" className="size-5 animate-spin text-muted-foreground" /> : <Upload aria-hidden="true" className="size-5 text-muted-foreground" />}
                    <span className="text-[13px] font-medium">{uploading ? "Uploading…" : dragging ? "Drop to attach" : `Drop a ${DOC_LABEL[docType].toLowerCase()} or click`}</span>
                  </button>
                </>
              ) : files.length === 0 ? (
                <p className="text-sm text-muted-foreground">No files attached.</p>
              ) : null}
            </section>

            {/* Session details */}
            <section aria-labelledby="details-title" className={cn(CARD, "p-5")}>
              <h3 id="details-title" className="mb-3 text-[15px] font-medium">
                Session details
              </h3>
              <dl className="space-y-2.5 text-[13px]">
                {subject ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Examinee</dt>
                    <dd className="truncate text-right font-medium">
                      {examineeHref ? (
                        <Link href={examineeHref} className="hover:underline hover:underline-offset-4">
                          {name || "No name yet"}
                        </Link>
                      ) : (
                        name
                      )}
                    </dd>
                  </div>
                ) : null}
                {subject ? (
                  <div className="flex justify-between gap-3">
                    <dt className="flex items-center gap-1.5 text-muted-foreground">
                      <Languages aria-hidden="true" className="size-3.5" /> English
                    </dt>
                    <dd className="text-right">{subject.english_proficiency || "Not assessed"}</dd>
                  </div>
                ) : null}
                {examTypeName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Exam type</dt>
                    <dd className="text-right">{examTypeName}</dd>
                  </div>
                ) : null}
                {examinerName ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">Examiner</dt>
                    <dd className="text-right">{examinerName}</dd>
                  </div>
                ) : null}
              </dl>
              {appointment?.notes?.trim() ? (
                <div className="mt-4 rounded-2xl bg-[#F7F6F1] px-3.5 py-3 dark:bg-muted/40">
                  <p className="mb-1 text-[11px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Booking notes</p>
                  <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{appointment.notes}</p>
                </div>
              ) : null}
            </section>
          </div>
        </div>
      )}

      {/* Unsaved findings bar */}
      {dirty && !locked ? (
        <div className="fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-full bg-[#2B2A27] py-2 pr-2 pl-5 text-sm text-[#FAF9F5] shadow-[0_8px_24px_rgba(20,20,19,0.25)] dark:bg-[#1B1B19]">
            <span>Unsaved findings</span>
            <button type="button" onClick={() => setNotes(savedNotes)} className="h-9 rounded-full px-3 text-[13px] text-[#C9C6BC] hover:bg-white/10 hover:text-[#FAF9F5]">
              Discard
            </button>
            <button type="button" onClick={() => void saveNotes()} disabled={saving} className="flex h-9 items-center gap-1.5 rounded-full bg-[#FAF9F5] px-4 text-[13px] font-semibold text-[#1A1915] hover:bg-white disabled:opacity-60">
              {saving ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Save aria-hidden="true" className="size-3.5" />}
              Save
            </button>
          </div>
        </div>
      ) : null}

      {/* Status change confirmation */}
      <Dialog open={confirm !== null} onOpenChange={(open) => !open && !saving && setConfirm(null)}>
        <DialogContent className="max-w-md rounded-[26px]">
          <DialogHeader>
            <DialogTitle>{confirm === "complete" ? "Mark documentation complete?" : confirm === "cancel" ? "Cancel this session?" : "Reopen documentation?"}</DialogTitle>
            <DialogDescription>
              {confirm === "complete"
                ? "The booking is marked completed and the Report Builder opens up. You can still reopen it to make corrections."
                : confirm === "cancel"
                  ? "The booking is cancelled too, and it stops counting as a session for this examinee. You can reopen it later."
                  : "It goes back to In progress so the findings, timeline and files can be edited. The booking returns to confirmed."}
            </DialogDescription>
          </DialogHeader>
          {confirm === "complete" && missing.length > 0 ? (
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                Still missing: <strong className="font-semibold">{missing.map((m) => m.label.toLowerCase()).join(", ")}</strong>. You can complete it anyway.
              </span>
            </div>
          ) : null}
          {confirm === "complete" && dirty ? <p className="text-[13px] text-muted-foreground">Your unsaved findings will be saved with it.</p> : null}
          <DialogFooter>
            <button type="button" onClick={() => setConfirm(null)} disabled={saving} className={OUTLINE}>
              Not now
            </button>
            <button type="button" onClick={() => void runConfirm()} disabled={saving} className={cn(confirm === "cancel" ? "flex h-10 items-center justify-center gap-1.5 rounded-full bg-destructive px-4 text-[13px] font-medium text-white hover:bg-destructive/90 disabled:opacity-50" : DARK)}>
              {saving ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : null}
              {confirm === "complete" ? "Mark complete" : confirm === "cancel" ? "Cancel session" : "Reopen"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
