"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  ArchiveRestore,
  ArrowUpRight,
  Copy,
  Download,
  Eye,
  EyeOff,
  FilePen,
  FileSignature,
  Loader2,
  Lock,
  Mail,
  RefreshCcw,
  RotateCw,
  Search,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, GlowPanel, Highlight, Segmented } from "@/components/dashboard/ui-kit";
import { RegenerateReportDialog } from "@/components/dashboard/regenerate-report-dialog";
import { ScheduledSendsPanel } from "@/components/dashboard/scheduled-sends-panel";
import { ShareReportDialog } from "@/components/dashboard/share-report-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clinicDateKey, formatClinicDateLabel, formatClinicDateTime } from "@/lib/clinic-time";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";
import {
  buildReportWorkflowMap,
  createSecureShare,
  DEFAULT_REPORT_SHARE_EXPIRY_DAYS,
  downloadLockedReportPreview,
  fetchConsolidatedStats,
  fetchReportWorkflowStatuses,
  fetchSecureShares,
  fetchUnscheduledReady,
  queueAllUnscheduledReady,
  queueScheduledSendForExam,
  regenerateSecureShare,
  setSecureShareArchived,
  type ConsolidatedReportStats,
  type ReportWorkflowStatus,
  type SecureReportShare,
} from "@/lib/reports";
import { formatSubjectName } from "@/lib/subjects";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

type Tab = "sessions" | "scheduled" | "sent";
type WorkflowFilter = "all" | ReportWorkflowStatus;
type ShareFilter = "all" | "live" | "expired" | "archived";

const PAGE_SIZES = [10, 20, 50] as const;

const WORKFLOW_LABEL: Record<ReportWorkflowStatus, string> = {
  none: "Needs report",
  draft: "Draft",
  locked: "Ready to send",
  sent: "Sent",
};

/** Verdicts in reading order: clear results, then concerning, then undecided. */
const VERDICTS = [
  { key: "ndi_count", code: "NDI", label: "No deception indicated", dot: "bg-[#7FBF8A]" },
  { key: "nsr_count", code: "NSR", label: "No significant response", dot: "bg-[#B9DDBF]" },
  { key: "di_count", code: "DI", label: "Deception indicated", dot: "bg-[#E58A7E]" },
  { key: "sr_count", code: "SR", label: "Significant response", dot: "bg-[#E2B35A]" },
  { key: "inconclusive_count", code: "INC", label: "Inconclusive", dot: "bg-[#ECE9E0]" },
] as const;

const shareSubjectName = (share: SecureReportShare) =>
  share.subject ? formatSubjectName(share.subject) || "Unnamed examinee" : "Unknown examinee";

const isShareExpired = (share: SecureReportShare) => new Date(share.expires_at).getTime() < Date.now();

const shortDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

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
  const [reportWorkflow, setReportWorkflow] = React.useState<Record<number, ReportWorkflowStatus>>({});
  const [loading, setLoading] = React.useState(true);
  // Skeletons only on the first load; a refresh keeps the current data on screen.
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const firstLoad = loading && !loadedOnce;
  const [error, setError] = React.useState<string | null>(null);

  const [tab, setTab] = React.useState<Tab>("sessions");
  const [scheduledCount, setScheduledCount] = React.useState<number | undefined>(undefined);
  // Locked reports signed before auto-send existed (no schedule yet), by exam id.
  const [unscheduled, setUnscheduled] = React.useState<Set<number>>(new Set());
  const [queueingExamId, setQueueingExamId] = React.useState<number | null>(null);
  const [panelKey, setPanelKey] = React.useState(0);
  const [search, setSearch] = React.useState("");
  const [dateFrom, setDateFrom] = React.useState("");
  const [dateTo, setDateTo] = React.useState("");
  const [workflowFilter, setWorkflowFilter] = React.useState<WorkflowFilter>("all");
  const [shareFilter, setShareFilter] = React.useState<ShareFilter>("all");
  const [page, setPage] = React.useState(1);
  const [perPage, setPerPage] = React.useState<number>(10);
  const [revealed, setRevealed] = React.useState<Record<number, boolean>>({});

  // Share / rotate dialogs (both confirm before any email is sent)
  const [selectedExamId, setSelectedExamId] = React.useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [shareExpiryDays, setShareExpiryDays] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [protectionMode, setProtectionMode] = React.useState<"password" | "secure_link">("password");
  const [sharing, setSharing] = React.useState(false);
  const [regenerateId, setRegenerateId] = React.useState<number | null>(null);
  const [regenerateMode, setRegenerateMode] = React.useState<"password" | "secure_link">("password");
  const [regenerateExpiry, setRegenerateExpiry] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [regenerating, setRegenerating] = React.useState(false);
  const [downloadingExamId, setDownloadingExamId] = React.useState<number | null>(null);
  const [archivingId, setArchivingId] = React.useState<number | null>(null);

  // Everything is loaded once and filtered here, so typing in search doesn't refetch.
  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sharesData, statsData, apptsData, workflowRows, examinersData] = await Promise.all([
        fetchSecureShares({ archive: "all" }),
        fetchConsolidatedStats(),
        fetchAppointments(),
        fetchReportWorkflowStatuses(),
        fetchExaminers().catch(() => [] as UserRecord[]),
      ]);
      fetchUnscheduledReady()
        .then((rows) => setUnscheduled(new Set(rows.map((r) => r.exam_id))))
        .catch(() => setUnscheduled(new Set()));
      setShares(sharesData);
      setStats(statsData);
      setAppointments(apptsData);
      setExaminers(examinersData);
      setReportWorkflow(buildReportWorkflowMap(workflowRows));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
      setLoadedOnce(true);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Any filter change returns to page 1.
  React.useEffect(() => {
    setPage(1);
  }, [tab, search, dateFrom, dateTo, workflowFilter, shareFilter, perPage]);

  /* ---------------- derived data ---------------- */

  const examinerName = React.useMemo(() => {
    const map = new Map<number, string>();
    for (const e of examiners) map.set(e.id, e.name);
    return (id?: number) => (id ? map.get(id) || `Examiner #${id}` : "—");
  }, [examiners]);

  const completedExams = React.useMemo(() => appointments.filter((a) => a.exam_id && a.exam_id > 0), [appointments]);
  const statusOf = React.useCallback((examId: number): ReportWorkflowStatus => reportWorkflow[examId] ?? "none", [reportWorkflow]);

  const workflowCounts = React.useMemo(() => {
    const counts: Record<ReportWorkflowStatus, number> = { none: 0, draft: 0, locked: 0, sent: 0 };
    for (const a of completedExams) counts[statusOf(a.exam_id!)] += 1;
    return counts;
  }, [completedExams, statusOf]);

  const needle = search.trim().toLowerCase();
  const inRange = React.useCallback(
    (value: string) => {
      const day = clinicDateKey(value);
      return (!dateFrom || day >= dateFrom) && (!dateTo || day <= dateTo);
    },
    [dateFrom, dateTo],
  );

  const filteredExams = React.useMemo(
    () =>
      completedExams.filter((a) => {
        if (workflowFilter !== "all" && statusOf(a.exam_id!) !== workflowFilter) return false;
        if (!inRange(a.scheduled_at)) return false;
        if (!needle) return true;
        const name = a.subject ? formatSubjectName(a.subject) : "";
        return [name, a.client?.name ?? "", examinerName(a.examiner_id)].some((v) => v.toLowerCase().includes(needle));
      }),
    [completedExams, workflowFilter, statusOf, inRange, needle, examinerName],
  );

  const shareCounts = React.useMemo(() => {
    let all = 0;
    let live = 0;
    let expired = 0;
    let archived = 0;
    for (const s of shares) {
      if (s.archived_at) {
        archived += 1;
        continue;
      }
      all += 1;
      if (isShareExpired(s)) expired += 1;
      else live += 1;
    }
    return { all, live, expired, archived };
  }, [shares]);

  const filteredShares = React.useMemo(
    () =>
      shares.filter((s) => {
        if (shareFilter === "archived" ? !s.archived_at : s.archived_at) return false;
        if (shareFilter === "live" && isShareExpired(s)) return false;
        if (shareFilter === "expired" && !isShareExpired(s)) return false;
        if (!inRange(s.created_at)) return false;
        if (!needle) return true;
        return [shareSubjectName(s), s.recipient_email].some((v) => v.toLowerCase().includes(needle));
      }),
    [shares, shareFilter, inRange, needle],
  );

  const rows = tab === "sessions" ? filteredExams : filteredShares;
  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * perPage;
  const pagedExams = filteredExams.slice(pageStart, pageStart + perPage);
  const pagedShares = filteredShares.slice(pageStart, pageStart + perPage);

  const issued = stats?.total_reports ?? 0;
  const filtersActive = needle !== "" || dateFrom !== "" || dateTo !== "" || (tab === "sessions" ? workflowFilter !== "all" : shareFilter !== "all");
  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setWorkflowFilter("all");
    setShareFilter("all");
  };

  /* ---------------- actions ---------------- */

  const openShare = (examId: number, email?: string) => {
    const status = statusOf(examId);
    if (status !== "locked" && status !== "sent") {
      toast.error("Finalize and lock the report in the Report Builder before emailing it.");
      return;
    }
    setSelectedExamId(examId);
    setRecipientEmail(email || "");
    setShareExpiryDays(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
    setProtectionMode("password");
  };

  const handleCreateShare = async () => {
    if (!selectedExamId || !recipientEmail.trim()) {
      toast.error("Enter the recipient's email address");
      return;
    }
    setSharing(true);
    try {
      const created = await createSecureShare(null, recipientEmail.trim(), selectedExamId, shareExpiryDays, protectionMode);
      if (created?.email_error) toast.warning("The link was created, but the email didn't go out. Copy the link from the list and send it yourself.", { duration: 10000 });
      else toast.success("Secure report sent");
      setSelectedExamId(null);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't send the report");
    } finally {
      setSharing(false);
    }
  };

  const queueOne = async (examId: number) => {
    setQueueingExamId(examId);
    try {
      const send = await queueScheduledSendForExam(examId);
      setUnscheduled((prev) => {
        const next = new Set(prev);
        next.delete(examId);
        return next;
      });
      setScheduledCount((n) => (n ?? 0) + 1);
      setPanelKey((k) => k + 1);
      toast.success(`Scheduled: emails ${send.recipient_email || "the client"} on ${formatClinicDateTime(send.send_at)}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't schedule this report");
    } finally {
      setQueueingExamId(null);
    }
  };

  const queueAll = async () => {
    const queued = await queueAllUnscheduledReady();
    setUnscheduled(new Set());
    setPanelKey((k) => k + 1);
    toast.success(`${queued} report${queued === 1 ? "" : "s"} scheduled to send in 48 hours`);
  };

  const openEditor = (examId: number, subjectName: string) => {
    if (statusOf(examId) === "locked" && !canViewLockedReport) {
      toast.error("You don't have permission to view locked final reports.");
      return;
    }
    router.push(`/dashboard/reports/${examId}?subject=${encodeURIComponent(subjectName)}`);
  };

  const downloadPreview = async (examId: number) => {
    if (!canViewLockedReport) {
      toast.error("You don't have permission to download locked final reports.");
      return;
    }
    setDownloadingExamId(examId);
    try {
      await downloadLockedReportPreview(examId);
      toast.success("Preview downloaded");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't download the preview");
    } finally {
      setDownloadingExamId(null);
    }
  };

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/shared/report/${token}`);
      toast.success("Secure link copied");
    } catch {
      toast.error("Couldn't copy — your browser blocked clipboard access");
    }
  };

  const openRegenerate = (share: SecureReportShare) => {
    setRegenerateId(share.id);
    setRegenerateMode(share.protection_mode || "password");
    setRegenerateExpiry(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  };

  const handleRegenerate = async () => {
    if (!regenerateId) return;
    setRegenerating(true);
    try {
      const updated = await regenerateSecureShare(regenerateId, regenerateExpiry, regenerateMode);
      setShares((prev) => prev.map((s) => (s.id === regenerateId ? updated : s)));
      setRegenerateId(null);
      if (updated.email_error) toast.warning("The link was created, but the email didn't go out. Copy the link from the list and send it yourself.", { duration: 10000 });
      else toast.success("Link rotated · a new email was sent");
      setStats(await fetchConsolidatedStats());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't rotate the link");
    } finally {
      setRegenerating(false);
    }
  };

  const toggleArchive = async (share: SecureReportShare) => {
    const archived = !share.archived_at;
    setArchivingId(share.id);
    try {
      const updated = await setSecureShareArchived(share.id, archived);
      setShares((prev) => prev.map((s) => (s.id === share.id ? updated : s)));
      toast.success(archived ? "Delivery archived" : "Delivery restored");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't update the archive");
    } finally {
      setArchivingId(null);
    }
  };

  if (userLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 aria-hidden="true" className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="terracotta" orb="72%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <FileSignature aria-hidden="true" className="size-4" />
                Reports
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Examination <span className="font-semibold">reports</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">
                Write, lock and send reports for completed exams. Each one goes out as an encrypted PDF behind an expiring secure link.
              </p>
            </div>
            <div className="flex items-center gap-2 self-start md:self-auto">
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                aria-label="Refresh"
                title="Refresh"
                className="flex size-11 items-center justify-center rounded-full bg-white/[0.07] text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
              >
                <RefreshCcw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={() => router.push("/verify")}
                className="flex h-11 items-center gap-2 rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12]"
              >
                <ShieldCheck aria-hidden="true" className="size-4" />
                Verify a PDF
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat label="Needs report" value={workflowCounts.none} hint="Completed, no report yet" icon={FilePen} accent="terracotta" loading={firstLoad} />
            <GlassStat label="Drafts" value={workflowCounts.draft} hint="Started, not locked" icon={FileSignature} accent="lavender" loading={firstLoad} />
            <GlassStat label="Ready to send" value={workflowCounts.locked} hint="Locked; auto-sends 48h after signing" icon={Lock} accent="amber" loading={firstLoad} />
            <GlassStat
              label="Live links"
              value={shareCounts.live}
              hint={shareCounts.expired ? `${shareCounts.expired} expired` : "Recipients can open these"}
              icon={Send}
              accent="sage"
              loading={firstLoad}
            />
          </div>

          {/* Verdicts: five labelled counts, not a chart */}
          <div className="flex flex-col gap-3 rounded-[22px] bg-white/[0.05] p-4 ring-1 ring-white/10 sm:p-5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-[#C9C6BC]">Issued reports by verdict</span>
              <span className="text-[13px] text-[#B5B2A8] tabular-nums">
                {firstLoad ? "—" : `${issued.toLocaleString()} total`}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
              {VERDICTS.map((v) => {
                const count = stats?.[v.key] ?? 0;
                const share = issued > 0 ? Math.round((count / issued) * 100) : 0;
                return (
                  <div key={v.code} className="flex min-w-0 flex-col gap-1">
                    <dt className="flex min-w-0 items-center gap-2 text-xs text-[#C9C6BC]" title={v.label}>
                      <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", v.dot)} />
                      <span className="font-mono text-[11px] font-semibold text-[#ECE9E0]">{v.code}</span>
                      <span className="truncate">{v.label}</span>
                    </dt>
                    <dd className="flex h-5 items-center gap-2 pl-3.5">
                      {firstLoad ? (
                        <span aria-hidden="true" className="block h-full w-8 animate-pulse rounded bg-white/10" />
                      ) : (
                        <>
                          <span className="text-xl leading-none font-medium tabular-nums">{count}</span>
                          {issued > 0 ? <span className="text-xs leading-none text-[#B5B2A8] tabular-nums">{share}%</span> : null}
                        </>
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </GlowPanel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 dark:bg-card">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Segmented
            label="View"
            value={tab}
            onChange={setTab}
            options={[
              { value: "sessions", label: "Sessions", count: completedExams.length },
              { value: "scheduled", label: "Scheduled", count: scheduledCount },
              { value: "sent", label: "Sent reports", count: shareCounts.all },
            ]}
          />
          <div className="relative w-full lg:w-80">
            <label htmlFor="reports-search" className="sr-only">
              Search
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reports-search"
              placeholder={tab === "sessions" ? "Search examinee, client or examiner…" : tab === "scheduled" ? "Search examinee, client or recipient…" : "Search examinee or recipient…"}
              className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-10 pl-11 text-sm shadow-none dark:bg-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button
                type="button"
                aria-label="Clear search"
                onClick={() => setSearch("")}
                className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
        {tab === "scheduled" ? null : (
        <div className="flex flex-col gap-3 border-t border-border/50 pt-3 lg:flex-row lg:items-center lg:justify-between">
          {tab === "sessions" ? (
            <Segmented
              label="Report status"
              value={workflowFilter}
              onChange={setWorkflowFilter}
              options={[
                { value: "all", label: "All", count: completedExams.length },
                { value: "none", label: WORKFLOW_LABEL.none, count: workflowCounts.none },
                { value: "draft", label: WORKFLOW_LABEL.draft, count: workflowCounts.draft },
                { value: "locked", label: WORKFLOW_LABEL.locked, count: workflowCounts.locked },
                { value: "sent", label: WORKFLOW_LABEL.sent, count: workflowCounts.sent },
              ]}
            />
          ) : (
            <Segmented
              label="Link status"
              value={shareFilter}
              onChange={setShareFilter}
              options={[
                { value: "all", label: "All", count: shareCounts.all },
                { value: "live", label: "Live", count: shareCounts.live },
                { value: "expired", label: "Expired", count: shareCounts.expired },
                { value: "archived", label: "Archived", count: shareCounts.archived },
              ]}
            />
          )}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] text-muted-foreground">{tab === "sessions" ? "Exam date" : "Sent"}</span>
            <DateInput label="From" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} />
            <span aria-hidden="true" className="text-muted-foreground">
              –
            </span>
            <DateInput label="To" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />
          </div>
        </div>
        )}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-[20px] bg-[#F6E3E1] px-4 py-3 text-sm text-[#8A2C22] dark:bg-red-950 dark:text-red-300">
          <span className="flex items-center gap-2">
            <AlertCircle aria-hidden="true" className="size-4" />
            {error}
          </span>
          <button type="button" onClick={() => void load()} className="font-medium underline-offset-4 hover:underline">
            Try again
          </button>
        </div>
      ) : null}

      {tab === "scheduled" ? (
        <ScheduledSendsPanel key={panelKey} search={search} unscheduledCount={unscheduled.size} onQueueAll={queueAll} onCountChange={setScheduledCount} onDelivered={() => void load()} />
      ) : (
      /* Table */
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        <div className="overflow-x-auto">
          {tab === "sessions" ? (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <TableHead columns={["Examinee", "Client", "Examiner", "Exam date", "Report"]} />
              <tbody className="divide-y divide-border/40">
                {firstLoad ? (
                  <SkeletonRows cols={6} />
                ) : pagedExams.length === 0 ? (
                  <EmptyRow
                    cols={6}
                    title={filtersActive ? "No sessions match these filters" : "No completed sessions yet"}
                    hint={filtersActive ? undefined : "Sessions appear here once their exam has been started or completed."}
                    action={filtersActive ? { label: "Clear filters", onClick: clearFilters } : undefined}
                  />
                ) : (
                  pagedExams.map((appt) => {
                    const examId = appt.exam_id!;
                    const status = statusOf(examId);
                    const name = appt.subject ? formatSubjectName(appt.subject) || `Examinee #${appt.subject_id}` : `Examinee #${appt.subject_id}`;
                    const finished = status === "locked" || status === "sent";
                    return (
                      <tr key={appt.id} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                        <td className="max-w-[260px] px-6 py-4">
                          <span className="block truncate font-medium">
                            <Highlight text={name} query={search} />
                          </span>
                        </td>
                        <td className="max-w-[220px] px-6 py-4">
                          <span className="block truncate">
                            <Highlight text={appt.client?.name || "—"} query={search} />
                          </span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">
                          <Highlight text={examinerName(appt.examiner_id)} query={search} />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">{formatClinicDateLabel(appt.scheduled_at)}</td>
                        <td className="px-6 py-4">
                          <WorkflowPill status={status} />
                        </td>
                        <td className="px-6 py-4">
                          <RowActions>
                            {status === "locked" && unscheduled.has(examId) ? (
                              <ActionButton
                                label="Schedule"
                                icon={queueingExamId === examId ? Loader2 : CalendarClock}
                                spin={queueingExamId === examId}
                                disabled={queueingExamId === examId}
                                onClick={() => void queueOne(examId)}
                              />
                            ) : null}
                            {status === "locked" ? (
                              <ActionButton primary label="Send report" icon={Mail} onClick={() => openShare(examId, appt.subject?.email)} />
                            ) : status === "sent" ? (
                              <ActionButton label="Send again" icon={Mail} onClick={() => openShare(examId, appt.subject?.email)} />
                            ) : (
                              <ActionButton
                                primary
                                label={status === "draft" ? "Continue draft" : "Write report"}
                                icon={FilePen}
                                onClick={() => openEditor(examId, name)}
                              />
                            )}
                            {status === "locked" && canViewLockedReport ? (
                              <ActionButton
                                iconOnly
                                label="Download preview PDF"
                                icon={downloadingExamId === examId ? Loader2 : Download}
                                spin={downloadingExamId === examId}
                                disabled={downloadingExamId === examId}
                                onClick={() => void downloadPreview(examId)}
                              />
                            ) : null}
                            {finished ? <ActionButton iconOnly label="Open report" icon={ArrowUpRight} onClick={() => openEditor(examId, name)} /> : null}
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[980px] border-collapse text-left text-sm">
              <TableHead columns={["Examinee", "Recipient", "Sent", "Access", "Link"]} />
              <tbody className="divide-y divide-border/40">
                {firstLoad ? (
                  <SkeletonRows cols={6} />
                ) : pagedShares.length === 0 ? (
                  <EmptyRow
                    cols={6}
                    title={
                      filtersActive && shareFilter !== "archived"
                        ? "No sent reports match these filters"
                        : shareFilter === "archived"
                          ? "Nothing archived"
                          : "No reports sent yet"
                    }
                    hint={!filtersActive ? "Lock a report from the Sessions view, then send it from there." : undefined}
                    action={filtersActive ? { label: "Clear filters", onClick: clearFilters } : { label: "Go to sessions", onClick: () => setTab("sessions") }}
                  />
                ) : (
                  pagedShares.map((share) => {
                    const expired = isShareExpired(share);
                    const pin = share.protection_mode !== "secure_link";
                    const name = shareSubjectName(share);
                    return (
                      <tr key={share.id} className={cn("transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40", share.archived_at && "text-muted-foreground")}>
                        <td className="max-w-[260px] px-6 py-4">
                          <span className="flex items-center gap-2.5">
                            {share.exam_report?.verdict ? <VerdictChip verdict={share.exam_report.verdict} /> : null}
                            <span className="truncate font-medium">
                              <Highlight text={name} query={search} />
                            </span>
                          </span>
                        </td>
                        <td className="max-w-[240px] px-6 py-4">
                          <span className="block truncate text-muted-foreground">
                            <Highlight text={share.recipient_email} query={search} />
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="flex flex-col gap-0.5">
                            <span>{shortDate(share.created_at)}</span>
                            {share.status === "viewed" ? <span className="text-xs text-[#2D5A27] dark:text-emerald-300">Opened by recipient</span> : null}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {pin ? (
                            <span className="flex items-center gap-1">
                              <span className="min-w-[4.5rem] font-mono text-[13px] tracking-wider tabular-nums">{revealed[share.id] ? share.password || "—" : "••••••"}</span>
                              <button
                                type="button"
                                aria-label={revealed[share.id] ? "Hide PIN" : "Show PIN"}
                                aria-pressed={Boolean(revealed[share.id])}
                                onClick={() => setRevealed((r) => ({ ...r, [share.id]: !r[share.id] }))}
                                className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                              >
                                {revealed[share.id] ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                              </button>
                            </span>
                          ) : (
                            <span className="text-[13px] text-muted-foreground">Link only, no PIN</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="flex flex-col gap-0.5">
                            <LinkPill expired={expired} />
                            <span className="pl-1 text-xs whitespace-nowrap text-muted-foreground">
                              {expired ? "Expired" : "Expires"} {shortDate(share.expires_at)}
                            </span>
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <RowActions>
                            <ActionButton label="Rotate" icon={RotateCw} onClick={() => openRegenerate(share)} />
                            <ActionButton iconOnly label="Copy secure link" icon={Copy} onClick={() => void copyLink(share.token)} />
                            <a
                              href={`/shared/report/${share.token}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open recipient's view"
                              title="Open recipient's view"
                              className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                            >
                              <ArrowUpRight aria-hidden="true" className="size-4" />
                            </a>
                            <ActionButton
                              iconOnly
                              label={share.archived_at ? "Restore delivery" : "Archive delivery"}
                              icon={archivingId === share.id ? Loader2 : share.archived_at ? ArchiveRestore : Archive}
                              spin={archivingId === share.id}
                              disabled={archivingId === share.id}
                              onClick={() => void toggleArchive(share)}
                            />
                          </RowActions>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {!firstLoad && rows.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-border/50 px-6 py-3 text-[13px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="tabular-nums">
              {pageStart + 1}–{Math.min(pageStart + perPage, rows.length)} of {rows.length} {tab === "sessions" ? "sessions" : "reports"}
            </span>
            <div className="flex items-center gap-2">
              <Select value={String(perPage)} onValueChange={(v) => setPerPage(Number(v))}>
                <SelectTrigger aria-label="Rows per page" className="h-9 w-auto rounded-full border-0 bg-[#F3F1EA] px-3.5 text-[13px] shadow-none dark:bg-muted">
                  <SelectValue>{perPage} per page</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} per page
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {totalPages > 1 ? (
                <>
                  <PagerButton label="Previous" disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} />
                  <span className="px-1 tabular-nums">
                    {safePage} / {totalPages}
                  </span>
                  <PagerButton label="Next" disabled={safePage >= totalPages} onClick={() => setPage(safePage + 1)} />
                </>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      )}

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
      <RegenerateReportDialog
        open={regenerateId !== null}
        onOpenChange={(open) => !open && setRegenerateId(null)}
        protectionMode={regenerateMode}
        onProtectionModeChange={setRegenerateMode}
        expiryDays={regenerateExpiry}
        onExpiryDaysChange={setRegenerateExpiry}
        submitting={regenerating}
        onSubmit={handleRegenerate}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

type IconType = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
        {columns.map((c) => (
          <th key={c} className="px-6 pt-5 pb-3 font-medium">
            {c}
          </th>
        ))}
        <th className="px-6 pt-5 pb-3 text-right font-medium">Actions</th>
      </tr>
    </thead>
  );
}

function RowActions({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-1">{children}</div>;
}

function ActionButton({
  label,
  icon: Icon,
  onClick,
  primary,
  iconOnly,
  disabled,
  spin,
}: {
  label: string;
  icon: IconType;
  onClick: () => void;
  primary?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
  spin?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={iconOnly ? label : undefined}
      title={iconOnly ? label : undefined}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors disabled:opacity-50",
        iconOnly ? "w-9 text-muted-foreground hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted" : "px-3.5",
        !iconOnly &&
          (primary
            ? "bg-[#30302E] text-[#FAF9F5] hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground"
            : "ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"),
      )}
    >
      <Icon aria-hidden="true" className={cn(iconOnly ? "size-4" : "size-3.5", spin && "animate-spin")} />
      {iconOnly ? null : label}
    </button>
  );
}

const WORKFLOW_STYLE: Record<ReportWorkflowStatus, { chip: string; dot: string }> = {
  none: { chip: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary", dot: "bg-primary" },
  draft: { chip: "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200", dot: "bg-[#7C6BD6]" },
  locked: { chip: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300", dot: "bg-[#E2B35A]" },
  sent: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
};

function WorkflowPill({ status }: { status: ReportWorkflowStatus }) {
  const style = WORKFLOW_STYLE[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", style.chip)}>
      {status === "locked" ? <Lock aria-hidden="true" className="size-3" /> : <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />}
      {WORKFLOW_LABEL[status]}
    </span>
  );
}

function LinkPill({ expired }: { expired: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium",
        expired ? "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" : "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
      )}
    >
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", expired ? "bg-[#8B887E]" : "bg-[#3F7A37] dark:bg-emerald-400")} />
      {expired ? "Expired" : "Live"}
    </span>
  );
}

function VerdictChip({ verdict }: { verdict: string }) {
  const v = verdict.toUpperCase();
  const tone =
    v === "NDI" || v === "NSR"
      ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300"
      : v === "DI" || v === "SR"
        ? "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300"
        : "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground";
  return <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", tone)}>{verdict}</span>;
}

function DateInput({ label, value, onChange, min, max }: { label: string; value: string; onChange: (v: string) => void; min?: string; max?: string }) {
  return (
    <div className="relative">
      <Input
        type="date"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-10 w-[9.5rem] rounded-full border-0 bg-[#F3F1EA] px-3.5 text-[13px] shadow-none dark:bg-muted", value && "pr-9")}
      />
      {value ? (
        <button
          type="button"
          aria-label={`Clear ${label.toLowerCase()} date`}
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function PagerButton({ label, disabled, onClick }: { label: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center rounded-full px-3.5 text-[13px] font-medium text-foreground ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-40 dark:hover:bg-muted"
    >
      {label}
    </button>
  );
}

function SkeletonRows({ cols }: { cols: number }) {
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <tr key={i}>
          <td colSpan={cols} className="px-6 py-3.5">
            <div className="h-9 animate-pulse rounded-xl bg-muted" />
          </td>
        </tr>
      ))}
    </>
  );
}

function EmptyRow({ cols, title, hint, action }: { cols: number; title: string; hint?: string; action?: { label: string; onClick: () => void } }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-14 text-center">
        <p className="text-[15px] font-medium">{title}</p>
        {hint ? <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{hint}</p> : null}
        {action ? (
          <button type="button" onClick={action.onClick} className="mt-2 text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
            {action.label}
          </button>
        ) : null}
      </td>
    </tr>
  );
}
