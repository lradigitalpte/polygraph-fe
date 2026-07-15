import type { AppointmentRecord } from "@/lib/exam-booking";
import type { ExamRecord } from "@/lib/exam-documentation";
import { formatClinicClock } from "@/lib/clinic-time";

export type ReportSessionContext = {
  subjectName: string;
  clientName: string;
  examType: string;
  referenceNo: string;
  formattedExamDate: string;
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
  section_4_follow_up: string;
  limestone_notes: string;
  pre_test_phase_text: string;
  exam_phase_text: string;
  opinion_phase_text: string;
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

export function formatReportReference(examId: number, date: Date): string {
  return `PIN/CONF/${date.getFullYear()}/${String(examId).padStart(3, "0")}`;
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
    referenceNo: formatReportReference(exam.id, examDate),
    formattedExamDate: formatReportExamDate(examDate),
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
    section_4_follow_up: "",
    limestone_notes: "",
    pre_test_phase_text: "",
    exam_phase_text: "",
    opinion_phase_text: "",
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
    section_4_follow_up: coalesceField(parsed.section_4_follow_up, fallback.section_4_follow_up),
    limestone_notes: coalesceField(parsed.limestone_notes, fallback.limestone_notes),
    pre_test_phase_text: coalesceField(parsed.pre_test_phase_text, fallback.pre_test_phase_text),
    exam_phase_text: coalesceField(parsed.exam_phase_text, fallback.exam_phase_text),
    opinion_phase_text: coalesceField(parsed.opinion_phase_text, fallback.opinion_phase_text),
  };
}

export function formatVerdictLabel(verdict: string): string {
  if (verdict === "DI") return "NOT TRUTHFUL";
  if (verdict === "NDI") return "TRUTHFUL / NO DECEPTION INDICATED";
  return "INCONCLUSIVE";
}

export function verdictColorClass(verdict: string): string {
  if (verdict === "DI") return "text-red-600";
  if (verdict === "NDI") return "text-emerald-600";
  return "text-zinc-500";
}
