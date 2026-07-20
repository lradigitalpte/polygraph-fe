"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  FileSignature,
  FileText,
  Languages,
  ListChecks,
  Loader2,
  Paperclip,
  PlayCircle,
  Save,
  ShieldCheck,
  Upload,
  User,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
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
import { fetchSubject, type SubjectRecord } from "@/lib/subjects";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { formatClinicDateTime } from "@/lib/clinic-time";

const EXAM_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
const DOC_TYPES = [
  { value: "chart", label: "Polygraph chart" },
  { value: "consent", label: "Consent form" },
  { value: "report", label: "Examiner report" },
  { value: "audio", label: "Audio / video" },
  { value: "other", label: "Other" },
] as const;
const PHASE_PRESETS = ["Pre-Test", "In-Test", "Post-Test"] as const;

const WORKFLOW_STEPS = [
  {
    icon: ListChecks,
    title: "Log each phase",
    body: "Record Pre-Test, In-Test, and Post-Test phases in the timeline as you run the session.",
  },
  {
    icon: FileText,
    title: "Write your findings",
    body: "Capture interview notes, observations, and conclusions in the examiner notes.",
  },
  {
    icon: Upload,
    title: "Upload test results",
    body: "Attach charts, consent forms, and audio exported from your polygraph instrument.",
  },
  {
    icon: CheckCircle2,
    title: "Complete documentation",
    body: "Mark the examination complete when its notes, phases, and files are finished. Write the report afterward in Reports.",
  },
] as const;

