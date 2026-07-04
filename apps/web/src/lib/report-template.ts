import type { AppointmentRecord } from "@/lib/exam-booking";
import type { ExamRecord } from "@/lib/exam-documentation";

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

export function formatSubjectName(subject?: {
  first_name?: string;
  last_name?: string;
}): string {
  if (!subject) return "";
  return `${subject.first_name ?? ""} ${subject.last_name ?? ""}`.trim();
}

export function formatReportReference(examId: number, date: Date): string {
  return `PIN/CONF/${date.getFullYear()}/${String(examId).padStart(3, "0")}`;
}

export function formatReportExamDate(date: Date): string {
  const month = date.toLocaleString("en-GB", { month: "long" });
  return `${ordinal(date.getDate())} ${month} ${date.getFullYear()}`;
}

export function formatReportDateTime(date: Date): string {
  const time = date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${formatReportExamDate(date)} at about ${time} hrs (Dubai Time)`;
}

export function buildOpinionPhaseText(subjectName: string, verdict: string): string {
  const label =
    verdict === "DI"
      ? "Not Truthful"
      : verdict === "Inconclusive"
        ? "Inconclusive"
        : "Truthful";
  const name = subjectName.trim() || "the above subject";
  return `Based on the diagnostic evaluations and analysis of the polygrams, I am in the opinion that the examination on ${name} as ${label}.`;
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
  const subjectName =
    formatSubjectName(exam.subject) ||
    formatSubjectName(appointment?.subject) ||
    "";
  const examDate = resolveExamDate(exam, appointment);
  const examType = (exam.type || appointment?.notes?.split("\n")[0] || "Polygraph examination").trim();
  const appointmentNotes = (appointment?.notes || "").trim();
  const examinerNotes = (exam.notes || "").trim();

  return {
    subjectName,
    clientName: clientName.trim(),
    examType,
    referenceNo: formatReportReference(exam.id, examDate),
    formattedExamDate: formatReportExamDate(examDate),
    formattedDateTime: formatReportDateTime(examDate),
    appointmentNotes,
    examinerNotes,
  };
}

export type NewReportDefaults = {
  referenceNo: string;
  examDate: string;
  purpose: string;
  instrument: string;
  preTestNotes: string;
  preTestPhaseText: string;
  examPhaseText: string;
  limestoneNotes: string;
  opinionPhaseText: string;
  postTestNotes: string;
  conclusion: string;
  section4FollowUp: string;
  questions: { text: string; answer: string; evaluation: string }[];
  verdict: string;
};

export function buildNewReportDefaults(
  ctx: ReportSessionContext,
  verdict = "NDI"
): NewReportDefaults {
  const clientPhrase = ctx.clientName ? ` for ${ctx.clientName}` : "";
  const examPurpose = ctx.appointmentNotes || ctx.examType;

  let preTestIntro = `On ${ctx.formattedDateTime}, I commenced to administer a polygraph examination to the above subject.`;
  if (examPurpose) {
    preTestIntro += `\n\n${examPurpose.endsWith(".") ? examPurpose : `${examPurpose}.`}`;
  } else if (ctx.examType) {
    preTestIntro += `\n\nA ${ctx.examType.toLowerCase()} was administered${clientPhrase}.`;
  }

  return {
    referenceNo: ctx.referenceNo,
    examDate: ctx.formattedExamDate,
    purpose: examPurpose,
    instrument: "Lafayette LX6000",
    preTestNotes:
      ctx.examinerNotes ||
      "Examinee physical and mental health assessed as fit for testing. Legal rights and examination consent form explained and signed.",
    preTestPhaseText: preTestIntro,
    examPhaseText:
      "During the examination phase, the relevant and comparison questions were administered to the subject. Verbal responses to the relevant questions were as indicated:",
    limestoneNotes:
      "The examination was conducted with a Limestone Technologies Computerised Polygraph, recording the blood pressure, pulse rate, galvanic skin response and breathing pattern of the subject.",
    opinionPhaseText: buildOpinionPhaseText(ctx.subjectName, verdict),
    postTestNotes: "Examinee cooperated and the test administration was as per procedure.",
    conclusion: "",
    section4FollowUp: "Nil",
    questions: [],
    verdict,
  };
}

export function coalesceField<T>(value: T | undefined | null, fallback: T): T {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "string" && value.trim() === "") return fallback;
  return value;
}
