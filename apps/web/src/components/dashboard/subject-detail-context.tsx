"use client";

import * as React from "react";
import {
  fetchSubject,
  fetchSubjectAppointments,
  type SubjectRecord,
} from "@/lib/subjects";
import type { AppointmentRecord } from "@/lib/exam-booking";

type SubjectDetailContextValue = {
  clientId: number;
  subjectId: number;
  subject: SubjectRecord | null;
  appointments: AppointmentRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setSubjectRecord: (record: SubjectRecord) => void;
};

const SubjectDetailContext = React.createContext<SubjectDetailContextValue | null>(null);

export function SubjectDetailProvider({
  clientId,
  subjectId,
  children,
}: {
  clientId: number;
  subjectId: number;
  children: React.ReactNode;
}) {
  const [subject, setSubject] = React.useState<SubjectRecord | null>(null);
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subjectData, appointmentData] = await Promise.all([
        fetchSubject(subjectId),
        fetchSubjectAppointments(subjectId, clientId),
      ]);
      setSubject(subjectData);
      setAppointments(appointmentData);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load examinee";
      setError(message);
      setSubject(null);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  }, [clientId, subjectId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const value = React.useMemo(
    () => ({
      clientId,
      subjectId,
      subject,
      appointments,
      loading,
      error,
      refresh: load,
      setSubjectRecord: setSubject,
    }),
    [clientId, subjectId, subject, appointments, loading, error, load]
  );

  return (
    <SubjectDetailContext.Provider value={value}>{children}</SubjectDetailContext.Provider>
  );
}

export function useSubjectDetail() {
  const context = React.useContext(SubjectDetailContext);
  if (!context) {
    throw new Error("useSubjectDetail must be used within SubjectDetailProvider");
  }
  return context;
}
