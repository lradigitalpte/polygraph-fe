"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportAnalytics } from "@/components/dashboard/report-analytics";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchConsolidatedStats, fetchSecureShares, type ConsolidatedReportStats, type SecureReportShare } from "@/lib/reports";
import { fetchExaminers, type UserRecord } from "@/lib/users";

export default function AnalyticsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userLoading && !can("exam:view")) { toast.error("You don't have permission to view analytics."); router.replace("/dashboard"); }
  }, [can, router, userLoading]);
  React.useEffect(() => {
    if (userLoading || !can("exam:view")) return;
    setLoading(true);
    void Promise.all([fetchAppointments(), fetchConsolidatedStats(), fetchSecureShares(), fetchExaminers()])
      .then(([appointmentData, statsData, shareData, examinerData]) => { setAppointments(appointmentData); setStats(statsData); setShares(shareData); setExaminers(examinerData); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load analytics"))
      .finally(() => setLoading(false));
  }, [can, userLoading]);

  if (userLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 aria-hidden="true" className="size-7 animate-spin text-primary" /></div>;
  return (
    <ReportAnalytics
      appointments={appointments}
      shares={shares}
      examiners={examiners}
      stats={stats}
      loading={loading}
      canFilterExaminer={can("client:manage")}
    />
  );
}
