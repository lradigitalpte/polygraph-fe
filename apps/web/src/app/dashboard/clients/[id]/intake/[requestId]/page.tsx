"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  Languages,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { authenticatedFetch } from "@/lib/api-client";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";

type SubmittedExaminee = {
  subject_id: number;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  employee_ref?: string;
  nationality?: string;
  gender?: string;
  english_proficiency?: string;
  interpreter_required: boolean;
  preferred_at?: string;
  booked: boolean;
};

type IntakeSubmission = {
  id: number;
  client_id: number;
  client_name: string;
  status: string;
  submitted_at?: string;
  agreed_at?: string;
  subjects: SubmittedExaminee[];
};

async function fetchIntakeSubmission(id: number): Promise<IntakeSubmission> {
  const res = await authenticatedFetch(`/api/intake-requests/${id}/submission`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to load submission");
  return data as IntakeSubmission;
}

// preferred_at is stored as a wall-clock time encoded in UTC; read the UTC parts directly
// so the date/time the client picked round-trips without timezone drift.
function preferredParts(iso?: string): { date: string; time: string } | null {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(iso);
  if (!m) return null;
  return { date: m[1], time: m[2] };
}

function formatPreferred(iso?: string): string {
  const parts = preferredParts(iso);
  if (!parts) return "No preference";
  const d = new Date(`${parts.date}T${parts.time}:00`);
  if (Number.isNaN(d.getTime())) return `${parts.date} · ${parts.time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} · ${parts.time}`;
}

export default function PendingAppointmentsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const requestId = Number(params.requestId);

  const [submission, setSubmission] = React.useState<IntakeSubmission | null>(null);
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  // Per-examinee selection keyed by subject_id.
  const [picks, setPicks] = React.useState<
    Record<number, { examTypeId?: string; examinerId?: string }>
  >({});

  React.useEffect(() => {
    if (!Number.isFinite(requestId)) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [sub, types, exrs] = await Promise.all([
          fetchIntakeSubmission(requestId),
          fetchExamTypes(),
          fetchExaminers(),
        ]);
        if (cancelled) return;
        setSubmission(sub);
        setExamTypes(types.filter((t) => t.active));
        setExaminers(exrs);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  const setPick = (subjectId: number, field: "examTypeId" | "examinerId", value: string) => {
    setPicks((prev) => ({ ...prev, [subjectId]: { ...prev[subjectId], [field]: value } }));
  };

  const handleBook = (examinee: SubmittedExaminee) => {
    const pick = picks[examinee.subject_id];
    if (!pick?.examTypeId || !pick?.examinerId) {
      toast.error("Pick an exam type and examiner first");
      return;
    }
    const qs = new URLSearchParams({
      clientId: String(clientId),
      subjectId: String(examinee.subject_id),
      examTypeId: pick.examTypeId,
      examinerId: pick.examinerId,
    });
    const parts = preferredParts(examinee.preferred_at);
    if (parts) {
      qs.set("date", parts.date);
      qs.set("time", parts.time);
    }
    router.push(`/dashboard/calendar/book?${qs.toString()}`);
  };

  const backHref = `/dashboard/clients/${clientId}/intake`;

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading pending appointments...
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="py-12 space-y-4">
        <p className="text-destructive">{error || "Submission not found."}</p>
        <Button variant="outline" render={<Link href={backHref} />}>
          Back to intake
        </Button>
      </div>
    );
  }

  const pending = submission.subjects.filter((s) => !s.booked);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      <div className="flex items-start gap-3">
        <Link href={backHref} className="mt-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pending appointments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            People submitted by <strong>{submission.client_name}</strong>. Pick an exam type and
            examiner for each, then book — the booking wizard opens pre-filled.
          </p>
        </div>
      </div>

      {submission.agreed_at && (
        <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2.5 text-sm">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-green-600" />
          <span className="text-green-800">
            Declaration accepted on{" "}
            <strong>{new Date(submission.agreed_at).toLocaleString("en-GB")}</strong>.
          </span>
        </div>
      )}

      {pending.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center text-muted-foreground">
            All submitted examinees have been booked. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {submission.subjects.map((ex) => {
            const name = `${ex.first_name} ${ex.last_name}`.trim() || "Examinee";
            const pick = picks[ex.subject_id] ?? {};
            return (
              <Card
                key={ex.subject_id}
                className={ex.interpreter_required ? "border-amber-500/40" : "border-border/60"}
              >
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-base">{name}</CardTitle>
                    {ex.booked ? (
                      <Badge className="bg-green-500/15 text-green-700 border-green-500/30 gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Booked
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground mt-1">
                    {(ex.email || ex.phone) && (
                      <span>{[ex.email, ex.phone].filter(Boolean).join(" · ")}</span>
                    )}
                    {ex.employee_ref && <span>Ref {ex.employee_ref}</span>}
                    {ex.gender && <span>{ex.gender}</span>}
                    {ex.nationality && <span>{ex.nationality}</span>}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Calendar className="h-4 w-4 text-primary" />
                      <span className="text-muted-foreground">Requested:</span>
                      <span className="font-medium">{formatPreferred(ex.preferred_at)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <Languages className="h-4 w-4 text-primary" />
                      <Badge variant="outline">{ex.english_proficiency || "Not assessed"}</Badge>
                    </span>
                    {ex.interpreter_required && (
                      <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                        <AlertTriangle className="h-4 w-4" />
                        Interpreter required
                      </span>
                    )}
                  </div>
                </CardHeader>
                {!ex.booked && (
                  <CardContent className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Exam type
                      </Label>
                      <Select
                        value={pick.examTypeId ?? ""}
                        onValueChange={(v) => setPick(ex.subject_id, "examTypeId", String(v))}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select exam type" />
                        </SelectTrigger>
                        <SelectContent>
                          {examTypes.map((t) => (
                            <SelectItem key={t.id} value={String(t.id)}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Examiner
                      </Label>
                      <Select
                        value={pick.examinerId ?? ""}
                        onValueChange={(v) => setPick(ex.subject_id, "examinerId", String(v))}
                      >
                        <SelectTrigger className="h-11 rounded-xl">
                          <SelectValue placeholder="Select examiner" />
                        </SelectTrigger>
                        <SelectContent>
                          {examiners.map((e) => (
                            <SelectItem key={e.id} value={String(e.id)}>
                              {e.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="h-11 rounded-xl gap-2"
                      disabled={!pick.examTypeId || !pick.examinerId}
                      onClick={() => handleBook(ex)}
                    >
                      <Clock className="h-4 w-4" />
                      Book
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
