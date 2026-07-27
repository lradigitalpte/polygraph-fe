import type { AppointmentRecord } from "@/lib/exam-booking";
import type { ExamRecord } from "@/lib/exam-documentation";
import { formatClinicClock } from "@/lib/clinic-time";

export type ReportSessionContext = {
  subjectName: string;
  clientName: string;
  examType: string;
  referenceNo: string;
  formattedExamDate: string;
  /** Report issuance date (defaults to today in clinic time). */
  formattedReportDate: string;
  formattedDateTime: string;
  appointmentNotes: string;
  examinerNotes: string;
};

export type ReportQuestion = {
  text: string;
  answer: string;
  evaluation: string;
};

/** Full report JSON saved by the builder — source of truth for PDF + preview. */
export type ReportContent = {
  purpose: string;
  instrument: string;
  pre_test_notes: string;
  questions: ReportQuestion[];
  post_test_notes: string;
  reference_no: string;
  exam_date: string;
  report_date: string;
  section_4_follow_up: string;
  limestone_notes: string;
  pre_test_phase_text: string;
  exam_phase_text: string;
  opinion_phase_text: string;
  identity_document_type?: "passport" | "emirates_id" | "";
  identity_verification_text?: string;
  exam_start_time?: string;
  exam_end_time?: string;
  cooperation_mode?: "cooperated" | "counter_measures";
  pre_exam_question_count_text?: string;
  response_legend_text?: string;
  source_template_id?: number;
  /** Editable signature block text — saved in draft, applied on finalize. */
  signer_display_name?: string;
  signer_caption_lines?: string;
};

export type ReportTemplateRecord = {
  id: number;
  slug: string;
  name: string;
  category: "generic" | "eva" | string;
  description?: string;
  content_json: string;
  is_default: boolean;
  active: boolean;
  created_at?: string;
  updated_at?: string;
};

export type ReportMergeContext = {
  subjectName: string;
  clientName: string;
  examDate: string;
  reportDate: string;
  referenceNo: string;
  examStartTime: string;
  examEndTime: string;
  subjectGender?: string;
  identityDocType?: string;
  cooperationMode?: string;
  verdictLabel?: string;
  preExamQuestionCountText?: string;
};

function ordinal(day: number): string {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
}

export function formatReportPersonName(name: string): string {
  return name.trim().toUpperCase();
}

export function formatSubjectName(subject?: {
  first_name?: string;
  last_name?: string;
}): string {
  if (!subject) return "";
  return formatReportPersonName(`${subject.first_name ?? ""} ${subject.last_name ?? ""}`);
}

export function formatReportReference(date: Date): string {
  // Omit ambiguous characters (0/O, 1/I) so references are easy to read aloud.
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  const code = Array.from(bytes, (value) => alphabet[value % alphabet.length]).join("");
  return `PIN/CONF/${date.getFullYear()}/${code.slice(0, 4)}-${code.slice(4)}`;
}

export function formatReportExamDate(date: Date): string {
  const month = date.toLocaleString("en-GB", { month: "long" });
  return `${ordinal(date.getDate())} ${month} ${date.getFullYear()}`;
}

export function formatReportDateTime(date: Date): string {
  const time = formatClinicClock(date);
  return `${formatReportExamDate(date)} at about ${time} hrs (Dubai Time)`;
}

