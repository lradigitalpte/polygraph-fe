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
  LayoutTemplate,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ReportRichTextContent } from "@/components/dashboard/report-rich-text-content";
import { ReportRichTextField } from "@/components/dashboard/report-rich-text-field";
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
  buildReportFromTemplate,
  buildReportSessionContext,
  applyReportFieldDefaults,
  cooperationSentence,
  defaultSignerCaptionFromProfile,
  formatReportPersonName,
  formatVerdictLabel,
  formatVerdictOptionLabel,
  identitySentence,
  normalizeReportVerdictWording,
  parseReportContent,
  reportVerdictWordingDescription,
  resolveExamDate,
  splitSignerCaptionLines,
  verdictColorClass,
  type ReportContent,
  type ReportSessionContext,
  type ReportTemplateRecord,
  type ReportVerdictWording,
} from "@/lib/report-template";
import { fetchReportTemplates, resolveReportTemplate } from "@/lib/report-templates";
import { fetchReport, finalizeReport, parseLegacyImportNotes, requestReportOverrideUnlock, saveDetailedReport, type LegacyImportMeta } from "@/lib/reports";
import { formatClinicClock, formatClinicDateTime } from "@/lib/clinic-time";

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
  const [verdictWording, setVerdictWording] = React.useState<ReportVerdictWording>("plain");
  const [saving, setSaving] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [showPreview, setShowPreview] = React.useState(true);
  const [isLocked, setIsLocked] = React.useState(false);
  const [overrideReason, setOverrideReason] = React.useState("");
  const [overrideDialogOpen, setOverrideDialogOpen] = React.useState(false);
  const [overrideSubmitting, setOverrideSubmitting] = React.useState(false);
  const [finalizeDialogOpen, setFinalizeDialogOpen] = React.useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = React.useState(false);
  const [finalizing, setFinalizing] = React.useState(false);
  const [lockedAt, setLockedAt] = React.useState<string | null>(null);
  const [legacyMeta, setLegacyMeta] = React.useState<LegacyImportMeta | null>(null);
  const [hasSavedReport, setHasSavedReport] = React.useState(false);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [examinerId, setExaminerId] = React.useState("");
  const [authorizationConfirmed, setAuthorizationConfirmed] = React.useState(false);
  const [examinerSignature, setExaminerSignature] = React.useState<{
    image: string;
    title: string;
    organization: string;
    credentials_text?: string;
  } | null>(null);
  const [signatureError, setSignatureError] = React.useState("");
  const [includeCredentials, setIncludeCredentials] = React.useState(false);
  const [lockedCredentialsText, setLockedCredentialsText] = React.useState("");
  const [lockedSignerName, setLockedSignerName] = React.useState("");
  const [lockedSignerCaption, setLockedSignerCaption] = React.useState("");

  // Form states
  const [verdict, setVerdict] = React.useState<string>("NDI");
  const [purpose, setPurpose] = React.useState("");
  const [instrument, setInstrument] = React.useState("");
  const [referenceNo, setReferenceNo] = React.useState("");
  const [examDate, setExamDate] = React.useState("");
  const [reportDate, setReportDate] = React.useState("");
  const [preTestPhaseText, setPreTestPhaseText] = React.useState("");
  const [preTestNotes, setPreTestNotes] = React.useState("");
  const [questions, setQuestions] = React.useState<{ text: string; answer: string; evaluation: string }[]>([]);
  const [examPhaseText, setExamPhaseText] = React.useState("");
  const [limestoneNotes, setLimestoneNotes] = React.useState("");
  const [opinionPhaseText, setOpinionPhaseText] = React.useState("");
  const [postTestNotes, setPostTestNotes] = React.useState("");
  const [section4FollowUp, setSection4FollowUp] = React.useState("");
  const [identityDocumentType, setIdentityDocumentType] = React.useState<"passport" | "emirates_id">("passport");
  const [identityVerificationText, setIdentityVerificationText] = React.useState("");
  const [examStartTime, setExamStartTime] = React.useState("");
  const [examEndTime, setExamEndTime] = React.useState("");
  const [cooperationMode, setCooperationMode] = React.useState<"cooperated" | "counter_measures">("cooperated");
  const [preExamQuestionCountText, setPreExamQuestionCountText] = React.useState("**4 relevant and 3 comparison questions**");
  const [responseLegendText, setResponseLegendText] = React.useState("");
  const [sourceTemplateId, setSourceTemplateId] = React.useState<number | null>(null);
  const [subjectGender, setSubjectGender] = React.useState("");
  const [reportTemplates, setReportTemplates] = React.useState<ReportTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = React.useState<string>("");
  const sessionContextRef = React.useRef<ReportSessionContext | null>(null);
  const draftHydratedRef = React.useRef(false);
  const draftKey = `polygraph:report-draft:${examId}`;
  const readOnly = isLocked;

  const activeTemplate = React.useMemo(
    () => reportTemplates.find((item) => String(item.id) === selectedTemplateId),
    [reportTemplates, selectedTemplateId],
  );

  const signerDisplayName = React.useMemo(() => {
    if (isLocked && lockedSignerName) return lockedSignerName;
    return examiners.find((item) => String(item.id) === examinerId)?.name || "";
  }, [examinerId, examiners, isLocked, lockedSignerName]);
  const signerCaptionLines = React.useMemo(() => {
    if (isLocked && lockedSignerCaption) return lockedSignerCaption;
    return defaultSignerCaptionFromProfile(examinerSignature?.title, examinerSignature?.organization);
  }, [examinerSignature, isLocked, lockedSignerCaption]);
  const examinerCredentialsText = React.useMemo(() => {
    if (isLocked) return lockedCredentialsText;
    return (examinerSignature?.credentials_text || "").trim();
  }, [examinerSignature?.credentials_text, isLocked, lockedCredentialsText]);
  const canIncludeCredentials = examinerCredentialsText.length > 0;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const applyReportContent = React.useCallback((content: ReportContent) => {
    setPurpose(content.purpose);
    setInstrument(content.instrument);
    setReferenceNo(content.reference_no);
    setExamDate(content.exam_date);
    setReportDate(content.report_date);
    setSection4FollowUp(content.section_4_follow_up);
    setPreTestNotes(content.pre_test_notes);
    setQuestions(content.questions);
    setLimestoneNotes(content.limestone_notes);
    setPreTestPhaseText(content.pre_test_phase_text);
    setExamPhaseText(content.exam_phase_text);
    setOpinionPhaseText(content.opinion_phase_text);
    setPostTestNotes(content.post_test_notes);
    setIdentityDocumentType((content.identity_document_type as "passport" | "emirates_id") || "passport");
    setIdentityVerificationText(content.identity_verification_text || "");
    setExamStartTime(content.exam_start_time || "");
    setExamEndTime(content.exam_end_time || "");
    setCooperationMode(content.cooperation_mode || "cooperated");
    setPreExamQuestionCountText(content.pre_exam_question_count_text || "4 relevant and 3 comparison questions");
    setResponseLegendText(content.response_legend_text || "");
    setSourceTemplateId(content.source_template_id ?? null);
  }, []);

  const loadTemplateIntoForm = React.useCallback(
    async (
      template: ReportTemplateRecord,
      ctx: ReportSessionContext,
      gender: string,
      wording: ReportVerdictWording,
      startTime: string,
    ) => {
      const content = applyReportFieldDefaults(
        buildReportFromTemplate(ctx, template, {
          subjectGender: gender,
          identityDocType: "passport",
          cooperationMode: "cooperated",
          verdictLabel: formatVerdictOptionLabel("NDI", wording),
          examStartTime: startTime,
        }),
      );
      applyReportContent(content);
      setSelectedTemplateId(String(template.id));
      setSourceTemplateId(template.id);
    },
    [applyReportContent],
  );

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
      setIncludeCredentials(Boolean(report.include_credentials));
      setLockedCredentialsText(report.credentials_text || "");
      setLockedSignerName(report.signer_name || "");
      setLockedSignerCaption(
        report.signer_caption ||
          defaultSignerCaptionFromProfile(report.signer_title, report.signer_organization),
      );
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
        sessionContextRef.current = ctx;
        const gender = exam.subject?.gender || appointment?.subject?.gender || "";
        setSubjectGender(gender);
        const wording = normalizeReportVerdictWording(client?.report_verdict_wording);
        setVerdictWording(wording);
        const templates = await fetchReportTemplates().catch(() => []);
        if (!cancelled) setReportTemplates(templates);
        const scheduledStart = formatClinicClock(resolveExamDate(exam, appointment));
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
          const template = client?.default_report_template_id
            ? templates.find((item) => item.id === client.default_report_template_id) ||
              (await resolveReportTemplate(exam.client_id).catch(() => null))
            : await resolveReportTemplate(exam.client_id).catch(() => null);
          if (template) {
            setVerdict("NDI");
            await loadTemplateIntoForm(template, ctx, gender, wording, scheduledStart);
          } else {
            applyReportDefaults(ctx);
          }
          if (legacy.reference) {
            setReferenceNo(legacy.reference);
          }
        }
        if (!report?.is_locked) {
          try {
            const localDraft = window.localStorage.getItem(draftKey);
            if (localDraft) {
              const parsed = JSON.parse(localDraft) as { verdict: string; content: ReportContent; savedAt: string };
              if (parsed.content && parsed.verdict) {
                setVerdict(parsed.verdict);
                applyReportContent(parsed.content);
                toast.info(`Recovered an unsaved local draft from ${new Date(parsed.savedAt).toLocaleString()}.`);
              }
            }
          } catch {
            window.localStorage.removeItem(draftKey);
          }
        } else {
          window.localStorage.removeItem(draftKey);
        }
        draftHydratedRef.current = true;
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
  }, [examId, querySubjectName, applyReportContent, applyReportDefaults, applySavedReport, draftKey, loadTemplateIntoForm, router]);

  const handleLoadTemplate = async (templateId: string) => {
    if (isLocked || !templateId || !sessionContextRef.current) return;
    const template = reportTemplates.find((item) => String(item.id) === templateId);
    if (!template) return;
    if (String(template.id) === selectedTemplateId) return;
    const confirmed = window.confirm(
      "Loading this template will replace the current report body text. Session details such as examinee and client will stay the same. Continue?",
    );
    if (!confirmed) return;
    await loadTemplateIntoForm(
      template,
      sessionContextRef.current,
      subjectGender,
      verdictWording,
      examStartTime || formatClinicClock(new Date()),
    );
    setTemplatePickerOpen(false);
    toast.success(`Loaded template: ${template.name}`);
  };

  const handleQuestionCountChange = (value: string) => {
    const previousBare = preExamQuestionCountText.replace(/\*\*/g, "");
    const nextBare = value.replace(/\*\*/g, "");
    const wrapped = value.includes("**") ? value : `**${value}**`;
    setPreExamQuestionCountText(wrapped);
    setPreTestNotes((prev) => {
      if (previousBare && prev.includes(previousBare)) {
        return prev.replace(previousBare, nextBare);
      }
      if (previousBare && prev.includes(`**${previousBare}**`)) {
        return prev.replace(`**${previousBare}**`, wrapped);
      }
      return prev;
    });
  };

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
    report_date: reportDate,
    section_4_follow_up: section4FollowUp,
    limestone_notes: limestoneNotes,
    pre_test_phase_text: preTestPhaseText,
    exam_phase_text: examPhaseText,
    opinion_phase_text: opinionPhaseText,
    identity_document_type: identityDocumentType,
    identity_verification_text: identityVerificationText,
    exam_start_time: examStartTime,
    exam_end_time: examEndTime,
    cooperation_mode: cooperationMode,
    pre_exam_question_count_text: preExamQuestionCountText,
    response_legend_text: responseLegendText,
    source_template_id: sourceTemplateId ?? undefined,
  });

  React.useEffect(() => {
    if (!mounted || loading || isLocked || !draftHydratedRef.current || !examId) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ verdict, content: buildReportPayload(), savedAt: new Date().toISOString() }));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftKey, examDate, examId, examPhaseText, instrument, isLocked, limestoneNotes, loading, mounted, opinionPhaseText, postTestNotes, preTestNotes, preTestPhaseText, purpose, questions, referenceNo, reportDate, section4FollowUp, verdict]);

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
      window.localStorage.removeItem(draftKey);
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
      const result = await finalizeReport(examId, {
        examinerId: Number(examinerId),
        authorizationConfirmed,
        includeCredentials,
      });
      window.localStorage.removeItem(draftKey);
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
      setIncludeCredentials(false);
      setLockedCredentialsText("");
      setLockedSignerName("");
      setLockedSignerCaption("");
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
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {!readOnly && reportTemplates.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              className="rounded-xl h-11 px-5 font-semibold gap-2 max-w-[280px]"
              onClick={() => setTemplatePickerOpen(true)}
            >
              <LayoutTemplate className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {activeTemplate ? activeTemplate.name : "Choose template"}
              </span>
            </Button>
          ) : null}
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
                  This report is immutable{lockedAt ? ` since ${formatClinicDateTime(lockedAt)}` : ""}. Return to Forensic Reports to email the secure PDF to the client.
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


            {/* Ref & Dates & Verdict */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="ref-no" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ref ID · Auto-generated</Label>
                <Input
                  id="ref-no"
                  value={referenceNo}
                  readOnly
                  aria-readonly="true"
                  className="h-10 rounded-xl bg-muted/40 border-border/50 font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="test-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Test Date</Label>
                <Input
                  id="test-date"
                  value={examDate}
                  onChange={(e) => setExamDate(e.target.value)}
                  disabled={readOnly}
                  className="h-10 rounded-xl bg-card border-border/50"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="report-date" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Report Date</Label>
                <Input
                  id="report-date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  disabled={readOnly}
                  className="h-10 rounded-xl bg-card border-border/50"
                />
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Session details</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold">Exam start time</Label>
                  <Input value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} disabled={readOnly} className="h-10 rounded-xl" placeholder="14:00" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground font-semibold">Exam end time</Label>
                  <Input value={examEndTime} onChange={(e) => setExamEndTime(e.target.value)} disabled={readOnly} className="h-10 rounded-xl" placeholder="15:45" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold">Identity verification</Label>
                <div className="flex flex-wrap gap-3">
                  {([
                    ["passport", "Passport"],
                    ["emirates_id", "Emirates ID"],
                  ] as const).map(([value, label]) => (
                    <label key={value} className="flex items-center gap-2 text-xs font-semibold">
                      <input
                        type="radio"
                        name="identity-document-type"
                        checked={identityDocumentType === value}
                        onChange={() => {
                          setIdentityDocumentType(value);
                          setIdentityVerificationText(identitySentence(value));
                        }}
                        disabled={readOnly}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <ReportRichTextField
                  rows={2}
                  value={identityVerificationText}
                  onChange={setIdentityVerificationText}
                  disabled={readOnly}
                  hint="Shown under examinee details on the report."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold">Pre-exam question count phrase</Label>
                <ReportRichTextField
                  rows={2}
                  value={preExamQuestionCountText}
                  onChange={handleQuestionCountChange}
                  disabled={readOnly}
                  hint="Bold phrase inserted into Section 1 pre-test notes (e.g. **4 relevant and 3 comparison questions**)."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground font-semibold">Cooperation line (Section 3)</Label>
                <Select
                  value={cooperationMode}
                  onValueChange={(value) => {
                    const mode = value as "cooperated" | "counter_measures";
                    setCooperationMode(mode);
                    setPostTestNotes(cooperationSentence(mode));
                  }}
                  disabled={readOnly}
                >
                  <SelectTrigger className="rounded-xl h-10 bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cooperated">Examinee cooperated</SelectItem>
                    <SelectItem value="counter_measures">Counter-measures employed</SelectItem>
                  </SelectContent>
                </Select>
                <ReportRichTextField
                  rows={2}
                  value={postTestNotes}
                  onChange={setPostTestNotes}
                  disabled={readOnly}
                  hint="Preset fills this text for Section 3. You can edit it freely — use Bold for emphasis."
                />
              </div>
            </div>

            {/* Verdict Selector */}
            <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/[0.02] p-4">
              <Label className="font-bold flex items-center gap-1.5 text-primary text-xs uppercase tracking-wider mb-2">
                <BrainCircuit className="h-4 w-4" /> Final Evaluation Verdict
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Client wording: {reportVerdictWordingDescription(verdictWording)}
              </p>
              <Select
                value={verdict}
                onValueChange={(val) => setVerdict(String(val))}
                disabled={readOnly}
              >
                <SelectTrigger className="rounded-xl h-11 bg-background">
                  <SelectValue placeholder="Select verdict..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="NDI">{formatVerdictOptionLabel("NDI", verdictWording)}</SelectItem>
                  <SelectItem value="DI">{formatVerdictOptionLabel("DI", verdictWording)}</SelectItem>
                  <SelectItem value="Inconclusive">{formatVerdictOptionLabel("Inconclusive", verdictWording)}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Section 1: Pre-Examination */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 1: Pre-Test Details</h4>
              <div className="space-y-2">
                <Label htmlFor="pretest-intro" className="text-xs text-muted-foreground font-semibold">Introductory Paragraph</Label>
                <ReportRichTextField
                  id="pretest-intro"
                  rows={3}
                  value={preTestPhaseText}
                  onChange={setPreTestPhaseText}
                  disabled={readOnly}
                  placeholder="On 04th May 2026 at about 14:00 hrs..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pretest-notes" className="text-xs text-muted-foreground font-semibold">Consent & Health Statements</Label>
                <ReportRichTextField
                  id="pretest-notes"
                  rows={2}
                  value={preTestNotes}
                  onChange={setPreTestNotes}
                  disabled={readOnly}
                  placeholder="Consent and fitness notes..."
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
                <ReportRichTextField
                  id="exam-intro"
                  rows={2}
                  value={examPhaseText}
                  onChange={setExamPhaseText}
                  disabled={readOnly}
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
                <ReportRichTextField
                  id="limestone"
                  rows={3}
                  value={limestoneNotes}
                  onChange={setLimestoneNotes}
                  disabled={readOnly}
                  hint="Bold the polygram sentence with **Four polygrams, including 1 acquaintance and 3 official tests**"
                />
              </div>
            </div>

            {/* Section 3: Opinion */}
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Section 3: Opinion & Verdict details</h4>
              <div className="space-y-2">
                <Label htmlFor="opinion-statement" className="text-xs text-muted-foreground font-semibold">Opinion notes</Label>
                <ReportRichTextField
                  id="opinion-statement"
                  rows={3}
                  value={opinionPhaseText}
                  onChange={setOpinionPhaseText}
                  disabled={readOnly}
                  placeholder="Based on diagnostic evaluations..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="post-notes" className="text-xs text-muted-foreground font-semibold">Post-Test Statement</Label>
                <p className="text-[10px] text-muted-foreground">Same text as the cooperation line in Session details.</p>
                <ReportRichTextField
                  id="post-notes"
                  rows={2}
                  value={postTestNotes}
                  onChange={setPostTestNotes}
                  disabled={readOnly}
                  placeholder="Post-test notes..."
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

            {/* Signature + credentials options */}
            <div className="space-y-3 rounded-2xl border border-border/50 bg-muted/10 p-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Signature block</h4>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Name, title, and organization come from the signing examiner&apos;s My Profile. They cannot be edited per report.
                </p>
              </div>
              {examinerSignature ? (
                <div className="rounded-xl border bg-white p-3 text-zinc-900 space-y-1">
                  <img src={examinerSignature.image} alt="Examiner signature" className="h-14 max-w-56 object-contain" />
                  <p className="text-xs font-bold">{signerDisplayName || "Examiner name missing"}</p>
                  {splitSignerCaptionLines(signerCaptionLines).map((line) => (
                    <p key={line} className="text-[11px]">{line}</p>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  {signatureError || "Select an examiner with a saved signature to preview the signature block."}
                </p>
              )}
              <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={includeCredentials}
                  disabled={readOnly || !canIncludeCredentials}
                  onChange={(e) => setIncludeCredentials(e.target.checked)}
                />
                <span className="space-y-1">
                  <span className="block font-medium">Include examiner credentials page</span>
                  <span className="block text-[11px] text-muted-foreground">
                    Off by default. When on, a new page with the examiner&apos;s saved credentials is added after the signature.
                    {!canIncludeCredentials
                      ? " This examiner has not added credentials in My Profile yet."
                      : ""}
                  </span>
                </span>
              </label>
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
                  <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 w-auto object-contain" />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider border-b border-zinc-300 pb-1 text-zinc-800">
                    POLYGRAPH EXAM DETAILS
                  </h3>
                  <div className="grid grid-cols-[92px_10px_1fr] items-baseline text-[10px]">
                    <div className="font-bold text-zinc-500 uppercase">REF ID</div>
                    <div className="font-bold text-zinc-500">:</div>
                    <div className="font-semibold text-zinc-900">{referenceNo}</div>
                  </div>
                  <div className="grid grid-cols-[92px_10px_1fr] items-baseline text-[10px]">
                    <div className="font-bold text-zinc-500 uppercase">TEST DATE</div>
                    <div className="font-bold text-zinc-500">:</div>
                    <div className="font-semibold text-zinc-900">{examDate}</div>
                  </div>
                  <div className="grid grid-cols-[92px_10px_1fr] items-baseline text-[10px]">
                    <div className="font-bold text-zinc-500 uppercase">REPORT DATE</div>
                    <div className="font-bold text-zinc-500">:</div>
                    <div className="font-semibold text-zinc-900">{reportDate || examDate}</div>
                  </div>
                  <div className="grid grid-cols-[92px_10px_1fr] items-baseline text-[10px]">
                    <div className="font-bold text-zinc-500 uppercase">EXAMINEE</div>
                    <div className="font-bold text-zinc-500">:</div>
                    <div className="font-black text-zinc-900 uppercase">{formatReportPersonName(subjectName) || "—"}</div>
                  </div>
                  {identityVerificationText ? (
                    <p className="text-[10px] text-zinc-700 whitespace-pre-line pt-2">
                      <ReportRichTextContent text={identityVerificationText} />
                    </p>
                  ) : null}
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 1: PRE-EXAMINATION PHASE
                  </h3>
                  <p className="whitespace-pre-line text-zinc-700">
                    <ReportRichTextContent text={preTestPhaseText} />
                  </p>
                  <p className="whitespace-pre-line text-zinc-700 italic">
                    <ReportRichTextContent text={preTestNotes} />
                  </p>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 2: EXAMINATION PHASE
                  </h3>
                  <p className="text-zinc-700 whitespace-pre-line">
                    <ReportRichTextContent text={examPhaseText} />
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
                      <ReportRichTextContent text={limestoneNotes} />
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
                  <p>Polygraph UAE | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                  <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                  <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                </div>
              </div>
            </div>

            {/* Visual Preview Template Page 2 — Section 3 always starts here */}
            <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col justify-between text-[11px] leading-relaxed select-none border border-zinc-200">
              <div>
                <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                  <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 w-auto object-contain" />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-3">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 3: OPINION OF EXAMINER
                  </h3>
                  <p className="whitespace-pre-line text-zinc-700">
                    <ReportRichTextContent text={opinionPhaseText} />
                  </p>
                  <p className="text-zinc-700">
                    <ReportRichTextContent text={postTestNotes} />
                  </p>
                  <div className="flex items-center gap-2 mt-4 pt-2">
                    <span className="font-black text-xs uppercase text-zinc-800">Result:</span>
                    <span className={`font-black text-xs uppercase ${verdictColorClass(verdict)}`}>
                      {formatVerdictLabel(verdict, verdictWording)}
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
                    <p className="text-[9px] font-black">{signerDisplayName}</p>
                    {splitSignerCaptionLines(signerCaptionLines).map((line) => (
                      <p key={line} className="text-[8px]">{line}</p>
                    ))}
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
                  <p>Polygraph UAE | Office 401-41, Deyaar building, Al Barsha 1, Dubai, United Arab Emirates</p>
                  <p>Website: www.polygraph.ae | Email: info@polygraph.ae</p>
                  <p className="text-[8px] font-black tracking-widest text-zinc-500 uppercase mt-2">STAFF IN CONFIDENCE</p>
                </div>
              </div>
            </div>

            {includeCredentials && examinerCredentialsText ? (
              <div className="w-[210mm] min-h-[297mm] bg-white text-zinc-900 p-[20mm] shadow-2xl relative flex flex-col text-[11px] leading-relaxed select-none mb-8 border border-zinc-200">
                <h2 className="text-base font-black tracking-wide text-[#b46428]">POLYGRAPH EXAMINER CREDENTIALS</h2>
                <div className="mt-6 whitespace-pre-wrap text-[11px] leading-relaxed text-zinc-800">
                  {examinerCredentialsText}
                </div>
              </div>
            ) : null}
          </div>
          ) : null}
        </div>
      )}
      <Dialog open={templatePickerOpen} onOpenChange={setTemplatePickerOpen}>
        <DialogContent className="rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Choose report template</DialogTitle>
            <DialogDescription>
              Loading a template replaces the report body text. Examinee, client, and reference details stay the same.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 max-h-[min(60vh,420px)] overflow-y-auto pr-1">
            {(["generic", "eva"] as const).map((category) => {
              const items = reportTemplates.filter((item) => item.category === category);
              if (items.length === 0) return null;
              return (
                <div key={category} className="space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {category === "eva" ? "Eva templates" : "Generic templates"}
                  </p>
                  <div className="space-y-2">
                    {items.map((template) => {
                      const isActive = String(template.id) === selectedTemplateId;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          disabled={isActive}
                          onClick={() => void handleLoadTemplate(String(template.id))}
                          className="w-full rounded-2xl border border-border/60 bg-card/50 p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/[0.03] disabled:cursor-default disabled:opacity-70 disabled:hover:border-border/60 disabled:hover:bg-card/50"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 space-y-1">
                              <p className="font-bold text-sm leading-tight">{template.name}</p>
                              {template.description ? (
                                <p className="text-xs text-muted-foreground line-clamp-2">{template.description}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              {isActive ? (
                                <Badge variant="secondary" className="text-[9px] uppercase tracking-wider">
                                  Current
                                </Badge>
                              ) : null}
                              {template.is_default ? (
                                <Badge variant="outline" className="text-[9px] uppercase tracking-wider">
                                  Org default
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTemplatePickerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
                setIncludeCredentials(false);
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
              <div className="rounded-xl border bg-white p-3 text-zinc-900 space-y-1">
                <img src={examinerSignature.image} alt="Examiner signature" className="h-14 max-w-56 object-contain" />
                <p className="text-xs font-bold">{signerDisplayName}</p>
                {splitSignerCaptionLines(signerCaptionLines).map((line) => (
                  <p key={line} className="text-[11px]">{line}</p>
                ))}
              </div>
            )}
            {signatureError && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
                {signatureError} Ask the examiner to open My Profile → Report Signature and upload a PNG signature before finalizing.
              </div>
            )}
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={includeCredentials}
                disabled={!canIncludeCredentials}
                onChange={(e) => setIncludeCredentials(e.target.checked)}
              />
              <span className="space-y-1">
                <span className="block">Include examiner credentials page after the signature</span>
                <span className="block text-xs text-muted-foreground">
                  Default is off. {!canIncludeCredentials ? "This examiner has no credentials saved yet." : "Uses the text from the examiner profile."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" className="mt-1" checked={authorizationConfirmed} onChange={(e) => setAuthorizationConfirmed(e.target.checked)} />
              <span>I confirm that I have received this examiner&apos;s authorization to apply their signature to this final report.</span>
            </label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setFinalizeDialogOpen(false)} disabled={finalizing}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void handleFinalize()} disabled={finalizing || !examinerSignature || !authorizationConfirmed || !signerDisplayName.trim() || !signerCaptionLines.trim()} className="gap-2">
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











