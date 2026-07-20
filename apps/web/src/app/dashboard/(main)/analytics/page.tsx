"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ReportAnalytics } from "@/components/dashboard/report-analytics";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchConsolidatedStats, fetchSecureShares, type ConsolidatedReportStats, type SecureReportShare } from "@/lib/reports";

export default function AnalyticsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!userLoading && !can("exam:view")) { toast.error("You don't have permission to view analytics."); router.replace("/dashboard"); }
  }, [can, router, userLoading]);
  React.useEffect(() => {
    if (userLoading || !can("exam:view")) return;
    setLoading(true);
    void Promise.all([fetchAppointments(), fetchConsolidatedStats(), fetchSecureShares()])
      .then(([appointmentData, statsData, shareData]) => { setAppointments(appointmentData); setStats(statsData); setShares(shareData); })
      .catch((error) => toast.error(error instanceof Error ? error.message : "Unable to load analytics"))
      .finally(() => setLoading(false));
  }, [can, userLoading]);

  if (userLoading) return <div className="flex min-h-[50vh] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-primary" /></div>;
  return <div className="mx-auto max-w-7xl space-y-7 p-2 sm:p-4">
    <header className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-card/70 p-7 shadow-sm">
      <div className="absolute right-0 top-0 h-48 w-48 -translate-y-1/3 translate-x-1/3 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start gap-4"><div className="rounded-2xl bg-primary p-3 text-primary-foreground"><BarChart3 className="h-6 w-6" /></div><div><p className="text-[10px] font-black uppercase tracking-[.22em] text-primary">Business intelligence</p><h1 className="mt-1 text-3xl font-black tracking-tight">Practice Analytics</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Track monthly booking demand, completion, drop-off, provider activity, examiner performance, and examination outcomes.</p></div></div>
    </header>
    <ReportAnalytics appointments={appointments} shares={shares} stats={stats} loading={loading} canFilterExaminer={can("client:manage")} />
  </div>;
}