export function resolveExamDate(exam: ExamRecord, appointment?: AppointmentRecord | null): Date {
  const raw = appointment?.scheduled_at || exam.date;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export function buildReportSessionContext(
  exam: ExamRecord,
  clientName: string,
  appointment?: AppointmentRecord | null
): ReportSessionContext {
  const examDate = resolveExamDate(exam, appointment);
  const examType = (exam.type || appointment?.notes?.split("\n")[0] || "Polygraph examination").trim();

  return {
    subjectName:
      formatSubjectName(exam.subject) ||
      formatSubjectName(appointment?.subject) ||
      "",
    clientName: clientName.trim(),
    examType,
    referenceNo: formatReportReference(examDate),
    formattedExamDate: formatReportExamDate(examDate),
    formattedReportDate: formatReportExamDate(new Date()),
    formattedDateTime: formatReportDateTime(examDate),
    appointmentNotes: (appointment?.notes || "").trim(),
    examinerNotes: (exam.notes || "").trim(),
  };
}

/** New/regenerated reports: only session fields prefilled. Body text stays empty. */
export function buildEmptyReportContent(ctx: ReportSessionContext): ReportContent {
  return {
    purpose: ctx.appointmentNotes || ctx.examType,
    instrument: "",
    pre_test_notes: ctx.examinerNotes,
    questions: [],
    post_test_notes: "",
    reference_no: ctx.referenceNo,
    exam_date: ctx.formattedExamDate,
    report_date: ctx.formattedReportDate,
    section_4_follow_up: "",
    limestone_notes: "",
    pre_test_phase_text: "",
    exam_phase_text: "",
    opinion_phase_text: "",
    identity_document_type: "passport",
    identity_verification_text: "",
    exam_start_time: "",
    exam_end_time: "",
    cooperation_mode: "cooperated",
    pre_exam_question_count_text: "4 relevant and 3 comparison questions",
    response_legend_text: "",
  };
}

export function pronounsForGender(gender?: string) {
  const value = (gender || "").trim().toLowerCase();
  if (value === "female" || value === "f" || value === "woman") {
    return { subject: "She", possessive: "Her", object: "her" };
  }
  if (value === "male" || value === "m" || value === "man") {
    return { subject: "He", possessive: "His", object: "him" };
  }
  return { subject: "They", possessive: "Their", object: "them" };
}

export function identitySentence(docType?: string) {
  const value = (docType || "").trim().toLowerCase();
  const label =
    value === "passport"
      ? "Passport"
      : value === "emirates_id"
        ? "Emirates ID"
        : "Passport or Emirates ID";
  return `The examiner verified the examinee's identity through an official ${label} in accordance with standard procedures.`;
}

export function cooperationSentence(mode?: string) {
  if ((mode || "").trim().toLowerCase() === "counter_measures") {
    return "Examinee employed counter measures to cheat the test.";
  }
  return "Examinee cooperated and the test administration was as per procedure.";
}

export function mergeTemplatePlaceholders(text: string, ctx: ReportMergeContext): string {
  if (!text.trim()) return "";
  const { possessive, subject } = pronounsForGender(ctx.subjectGender);
  return text
    .replaceAll("{{subject_name}}", ctx.subjectName)
    .replaceAll("{{client_name}}", ctx.clientName)
    .replaceAll("{{exam_date}}", ctx.examDate)
    .replaceAll("{{report_date}}", ctx.reportDate)
    .replaceAll("{{reference_no}}", ctx.referenceNo)
    .replaceAll("{{exam_start_time}}", ctx.examStartTime)
    .replaceAll("{{exam_end_time}}", ctx.examEndTime)
    .replaceAll("{{pronoun_subject}}", subject)
    .replaceAll("{{pronoun_possessive}}", possessive)
    .replaceAll("{{identity_sentence}}", identitySentence(ctx.identityDocType))
    .replaceAll("{{cooperation_sentence}}", cooperationSentence(ctx.cooperationMode))
    .replaceAll("{{verdict_label}}", ctx.verdictLabel || "Truthful")
    .replaceAll(
      "{{pre_exam_question_count_text}}",
      ctx.preExamQuestionCountText || "4 relevant and 3 comparison questions",
    );
}

export function parseTemplateContent(raw: string): ReportContent {
  return JSON.parse(raw) as ReportContent;
}

export function buildReportMergeContext(
  session: ReportSessionContext,
  options?: {
    subjectGender?: string;
    identityDocType?: string;
    cooperationMode?: string;
    verdictLabel?: string;
    examStartTime?: string;
    examEndTime?: string;
    preExamQuestionCountText?: string;
  },
): ReportMergeContext {
  return {
    subjectName: session.subjectName,
    clientName: session.clientName,
    examDate: session.formattedExamDate,
    reportDate: session.formattedReportDate,
    referenceNo: session.referenceNo,
    examStartTime: options?.examStartTime || "",
    examEndTime: options?.examEndTime || "",
    subjectGender: options?.subjectGender,
    identityDocType: options?.identityDocType || "passport",
    cooperationMode: options?.cooperationMode || "cooperated",
    verdictLabel: options?.verdictLabel || "Truthful",
    preExamQuestionCountText:
      options?.preExamQuestionCountText || "4 relevant and 3 comparison questions",
  };
}

export function mergeReportContent(template: ReportContent, ctx: ReportMergeContext): ReportContent {
  const merged: ReportContent = {
    ...template,
    purpose: mergeTemplatePlaceholders(template.purpose, ctx),
    pre_test_notes: mergeTemplatePlaceholders(template.pre_test_notes, ctx),
    pre_test_phase_text: mergeTemplatePlaceholders(template.pre_test_phase_text, ctx),
    exam_phase_text: mergeTemplatePlaceholders(template.exam_phase_text, ctx),
    limestone_notes: mergeTemplatePlaceholders(template.limestone_notes, ctx),
    opinion_phase_text: mergeTemplatePlaceholders(template.opinion_phase_text, ctx),
    post_test_notes: mergeTemplatePlaceholders(template.post_test_notes, ctx),
    section_4_follow_up: mergeTemplatePlaceholders(template.section_4_follow_up, ctx),
    response_legend_text: mergeTemplatePlaceholders(template.response_legend_text || "", ctx),
    identity_verification_text:
      mergeTemplatePlaceholders(template.identity_verification_text || "{{identity_sentence}}", ctx) ||
      identitySentence(ctx.identityDocType),
    reference_no: ctx.referenceNo,
    exam_date: ctx.examDate,
    report_date: ctx.reportDate,
    exam_start_time: template.exam_start_time || ctx.examStartTime,
    exam_end_time: template.exam_end_time || ctx.examEndTime,
    identity_document_type: (template.identity_document_type || ctx.identityDocType || "passport") as
      | "passport"
      | "emirates_id"
      | "",
    cooperation_mode: template.cooperation_mode || (ctx.cooperationMode as ReportContent["cooperation_mode"]) || "cooperated",
    pre_exam_question_count_text:
      template.pre_exam_question_count_text ||
      ctx.preExamQuestionCountText ||
      "4 relevant and 3 comparison questions",
    questions: template.questions?.length ? template.questions.map((q) => ({ ...q })) : [],
  };
  return merged;
}

export function buildReportFromTemplate(
  session: ReportSessionContext,
  template: ReportTemplateRecord,
  options?: Parameters<typeof buildReportMergeContext>[1],
): ReportContent {
  const preset = parseTemplateContent(template.content_json);
  const ctx = buildReportMergeContext(session, options);
  const merged = mergeReportContent(preset, ctx);
  merged.source_template_id = template.id;
  return merged;
}

export function applyReportFieldDefaults(content: ReportContent): ReportContent {
  const identityType = content.identity_document_type || "passport";
  return {
    ...content,
    identity_document_type: identityType,
    identity_verification_text:
      content.identity_verification_text?.trim() || identitySentence(identityType),
    cooperation_mode: content.cooperation_mode || "cooperated",
    post_test_notes:
      content.post_test_notes?.trim() || cooperationSentence(content.cooperation_mode),
    pre_exam_question_count_text:
      content.pre_exam_question_count_text || "4 relevant and 3 comparison questions",
  };
}

/** Use saved value when present (including empty string). Fallback only for missing keys. */
export function coalesceField<T>(value: T | undefined | null, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  return value;
}

type ParsedReportJson = Partial<ReportContent> & {
  conclusion?: string;
};

/** Parse saved report JSON; missing keys fall back to empty-report defaults. Empty strings are kept. */
export function parseReportContent(raw: string, fallback: ReportContent): ReportContent {
  const parsed = JSON.parse(raw) as ParsedReportJson;
  return {
    purpose: coalesceField(parsed.purpose, fallback.purpose),
    instrument: coalesceField(parsed.instrument, fallback.instrument),
    pre_test_notes: coalesceField(parsed.pre_test_notes, fallback.pre_test_notes),
    questions: parsed.questions?.length ? parsed.questions : fallback.questions,
    post_test_notes: coalesceField(parsed.post_test_notes, fallback.post_test_notes),
    reference_no: coalesceField(parsed.reference_no, fallback.reference_no),
    exam_date: coalesceField(parsed.exam_date, fallback.exam_date),
    // Older saved reports only have exam_date — fall back to that, then today's default.
    report_date: coalesceField(
      parsed.report_date,
      coalesceField(parsed.exam_date, fallback.report_date),
    ),
    section_4_follow_up: coalesceField(parsed.section_4_follow_up, fallback.section_4_follow_up),
    limestone_notes: coalesceField(parsed.limestone_notes, fallback.limestone_notes),
    pre_test_phase_text: coalesceField(parsed.pre_test_phase_text, fallback.pre_test_phase_text),
    exam_phase_text: coalesceField(parsed.exam_phase_text, fallback.exam_phase_text),
    opinion_phase_text: coalesceField(parsed.opinion_phase_text, fallback.opinion_phase_text),
    identity_document_type: coalesceField(parsed.identity_document_type, fallback.identity_document_type),
    identity_verification_text: coalesceField(
      parsed.identity_verification_text,
      fallback.identity_verification_text,
    ),
    exam_start_time: coalesceField(parsed.exam_start_time, fallback.exam_start_time),
    exam_end_time: coalesceField(parsed.exam_end_time, fallback.exam_end_time),
    cooperation_mode: coalesceField(parsed.cooperation_mode, fallback.cooperation_mode),
    pre_exam_question_count_text: coalesceField(
      parsed.pre_exam_question_count_text,
      fallback.pre_exam_question_count_text,
    ),
    response_legend_text: coalesceField(parsed.response_legend_text, fallback.response_legend_text),
    source_template_id: parsed.source_template_id ?? fallback.source_template_id,
    signer_display_name: coalesceField(parsed.signer_display_name, fallback.signer_display_name),
    signer_caption_lines: coalesceField(parsed.signer_caption_lines, fallback.signer_caption_lines),
  };
}

export type ReportVerdictWording = "plain" | "forensic";

export function normalizeReportVerdictWording(value?: string | null): ReportVerdictWording {
  return value === "forensic" ? "forensic" : "plain";
}

export function formatVerdictLabel(verdict: string, wording: ReportVerdictWording = "plain"): string {
  if (verdict === "DI") {
    return wording === "forensic" ? "DECEPTION INDICATED (DI)" : "NOT TRUTHFUL";
  }
  if (verdict === "NDI") {
    return wording === "forensic" ? "NO DECEPTION INDICATED (NDI)" : "TRUTHFUL";
  }
  return "INCONCLUSIVE";
}

export function formatVerdictOptionLabel(verdict: string, wording: ReportVerdictWording = "plain"): string {
  if (verdict === "DI") {
    return wording === "forensic" ? "Deception Indicated (DI)" : "Not Truthful";
  }
  if (verdict === "NDI") {
    return wording === "forensic" ? "No Deception Indicated (NDI)" : "Truthful";
  }
  return "Inconclusive";
}

export function reportVerdictWordingDescription(wording: ReportVerdictWording): string {
  return wording === "forensic"
    ? "Reports print Deception Indicated / No Deception Indicated."
    : "Reports print Not Truthful / Truthful.";
}

export function verdictColorClass(verdict: string): string {
  if (verdict === "DI") return "text-red-600";
  if (verdict === "NDI") return "text-emerald-600";
  return "text-zinc-500";
}

/** Default multiline caption below the signature image (title, org, credentials, etc.). */
export function defaultSignerCaptionFromProfile(title?: string, organization?: string): string {
  return [title, organization].map((line) => (line || "").trim()).filter(Boolean).join("\n");
}

export function splitSignerCaptionLines(caption?: string): string[] {
  return (caption || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}
