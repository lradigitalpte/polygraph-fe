"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Clock,
  FileText,
  Loader2,
  Paperclip,
  PlayCircle,
  Save,
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
import type { AppointmentRecord } from "@/lib/exam-booking";
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
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { ClientPaymentPanel } from "@/components/dashboard/client-payment-panel";

const EXAM_STATUSES = ["scheduled", "in_progress", "completed", "cancelled"] as const;
const DOC_TYPES = [
  { value: "chart", label: "Polygraph chart" },
  { value: "consent", label: "Consent form" },
  { value: "report", label: "Examiner report" },
  { value: "audio", label: "Audio / video" },
  { value: "other", label: "Other" },
] as const;
const PHASE_PRESETS = ["Pre-Test", "In-Test", "Post-Test"] as const;

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export default function ExaminationDocumentationPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const appointmentId = Number(params.appointmentId);
  const { client, appointments, refresh } = useClientDetail();

  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;

  const [exam, setExam] = React.useState<ExamRecord | null>(null);
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
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load examination");
    } finally {
      setLoading(false);
    }
  }, [appointmentId]);

  React.useEffect(() => {
    void loadExam();
  }, [loadExam]);

  const examinerName =
    examiners.find((e) => e.id === appointment?.examiner_id)?.name ??
    (appointment?.examiner_id ? `Examiner #${appointment.examiner_id}` : "—");

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
    return (
      <p className="text-destructive py-12 text-center">Invalid session link.</p>
    );
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
    <div className="space-y-6 pb-20">
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
              <h1 className="text-2xl font-bold tracking-tight">
                {formatAppointmentCode(appointmentId)}
              </h1>
              {exam && (
                <Badge className="bg-primary/15 text-primary border-primary/20 capitalize">
                  {exam.status.replace(/_/g, " ")}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Examination documentation
              {client ? ` · ${client.name}` : ""}
            </p>
            {appointment && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateTime(appointment.scheduled_at)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDuration(appointment.duration)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <User className="h-3.5 w-3.5" />
                  {examinerName}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {appointment && (
        <div className="max-w-md">
          <ClientPaymentPanel
            appointment={appointment}
            clientEmail={client?.email}
            clientId={clientId}
            onUpdated={() => void refresh()}
          />
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading examination...
        </div>
      ) : !exam ? (
        <Card className="border-dashed border-primary/30 bg-primary/5">
          <CardHeader className="text-center pb-2">
            <CardTitle>Start examination documentation</CardTitle>
            <CardDescription className="max-w-md mx-auto">
              This page is your forensic case file for the session — examiner notes, phase
              timeline, and uploaded charts or reports. Testing itself runs on your polygraph
              instrument; this system only stores the documentation.
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
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Examiner notes & findings
                </CardTitle>
                <CardDescription>
                  Pre-test interview, test summary, conclusions, and referral notes.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
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
                    className="min-h-[200px] rounded-xl resize-none text-sm"
                    placeholder="Record pre-test, in-test observations, post-test, and final findings..."
                    value={examNotes}
                    onChange={(e) => setExamNotes(e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base">Session timeline</CardTitle>
                <CardDescription>Log pre-test, in-test, and post-test phases.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {exam.phases && exam.phases.length > 0 ? (
                  <ul className="space-y-2">
                    {exam.phases.map((phase) => (
                      <li
                        key={phase.id}
                        className="rounded-xl border border-border/50 bg-background px-4 py-3"
                      >
                        <div className="font-medium text-sm">{phase.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {formatDateTime(phase.start_time)}
                        </div>
                        {phase.notes && (
                          <p className="text-xs text-muted-foreground mt-2">{phase.notes}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No phases recorded yet.</p>
                )}
                <div className="grid gap-3 pt-2 border-t border-border/50">
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
                      className="min-h-[72px] rounded-xl resize-none text-sm"
                      placeholder="What happened during this phase..."
                      value={phaseNotes}
                      onChange={(e) => setPhaseNotes(e.target.value)}
                    />
                  </div>
                  <Button type="button" variant="secondary" onClick={handleAddPhase}>
                    Log phase
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {appointment?.notes && (
              <Card className="border-border/50 bg-muted/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Booking notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{appointment.notes}</p>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/50 shadow-sm bg-card/50">
              <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Paperclip className="h-4 w-4 text-primary" />
                  Attachments
                </CardTitle>
                <CardDescription>Charts, consent, reports, audio from instrument.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                {exam.documents && exam.documents.length > 0 ? (
                  <ul className="space-y-2">
                    {exam.documents.map((doc) => (
                      <li
                        key={doc.id}
                        className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm"
                      >
                        <div className="min-w-0">
                          <div className="font-medium truncate">{doc.name}</div>
                          <div className="text-[10px] text-muted-foreground capitalize">
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
                  <p className="text-xs text-muted-foreground">No files yet.</p>
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
                  className="w-full gap-2 rounded-xl"
                  disabled={uploading}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload file
                </Button>
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20 gap-2"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save examination record
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