function formatDateTime(iso: string) {
  return formatClinicDateTime(iso) || iso;
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function phaseAccent(name: string) {
  const n = name.toLowerCase();
  if (n.includes("pre")) return "bg-sky-500";
  if (n.includes("post")) return "bg-violet-500";
  if (n.includes("in")) return "bg-emerald-500";
  return "bg-primary";
}

export default function ExaminationDocumentationPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const appointmentId = Number(params.appointmentId);
  const { client, appointments, refresh } = useClientDetail();

  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;

  const [exam, setExam] = React.useState<ExamRecord | null>(null);
  const [subject, setSubject] = React.useState<SubjectRecord | null>(null);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [examNotes, setExamNotes] = React.useState("");
  const [examStatus, setExamStatus] = React.useState("in_progress");
  const [phaseNotes, setPhaseNotes] = React.useState("");
  const [phaseName, setPhaseName] = React.useState<string>(PHASE_PRESETS[0]);
  const [docType, setDocType] = React.useState("chart");
  const [starting, setStarting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const loadExam = React.useCallback(async () => {
    if (!Number.isFinite(appointmentId)) return;
    setLoading(true);
    try {
      const [examData, examinerList] = await Promise.all([
        fetchExamByAppointment(appointmentId),
        fetchExaminers(),
      ]);
      setExam(examData);
      setExaminers(examinerList);
      if (examData) {
        setExamNotes(examData.notes ?? "");
        setExamStatus(examData.status ?? "in_progress");
        if (examData.subject_id) {
          const subj = await fetchSubject(examData.subject_id).catch(() => null);
          setSubject(subj);
        }
      } else if (appointment?.subject_id) {
        const subj = await fetchSubject(appointment.subject_id).catch(() => null);
        setSubject(subj);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load examination");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, appointment?.subject_id]);

  React.useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const examinerName =
    examiners.find((e) => e.id === appointment?.examiner_id)?.name ??
    (appointment?.examiner_id ? `Examiner #${appointment.examiner_id}` : "—");

  const sortedPhases = React.useMemo(() => {
    if (!exam?.phases) return [];
    return [...exam.phases].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [exam?.phases]);

  const handleStart = async () => {
    setStarting(true);
    try {
      const created = await startExamDocumentation(appointmentId);
      setExam(created);
      setExamNotes(created.notes ?? "");
      setExamStatus(created.status);
      if (appointment?.status === "pending") {
        await updateAppointment(appointmentId, { status: "confirmed" });
      }
      toast.success("Examination record started");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start examination");
    } finally {
      setStarting(false);
    }
  };

  const handleSave = async () => {
    if (!exam) return;
    setSaving(true);
    try {
      const updated = await updateExam(exam.id, {
        notes: examNotes,
        status: examStatus,
      });
      setExam(updated);
      toast.success("Examination record saved");
      void refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPhase = async () => {
    if (!exam) return;
    try {
      await addExamPhase({
        exam_id: exam.id,
        name: phaseName,
        notes: phaseNotes,
      });
      const refreshed = await fetchExamByAppointment(appointmentId);
      setExam(refreshed);
      setPhaseNotes("");
      toast.success("Phase logged");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log phase");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !exam) return;
    setUploading(true);
    try {
      await uploadExamDocument(exam.id, file, docType);
      const refreshed = await fetchExamByAppointment(appointmentId);
      setExam(refreshed);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const inputClass = "h-11 rounded-xl";
  const fieldLabel = "text-xs font-bold uppercase tracking-wider text-muted-foreground";
  const backHref = `/dashboard/clients/${clientId}/exams`;

  if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
    return <p className="text-destructive py-12 text-center">Invalid session link.</p>;
  }

  if (!appointment && !loading) {
    return (
      <div className="py-12 text-center space-y-4">
        <p className="text-muted-foreground">Appointment not found for this client.</p>
        <Button variant="outline" render={<Link href={backHref} />}>
          Back to exam history
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full shrink-0 mt-0.5"
            render={<Link href={backHref} />}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-3xl font-bold tracking-tight">
                {subject ? `${subject.first_name} ${subject.last_name}` : formatAppointmentCode(appointmentId)}
              </h1>
              {exam && (
                <Badge className="bg-primary/15 text-primary border-primary/20 capitalize text-sm px-3 py-0.5">
                  {exam.status.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <p className="text-base text-muted-foreground">
              {exam?.type || "Polygraph Examination"}
              {client ? ` · Client: ${client.name}` : ""}
              {subject ? ` · ${formatAppointmentCode(appointmentId)}` : ""}
            </p>
            {appointment && (
              <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDateTime(appointment.scheduled_at)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDuration(appointment.duration)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" />
                  {examinerName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading examination...
        </div>
      ) : !exam ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Start examination documentation</CardTitle>
            <CardDescription className="max-w-md mx-auto text-base">
              This page is your forensic case file for the session — examiner notes, phase
              timeline, uploaded charts, and the final report. Testing itself runs on your polygraph
              instrument; this system stores the documentation.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center pb-8">
            <Button size="lg" onClick={handleStart} disabled={starting} className="gap-2 rounded-xl">
              {starting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <PlayCircle className="h-5 w-5" />
              )}
              Start examination record
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Language readiness — so the examiner knows before starting */}
          {subject && (
            <Card
              className={
                subject.interpreter_required
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-border/50"
              }
            >
              <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
                <span className="inline-flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">English proficiency:</span>
                  <Badge variant="outline" className="font-medium">
                    {subject.english_proficiency || "Not assessed"}
                  </Badge>
                </span>
                {subject.interpreter_required && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                    <AlertTriangle className="h-4 w-4" />
                    Interpreter required
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Workflow directions */}
          <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-primary" />
                How to document this session
              </CardTitle>
              <CardDescription className="text-sm">
                Follow these steps from intake to final verdict.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {WORKFLOW_STEPS.map((step, i) => {
                  const Icon = step.icon;
                  return (
                    <li key={step.title} className="flex gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-1.5">
                          <span className="text-muted-foreground">{i + 1}.</span>
                          {step.title}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 leading-snug">
                          {step.body}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-6">
              {/* Examiner notes */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    Examiner notes &amp; findings
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Pre-test interview, test summary, conclusions, and referral notes.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  <div className="grid gap-2">
                    <Label className={fieldLabel}>Examination status</Label>
                    <Select value={examStatus} onValueChange={(v) => setExamStatus(String(v))}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        {EXAM_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {statusLabel(s)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label className={fieldLabel}>Documentation</Label>
                    <Textarea
                      className="min-h-[260px] rounded-xl resize-y text-base leading-relaxed"
                      placeholder="Record pre-test, in-test observations, post-test, and final findings..."
                      value={examNotes}
                      onChange={(e) => setExamNotes(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      className="h-11 rounded-xl font-semibold gap-2"
                      disabled={saving}
                      onClick={handleSave}
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      Save notes
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Session timeline */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" />
                    Session timeline
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Examiner notes captured during each phase of the exam.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-5">
                  {sortedPhases.length > 0 ? (
                    <ol className="relative space-y-4 before:absolute before:left-[7px] before:top-2 before:bottom-2 before:w-px before:bg-border">
                      {sortedPhases.map((phase) => (
                        <li key={phase.id} className="relative pl-7">
                          <span
                            className={`absolute left-0 top-1.5 h-3.5 w-3.5 rounded-full ring-4 ring-background ${phaseAccent(
                              phase.name
                            )}`}
                          />
                          <div className="rounded-xl border border-border/60 bg-background px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-semibold text-base">{phase.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDateTime(phase.start_time)}
                              </span>
                            </div>
                            {phase.notes && (
                              <p className="text-sm text-muted-foreground mt-2 leading-relaxed whitespace-pre-wrap">
                                {phase.notes}
                              </p>
                            )}
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-xl border border-dashed py-6 text-center">
                      No phases recorded yet. Log your first phase below.
                    </p>
                  )}
                  <div className="grid gap-4 pt-4 border-t border-border/50">
                    <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
                      <div className="grid gap-2">
                        <Label className={fieldLabel}>Phase</Label>
                        <Select value={phaseName} onValueChange={(v) => setPhaseName(String(v))}>
                          <SelectTrigger className={inputClass}>
                            <SelectValue placeholder="Select phase" />
                          </SelectTrigger>
                          <SelectContent>
                            {PHASE_PRESETS.map((p) => (
                              <SelectItem key={p} value={p}>
                                {p}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid gap-2">
                        <Label className={fieldLabel}>Phase notes</Label>
                        <Textarea
                          className="min-h-[88px] rounded-xl resize-y text-base leading-relaxed"
                          placeholder="What happened during this phase..."
                          value={phaseNotes}
                          onChange={(e) => setPhaseNotes(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="secondary"
                        className="h-11 rounded-xl gap-2"
                        onClick={handleAddPhase}
                      >
                        <ListChecks className="h-4 w-4" />
                        Log phase
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              {appointment?.notes && (
                <Card className="border-border/50 bg-muted/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Booking notes</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {appointment.notes}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Test results / attachments */}
              <Card className="border-border/50 shadow-sm">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Paperclip className="h-5 w-5 text-primary" />
                    Test results &amp; files
                  </CardTitle>
                  <CardDescription className="text-sm">
                    Upload charts, consent forms, reports, and audio exported from the instrument.
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {exam.documents && exam.documents.length > 0 ? (
                    <ul className="space-y-2">
                      {exam.documents.map((doc) => (
                        <li
                          key={doc.id}
                          className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5"
                        >
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{doc.name}</div>
                            <div className="text-xs text-muted-foreground capitalize">
                              {doc.type}
                            </div>
                          </div>
                          {doc.url && (
                            <Button
                              variant="ghost"
                              size="sm"
                              render={<a href={doc.url} target="_blank" rel="noopener noreferrer" />}
                            >
                              Open
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground rounded-xl border border-dashed py-5 text-center">
                      No files yet. Upload your first result below.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label className={fieldLabel}>File type</Label>
                    <Select value={docType} onValueChange={(v) => setDocType(String(v))}>
                      <SelectTrigger className={inputClass}>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPES.map((t) => (
                          <SelectItem key={t.value} value={t.value}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-11 gap-2 rounded-xl"
                    disabled={uploading}
                    onClick={() => fileRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    Upload test result
                  </Button>
                </CardContent>
              </Card>

              <Button
                variant="secondary"
                className="w-full h-12 rounded-xl font-bold gap-2"
                disabled={saving}
                onClick={handleSave}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save examination record
              </Button>
            </div>
          </div>

          {/* Report handoff */}
          <Card className="border-primary/30 shadow-sm">
            <CardHeader className="bg-primary/5 pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileSignature className="h-5 w-5 text-primary" />
                Report handoff
              </CardTitle>
              <CardDescription className="text-sm">
                Report writing is a separate step after the examination documentation is complete.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{examStatus === "completed" ? "Documentation complete" : "Complete the documentation first"}</p>
                  <p className="mt-1 text-sm text-muted-foreground">Mark the examination status as Completed and save. Then build, finalize, lock, and send the report from Reports.</p>
                </div>
                {examStatus === "completed" && exam ? (
                  <Button className="shrink-0 gap-2" render={<Link href={`/dashboard/reports/${exam.id}`} />}>
                    <FileSignature className="h-4 w-4" />
                    Open Report Builder
                  </Button>
                ) : (
                  <Button className="shrink-0 gap-2" disabled><FileSignature className="h-4 w-4" />Open Report Builder</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
