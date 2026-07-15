"use client";

import * as React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  FileSignature,
  Plus,
  Trash,
  Loader2,
  Activity,
  BrainCircuit,
  Eye,
  EyeOff,
  Printer,
  Lock,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAppointment, fetchExam } from "@/lib/exam-documentation";
import { fetchClient } from "@/lib/clients";
import { fetchExaminerSignature, fetchExaminers, type UserRecord } from "@/lib/users";
import {
  buildEmptyReportContent,
  buildReportSessionContext,
  formatReportPersonName,
  formatVerdictLabel,
  parseReportContent,
  verdictColorClass,
  type ReportContent,
  type ReportSessionContext,
} from "@/lib/report-template";
import { fetchReport, finalizeReport, parseLegacyImportNotes, requestReportOverrideUnlock, saveDetailedReport, type LegacyImportMeta } from "@/lib/reports";

export default function ReportBuilderPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const examId = Number(params.examId);
  const querySubjectName = searchParams.get("subject") || "";
  const { can } = useCurrentUser();
  const canFinalizeReport = can("exam:report");
  const canOverrideLockedReport = can("exam:report:override");

  const [loading, setLoading] = React.useState(false);
  const [subjectName, setSubjectName] = React.useState(() => formatReportPersonName(querySubjectName));
  const [clientName, setClientName] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(true);
  const [isLocked, setIsLocked] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = React.useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);
  const [lockedAt, setLockedAt] = React.useState<string | null>(null);
  const [legacyMeta, setLegacyMeta] = React.useState<LegacyImportMeta | null>(null);
  const [hasSavedReport, setHasSavedReport] = React.useState(false);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examinerId, setExaminerId] = React.useState("");
  const [authorizationConfirmed, setAuthorizationConfirmed] = React.useState(false);
  const [examinerSignature, setExaminerSignature] = React.useState<{ image: string; title: string; organization: string } | null>(null);
  const [signatureError, setSignatureError] = React.useState("");

  // Form states
  const [verdict, setVerdict] = React.useState<string>("NDI");
  const [purpose, setPurpose] = React.useState("");
  const [instrument, setInstrument] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [examDate, setExamDate] = React.useState("");
  const [preTestPhaseText, setPreTestPhaseText] = React.useState("");
  const [preTestNotes, setPreTestNotes] = React.useState("");
  const [questions, setQuestions] = React.useState<{ text: string; answer: string; evaluation: string }[]>([]);
  const [examPhaseText, setExamPhaseText] = React.useState("");
  const [limestoneNotes, setLimestoneNotes] = React.useState("");
  const [opinionPhaseText, setOpinionPhaseText] = React.useState("");
  const [postTestNotes, setPostTestNotes] = React.useState("");
  const [section4FollowUp, setSection4FollowUp] = React.useState("");
  const readOnly = isLocked;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const applyReportContent = React.useCallback((content: ReportContent) => {
    setPurpose(content.purpose);
    setInstrument(content.instrument);
    setReferenceNo(content.reference_no);
    setExamDate(content.exam_date);
    setSection4FollowUp(content.section_4_follow_up);
    setPreTestNotes(content.pre_test_notes);
    setQuestions(content.questions);
    setLimestoneNotes(content.limestone_notes);
    setPreTestPhaseText(content.pre_test_phase_text);
    setExamPhaseText(content.exam_phase_text);
    setOpinionPhaseText(content.opinion_phase_text);
    setPostTestNotes(content.post_test_notes);
  }, []);

  const applyReportDefaults = React.useCallback(
    (ctx: ReportSessionContext, verdictValue = "NDI") => {
      setVerdict(verdictValue);
      applyReportContent(buildEmptyReportContent(ctx));
    },
    [applyReportContent]
  );

  const applySavedReport = React.useCallback(
    (
      report: NonNullable<Awaited<ReturnType<typeof fetchReport>>>,
      ctx: ReportSessionContext
    ) => {
      const fallback = buildEmptyReportContent(ctx);
      setVerdict(report.verdict || "NDI");
      setIsLocked(Boolean(report.is_locked));
      setLockedAt(report.locked_at ?? null);

      try {
        applyReportContent(parseReportContent(report.content, fallback));
      } catch {
        applyReportDefaults(ctx, report.verdict || "NDI");
      }
    },
    [applyReportContent, applyReportDefaults]
  );

  // Load exam context + any saved report
  React.useEffect(() => {
    if (!examId) return;

    let cancelled = false;
    setLoading(true);

    void (async () => {
      try {
        const [report, exam, examinerRoster] = await Promise.all([fetchReport(examId), fetchExam(examId), fetchExaminers()]);

        const appointment = exam.appointment_id
          ? await fetchAppointment(exam.appointment_id).catch(() => null)
          : null;
        const client = await fetchClient(exam.client_id).catch(() => null);
        const ctx = buildReportSessionContext(
          exam,
          client?.name || appointment?.client?.name || "",
          appointment
        );

        if (cancelled) return;

        setSubjectName(formatReportPersonName(ctx.subjectName || querySubjectName));
        setClientName(ctx.clientName);
        setExaminers(examinerRoster);
        const assignedExaminerId = exam.examiner_id ? String(exam.examiner_id) : "";
        setExaminerId(assignedExaminerId);
        if (assignedExaminerId) {
          const signature = await fetchExaminerSignature(Number(assignedExaminerId)).catch(() => null);
          setExaminerSignature(signature);
          setSignatureError(signature ? "" : "This examiner has not uploaded a report signature in My Profile.");
        }

        const legacy = parseLegacyImportNotes(appointment?.notes);
        setLegacyMeta(legacy.legacyStatus || legacy.legacyResults ? legacy : null);

        if (report) {
          setHasSavedReport(true);
          applySavedReport(report, ctx);
        } else {
          setHasSavedReport(false);
          applyReportDefaults(ctx);
          if (legacy.reference) {
            setReferenceNo(legacy.reference);
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.message.includes("403")) {
          toast.error("You don't have permission to view this locked final report.");
          router.back();
          return;
        }
        toast.error("Failed to load report data");
        setIsLocked(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [examId, querySubjectName, applyReportDefaults, applySavedReport, router]);

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, { text: "", answer: "No", evaluation: "No Reaction" }]);
  };

  const handleRemoveQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, field: "text" | "answer" | "evaluation", value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, [field]: value } : q))
    );
  };

  const buildReportPayload = (): ReportContent => ({
    purpose,
    instrument,
    pre_test_notes: preTestNotes,
    questions,
    post_test_notes: postTestNotes,
    reference_no: referenceNo,
    exam_date: examDate,
    section_4_follow_up: section4FollowUp,
    limestone_notes: limestoneNotes,
    pre_test_phase_text: preTestPhaseText,
    exam_phase_text: examPhaseText,
    opinion_phase_text: opinionPhaseText,
  });

  const handleSave = async () => {
    if (isLocked) {
      toast.error("This report is locked and view-only.");
      return;
    }
    if (!verdict) {
      toast.error("Please select a verdict");
      return;
    }

    setSaving(true);
    try {
      await saveDetailedReport(examId, verdict, buildReportPayload());
      toast.success("Report draft saved. Finalize and lock it when ready to send.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to compile report");
    } finally {
      setSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (isLocked) return;
    if (!verdict) {
      toast.error("Please select a verdict");
      return;
    }

    setFinalizing(true);
    try {
      await saveDetailedReport(examId, verdict, buildReportPayload());
      if (!examinerId || !authorizationConfirmed) {
        toast.error("Select the examiner and confirm their authorization");
        return;
      }
      const result = await finalizeReport(examId, Number(examinerId), authorizationConfirmed);
      setIsLocked(true);
      setLockedAt(result.locked_at ?? new Date().toISOString());
      setFinalizeDialogOpen(false);
      toast.success("Report finalized and locked. You can now email it from Forensic Reports.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to finalize report");
    } finally {
      setFinalizing(false);
    }
  };

  const handleOverrideUnlock = async () => {
    if (!overrideReason.trim()) {
      toast.error("Please enter a reason for the override.");
      return;
    }
    setOverrideSubmitting(true);
    try {
      await requestReportOverrideUnlock(examId, overrideReason.trim());
      setIsLocked(false);
      setLockedAt(null);
      setOverrideDialogOpen(false);
      setOverrideReason("");
      toast.success("Report unlocked for controlled revision. Existing secure shares were expired.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to unlock report");
    } finally {
      setOverrideSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] rounded-[2.5rem] border border-border/50 bg-background/95 backdrop-blur-xl overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-border/40 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <FileSignature className="h-6 w-6 text-primary" />
              Polygraph Forensic Report Builder
            </h1>
            <p className="font-semibold text-xs text-muted-foreground mt-1">
              {subjectName ? (
                <>
                  Examinee: <span className="text-foreground">{subjectName}</span>
                  {clientName ? (
                    <>
                      {" "}
                      · Client: <span className="text-foreground">{clientName}</span>
                    </>
                  ) : null}
                </>
              ) : (
                "Configure report sections on the left and preview the official formatted template on the right."
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl h-11 px-5 hover:bg-muted/50 font-semibold"
            onClick={() => setShowPreview((current) => !current)}
          >
            {showPreview ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            {showPreview ? "Hide Preview" : "Show Preview"}
          </Button>
          {isLocked && canOverrideLockedReport ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-11 px-5 font-semibold"
              onClick={() => setOverrideDialogOpen(true)}
            >
              <ArrowLeft className="mr-2 h-4 w-4 rotate-180" />
              Unlock For Revision
            </Button>
          ) : null}
          {!isLocked && canFinalizeReport ? (
            <Button
              type="button"
              variant="secondary"
              className="rounded-xl h-11 px-5 font-bold gap-2"
              onClick={() => setFinalizeDialogOpen(true)}
              disabled={saving || finalizing || loading}
            >
              <Lock className="h-4 w-4" />
              Finalize & Sign
            </Button>
          ) : null}
          <Button
            variant="outline"
            className="rounded-xl h-11 px-5 hover:bg-muted/50 font-semibold"
            onClick={() => router.back()}
          >
            {isLocked ? "Close" : "Cancel / Draft"}
          </Button>
          <Button
            className="rounded-xl font-bold gap-2 h-11 px-6 bg-primary hover:scale-[1.02] shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all text-primary-foreground"
            onClick={() => void handleSave()}
            disabled={saving || loading || isLocked}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving Report...
              </>
            ) : isLocked ? (
              <>
                <Eye className="h-4 w-4" />
                View Only
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                Save Report
              </>
            )}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center flex-1">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Form Editor (Scrollable) */}
          <div className={`${showPreview ? "lg:col-span-5 lg:border-r" : "lg:col-span-12"} border-border/40 overflow-y-auto p-6 space-y-6 max-h-[calc(100vh-140px)]`}>
            <h3 className="text-sm font-black uppercase tracking-wider text-primary border-b border-primary/20 pb-2">
              Report Parameters
            </h3>            {isLocked ? (
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-950">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                  <Lock className="h-4 w-4" /> Final Report Locked
                </div>
                <p className="mt-2 text-xs text-emerald-900/80">
                  This report is immutable{lockedAt ? ` since ${new Date(lockedAt).toLocaleString()}` : ""}. Return to Forensic Reports to email the secure PDF to the client.
                  {canOverrideLockedReport ? " An authorized admin can unlock it for revision if needed." : ""}
                </p>
              </div>
            ) : legacyMeta && !hasSavedReport ? (
              <div className="rounded-2xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-950">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                  <Activity className="h-4 w-4" /> Assessment complete — write formal report
                </div>
                <p className="mt-2 text-xs text-blue-900/80">
                  The examination session is marked complete from your legacy import. Spreadsheet status/results below are reference only — write the official Polygraph report here, then finalize and send.
                </p>
                <div className="mt-3 grid gap-1 text-xs text-blue-900/90">
                  {legacyMeta.legacyStatus && (
                    <p><span className="font-semibold">Legacy session status:</span> {legacyMeta.legacyStatus}</p>
                  )}
                  {legacyMeta.legacyResults && (
                    <p><span className="font-semibold">Legacy result:</span> {legacyMeta.legacyResults}</p>
                  )}
                  {legacyMeta.reference && (
                    <p><span className="font-semibold">Reference:</span> {legacyMeta.reference}</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-950">
                <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[11px]">
                  <FileSignature className="h-4 w-4" /> Draft In Progress
                </div>
                <p className="mt-2 text-xs text-amber-900/80">
                  Save your draft as you work, then use <span className="font-semibold">Finalize &amp; Lock</span> when the report is ready to send. Locked reports cannot be edited unless an admin unlocks them.
                </p>
              </div>
            )}


            {/* Ref & Date & Verdict */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ref-no" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Our Reference</Label>
                <Input
                  id="ref-no"
                  value={referenceNo}
                  onChange={(e) => setReferenceNo(e.target.value)}
                  disabled={readOnly}
                  className="h-10 rounded-xl bg-card border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exam Date</Label>
                <Input
                  id="date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  disabled={readOnly}
                  className="h-10 rounded-xl bg-card border-border/50"
                />
              </div>
            </div>

            {/* Verdict Selector */}
            <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4">
              <Label className="font-bold flex items-center gap-1.5 text-primary text-xs uppercase tracking-wider mb-2">
                <BrainCircuit className="h-4 w-4" /> Final Evaluation Verdict
              </Label>
              <Select
                value={verdict}
                onValueChange={(val) => setVerdict(String(val))}
                disabled={readOnly}
              >
                <SelectTrigger className="rounded-xl h-11 bg-background">
                  <SelectValue placeholder="Select verdict..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="NDI">No Deception Indicated (NDI) / Truthful</SelectItem>
                  <SelectItem value="DI">Deception Indicated (DI) / Not Truthful</SelectItem>
                  <SelectItem value="Inconclusive">Inconclusive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Section 1: Pre-Examination */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 1: Pre-Test Details</h4>
              <div className="space-y-2">
                <Label htmlFor="pretest-intro" className="text-xs text-muted-foreground font-semibold">Introductory Paragraph</Label>
                <Textarea
                  id="pretest-intro"
                  rows={3}
                  value={preTestPhaseText}
                  onChange={(e) => setPreTestPhaseText(e.target.value)}
                  disabled={readOnly}
                  placeholder="On 04th May 2026 at about 14:00 hrs..."
                  className="rounded-xl text-xs bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pretest-notes" className="text-xs text-muted-foreground font-semibold">Consent & Health Statements</Label>
                <Textarea
                  id="pretest-notes"
                  rows={2}
                  value={preTestNotes}
                  onChange={(e) => setPreTestNotes(e.target.value)}
                  disabled={readOnly}
                  placeholder="Consent and fitness notes..."
                  className="rounded-xl text-xs bg-card"
                />
              </div>
            </div>

            {/* Section 2: Questions Table */}
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-border/40 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <Activity className="h-4 w-4" /> Section 2: Questions asked
                </h4>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl text-xs gap-1.5 h-8"
                  onClick={handleAddQuestion}
                  disabled={readOnly}
                >
                  <Plus className="h-3.5 w-3.5" /> Add Question
                </Button>
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam-intro" className="text-xs text-muted-foreground font-semibold font-bold">Introductory statement</Label>
                <Textarea
                  id="exam-intro"
                  rows={2}
                  value={examPhaseText}
                  onChange={(e) => setExamPhaseText(e.target.value)}
                  disabled={readOnly}
                  className="rounded-xl text-xs bg-card"
                />
              </div>

              <div className="space-y-3">
                {questions.map((q, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col gap-2 p-3 rounded-2xl border border-border/40 bg-card relative"
                  >
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] font-black uppercase text-primary">Question #{idx + 1}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-lg hover:bg-rose-500/10 hover:text-rose-500"
                        onClick={() => handleRemoveQuestion(idx)}
                        disabled={readOnly}
                      >
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Input
                      placeholder="Type question text..."
                      value={q.text}
                      onChange={(e) => handleQuestionChange(idx, "text", e.target.value)}
                      disabled={readOnly}
                      className="h-9 rounded-lg"
                    />
                    <div className="grid grid-cols-2 gap-2 mt-1">
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground uppercase font-bold">Answer</Label>
                        <Select
                          value={q.answer}
                          onValueChange={(val) => handleQuestionChange(idx, "answer", String(val))}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            <SelectItem value="Yes">Yes</SelectItem>
                            <SelectItem value="No">No</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[9px] text-muted-foreground uppercase font-bold">Evaluation</Label>
                        <Select
                          value={q.evaluation}
                          onValueChange={(val) => handleQuestionChange(idx, "evaluation", String(val))}
                          disabled={readOnly}
                        >
                          <SelectTrigger className="h-8 rounded-lg text-xs bg-background">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-lg">
                            <SelectItem value="No Reaction">No Reaction</SelectItem>
                            <SelectItem value="Reaction / Deceptive">Reaction / Deceptive</SelectItem>
                            <SelectItem value="Inconclusive">Inconclusive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <Label htmlFor="limestone" className="text-xs text-muted-foreground font-semibold">Instrument & Recording statement</Label>
                <Textarea
                  id="limestone"
                  rows={3}
                  value={limestoneNotes}
                  onChange={(e) => setLimestoneNotes(e.target.value)}
                  disabled={readOnly}
                  className="rounded-xl text-xs bg-card"
                />
              </div>
            </div>

            {/* Section 3: Opinion */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 3: Opinion & Verdict details</h4>
              <div className="space-y-2">
                <Label htmlFor="opinion-statement" className="text-xs text-muted-foreground font-semibold">Opinion notes</Label>
                <Textarea
                  id="opinion-statement"
                  rows={3}
                  value={opinionPhaseText}
                  onChange={(e) => setOpinionPhaseText(e.target.value)}
                  disabled={readOnly}
                  placeholder="Based on diagnostic evaluations..."
                  className="rounded-xl text-xs bg-card"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-notes" className="text-xs text-muted-foreground font-semibold">Post-Test Statement</Label>
                <Textarea
                  id="post-notes"
                  rows={2}
                  value={postTestNotes}
                  onChange={(e) => setPostTestNotes(e.target.value)}
                  disabled={readOnly}
                  placeholder="Post-test notes..."
                  className="rounded-xl text-xs bg-card"
                />
              </div>
            </div>

            {/* Section 4: Follow up */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 4: Follow Up</h4>
              <div className="space-y-2">
                <Label htmlFor="follow-up" className="text-xs text-muted-foreground font-semibold">Requesting Agency Follow-up</Label>
                <Input
                  id="follow-up"
                  value={section4FollowUp}
                  onChange={(e) => setSection4FollowUp(e.target.value)}
                  disabled={readOnly}
                  className="h-10 rounded-xl bg-card border-border/50 text-xs"
                />
              </div>
            </div>
          </div>


          {/* Right Column: Live A4 Document Preview */}
          {showPreview ? (
          <div className="lg:col-span-7 bg-zinc-950/40 p-8 overflow-y-auto max-h-[calc(100vh-140px)] flex flex-col items-center">
            <div className="sticky top-0 w-full flex justify-between items-center mb-4 z-10 bg-zinc-900/60 backdrop-blur px-4 py-2.5 rounded-2xl border border-border/40">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-4 w-4 text-primary" /> Live Document Preview
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 rounded-lg px-2.5 text-[10px] font-bold uppercase tracking-wider"
                  onClick={() => setShowPreview(false)}
                >
                  <EyeOff className="mr-1.5 h-3.5 w-3.5" />
                  Hide Preview
                </Button>
                <span className="text-[10px] text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
                  A4 Ratio Print Simulated
                </span>
              </div>
            </div>

            {/* Visual Preview Template Page 1 */}
            <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col justify-between text-[11px] leading-relaxed select-none mb-8 border border-zinc-200">
              <div>
                <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                  <div className="flex items-center gap-2">
                    <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 object-contain" />
                    <div className="flex flex-col">
                      <span className="text-sm font-black tracking-tight text-red-600">POLYGRAPH UAE</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                    EXAMINEE INFORMATION
                  </h3>
                  <div className="grid grid-cols-12 text-[10px]">
                    <div className="col-span-3 font-bold text-zinc-500 uppercase">OUR REF</div>
                    <div className="col-span-9 font-semibold text-zinc-900">: {referenceNo}</div>
                  </div>
                  <div className="grid grid-cols-12 text-[10px]">
                    <div className="col-span-3 font-bold text-zinc-500 uppercase">DATE</div>
                    <div className="col-span-9 font-semibold text-zinc-900">: {examDate}</div>
                  </div>
                  <div className="grid grid-cols-12 text-[10px]">
                    <div className="col-span-3 font-bold text-zinc-500 uppercase">EXAMINEE</div>
                    <div className="col-span-9 font-black text-zinc-900">: {subjectName || "—"}</div>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 1: PRE-EXAMINATION PHASE
                  </h3>
                  <p className="whitespace-pre-line text-zinc-700">
                    {preTestPhaseText}
                  </p>
                  <p className="whitespace-pre-line text-zinc-700 italic">
                    {preTestNotes}
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 2: EXAMINATION PHASE
                  </h3>
                  <p className="text-zinc-700 whitespace-pre-line">
                    {examPhaseText}
                  </p>

                  {questions.length > 0 && (
                    <table className="mt-2 w-full table-fixed border-collapse border border-zinc-300 text-left">
                      <thead>
                        <tr className="bg-zinc-50 text-[8px] font-black uppercase text-zinc-500 tracking-wider border-b border-zinc-300">
                          <th className="w-12 border border-zinc-300 px-2 py-1.5 text-center">S/N</th>
                          <th className="border border-zinc-300 px-3 py-1.5">Questions</th>
                          <th className="w-36 border border-zinc-300 px-3 py-1.5 text-center">Examinee Response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, idx) => (
                          <tr key={idx} className="border-b border-zinc-200">
                            <td className="align-top border border-zinc-300 px-2 py-2 text-center font-semibold text-zinc-500">{idx + 1}</td>
                            <td className="border border-zinc-300 px-3 py-2 text-zinc-700 italic font-medium whitespace-normal break-words leading-6">{q.text || "-"}</td>
                            <td className="border border-zinc-300 px-3 py-2 text-center font-black text-zinc-900 align-middle">{q.answer}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {limestoneNotes.trim() ? (
                    <p className="text-zinc-700 whitespace-pre-line mt-4">
                      {limestoneNotes}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="border-t border-zinc-200 pt-6 mt-8 space-y-4">
                <div className="flex justify-center items-center gap-8">
                  <img src="/americanpolygraphassociation.png" alt="APA" className="h-10 w-10 object-contain grayscale opacity-80" />
                  <img src="/singaporeassociationofpolygraph.jfif" alt="SAP" className="h-8 w-16 object-contain grayscale opacity-80" />
                </div>
                <div className="text-[7.5px] text-zinc-400 text-center space-y-1 font-semibold">
                  <p>Polygraph International HR Consultancy LLC | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                  <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                  <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                </div>
              </div>
            </div>

            {/* Visual Preview Template Page 2 — Section 3 always starts here */}
            <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col justify-between text-[11px] leading-relaxed select-none border border-zinc-200">
              <div>
                <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                  <div className="flex items-center gap-2">
                    <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 object-contain" />
                    <div className="flex flex-col">
                      <span className="text-sm font-black tracking-tight text-red-600">POLYGRAPH UAE</span>
                    </div>
                  </div>
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 3: OPINION OF EXAMINER
                  </h3>
                  <p className="whitespace-pre-line text-zinc-700">
                    {opinionPhaseText}
                  </p>
                  <p className="text-zinc-700">
                    {postTestNotes}
                  </p>
                  <div className="flex items-center gap-2 mt-4 pt-2">
                    <span className="font-black text-xs uppercase text-zinc-800">Result:</span>
                    <span className={`font-black text-xs uppercase ${verdictColorClass(verdict)}`}>
                      {formatVerdictLabel(verdict)}
                    </span>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 4: FOLLOW-UP BY REQUESTING AGENCY
                  </h3>
                  <p className="text-zinc-700 font-semibold italic">
                    {section4FollowUp}
                  </p>
                </div>

                {examinerSignature && (
                  <div className="mt-8 text-zinc-800">
                    <p className="text-[8px] font-bold">Electronically signed by:</p>
                    <img src={examinerSignature.image} alt="Examiner signature" className="mt-1 h-14 max-w-48 object-contain" />
                    <p className="text-[9px] font-black">{examiners.find((item) => String(item.id) === examinerId)?.name}</p>
                    <p className="text-[8px]">{examinerSignature.title}</p>
                    <p className="text-[8px]">{examinerSignature.organization}</p>
                    <p className="mt-1 text-[7px] text-zinc-500">Signing date and verification code are added when the final PDF is issued.</p>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-200 pt-6 mt-8 space-y-4">
                <div className="flex justify-center items-center gap-8">
                  <img src="/americanpolygraphassociation.png" alt="APA" className="h-10 w-10 object-contain grayscale opacity-80" />
                  <img src="/singaporeassociationofpolygraph.jfif" alt="SAP" className="h-8 w-16 object-contain grayscale opacity-80" />
                </div>
                <div className="text-[7.5px] text-zinc-400 text-center space-y-1 font-semibold">
                  <p>Polygraph UAE HR Consultancy LLC | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                  <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                  <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                </div>
              </div>
            </div>
          </div>
          ) : null}
        </div>
      )}
      <Dialog open={finalizeDialogOpen} onOpenChange={setFinalizeDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Finalize and electronically sign this report?</DialogTitle>
            <DialogDescription>
              Select the responsible examiner. Their saved signature will be placed on the PDF and the authorization will be recorded privately in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Signing examiner</Label>
              <Select value={examinerId} onValueChange={(value) => {
                const id = String(value ?? "");
                setExaminerId(id);
                setAuthorizationConfirmed(false);
                setSignatureError("");
                void fetchExaminerSignature(Number(id))
                  .then((signature) => {
                    setExaminerSignature(signature);
                    setSignatureError("");
                  })
                  .catch(() => {
                    setExaminerSignature(null);
                    setSignatureError("This examiner has not uploaded a report signature in My Profile.");
                  });
              }}>
                <SelectTrigger>
                  <span className="truncate">
                    {examiners.find((item) => String(item.id) === examinerId)?.name || "Select examiner"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {examiners.map((examiner) => <SelectItem key={examiner.id} value={String(examiner.id)}>{examiner.name}{examiner.has_signature ? "" : " (signature missing)"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {examinerSignature && (
              <div className="rounded-xl border bg-white p-3 text-zinc-900">
                <img src={examinerSignature.image} alt="Examiner signature" className="h-14 max-w-56 object-contain" />
                <p className="font-bold">{examiners.find((item) => String(item.id) === examinerId)?.name}</p>
                <p className="text-xs">{examinerSignature.title}</p><p className="text-xs">{examinerSignature.organization}</p>
              </div>
            )}
            {signatureError && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                {signatureError} Ask the examiner to open My Profile → Report Signature and upload a PNG signature before finalizing.
              </div>
            )}
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={authorizationConfirmed} onChange={(e) => setAuthorizationConfirmed(e.target.checked)} />
              <span>I confirm that I have received this examiner&apos;s authorization to apply their signature to this final report.</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFinalizeDialogOpen(false)} disabled={finalizing}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleFinalize()} disabled={finalizing || !examinerSignature || !authorizationConfirmed} className="gap-2">
              {finalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
              Finalize & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={overrideDialogOpen} onOpenChange={setOverrideDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Unlock Locked Report</DialogTitle>
            <DialogDescription>
              This action reopens the locked report for revision and expires any active secure shares. A reason is required and the action is written to the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="override-reason">Override Reason</Label>
            <Textarea
              id="override-reason"
              rows={4}
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="Explain why this final report must be reopened for revision..."
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOverrideDialogOpen(false)} disabled={overrideSubmitting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleOverrideUnlock()} disabled={overrideSubmitting}>
              {overrideSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Confirm Unlock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}











