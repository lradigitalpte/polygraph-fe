"use client";

import * as React from "react";
import { useUIStore } from "@/lib/store";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  Plus,
  Loader2,
  Activity,
  Eye,
  EyeOff,
  ListChecks,
  Save,
  LockOpen,
  X,
  FilePen,
  Trash2,
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
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Segmented } from "@/components/dashboard/ui-kit";
import { CredentialsRichTextContent } from "@/components/dashboard/credentials-rich-text-editor";
import { ReportRichTextContent } from "@/components/dashboard/report-rich-text-content";
import { ReportRichTextField } from "@/components/dashboard/report-rich-text-field";
import { isCredentialsEmpty } from "@/lib/credentials-rich-text";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchAppointment, fetchExam } from "@/lib/exam-documentation";
import { fetchExamQuestions } from "@/lib/exam-questions";
import { fetchClient } from "@/lib/clients";
import { fetchExaminerSignature, fetchExaminers, type UserRecord } from "@/lib/users";
import {
  buildEmptyReportContent,
  buildQuestionsFromExamQuestions,
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
  syncOpinionPhaseTextWithVerdict,
  verdictColorClass,
  type ReportContent,
  type ReportSessionContext,
  type ReportTemplateRecord,
  type ReportVerdictWording,
} from "@/lib/report-template";
import { richTextToPlain } from "@/lib/report-rich-text";
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
  const [mobileTab, setMobileTab] = React.useState<"editor" | "preview">("editor");
  const editorScrollRef = React.useRef<HTMLDivElement>(null);

  // The builder needs the width: collapse the sidebar while it's open and
  // restore whatever the user had when they leave.
  React.useEffect(() => {
    const { isSidebarCollapsed, setSidebarCollapsed } = useUIStore.getState();
    const wasCollapsed = isSidebarCollapsed;
    setSidebarCollapsed(true);
    return () => useUIStore.getState().setSidebarCollapsed(wasCollapsed);
  }, []);
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
  const [loadingSessionQuestions, setLoadingSessionQuestions] = React.useState(false);
  const [replaceQuestionsDialogOpen, setReplaceQuestionsDialogOpen] = React.useState(false);
  const [examPhaseText, setExamPhaseText] = React.useState("");
  const [limestoneNotes, setLimestoneNotes] = React.useState("");
  const [opinionPhaseText, setOpinionPhaseText] = React.useState("");
  const [examinersObservationEnabled, setExaminersObservationEnabled] = React.useState(false);
  const [examinersObservationText, setExaminersObservationText] = React.useState("");
  const [postTestNotes, setPostTestNotes] = React.useState("");
  const [section4FollowUp, setSection4FollowUp] = React.useState("");
  const [identityDocumentType, setIdentityDocumentType] = React.useState<"passport" | "emirates_id">("passport");
  const [identityVerificationText, setIdentityVerificationText] = React.useState("");
  const [examStartTime, setExamStartTime] = React.useState("");
  const [examEndTime, setExamEndTime] = React.useState("");
  const [cooperationMode, setCooperationMode] = React.useState<"cooperated" | "counter_measures">("cooperated");
  const [preExamQuestionCountText, setPreExamQuestionCountText] = React.useState("**4 relevant and 3 comparison questions**");
  const [responseLegendText, setResponseLegendText] = React.useState("");
  const [enableColorCoding, setEnableColorCoding] = React.useState(false);
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
    return examinerSignature?.credentials_text || "";
  }, [examinerSignature?.credentials_text, isLocked, lockedCredentialsText]);
  const canIncludeCredentials = !isCredentialsEmpty(examinerCredentialsText);

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
    setExaminersObservationEnabled(!!content.examiners_observation_enabled);
    setExaminersObservationText(content.examiners_observation_text || "");
    setPostTestNotes(content.post_test_notes);
    setIdentityDocumentType((content.identity_document_type as "passport" | "emirates_id") || "passport");
    setIdentityVerificationText(content.identity_verification_text || "");
    setExamStartTime(content.exam_start_time || "");
    setExamEndTime(content.exam_end_time || "");
    setCooperationMode(content.cooperation_mode || "cooperated");
    setPreExamQuestionCountText(content.pre_exam_question_count_text || "4 relevant and 3 comparison questions");
    setResponseLegendText(content.response_legend_text || "");
    setEnableColorCoding(!!content.enable_color_coding);
    setSourceTemplateId(content.source_template_id ?? null);
  }, []);

  const loadTemplateIntoForm = React.useCallback(
    async (
      template: ReportTemplateRecord,
      ctx: ReportSessionContext,
      gender: string,
      wording: ReportVerdictWording,
      startTime: string,
      verdictValue = "NDI",
    ) => {
      const content = applyReportFieldDefaults(
        buildReportFromTemplate(ctx, template, {
          subjectGender: gender,
          identityDocType: "passport",
          cooperationMode: "cooperated",
          verdictLabel: formatVerdictOptionLabel(verdictValue, wording),
          examStartTime: startTime,
        }),
      );
      content.opinion_phase_text = syncOpinionPhaseTextWithVerdict(
        content.opinion_phase_text,
        verdictValue,
        wording,
        ctx.subjectName,
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
      ctx: ReportSessionContext,
      wording: ReportVerdictWording,
    ) => {
      const fallback = buildEmptyReportContent(ctx);
      const verdictValue = report.verdict || "NDI";
      setVerdict(verdictValue);
      setIsLocked(Boolean(report.is_locked));
      setLockedAt(report.locked_at ?? null);

      try {
        const parsed = parseReportContent(report.content, fallback);
        parsed.opinion_phase_text = syncOpinionPhaseTextWithVerdict(
          parsed.opinion_phase_text,
          verdictValue,
          wording,
          ctx.subjectName,
        );
        applyReportContent(parsed);
      } catch {
        applyReportDefaults(ctx, verdictValue);
      }
      setIncludeCredentials(Boolean(report.include_credentials));
      setLockedCredentialsText(report.credentials_text || "");
      setLockedSignerName(report.signer_name || "");
      setLockedSignerCaption(
        report.signer_caption ||
          defaultSignerCaptionFromProfile(report.signer_title, report.signer_organization),
      );
    },
    [applyReportContent, applyReportDefaults],
  );

  const handleVerdictChange = React.useCallback(
    (newVerdict: string) => {
      setVerdict(newVerdict);
      setOpinionPhaseText((prev) =>
        syncOpinionPhaseTextWithVerdict(prev, newVerdict, verdictWording, subjectName),
      );
    },
    [subjectName, verdictWording],
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
          applySavedReport(report, ctx, wording);
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
                applyReportContent({
                  ...parsed.content,
                  opinion_phase_text: syncOpinionPhaseTextWithVerdict(
                    parsed.content.opinion_phase_text,
                    parsed.verdict,
                    wording,
                    ctx.subjectName,
                  ),
                });
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
      verdict,
    );
    setTemplatePickerOpen(false);
    toast.success(`Loaded template: ${template.name}`);
  };

  const handleQuestionCountChange = (value: string) => {
    const previousBare = richTextToPlain(preExamQuestionCountText);
    const nextBare = richTextToPlain(value);
    setPreExamQuestionCountText(value);
    if (!previousBare || !nextBare || previousBare === nextBare) return;
    setPreTestNotes((prev) => {
      if (prev.includes(preExamQuestionCountText)) {
        return prev.replace(preExamQuestionCountText, value);
      }
      if (prev.includes(`**${previousBare}**`)) {
        return prev.replace(`**${previousBare}**`, value);
      }
      if (prev.includes(previousBare)) {
        return prev.replace(previousBare, nextBare);
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

  const applyQuestionsFromSession = async () => {
    setLoadingSessionQuestions(true);
    try {
      const examQuestions = await fetchExamQuestions(examId);
      if (examQuestions.length === 0) {
        toast.error("No questions recorded for this session yet");
        return;
      }
      const { questions: loaded, countText } = buildQuestionsFromExamQuestions(examQuestions);
      setQuestions(loaded);
      handleQuestionCountChange(countText);
      toast.success("Loaded questions from the session");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load session questions");
    } finally {
      setLoadingSessionQuestions(false);
    }
  };

  const handleLoadQuestionsFromSession = async () => {
    if (questions.length > 0) {
      setReplaceQuestionsDialogOpen(true);
      return;
    }
    await applyQuestionsFromSession();
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
    examiners_observation_enabled: examinersObservationEnabled,
    examiners_observation_text: examinersObservationText,
    identity_document_type: identityDocumentType,
    identity_verification_text: identityVerificationText,
    exam_start_time: examStartTime,
    exam_end_time: examEndTime,
    cooperation_mode: cooperationMode,
    pre_exam_question_count_text: preExamQuestionCountText,
    response_legend_text: responseLegendText,
    enable_color_coding: enableColorCoding,
    source_template_id: sourceTemplateId ?? undefined,
  });

  React.useEffect(() => {
    if (!mounted || loading || isLocked || !draftHydratedRef.current || !examId) return;
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(draftKey, JSON.stringify({ verdict, content: buildReportPayload(), savedAt: new Date().toISOString() }));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [draftKey, enableColorCoding, examDate, examId, examPhaseText, examinersObservationEnabled, examinersObservationText, instrument, isLocked, limestoneNotes, loading, mounted, opinionPhaseText, postTestNotes, preTestNotes, preTestPhaseText, purpose, questions, referenceNo, reportDate, section4FollowUp, verdict]);

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

  const statusLabel = isLocked ? "Locked" : hasSavedReport ? "Draft" : "New report";
  // Scroll only the editor column — scrollIntoView would also scroll the
  // dashboard's outer containers and leave a gap under the builder.
  const scrollToSection = (id: string) => {
    const container = editorScrollRef.current;
    const target = document.getElementById(id);
    if (!container || !target) return;
    const top =
      target.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 56;
    container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border/50 px-3 py-3 sm:px-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            aria-label="Back to reports"
            title="Back to reports"
            onClick={() => router.back()}
            className="flex size-10 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-1 ring-border transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
          </button>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h1 className="truncate text-lg leading-tight font-medium tracking-[-0.01em] sm:text-xl">
                {subjectName || "Polygraph report"}
              </h1>
              <BuilderStatusPill label={statusLabel} locked={isLocked} />
            </div>
            <p className="mt-0.5 truncate text-[13px] text-muted-foreground">
              {clientName ? <>{clientName} · </> : null}
              {referenceNo ? <span className="font-mono text-xs">{referenceNo}</span> : "Report builder"}
            </p>
          </div>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:justify-end">
          {!readOnly && reportTemplates.length > 0 ? (
            <HeaderButton icon={LayoutTemplate} onClick={() => setTemplatePickerOpen(true)} title="Choose template">
              <span className="max-w-[160px] truncate">{activeTemplate ? activeTemplate.name : "Choose template"}</span>
            </HeaderButton>
          ) : null}
          <HeaderButton
            icon={showPreview ? EyeOff : Eye}
            onClick={() => setShowPreview((current) => !current)}
            className="hidden lg:flex"
          >
            {showPreview ? "Hide preview" : "Show preview"}
          </HeaderButton>
          {isLocked && canOverrideLockedReport ? (
            <HeaderButton icon={LockOpen} onClick={() => setOverrideDialogOpen(true)}>
              Unlock for revision
            </HeaderButton>
          ) : null}
          {isLocked ? (
            <HeaderButton icon={X} onClick={() => router.back()}>
              Close
            </HeaderButton>
          ) : (
            <>
              <HeaderButton icon={saving ? Loader2 : Save} spin={saving} onClick={() => void handleSave()} disabled={saving || loading}>
                {saving ? "Saving…" : "Save draft"}
              </HeaderButton>
              {canFinalizeReport ? (
                <button
                  type="button"
                  onClick={() => setFinalizeDialogOpen(true)}
                  disabled={saving || finalizing || loading}
                  className="flex h-10 flex-1 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 sm:flex-initial dark:bg-secondary dark:text-secondary-foreground"
                >
                  <Lock aria-hidden="true" className="size-4" />
                  Finalize &amp; sign
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      {/* Mobile: switch between form and preview */}
      <div className="flex shrink-0 justify-center px-3 pt-3 lg:hidden">
        <Segmented
          label="View"
          value={mobileTab}
          onChange={(tab) => {
            if (tab === "preview") setShowPreview(true);
            setMobileTab(tab);
          }}
          options={[
            { value: "editor", label: "Edit report" },
            { value: "preview", label: "A4 preview" },
          ]}
        />
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-12">
          {/* Left column: form editor */}
          <div
            ref={editorScrollRef}
            className={cn(
              "min-h-0 overflow-x-hidden overflow-y-auto border-border/50",
              showPreview ? "lg:col-span-5 lg:border-r" : "lg:col-span-12",
              mobileTab === "editor" ? "block" : "hidden lg:block",
            )}
          >
            {/* Section jump bar */}
            <nav
              aria-label="Report sections"
              className="sticky top-0 z-10 flex gap-1 overflow-x-auto border-b border-border/50 bg-white/95 px-3 py-2 no-scrollbar sm:px-5 dark:bg-card/95"
            >
              {SECTION_NAV.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => scrollToSection(s.id)}
                  className="h-8 shrink-0 rounded-full px-3 text-[13px] whitespace-nowrap text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                >
                  {s.label}
                </button>
              ))}
            </nav>

            <div className={cn("mx-auto flex flex-col gap-5 p-3 sm:p-5", !showPreview && "max-w-3xl")}>
              {/* Status */}
              {isLocked ? (
                <Callout tone="sage" icon={Lock} title="Final report locked">
                  Read-only{lockedAt ? ` since ${formatClinicDateTime(lockedAt)}` : ""}. Send the secure PDF from Reports.
                  {canOverrideLockedReport ? " An admin can unlock it for revision." : ""}
                </Callout>
              ) : legacyMeta && !hasSavedReport ? (
                <Callout tone="lavender" icon={Activity} title="Imported session — write the formal report">
                  The spreadsheet values below are for reference only.
                  {legacyMeta.legacyStatus || legacyMeta.legacyResults || legacyMeta.reference ? (
                    <span className="mt-2 grid gap-0.5">
                      {legacyMeta.legacyStatus ? <span>Legacy status: <span className="font-medium text-foreground">{legacyMeta.legacyStatus}</span></span> : null}
                      {legacyMeta.legacyResults ? <span>Legacy result: <span className="font-medium text-foreground">{legacyMeta.legacyResults}</span></span> : null}
                      {legacyMeta.reference ? <span>Reference: <span className="font-medium text-foreground">{legacyMeta.reference}</span></span> : null}
                    </span>
                  ) : null}
                </Callout>
              ) : (
                <Callout tone="amber" icon={FilePen} title={hasSavedReport ? "Draft in progress" : "New report"}>
                  Save as you go. When it&apos;s ready, <span className="font-medium text-foreground">Finalize &amp; sign</span> locks it for sending — only an admin can unlock it after that.
                </Callout>
              )}

              {/* Report details */}
              <SectionCard id="sec-details" title="Report details">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field id="ref-no" label="Reference" hint="Generated automatically">
                    <Input id="ref-no" value={referenceNo} readOnly aria-readonly="true" className={cn(FIELD, "font-mono text-[13px] text-muted-foreground")} />
                  </Field>
                  <Field id="test-date" label="Test date">
                    <Input id="test-date" value={examDate} onChange={(e) => setExamDate(e.target.value)} disabled={readOnly} className={FIELD} />
                  </Field>
                  <Field id="report-date" label="Report date">
                    <Input id="report-date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} disabled={readOnly} className={FIELD} />
                  </Field>
                </div>
              </SectionCard>

              {/* Session */}
              <SectionCard id="sec-session" title="Session">
                <div className="grid grid-cols-2 gap-4">
                  <Field id="exam-start" label="Start time">
                    <Input id="exam-start" value={examStartTime} onChange={(e) => setExamStartTime(e.target.value)} disabled={readOnly} placeholder="14:00" className={cn(FIELD, "tabular-nums")} />
                  </Field>
                  <Field id="exam-end" label="End time">
                    <Input id="exam-end" value={examEndTime} onChange={(e) => setExamEndTime(e.target.value)} disabled={readOnly} placeholder="15:45" className={cn(FIELD, "tabular-nums")} />
                  </Field>
                </div>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-1 text-[13px] font-medium">Identity verified with</span>
                    <Segmented
                      label="Identity document"
                      value={identityDocumentType}
                      onChange={(value) => {
                        setIdentityDocumentType(value);
                        setIdentityVerificationText(identitySentence(value));
                      }}
                      options={[
                        { value: "passport", label: "Passport", disabled: readOnly },
                        { value: "emirates_id", label: "Emirates ID", disabled: readOnly },
                      ]}
                    />
                  </div>
                  <ReportRichTextField rows={2} value={identityVerificationText} onChange={setIdentityVerificationText} disabled={readOnly} hint="Shown under the examinee details." />
                </div>
                <Field label="Question count phrase">
                  <ReportRichTextField
                    rows={2}
                    value={preExamQuestionCountText}
                    onChange={handleQuestionCountChange}
                    disabled={readOnly}
                    hint="Keep it bold. Also synced into Section 1."
                  />
                </Field>
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="px-1 text-[13px] font-medium">Cooperation</span>
                    <Segmented
                      label="Cooperation"
                      value={cooperationMode}
                      onChange={(mode) => {
                        setCooperationMode(mode);
                        setPostTestNotes(cooperationSentence(mode));
                      }}
                      options={[
                        { value: "cooperated", label: "Cooperated", disabled: readOnly },
                        { value: "counter_measures", label: "Counter-measures", disabled: readOnly },
                      ]}
                    />
                  </div>
                  <ReportRichTextField
                    rows={2}
                    value={postTestNotes}
                    onChange={setPostTestNotes}
                    disabled={readOnly}
                    hint="Printed once in Section 3, after the opinion. Switching the option above replaces this text."
                  />
                </div>
              </SectionCard>

              {/* Verdict */}
              <SectionCard
                id="sec-verdict"
                title="Verdict"
                aside={<span className="text-xs text-muted-foreground">{reportVerdictWordingDescription(verdictWording)}</span>}
              >
                <div role="radiogroup" aria-label="Verdict" className="flex flex-wrap gap-2">
                  {VERDICT_OPTIONS.map((v) => {
                    const active = verdict === v;
                    return (
                      <button
                        key={v}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={readOnly}
                        onClick={() => handleVerdictChange(v)}
                        className={cn(
                          "inline-flex min-h-10 items-center gap-2 rounded-full px-3.5 py-1.5 text-left text-[13px] transition-colors disabled:cursor-not-allowed",
                          active
                            ? cn(VERDICT_TONE[v].chip, "font-medium ring-1 ring-current/20")
                            : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground disabled:hover:bg-transparent dark:hover:bg-muted",
                          readOnly && !active && "opacity-50",
                        )}
                      >
                        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", VERDICT_TONE[v].dot, !active && "opacity-60")} />
                        {formatVerdictOptionLabel(v, verdictWording)}
                      </button>
                    );
                  })}
                </div>
                <p className="px-1 text-xs text-muted-foreground">Changing the verdict updates the result phrase in Section 3.</p>
              </SectionCard>

              {/* Section 1 */}
              <SectionCard id="sec-1" number={1} title="Pre-test">
                <Field id="pretest-intro" label="Introduction">
                  <ReportRichTextField id="pretest-intro" rows={3} value={preTestPhaseText} onChange={setPreTestPhaseText} disabled={readOnly} placeholder="On 04th May 2026 at about 14:00 hrs..." />
                </Field>
                <Field id="pretest-notes" label="Consent & health">
                  <ReportRichTextField id="pretest-notes" rows={2} value={preTestNotes} onChange={setPreTestNotes} disabled={readOnly} placeholder="Consent and fitness notes..." />
                </Field>
              </SectionCard>

              {/* Section 2 */}
              <SectionCard
                id="sec-2"
                number={2}
                title="Questions"
                aside={
                  <div className="flex flex-wrap gap-1.5">
                    <SmallButton
                      icon={loadingSessionQuestions ? Loader2 : ListChecks}
                      spin={loadingSessionQuestions}
                      onClick={() => void handleLoadQuestionsFromSession()}
                      disabled={readOnly || loadingSessionQuestions}
                    >
                      Load from session
                    </SmallButton>
                    <SmallButton icon={Plus} onClick={handleAddQuestion} disabled={readOnly}>
                      Add question
                    </SmallButton>
                  </div>
                }
              >
                <SwitchRow
                  label="Colour-code responses"
                  description="Reactions print red and no-reactions green, in the PDF and the preview."
                  checked={enableColorCoding}
                  disabled={readOnly}
                  onChange={setEnableColorCoding}
                />
                <Field id="exam-intro" label="Introduction">
                  <ReportRichTextField id="exam-intro" rows={2} value={examPhaseText} onChange={setExamPhaseText} disabled={readOnly} />
                </Field>

                {questions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
                    <p className="text-sm font-medium">No questions yet</p>
                    <p className="mt-1 text-[13px] text-muted-foreground">Load the ones recorded during the session, or add them by hand.</p>
                  </div>
                ) : (
                  <ol className="flex flex-col gap-3">
                    {questions.map((q, idx) => (
                      <li key={idx} className="flex flex-col gap-3 rounded-2xl bg-[#F7F6F1] p-3 sm:p-4 dark:bg-muted/40">
                        <div className="flex items-start gap-3">
                          <span
                            aria-hidden="true"
                            className="mt-2 flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums ring-1 ring-border dark:bg-card"
                          >
                            {idx + 1}
                          </span>
                          <label htmlFor={`question-${idx}`} className="sr-only">
                            Question {idx + 1}
                          </label>
                          <Input
                            id={`question-${idx}`}
                            placeholder="Type the question…"
                            value={q.text}
                            onChange={(e) => handleQuestionChange(idx, "text", e.target.value)}
                            disabled={readOnly}
                            className="h-11 flex-1 rounded-xl border-0 bg-white px-3.5 text-sm shadow-none dark:bg-card"
                          />
                          <button
                            type="button"
                            aria-label={`Remove question ${idx + 1}`}
                            title="Remove question"
                            onClick={() => handleRemoveQuestion(idx)}
                            disabled={readOnly}
                            className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F6E3E1] hover:text-[#8A2C22] disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-red-950 dark:hover:text-red-300"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-10">
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Answer</span>
                            <Segmented
                              label={`Answer to question ${idx + 1}`}
                              value={q.answer}
                              onChange={(value) => handleQuestionChange(idx, "answer", value)}
                              className="bg-white dark:bg-card"
                              options={ANSWER_OPTIONS.map((a) => ({ value: a, label: a, disabled: readOnly }))}
                            />
                          </span>
                          <span className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Result</span>
                            <Segmented
                              label={`Evaluation of question ${idx + 1}`}
                              value={q.evaluation}
                              onChange={(value) => handleQuestionChange(idx, "evaluation", value)}
                              className="bg-white dark:bg-card"
                              options={EVALUATION_OPTIONS.map((o) => ({ ...o, disabled: readOnly }))}
                            />
                          </span>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                <Field id="limestone" label="Instrument & recording">
                  <ReportRichTextField
                    id="limestone"
                    rows={3}
                    value={limestoneNotes}
                    onChange={setLimestoneNotes}
                    disabled={readOnly}
                    hint="Bold the polygram sentence, e.g. Four polygrams, including 1 acquaintance and 3 official tests."
                  />
                </Field>
              </SectionCard>

              {/* Section 3 */}
              <SectionCard id="sec-3" number={3} title="Opinion">
                <Field id="opinion-statement" label="Opinion">
                  <ReportRichTextField
                    id="opinion-statement"
                    rows={3}
                    value={opinionPhaseText}
                    onChange={setOpinionPhaseText}
                    disabled={readOnly}
                    placeholder="Based on diagnostic evaluations..."
                    hint="The cooperation line from Session is added after this automatically."
                  />
                </Field>
                <SwitchRow
                  label="Examiner's observation"
                  description="Adds a separate observation paragraph, printed in blue."
                  checked={examinersObservationEnabled}
                  disabled={readOnly}
                  onChange={setExaminersObservationEnabled}
                >
                  {examinersObservationEnabled ? (
                    <ReportRichTextField
                      id="examiners-observation"
                      rows={3}
                      value={examinersObservationText}
                      onChange={setExaminersObservationText}
                      disabled={readOnly}
                      placeholder="Enter the examiner's observation..."
                      className="text-blue-600"
                    />
                  ) : null}
                </SwitchRow>
              </SectionCard>

              {/* Section 4 */}
              <SectionCard id="sec-4" number={4} title="Follow-up">
                <Field id="follow-up" label="Follow-up by requesting agency">
                  <Input id="follow-up" value={section4FollowUp} onChange={(e) => setSection4FollowUp(e.target.value)} disabled={readOnly} className={FIELD} />
                </Field>
              </SectionCard>

              {/* Signature */}
              <SectionCard id="sec-signature" title="Signature">
                <p className="px-1 text-xs text-muted-foreground">
                  Name, title and organisation come from the signing examiner&apos;s My Profile and can&apos;t be changed per report.
                </p>
                {examinerSignature ? (
                  <div className="space-y-1 rounded-2xl bg-white p-4 text-zinc-900 ring-1 ring-border">
                    <img src={examinerSignature.image} alt="Examiner signature" className="h-14 max-w-56 object-contain" />
                    <p className="text-sm font-semibold">{signerDisplayName || "Examiner name missing"}</p>
                    {splitSignerCaptionLines(signerCaptionLines).map((line) => (
                      <p key={line} className="text-xs text-zinc-600">{line}</p>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300">
                    {signatureError || "Choose a signing examiner with a saved signature when you finalize — it will appear here."}
                  </p>
                )}
                <SwitchRow
                  label="Add credentials page"
                  description={
                    canIncludeCredentials
                      ? "Adds a page with the examiner's saved credentials after the signature."
                      : "This examiner hasn't added credentials in My Profile yet."
                  }
                  checked={includeCredentials}
                  disabled={readOnly || !canIncludeCredentials}
                  onChange={setIncludeCredentials}
                />
              </SectionCard>
            </div>
          </div>

          {/* Right column: live A4 preview */}
          {showPreview ? (
          <div
            className={cn(
              "lg:col-span-7 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#E9E6DD] dark:bg-zinc-950/60",
              mobileTab === "preview" ? "flex" : "hidden lg:flex"
            )}
          >
            <div className="flex w-full shrink-0 items-center justify-between gap-3 border-b border-border/50 bg-[#F3F1EA] px-4 py-2 dark:bg-zinc-900">
              <span className="flex items-center gap-2 text-[13px] font-medium">
                <Eye aria-hidden="true" className="size-4 text-muted-foreground" />
                Live preview
                <span className="font-normal text-muted-foreground">· A4, as printed</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPreview(false)}
                className="hidden h-8 items-center gap-1.5 rounded-full px-3 text-[13px] text-muted-foreground transition-colors hover:bg-white hover:text-foreground lg:flex dark:hover:bg-muted"
              >
                <EyeOff aria-hidden="true" className="size-3.5" />
                Hide
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto overflow-x-auto p-2 sm:p-6 max-w-full">
              <div className="w-full flex flex-col items-center overflow-x-auto pb-6 no-scrollbar">
                {/* Visual Preview Template Page 1 */}
                <div className="relative mb-8 flex w-full max-w-[210mm] min-w-[280px] min-h-[297mm] flex-col justify-between border border-zinc-200 bg-white p-[5%] sm:p-[6%] text-[10px] sm:text-[11px] leading-relaxed text-zinc-900 shadow-2xl select-none shrink-0">
              <div>
                <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                  <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 w-auto object-contain" />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-4">
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
                    <div className="pt-3 text-[10px] text-zinc-700">
                      <ReportRichTextContent text={identityVerificationText} />
                    </div>
                  ) : null}
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 1: PRE-EXAMINATION PHASE
                  </h3>
                  <div className="text-zinc-700 leading-relaxed">
                    <ReportRichTextContent text={preTestPhaseText} />
                  </div>
                  <div className="text-zinc-700 italic leading-relaxed pt-1">
                    <ReportRichTextContent text={preTestNotes} />
                  </div>
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 2: EXAMINATION PHASE
                  </h3>
                  <div className="text-zinc-700 leading-relaxed">
                    <ReportRichTextContent text={examPhaseText} />
                  </div>

                  {questions.length > 0 && (
                    <table className="mt-3 w-full table-fixed border-collapse border border-zinc-300 text-left">
                      <thead>
                        <tr className="bg-zinc-50 text-[8px] font-black uppercase text-zinc-500 tracking-wider border-b border-zinc-300">
                          <th className="w-12 border border-zinc-300 px-2 py-1.5 text-center">S/N</th>
                          <th className="border border-zinc-300 px-3 py-1.5">Questions</th>
                          <th className="w-36 border border-zinc-300 px-3 py-1.5 text-center">Examinee Response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {questions.map((q, idx) => {
                          const evalLower = (q.evaluation || "").toLowerCase();
                          const isDeceptive = evalLower.includes("deceptive") || (evalLower.includes("reaction") && !evalLower.includes("no reaction"));
                          const isNoReaction = evalLower === "no reaction";
                          const responseColorClass = enableColorCoding
                            ? isDeceptive
                              ? "text-red-600 font-black"
                              : isNoReaction
                                ? "text-emerald-600 font-black"
                                : "text-zinc-900 font-black"
                            : "text-zinc-900 font-black";
                          return (
                            <tr key={idx} className="border-b border-zinc-200">
                              <td className="align-top border border-zinc-300 px-2 py-2 text-center font-semibold text-zinc-500">{idx + 1}</td>
                              <td className="border border-zinc-300 px-3 py-2 text-zinc-700 italic font-medium whitespace-normal break-words leading-6">{q.text || "-"}</td>
                              <td className={`border border-zinc-300 px-3 py-2 text-center align-middle ${responseColorClass}`}>{q.answer}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}

                  {limestoneNotes.trim() ? (
                    <div className="mt-4 text-zinc-700">
                      <ReportRichTextContent text={limestoneNotes} />
                    </div>
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
            <div className="relative mb-8 flex w-full max-w-[210mm] min-w-[280px] min-h-[297mm] flex-col justify-between border border-zinc-200 bg-white p-[5%] sm:p-[6%] text-[10px] sm:text-[11px] leading-relaxed text-zinc-900 shadow-2xl select-none shrink-0">
              <div>
                <div className="flex justify-between items-end border-b-2 border-zinc-200 pb-2">
                  <img src="/logo-print.png" alt="Polygraph UAE" className="h-10 w-auto object-contain" />
                  <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">STAFF IN CONFIDENCE</span>
                </div>

                <div className="mt-8 space-y-4">
                  <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                    SECTION 3: OPINION OF EXAMINER
                  </h3>
                  <div className="text-zinc-700 leading-relaxed">
                    <ReportRichTextContent text={opinionPhaseText} />
                  </div>
                  {examinersObservationEnabled ? (
                    <div className="pt-2">
                      <h3 className="font-black text-xs uppercase tracking-wider underline underline-offset-4 decoration-1 text-zinc-800">
                        EXAMINER&apos;S OBSERVATION
                      </h3>
                      <div className="mt-3 leading-relaxed text-blue-600">
                        <ReportRichTextContent text={examinersObservationText} />
                      </div>
                    </div>
                  ) : null}
                  <div className="text-zinc-700 leading-relaxed pt-1">
                    <ReportRichTextContent text={postTestNotes} />
                  </div>
                  <div className="flex items-center gap-2 mt-5 pt-3">
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

            {includeCredentials && canIncludeCredentials ? (
              <div className="relative mb-8 flex w-full max-w-[210mm] min-w-[280px] min-h-[297mm] flex-col border border-zinc-200 bg-white p-[5%] sm:p-[6%] text-[10px] sm:text-[11px] leading-relaxed text-zinc-900 shadow-2xl select-none shrink-0">
                <h2 className="text-center text-base font-black tracking-wide text-[#b46428]">
                  POLYGRAPH EXAMINER CREDENTIALS
                </h2>
                <CredentialsRichTextContent html={examinerCredentialsText} className="mt-8" />
              </div>
            ) : null}
              </div>
            </div>
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

      <Dialog open={replaceQuestionsDialogOpen} onOpenChange={setReplaceQuestionsDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Replace questions with session data?</DialogTitle>
            <DialogDescription>
              This report already has {questions.length} question{questions.length === 1 ? "" : "s"} entered.
              Loading from the session will replace them with what was recorded during the exam. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setReplaceQuestionsDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                setReplaceQuestionsDialogOpen(false);
                void applyQuestionsFromSession();
              }}
              disabled={loadingSessionQuestions}
            >
              {loadingSessionQuestions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Replace Questions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Builder UI pieces                                                   */
/* ------------------------------------------------------------------ */

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none disabled:opacity-70 dark:bg-muted";

const SECTION_NAV = [
  { id: "sec-details", label: "Details" },
  { id: "sec-session", label: "Session" },
  { id: "sec-verdict", label: "Verdict" },
  { id: "sec-1", label: "1 · Pre-test" },
  { id: "sec-2", label: "2 · Questions" },
  { id: "sec-3", label: "3 · Opinion" },
  { id: "sec-4", label: "4 · Follow-up" },
  { id: "sec-signature", label: "Signature" },
] as const;

const VERDICT_OPTIONS = ["NDI", "DI", "NSR", "SR", "Inconclusive"] as const;

const VERDICT_TONE: Record<(typeof VERDICT_OPTIONS)[number], { chip: string; dot: string }> = {
  NDI: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
  NSR: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
  DI: { chip: "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300", dot: "bg-[#B94A3E] dark:bg-red-400" },
  SR: { chip: "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300", dot: "bg-[#B94A3E] dark:bg-red-400" },
  Inconclusive: { chip: "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground", dot: "bg-[#8B887E]" },
};

const ANSWER_OPTIONS = ["Yes", "No", "Other"] as const;

/** Values are what the report stores; labels are just shorter. */
const EVALUATION_OPTIONS = [
  { value: "No Reaction", label: "No reaction" },
  { value: "Reaction / Deceptive", label: "Reaction" },
  { value: "Inconclusive", label: "Inconclusive" },
];

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

function BuilderStatusPill({ label, locked }: { label: string; locked: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        locked
          ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      {locked ? <Lock aria-hidden="true" className="size-3" /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-[#E2B35A]" />}
      {label}
    </span>
  );
}

function HeaderButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  spin,
  title,
  className,
}: {
  icon: IconType;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex h-10 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 sm:flex-initial dark:hover:bg-muted",
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("size-4 shrink-0", spin && "animate-spin")} />
      {children}
    </button>
  );
}

function SmallButton({
  icon: Icon,
  children,
  onClick,
  disabled,
  spin,
}: {
  icon: IconType;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 disabled:hover:bg-transparent dark:hover:bg-muted"
    >
      <Icon aria-hidden="true" className={cn("size-3.5", spin && "animate-spin")} />
      {children}
    </button>
  );
}

const CALLOUT_TONE = {
  amber: { box: "bg-[#F8EEDB] dark:bg-amber-950/60", icon: "text-[#8A5A12] dark:text-amber-300" },
  sage: { box: "bg-[#E7F1E4] dark:bg-emerald-950/60", icon: "text-[#2D5A27] dark:text-emerald-300" },
  lavender: { box: "bg-[#EFEBFE] dark:bg-violet-950/60", icon: "text-[#3B2E86] dark:text-violet-200" },
} as const;

function Callout({ tone, icon: Icon, title, children }: { tone: keyof typeof CALLOUT_TONE; icon: IconType; title: string; children: React.ReactNode }) {
  const style = CALLOUT_TONE[tone];
  return (
    <div className={cn("flex gap-3 rounded-2xl px-4 py-3", style.box)}>
      <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", style.icon)} />
      <div className="min-w-0 text-[13px] text-muted-foreground">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function SectionCard({
  id,
  number,
  title,
  aside,
  children,
}: {
  id: string;
  number?: number;
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="flex scroll-mt-14 flex-col gap-4 rounded-[22px] p-4 ring-1 ring-border/60 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id={`${id}-title`} className="flex items-center gap-2.5 text-[15px] font-medium">
          {number ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-[#30302E] text-xs font-semibold text-[#FAF9F5] tabular-nums dark:bg-secondary dark:text-secondary-foreground">
              {number}
            </span>
          ) : null}
          {number ? `Section ${number} · ${title}` : title}
        </h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Field({ id, label, hint, children }: { id?: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
      </label>
      {children}
      {hint ? <p className="px-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <label htmlFor={id} className={cn("text-sm font-medium", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
            {label}
          </label>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
            checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform",
              checked ? "translate-x-5" : "translate-x-0",
            )}
          />
        </button>
      </div>
      {children}
    </div>
  );
}
