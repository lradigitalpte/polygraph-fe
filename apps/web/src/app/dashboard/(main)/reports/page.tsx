"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  FileSignature,
  Search,
  Copy,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  Calendar,
  Mail,
  ShieldAlert,
  Loader2,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  ClipboardList,
  Lock,
  ShieldCheck,
  Archive,
  ArchiveRestore,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatSubjectName } from "@/lib/subjects";
import { clinicDateKey, formatClinicDateLabel } from "@/lib/clinic-time";
import { ShareReportDialog } from "@/components/dashboard/share-report-dialog";
import { RegenerateReportDialog } from "@/components/dashboard/regenerate-report-dialog";
import {
  DEFAULT_REPORT_SHARE_EXPIRY_DAYS,
  fetchSecureShares,
  createSecureShare,
  regenerateSecureShare,
  setSecureShareArchived,
  fetchConsolidatedStats,
  fetchReportWorkflowStatuses,
  downloadLockedReportPreview,
  buildReportWorkflowMap,
  type ReportWorkflowStatus,
  type SecureReportShare,
  type ConsolidatedReportStats,
} from "@/lib/reports";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";

export default function ReportsDashboard() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const canViewLockedReport = can("exam:report:view_locked");

  React.useEffect(() => {
    if (!userLoading && !can("exam:view")) {
      toast.error("You don't have permission to access reports.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [appointments, setAppointments] = React.useState<AppointmentRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [stats, setStats] = React.useState<ConsolidatedReportStats | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});
  const [reportWorkflow, setReportWorkflow] = React.useState<
    Record<number, ReportWorkflowStatus>
  >({});

  // Sessions table filter + pagination
  const [examsSearch, setExamsSearch] = React.useState("");
  const [examsDateFrom, setExamsDateFrom] = React.useState("");
  const [examsDateTo, setExamsDateTo] = React.useState("");
  const [examsWorkflowFilter, setExamsWorkflowFilter] = React.useState<"all" | ReportWorkflowStatus>("all");
  const [examsPage, setExamsPage] = React.useState(1);
  const [examsPerPage, setExamsPerPage] = React.useState(5);

  // Shares table filter + pagination
  const [sharesPage, setSharesPage] = React.useState(1);
  const [sharesStatusFilter, setSharesStatusFilter] = React.useState<"all" | "active" | "expired">("all");
  const [sharesSearchDateFrom, setSharesSearchDateFrom] = React.useState("");
  const [sharesSearchDateTo, setSharesSearchDateTo] = React.useState("");
  const [sharesPerPage, setSharesPerPage] = React.useState(5);
  const [sharesArchiveView, setSharesArchiveView] = React.useState<"active" | "archived">("active");

  // Share Dialog states
  const [selectedExamId, setSelectedExamId] = React.useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [shareExpiryDays, setShareExpiryDays] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [protectionMode, setProtectionMode] = React.useState<"password" | "secure_link">("password");
  const [regenerateId, setRegenerateId] = React.useState<number | null>(null);
  const [regenerateMode, setRegenerateMode] = React.useState<"password" | "secure_link">("password");
  const [regenerateExpiry, setRegenerateExpiry] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [regenerating, setRegenerating] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [downloadingExamId, setDownloadingExamId] = React.useState<number | null>(null);


  const loadData = async () => {
    setLoading(true);
    try {
      const [sharesData, statsData, apptsData, workflowRows, examinersData] = await Promise.all([
        fetchSecureShares({ search, archive: "all" }),
        fetchConsolidatedStats(),
        fetchAppointments(),
        fetchReportWorkflowStatuses(),
        fetchExaminers().catch(() => [] as UserRecord[]),
      ]);
      setShares(sharesData);
      setStats(statsData);
      setAppointments(apptsData);
      setExaminers(examinersData);
      setReportWorkflow(buildReportWorkflowMap(workflowRows));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void loadData();
  }, [search]);

  const handleOpenShare = (examId: number, initialEmail?: string) => {
    const status = reportWorkflow[examId];
    if (status !== "locked" && status !== "sent") {
      toast.error("Finalize and lock the report in the Report Builder before emailing it.");
      return;
    }
    setSelectedExamId(examId);
    setRecipientEmail(initialEmail || "");
    setShareExpiryDays(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
    setProtectionMode("password");
  };

  const handleCreateShare = async () => {
    if (!selectedExamId || !recipientEmail.trim()) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSharing(true);
    try {
      await createSecureShare(null, recipientEmail.trim(), selectedExamId, shareExpiryDays, protectionMode);
      toast.success("Secure PDF encrypted and sent successfully!");
      setSelectedExamId(null);
      void loadData();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate secure share");
    } finally {
      setSharing(false);
    }
  };

  const handleOpenReportEditor = (examId: number, subjectName: string) => {
    const status = reportWorkflow[examId];
    if (status === "locked" && !canViewLockedReport) {
      toast.error("You don't have permission to view locked final reports.");
      return;
    }
    router.push(`/dashboard/reports/${examId}?subject=${encodeURIComponent(subjectName)}`);
  };

  const handleDownloadPreview = async (examId: number) => {
    const status = reportWorkflow[examId];
    if (status !== "locked") {
      toast.error("Only locked reports awaiting send can be downloaded for local review.");
      return;
    }
    if (!canViewLockedReport) {
      toast.error("You don't have permission to download locked final reports.");
      return;
    }
    setDownloadingExamId(examId);
    try {
      await downloadLockedReportPreview(examId);
      toast.success("Report preview downloaded.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download report preview");
    } finally {
      setDownloadingExamId(null);
    }
  };

  const workflowBadge = (status: ReportWorkflowStatus | undefined) => {
    switch (status) {
      case "sent":
        return <Badge className="bg-emerald-500/10 text-emerald-700 border-none">Sent</Badge>;
      case "locked":
        return (
          <Badge className="bg-amber-500/10 text-amber-700 border-none gap-1">
            <Lock className="h-3 w-3" />
            Locked — pending send
          </Badge>
        );
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      default:
        return <Badge variant="secondary">Needs report</Badge>;
    }
  };

  const handleCopyLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const secureLink = `${origin}/shared/report/${token}`;
    navigator.clipboard.writeText(secureLink);
    toast.success("Secure link copied to clipboard");
  };

  const handleOpenRegenerate = (share: SecureReportShare) => {
    setRegenerateId(share.id); setRegenerateMode(share.protection_mode || "password"); setRegenerateExpiry(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  };
  const handleRegenerate = async () => {
    if (!regenerateId) return;
    setRegenerating(true);
    try {
      const updated = await regenerateSecureShare(regenerateId, regenerateExpiry, regenerateMode);
      toast.success("Secure share link rotated successfully! A new notification email was sent.");
      setShares((prev) => prev.map((s) => (s.id === regenerateId ? updated : s)));
      setRegenerateId(null);
      const statsData = await fetchConsolidatedStats();
      setStats(statsData);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to rotate link");
    } finally { setRegenerating(false); }
  };

  const togglePasswordReveal = (id: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleArchiveToggle = async (share: SecureReportShare) => {
    const archived = !share.archived_at;
    try {
      const updated = await setSecureShareArchived(share.id, archived);
      setShares((prev) => prev.map((item) => item.id === share.id ? updated : item));
      toast.success(archived ? "Report delivery archived." : "Report delivery restored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to update report archive");
    }
  };

  // Sessions table derived data — Dubai clinic calendar day (YYYY-MM-DD)
  const toInputDate = (value: string) => clinicDateKey(value);

  const completedExams = React.useMemo(() => {
    return appointments.filter((appt) => appt.exam_id && appt.exam_id > 0);
  }, [appointments]);

  const examinerNameById = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const examiner of examiners) {
      map.set(examiner.id, examiner.name);
    }
    return map;
  }, [examiners]);

  const examinerLabel = React.useCallback(
    (examinerId?: number) => {
      if (!examinerId) return "—";
      return examinerNameById.get(examinerId) || `Examiner #${examinerId}`;
    },
    [examinerNameById],
  );

  const filteredExams = React.useMemo(() => {
    const q = examsSearch.trim().toLowerCase();
    return completedExams.filter((appt) => {
      const name = appt.subject
        ? `${appt.subject.first_name} ${appt.subject.last_name}`.toLowerCase()
        : "";
      const client = (appt.client?.name || "").toLowerCase();
      const examiner = examinerLabel(appt.examiner_id).toLowerCase();
      const day = toInputDate(appt.scheduled_at);
      const workflowStatus = reportWorkflow[appt.exam_id!] ?? "none";
      const matchesText = !q || name.includes(q) || client.includes(q) || examiner.includes(q);
      const matchesDateFrom = !examsDateFrom || day >= examsDateFrom;
      const matchesDateTo = !examsDateTo || day <= examsDateTo;
      const matchesWorkflow = examsWorkflowFilter === "all" || workflowStatus === examsWorkflowFilter;
      return matchesText && matchesDateFrom && matchesDateTo && matchesWorkflow;
    });
  }, [completedExams, examsSearch, examsDateFrom, examsDateTo, examsWorkflowFilter, reportWorkflow, examinerLabel]);

  const workflowCounts = React.useMemo(() => {
    const counts: Record<ReportWorkflowStatus, number> = {
      none: 0,
      draft: 0,
      locked: 0,
      sent: 0,
    };
    for (const appt of completedExams) {
      const status = reportWorkflow[appt.exam_id!] ?? "none";
      counts[status] += 1;
    }
    return counts;
  }, [completedExams, reportWorkflow]);

  const examsTotalPages = Math.max(1, Math.ceil(filteredExams.length / examsPerPage));
  React.useEffect(() => { if (examsPage > examsTotalPages) setExamsPage(examsTotalPages); }, [examsTotalPages, examsPage]);
  const paginatedExams = React.useMemo(
    () => filteredExams.slice((examsPage - 1) * examsPerPage, examsPage * examsPerPage),
    [filteredExams, examsPage, examsPerPage],
  );

  // Shares table derived data
  const filteredShares = React.useMemo(() => {
    const now = Date.now();
    return shares.filter((s) => {
	  if (sharesArchiveView === "active" && s.archived_at) return false;
	  if (sharesArchiveView === "archived" && !s.archived_at) return false;
      const createdDay = toInputDate(s.created_at);
      const matchesDateFrom = !sharesSearchDateFrom || createdDay >= sharesSearchDateFrom;
      const matchesDateTo = !sharesSearchDateTo || createdDay <= sharesSearchDateTo;
      if (sharesStatusFilter === "active" && new Date(s.expires_at).getTime() < now) return false;
      if (sharesStatusFilter === "expired" && new Date(s.expires_at).getTime() >= now) return false;
      return matchesDateFrom && matchesDateTo;
    });
  }, [shares, sharesArchiveView, sharesStatusFilter, sharesSearchDateFrom, sharesSearchDateTo]);

  const sharesTotalPages = Math.max(1, Math.ceil(filteredShares.length / sharesPerPage));
  React.useEffect(() => { if (sharesPage > sharesTotalPages) setSharesPage(sharesTotalPages); }, [sharesTotalPages, sharesPage]);
  const paginatedShares = filteredShares.slice((sharesPage - 1) * sharesPerPage, sharesPage * sharesPerPage);

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8 p-3 sm:p-6 max-w-7xl mx-auto">
      {/* Gradients */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-emerald-500/5 rounded-full blur-[100px] translate-y-1/2 -translate-x-1/4" />
      </div>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-5 sm:p-8 rounded-2xl sm:rounded-[2.5rem] bg-card/40 border border-border/50 backdrop-blur-xl shadow-sm relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2.5 sm:p-3 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <FileSignature className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Forensic Reports</h1>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-bold opacity-70 uppercase tracking-widest text-[10px] pl-1 pt-1">
            Consolidated Corporate Secure Document shares
          </p>
          <p className="text-xs text-muted-foreground pl-1 pt-2 max-w-2xl">
            Audit, view, and rotate secure report links generated for subjects and clients. Reports are sent as password-encrypted PDFs with temporary self-unlock tokens.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="relative z-10 h-11 rounded-xl px-5 font-bold w-full md:w-auto justify-center"
          onClick={() => router.push("/verify")}
        >
          <ShieldCheck className="mr-2 h-4 w-4" />
          Verify PDF
        </Button>
      </div>

      {/* Statistics widgets */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-6">
        {[
          { label: "Total Reports Issued", value: stats?.total_reports ?? 0, icon: FileSignature, color: "bg-primary/10 text-primary" },
          {
            label: "No Deception Indicated (NDI)",
            value: stats?.ndi_count ?? 0,
            icon: CheckCircle,
            color: "bg-emerald-500/10 text-emerald-500",
          },
          {
            label: "Deception Indicated (DI)",
            value: stats?.di_count ?? 0,
            icon: AlertTriangle,
            color: "bg-rose-500/10 text-rose-500",
          },
          {
            label: "Inconclusive Findings",
            value: stats?.inconclusive_count ?? 0,
            icon: HelpCircle,
            color: "bg-neutral-500/10 text-neutral-500",
          },
        ].map((stat, i) => (
          <Card key={i} className="border-border/40 bg-card/30 backdrop-blur-md shadow-xl overflow-hidden group hover:border-primary/30 transition-all hover:scale-[1.02] min-w-0">
            <CardContent className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-2 mb-2 sm:mb-4">
                <div className={cn("p-2 sm:p-2.5 rounded-xl shadow-inner shrink-0 w-fit", stat.color)}>
                  <stat.icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <p className="text-[9px] sm:text-[10px] uppercase font-black tracking-wider text-muted-foreground/70 leading-tight">{stat.label}</p>
              </div>
              <p className="text-xl sm:text-3xl font-black tracking-tighter">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="sessions" className="space-y-6">
        <TabsList className="w-full grid grid-cols-2 sm:flex sm:w-auto h-auto justify-start gap-2 rounded-2xl border border-border/50 bg-muted/40 p-1.5 shadow-sm backdrop-blur">
          <TabsTrigger
            value="sessions"
            className="w-full sm:w-auto rounded-xl px-4 sm:px-5 py-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors data-[active]:bg-primary data-[active]:text-primary-foreground data-[active]:shadow-md"
          >
            Sessions to Build
          </TabsTrigger>
          <TabsTrigger
            value="reports"
            className="w-full sm:w-auto rounded-xl px-4 sm:px-5 py-2.5 text-xs font-black uppercase tracking-widest text-muted-foreground transition-colors data-[active]:bg-primary data-[active]:text-primary-foreground data-[active]:shadow-md"
          >
            Sent Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6 mt-0 outline-none">
          <Card className="border-border/40 bg-card/30 backdrop-blur-md rounded-2xl sm:rounded-[2.5rem] overflow-hidden shadow-xl min-w-0 max-w-full">
            <CardHeader className="px-4 sm:px-8 pt-5 sm:pt-8 pb-4 min-w-0 max-w-full">
              <div className="flex flex-col gap-4 min-w-0 max-w-full">
                <div className="min-w-0 max-w-full">
                  <CardTitle className="text-base sm:text-lg flex items-center gap-2 font-bold max-w-full leading-snug break-words">
                    <ClipboardList className="h-5 w-5 text-primary shrink-0" />
                    <span className="break-words">Sessions Ready for Report Customization</span>
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs sm:text-sm leading-relaxed max-w-full">
                    Completed assessments ready for your formal Polygraph report — write, finalize, and send from here.
                  </CardDescription>
                </div>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto] min-w-0 max-w-full">
                  <div className="relative w-full min-w-0">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Search examinee, client..."
                      className="h-10 pl-10 rounded-xl bg-card border-border/50 text-xs sm:text-sm w-full min-w-0"
                      value={examsSearch}
                      onChange={(e) => { setExamsSearch(e.target.value); setExamsPage(1); }}
                    />
                  </div>
                  <Input
                    type="date"
                    className="h-10 rounded-xl bg-card border-border/50 text-xs sm:text-sm w-full min-w-0 max-w-full"
                    value={examsDateFrom}
                    onChange={(e) => { setExamsDateFrom(e.target.value); setExamsPage(1); }}
                  />
                  <Input
                    type="date"
                    className="h-10 rounded-xl bg-card border-border/50 text-xs sm:text-sm w-full min-w-0 max-w-full"
                    value={examsDateTo}
                    onChange={(e) => { setExamsDateTo(e.target.value); setExamsPage(1); }}
                  />
                  <div className="grid grid-cols-4 sm:flex sm:items-center gap-1.5 w-full sm:w-auto">
                    {[5, 10, 20, 50].map((size) => (
                      <Button
                        key={size}
                        type="button"
                        size="sm"
                        variant={examsPerPage === size ? "default" : "outline"}
                        className="h-10 px-2.5 sm:px-3.5 rounded-xl text-xs font-black uppercase tracking-widest w-full sm:w-auto"
                        onClick={() => { setExamsPerPage(size); setExamsPage(1); }}
                      >
                        {size}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto pb-1.5 max-w-full no-scrollbar">
                  {([
                    { value: "all" as const, label: "All", count: completedExams.length },
                    { value: "none" as const, label: "Needs report", count: workflowCounts.none },
                    { value: "draft" as const, label: "Draft", count: workflowCounts.draft },
                    { value: "locked" as const, label: "Locked — pending send", count: workflowCounts.locked },
                    { value: "sent" as const, label: "Sent", count: workflowCounts.sent },
                  ]).map((filter) => (
                    <Button
                      key={filter.value}
                      type="button"
                      size="sm"
                      variant={examsWorkflowFilter === filter.value ? "default" : "outline"}
                      className="h-10 px-3.5 sm:px-4 rounded-xl text-xs font-black uppercase tracking-widest shrink-0"
                      onClick={() => { setExamsWorkflowFilter(filter.value); setExamsPage(1); }}
                    >
                      {filter.label}
                      <span className="ml-1.5 opacity-70">({filter.count})</span>
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      <th className="px-8 py-4">Examinee</th>
                      <th className="px-8 py-4">Requesting Client</th>
                      <th className="px-8 py-4">Examiner</th>
                      <th className="px-8 py-4">Date</th>
                      <th className="px-8 py-4">Report status</th>
                      <th className="px-8 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="px-8 py-8 text-center text-muted-foreground italic">
                          Loading sessions...
                        </td>
                      </tr>
                    ) : paginatedExams.length > 0 ? (
                      paginatedExams.map((appt) => {
                        const examineeName = appt.subject
                          ? formatSubjectName(appt.subject)
                          : `Examinee #${appt.subject_id}`;
                        return (
                          <tr key={appt.id} className="hover:bg-primary/[0.02] transition-colors">
                            <td className="px-8 py-4 font-semibold text-foreground">{examineeName}</td>
                            <td className="px-8 py-4 text-xs font-medium text-foreground/80">{appt.client?.name || "Corporate"}</td>
                            <td className="px-8 py-4 text-xs font-medium text-foreground/80">{examinerLabel(appt.examiner_id)}</td>
                            <td className="px-8 py-4 text-xs text-muted-foreground">{formatClinicDateLabel(appt.scheduled_at)}</td>
                            <td className="px-8 py-4">
                              {workflowBadge(reportWorkflow[appt.exam_id!])}
                            </td>
                            <td className="px-8 py-4 text-right space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-xl text-xs gap-1.5 font-semibold"
                                onClick={() => handleOpenReportEditor(appt.exam_id!, examineeName)}
                              >
                                <FileSignature className="h-3.5 w-3.5" />
                                {reportWorkflow[appt.exam_id!] === "locked" || reportWorkflow[appt.exam_id!] === "sent"
                                  ? "View Locked Report"
                                  : "Write / Edit Report"}
                              </Button>
                              {reportWorkflow[appt.exam_id!] === "locked" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="rounded-xl text-xs gap-1.5 font-semibold"
                                  onClick={() => void handleDownloadPreview(appt.exam_id!)}
                                  disabled={!canViewLockedReport || downloadingExamId === appt.exam_id}
                                  title="Download a local preview PDF before sending"
                                >
                                  {downloadingExamId === appt.exam_id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                  Download Preview
                                </Button>
                              )}
                              <Button
                                size="sm"
                                className="rounded-xl text-xs gap-1.5 font-bold"
                                onClick={() => handleOpenShare(appt.exam_id!, appt.subject?.email)}
                                disabled={reportWorkflow[appt.exam_id!] !== "locked" && reportWorkflow[appt.exam_id!] !== "sent"}
                                title={
                                  reportWorkflow[appt.exam_id!] === "locked" || reportWorkflow[appt.exam_id!] === "sent"
                                    ? "Email secure PDF to client"
                                    : "Finalize and lock the report before sending"
                                }
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Email Secure Report
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-8 py-12 text-center text-muted-foreground italic">
                          {examsSearch || examsDateFrom || examsDateTo || examsWorkflowFilter !== "all"
                            ? "No sessions match your filters."
                            : "No active sessions found. Ensure session documentation is started or completed."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-border/20">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground italic">
                    Loading sessions...
                  </div>
                ) : paginatedExams.length > 0 ? (
                  paginatedExams.map((appt) => {
                    const examineeName = appt.subject
                      ? formatSubjectName(appt.subject)
                      : `Examinee #${appt.subject_id}`;
                    const status = reportWorkflow[appt.exam_id!];
                    return (
                      <div key={appt.id} className="p-4 space-y-3 hover:bg-primary/[0.02] transition-colors min-w-0 max-w-full overflow-hidden">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-base text-foreground leading-tight break-words">{examineeName}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5 font-medium break-words">
                              Client: <span className="text-foreground/80">{appt.client?.name || "Corporate"}</span>
                            </p>
                          </div>
                          <div className="shrink-0 self-start">
                            {workflowBadge(status)}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-xl border border-border/30">
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Examiner</span>
                            <span className="font-medium text-foreground">{examinerLabel(appt.examiner_id)}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase tracking-wider block opacity-70">Scheduled</span>
                            <span className="font-medium text-foreground">{formatClinicDateLabel(appt.scheduled_at)}</span>
                          </div>
                        </div>

                        {/* Dedicated Mobile Action Buttons */}
                        <div className="flex flex-col gap-2 pt-1">
                          {status === "locked" && (
                            <Button
                              size="sm"
                              variant="default"
                              className="w-full rounded-xl text-xs gap-2 font-bold h-10 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                              onClick={() => void handleDownloadPreview(appt.exam_id!)}
                              disabled={!canViewLockedReport || downloadingExamId === appt.exam_id}
                            >
                              {downloadingExamId === appt.exam_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Download Report Preview
                            </Button>
                          )}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full rounded-xl text-xs gap-1.5 font-semibold h-10"
                              onClick={() => handleOpenReportEditor(appt.exam_id!, examineeName)}
                            >
                              <FileSignature className="h-3.5 w-3.5" />
                              {status === "locked" || status === "sent"
                                ? "View Report"
                                : "Write / Edit Report"}
                            </Button>
                            <Button
                              size="sm"
                              variant={status === "locked" ? "outline" : "secondary"}
                              className="w-full rounded-xl text-xs gap-1.5 font-bold h-10"
                              onClick={() => handleOpenShare(appt.exam_id!, appt.subject?.email)}
                              disabled={status !== "locked" && status !== "sent"}
                            >
                              <Mail className="h-3.5 w-3.5" />
                              Email Secure Report
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground italic text-xs">
                    {examsSearch || examsDateFrom || examsDateTo || examsWorkflowFilter !== "all"
                      ? "No sessions match your filters."
                      : "No active sessions found. Ensure session documentation is started or completed."}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 border-t border-border/30 bg-muted/10 gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing <span className="text-foreground">{filteredExams.length > 0 ? (examsPage - 1) * examsPerPage + 1 : 0}-{Math.min(examsPage * examsPerPage, filteredExams.length)}</span> of {filteredExams.length} sessions
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                    onClick={() => setExamsPage((p) => Math.max(1, p - 1))}
                    disabled={examsPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                    onClick={() => setExamsPage((p) => Math.min(examsTotalPages, p + 1))}
                    disabled={examsPage === examsTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6 mt-0 outline-none">
          <div className="space-y-6">
            <div className="flex flex-col gap-4 px-1 sm:px-2">
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={sharesArchiveView === "active" ? "default" : "outline"}
                  className="rounded-xl flex-1 sm:flex-initial"
                  onClick={() => { setSharesArchiveView("active"); setSharesPage(1); }}
                >
                  Sent reports
                </Button>
                <Button
                  size="sm"
                  variant={sharesArchiveView === "archived" ? "default" : "outline"}
                  className="rounded-xl flex-1 sm:flex-initial"
                  onClick={() => { setSharesArchiveView("archived"); setSharesPage(1); }}
                >
                  <Archive className="mr-2 h-4 w-4" /> Archived
                </Button>
              </div>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
                <div className="relative w-full">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by examinee or email..."
                    className="h-12 pl-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm text-sm"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setSharesPage(1); }}
                  />
                </div>
                <Input
                  type="date"
                  className="h-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm text-sm"
                  value={sharesSearchDateFrom}
                  onChange={(e) => { setSharesSearchDateFrom(e.target.value); setSharesPage(1); }}
                />
                <Input
                  type="date"
                  className="h-12 rounded-2xl bg-card border-border/50 focus:border-primary/50 transition-all shadow-sm text-sm"
                  value={sharesSearchDateTo}
                  onChange={(e) => { setSharesSearchDateTo(e.target.value); setSharesPage(1); }}
                />
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[5, 10, 20, 50].map((size) => (
                    <Button
                      key={size}
                      size="sm"
                      variant={sharesPerPage === size ? "default" : "outline"}
                      className="h-10 px-3.5 rounded-xl text-xs font-black uppercase tracking-widest flex-1 sm:flex-initial"
                      onClick={() => { setSharesPerPage(size); setSharesPage(1); }}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full no-scrollbar">
                {(["all", "active", "expired"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={sharesStatusFilter === f ? "default" : "outline"}
                    className="h-10 px-5 rounded-xl capitalize text-xs font-black uppercase tracking-widest shrink-0"
                    onClick={() => { setSharesStatusFilter(f); setSharesPage(1); }}
                  >
                    {f === "all" ? "All" : f === "active" ? "Active" : "Expired"}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl sm:rounded-[2.5rem] border border-border/40 bg-card/20 backdrop-blur-xl overflow-hidden shadow-2xl">
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30 border-b border-border/50">
                      <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Examinee</th>
                      <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Recipient Email</th>
                      <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Passcode</th>
                      <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px]">Status / Expiration</th>
                      <th className="px-8 py-5 font-black text-muted-foreground uppercase tracking-widest text-[10px] text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/20">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                          Loading reports list...
                        </td>
                      </tr>
                    ) : paginatedShares.length > 0 ? (
                      paginatedShares.map((share) => {
                        const isExpired = new Date(share.expires_at).getTime() < Date.now();
                        const formattedExpiry = new Date(share.expires_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });

                        return (
                          <tr key={share.id} className="hover:bg-primary/[0.03] transition-all group">
                            <td className="px-8 py-6">
                              <div className="flex flex-col gap-1">
                                <span className="font-black text-base leading-none text-foreground">
                                  {share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "Unknown Subject"}
                                </span>
                                <span className="flex items-center gap-2">
                                  {share.exam_report && (
                                    <Badge
                                      className={cn(
                                        "text-[9px] font-black uppercase tracking-[0.1em]",
                                        share.exam_report.verdict === "NDI"
                                          ? "bg-emerald-500/10 text-emerald-600 border-none"
                                          : share.exam_report.verdict === "DI"
                                            ? "bg-rose-500/10 text-rose-600 border-none"
                                            : "bg-neutral-500/10 text-neutral-600 border-none"
                                      )}
                                    >
                                      {share.exam_report.verdict}
                                    </Badge>
                                  )}
                                  <span className="text-[9px] text-muted-foreground/80 font-normal">
                                    Sent: {new Date(share.created_at).toLocaleDateString()}
                                  </span>
                                </span>
                              </div>
                            </td>
                            <td className="px-8 py-6 font-semibold text-xs text-foreground/80">
                              <div className="flex items-center gap-1.5">
                                <Mail className="h-4 w-4 text-primary/70 shrink-0" />
                                {share.recipient_email}
                              </div>
                            </td>
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm tracking-wider font-bold">
                                  {share.protection_mode === "secure_link" ? "No PIN" : revealedPasswords[share.id] ? (share.password || "—") : "••••••"}
                                </span>
                                {share.protection_mode !== "secure_link" && <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-lg"
                                  onClick={() => togglePasswordReveal(share.id)}
                                >
                                  {revealedPasswords[share.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>}
                              </div>
                            </td>
                            <td className="px-8 py-6 space-y-1">
                              <Badge
                                className={cn(
                                  "rounded-full px-3 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shadow-sm",
                                  isExpired ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                                )}
                              >
                                {isExpired ? "Expired" : "Active"}
                              </Badge>
                              <div className="text-[9px] text-muted-foreground font-semibold flex items-center gap-1">
                                <Calendar className="h-3 w-3 shrink-0" />
                                {isExpired ? `Expired ${formattedExpiry}` : `Expires ${formattedExpiry}`}
                              </div>
                            </td>
                            <td className="px-8 py-6 text-right space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-primary/10 hover:text-primary transition-all"
                                onClick={() => handleCopyLink(share.token)}
                                title="Copy Secure Link"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-amber-500/10 hover:text-amber-600 transition-all"
                                onClick={() => handleOpenRegenerate(share)}
                                title="Regenerate / Rotate Link"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </Button>
                              <a href={`/shared/report/${share.token}`} target="_blank" rel="noopener noreferrer">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-9 w-9 rounded-xl hover:bg-blue-500/10 hover:text-blue-600 transition-all"
                                  title="Visit Shared Portal"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-xl hover:bg-muted"
                                onClick={() => void handleArchiveToggle(share)}
                                title={share.archived_at ? "Restore report delivery" : "Archive report delivery"}
                              >
                                {share.archived_at ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={5} className="px-8 py-20 text-center text-muted-foreground font-bold italic">
                          {sharesArchiveView === "archived" ? "No archived report deliveries." : "No report shares found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List View */}
              <div className="block md:hidden divide-y divide-border/20">
                {loading ? (
                  <div className="p-8 text-center text-muted-foreground font-bold italic">
                    Loading reports list...
                  </div>
                ) : paginatedShares.length > 0 ? (
                  paginatedShares.map((share) => {
                    const isExpired = new Date(share.expires_at).getTime() < Date.now();
                    const formattedExpiry = new Date(share.expires_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    });

                    return (
                      <div key={share.id} className="p-4 space-y-3 hover:bg-primary/[0.03] transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className="font-black text-base leading-tight text-foreground">
                              {share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "Unknown Subject"}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              {share.exam_report && (
                                <Badge
                                  className={cn(
                                    "text-[9px] font-black uppercase tracking-[0.1em]",
                                    share.exam_report.verdict === "NDI"
                                      ? "bg-emerald-500/10 text-emerald-600 border-none"
                                      : share.exam_report.verdict === "DI"
                                        ? "bg-rose-500/10 text-rose-600 border-none"
                                        : "bg-neutral-500/10 text-neutral-600 border-none"
                                  )}
                                >
                                  {share.exam_report.verdict}
                                </Badge>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                Sent {new Date(share.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <Badge
                            className={cn(
                              "rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-widest border-none shrink-0",
                              isExpired ? "bg-rose-500/10 text-rose-600" : "bg-emerald-500/10 text-emerald-600"
                            )}
                          >
                            {isExpired ? "Expired" : "Active"}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-xs bg-muted/20 p-2.5 rounded-xl border border-border/30">
                          <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
                            <Mail className="h-3.5 w-3.5 text-primary/70 shrink-0" />
                            <span className="truncate">{share.recipient_email}</span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-border/20">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase font-bold text-muted-foreground">PIN:</span>
                              <span className="font-mono text-xs font-bold">
                                {share.protection_mode === "secure_link" ? "No PIN" : revealedPasswords[share.id] ? (share.password || "—") : "••••••"}
                              </span>
                              {share.protection_mode !== "secure_link" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6 rounded-md"
                                  onClick={() => togglePasswordReveal(share.id)}
                                >
                                  {revealedPasswords[share.id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                </Button>
                              )}
                            </div>
                            <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1">
                              <Calendar className="h-3 w-3 shrink-0" />
                              {isExpired ? `Expired ${formattedExpiry}` : `Expires ${formattedExpiry}`}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-2 pt-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs rounded-xl gap-1 font-semibold flex items-center justify-center col-span-1"
                            onClick={() => handleCopyLink(share.token)}
                            title="Copy Link"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Copy</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs rounded-xl gap-1 font-semibold flex items-center justify-center col-span-1 text-amber-600 hover:text-amber-700"
                            onClick={() => handleOpenRegenerate(share)}
                            title="Rotate Link"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            <span className="hidden sm:inline">Rotate</span>
                          </Button>
                          <a href={`/shared/report/${share.token}`} target="_blank" rel="noopener noreferrer" className="col-span-1">
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full h-9 text-xs rounded-xl gap-1 font-semibold flex items-center justify-center text-blue-600 hover:text-blue-700"
                              title="Visit Portal"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Portal</span>
                            </Button>
                          </a>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs rounded-xl gap-1 font-semibold flex items-center justify-center col-span-1"
                            onClick={() => void handleArchiveToggle(share)}
                            title={share.archived_at ? "Restore" : "Archive"}
                          >
                            {share.archived_at ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                            <span className="hidden sm:inline">{share.archived_at ? "Restore" : "Archive"}</span>
                          </Button>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-muted-foreground font-bold italic text-xs">
                    {sharesArchiveView === "archived" ? "No archived report deliveries." : "No report shares found."}
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between px-4 sm:px-8 py-4 border-t border-border/30 bg-muted/10 gap-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Showing <span className="text-foreground">{filteredShares.length > 0 ? (sharesPage - 1) * sharesPerPage + 1 : 0}-{Math.min(sharesPage * sharesPerPage, filteredShares.length)}</span> of {filteredShares.length} reports
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                    onClick={() => setSharesPage((p) => Math.max(1, p - 1))}
                    disabled={sharesPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-4 rounded-xl border-border/50 text-xs font-black uppercase tracking-widest disabled:opacity-30"
                    onClick={() => setSharesPage((p) => Math.min(sharesTotalPages, p + 1))}
                    disabled={sharesPage === sharesTotalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
      <ShareReportDialog
        open={selectedExamId !== null}
        onOpenChange={(open) => !open && setSelectedExamId(null)}
        recipientEmail={recipientEmail}
        onRecipientEmailChange={setRecipientEmail}
        expiryDays={shareExpiryDays}
        onExpiryDaysChange={setShareExpiryDays}
        sharing={sharing}
        protectionMode={protectionMode}
        onProtectionModeChange={setProtectionMode}
        onSubmit={handleCreateShare}
      />
      <RegenerateReportDialog open={regenerateId !== null} onOpenChange={(open) => !open && setRegenerateId(null)} protectionMode={regenerateMode} onProtectionModeChange={setRegenerateMode} expiryDays={regenerateExpiry} onExpiryDaysChange={setRegenerateExpiry} submitting={regenerating} onSubmit={handleRegenerate} />

    </div>
  );
}
