"use client";

import { useParams } from "next/navigation";

/**
 * Where a session's pages live. A session opened from an examinee's pages stays
 * under that examinee (so the examinee sidebar remains); otherwise it sits under
 * the account's "All sessions".
 */
export function sessionBase(clientId: number | string, appointmentId: number | string, subjectId?: number | string | null) {
  return subjectId
    ? `/dashboard/clients/${clientId}/examinees/${subjectId}/exams/${appointmentId}`
    : `/dashboard/clients/${clientId}/exams/${appointmentId}`;
}

export function useSessionRoute() {
  const params = useParams();
  const clientId = String(params.id);
  const appointmentId = String(params.appointmentId);
  const subjectId = params.subjectId != null ? String(params.subjectId) : null;
  return {
    base: sessionBase(clientId, appointmentId, subjectId),
    /** Where "back" goes: the examinee's exam history, or the account's session list. */
    back: subjectId ? `/dashboard/clients/${clientId}/examinees/${subjectId}/exams` : `/dashboard/clients/${clientId}/exams`,
    backLabel: subjectId ? "Exam history" : "All sessions",
  };
}
