"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { useParams, useRouter } from "next/navigation";
import { CalendarPlus, Check, Copy, Eye, EyeOff, FileSignature, Link2, Loader2, Lock, Mail, PenLine, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, TableSearch, usePager } from "@/components/dashboard/table-pager";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { ShareReportDialog } from "@/components/dashboard/share-report-dialog";
import { RegenerateReportDialog } from "@/components/dashboard/regenerate-report-dialog";
import {
  DEFAULT_REPORT_SHARE_EXPIRY_DAYS,
  fetchSecureShares,
  createSecureShare,
  regenerateSecureShare,
  fetchReportWorkflowStatuses,
  buildReportWorkflowMap,
  type ReportWorkflowStatus,
  type SecureReportShare,
} from "@/lib/reports";
import { formatSubjectName } from "@/lib/subjects";
import { formatClinicDateLabel } from "@/lib/clinic-time";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

const STAGES: { key: ReportWorkflowStatus; label: string }[] = [
  { key: "draft", label: "Write" },
  { key: "locked", label: "Lock" },
  { key: "sent", label: "Send" },
];
const STAGE_INDEX: Record<ReportWorkflowStatus, number> = { none: -1, draft: 0, locked: 1, sent: 2 };

function StageTrack({ status }: { status: ReportWorkflowStatus }) {
  const reached = STAGE_INDEX[status];
  return (
    <ol className="flex items-center gap-1" aria-label={`Report stage: ${status === "none" ? "not started" : status}`}>
      {STAGES.map((stage, i) => {
        const done = i <= reached;
        return (
          <li key={stage.key} className="flex items-center gap-1">
            {i > 0 ? <span aria-hidden="true" className={cn("h-px w-3", done ? "bg-[#5FA86C]" : "bg-border")} /> : null}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
                done ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : "bg-[#F3F1EA] text-muted-foreground dark:bg-muted",
              )}
            >
              {done ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : null}
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function relative(iso: string) {
  const days = Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

type ReportFilter = "all" | "write" | "ready" | "sent";
type LinkFilter = "all" | "active" | "opened" | "inactive";
type ShareState = "active" | "opened" | "expired" | "withdrawn";

function shareState(s: SecureReportShare): ShareState {
  if (s.archived_at) return "withdrawn";
  if (new Date(s.expires_at).getTime() < Date.now()) return "expired";
  return s.status === "viewed" ? "opened" : "active";
}

const SHARE_STATE: Record<ShareState, { text: string; style: string }> = {
  active: { text: "Not opened yet", style: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" },
  opened: { text: "Opened", style: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" },
  expired: { text: "Expired", style: "bg-destructive/10 text-destructive" },
  withdrawn: { text: "Withdrawn", style: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" },
};

const PILL = "flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium whitespace-nowrap ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted";
const DARK_PILL = "flex h-8 items-center gap-1.5 rounded-full bg-[#2B2A27] px-3 text-[13px] font-medium whitespace-nowrap text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background";

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Couldn't copy — your browser blocked the clipboard.");
  }
}

export default function ClientReportsPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = Number(params.id);
  const { client, appointments, loading: clientLoading } = useClientDetail();
  const { can } = useCurrentUser();

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});

  const [selectedExamId, setSelectedExamId] = React.useState<number | null>(null);
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [shareExpiryDays, setShareExpiryDays] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [protectionMode, setProtectionMode] = React.useState<"password" | "secure_link">("password");
  const [regenerateId, setRegenerateId] = React.useState<number | null>(null);
  const [regenerateMode, setRegenerateMode] = React.useState<"password" | "secure_link">("password");
  const [regenerateExpiry, setRegenerateExpiry] = React.useState(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
  const [regenerating, setRegenerating] = React.useState(false);
  const [sharing, setSharing] = React.useState(false);
  const [reportWorkflow, setReportWorkflow] = React.useState<Record<number, ReportWorkflowStatus>>({});
  const [workflowLoading, setWorkflowLoading] = React.useState(true);
  const [tab, setTab] = React.useState<"reports" | "links">("reports");
  const [reportFilter, setReportFilter] = React.useState<ReportFilter>("all");
  const [reportQuery, setReportQuery] = React.useState("");
  const [linkFilter, setLinkFilter] = React.useState<LinkFilter>("all");
  const [linkQuery, setLinkQuery] = React.useState("");
  const reportsRef = React.useRef<HTMLElement>(null);
  const linksRef = React.useRef<HTMLElement>(null);

  const loadShares = React.useCallback(async () => {
    if (!Number.isFinite(clientId)) return;
    setSharesLoading(true);
    try {
      setShares(await fetchSecureShares({ client_id: clientId }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load shared reports");
    } finally {
      setSharesLoading(false);
    }
  }, [clientId]);

  React.useEffect(() => {
    void loadShares();
  }, [loadShares]);

  // Sessions whose documentation has started — the only ones that can have a report.
  const documented = React.useMemo(
    () => appointments.filter((a) => a.exam_id && a.exam_id > 0).sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    [appointments],
  );
  const examIdsKey = documented.map((a) => a.exam_id).join(",");

  React.useEffect(() => {
    let cancelled = false;
    const examIds = documented.map((a) => a.exam_id).filter((id): id is number => Boolean(id));
    if (examIds.length === 0) {
      setReportWorkflow({});
      setWorkflowLoading(false);
      return;
    }
    setWorkflowLoading(true);
    fetchReportWorkflowStatuses()
      .then((rows) => {
        if (!cancelled) setReportWorkflow(buildReportWorkflowMap(rows, examIds));
      })
      .catch((err) => {
        if (!cancelled) {
          setReportWorkflow({});
          toast.error(err instanceof Error ? err.message : "Failed to load report statuses");
        }
      })
      .finally(() => {
        if (!cancelled) setWorkflowLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the exam id list
  }, [examIdsKey]);

  const openEditor = (examId: number, subjectName: string) => {
    router.push(`/dashboard/reports/${examId}?subject=${encodeURIComponent(subjectName)}`);
  };

  const openShare = (examId: number, initialEmail?: string) => {
    const status = reportWorkflow[examId];
    if (status !== "locked" && status !== "sent") {
      toast.error("Finish and lock the report in the Report Builder before emailing it.");
      return;
    }
    setSelectedExamId(examId);
    setRecipientEmail(initialEmail || client?.email || "");
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
      const created = await createSecureShare(null, recipientEmail.trim(), selectedExamId, shareExpiryDays, protectionMode);
      if (created?.email_error) toast.warning("The link was created, but the email didn't go out. Copy the link from the list and send it yourself.", { duration: 10000 });
      else toast.success(`Encrypted report sent to ${recipientEmail.trim()}`);
      setReportWorkflow((prev) => ({ ...prev, [selectedExamId]: "sent" }));
      setSelectedExamId(null);
      void loadShares();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send the report");
    } finally {
      setSharing(false);
    }
  };

  const handleRegenerate = async () => {
    if (!regenerateId) return;
    setRegenerating(true);
    try {
      const updated = await regenerateSecureShare(regenerateId, regenerateExpiry, regenerateMode);
      if (updated.email_error) toast.warning("The link was created, but the email didn't go out. Copy the link from the list and send it yourself.", { duration: 10000 });
      else toast.success("New link created and emailed. The old link no longer works.");
      setShares((prev) => prev.map((s) => (s.id === regenerateId ? updated : s)));
      setRegenerateId(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create a new link");
    } finally {
      setRegenerating(false);
    }
  };

  const counts = React.useMemo(() => {
    const c = { none: 0, draft: 0, locked: 0, sent: 0 } as Record<ReportWorkflowStatus, number>;
    for (const a of documented) c[reportWorkflow[a.exam_id!] ?? "none"] += 1;
    return c;
  }, [documented, reportWorkflow]);

  // ---- Reports table: filter + search + paging ----
  const rq = reportQuery.trim().toLowerCase();
  const filteredReports = React.useMemo(
    () =>
      documented.filter((a) => {
        const status = reportWorkflow[a.exam_id!] ?? "none";
        if (reportFilter === "write" && status !== "none" && status !== "draft") return false;
        if (reportFilter === "ready" && status !== "locked") return false;
        if (reportFilter === "sent" && status !== "sent") return false;
        if (!rq) return true;
        const name = a.subject ? formatSubjectName(a.subject) : "";
        return [name, formatAppointmentCode(a.id), formatClinicDateLabel(a.scheduled_at)].some((v) => v.toLowerCase().includes(rq));
      }),
    [documented, reportWorkflow, reportFilter, rq],
  );
  const reportPager = usePager(filteredReports, [reportFilter, rq]);

  // ---- Sent links table ----
  const lq = linkQuery.trim().toLowerCase();
  const sortedShares = React.useMemo(() => [...shares].sort((a, b) => b.created_at.localeCompare(a.created_at)), [shares]);
  const linkCounts = React.useMemo(() => {
    const c = { all: shares.length, active: 0, opened: 0, inactive: 0 };
    for (const s of shares) {
      const st = shareState(s);
      if (st === "active") c.active++;
      else if (st === "opened") c.opened++;
      else c.inactive++;
    }
    return c;
  }, [shares]);
  const filteredShares = React.useMemo(
    () =>
      sortedShares.filter((s) => {
        const st = shareState(s);
        if (linkFilter === "active" && st !== "active") return false;
        if (linkFilter === "opened" && st !== "opened") return false;
        if (linkFilter === "inactive" && st !== "expired" && st !== "withdrawn") return false;
        if (!lq) return true;
        const name = s.subject ? `${s.subject.first_name} ${s.subject.last_name}` : "";
        return [s.recipient_email, name].some((v) => v.toLowerCase().includes(lq));
      }),
    [sortedShares, linkFilter, lq],
  );
  const linkPager = usePager(filteredShares, [linkFilter, lq]);

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading reports…
      </div>
    );
  }

  const notStarted = appointments.filter((a) => !a.exam_id && !["cancelled", "canceled"].includes(a.status.toLowerCase())).length;
  const activeLinks = shares.filter((s) => {
    const st = shareState(s);
    return st === "active" || st === "opened";
  }).length;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold tracking-[-0.02em]">Secure reports</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Write and lock each report in the Report Builder, then email it as an encrypted PDF. Every link you send is logged below.</p>
      </div>

      {/* Pipeline */}
      {documented.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            { label: "To write", value: counts.none + counts.draft, hint: counts.draft ? `${counts.draft} draft${counts.draft === 1 ? "" : "s"} in progress` : "No drafts", icon: PenLine, filter: "write" as const },
            { label: "Ready to send", value: counts.locked, hint: "Locked, not emailed yet", icon: Lock, filter: "ready" as const },
            { label: "Sent", value: counts.sent, hint: "Emailed to a recipient", icon: Mail, filter: "sent" as const },
            { label: "Links issued", value: shares.length, hint: `${activeLinks} still active`, icon: Link2, filter: null },
          ].map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => {
                if (s.filter) {
                  setTab("reports");
                  setReportFilter(s.filter);
                } else setTab("links");
              }}
              className={cn(CARD, "p-4 text-left transition-shadow hover:ring-border")}
            >
              <p className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <s.icon aria-hidden="true" className="size-3.5" />
                {s.label}
              </p>
              <p className="mt-1 text-2xl font-medium tracking-[-0.02em] tabular-nums">{workflowLoading && s.filter ? "—" : s.value}</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.hint}</p>
            </button>
          ))}
        </div>
      ) : null}

      <Segmented<"reports" | "links">
        label="Secure reports sections"
        value={tab}
        onChange={setTab}
        options={[
          { value: "reports", label: "Reports", count: documented.length },
          { value: "links", label: "Sent links", count: shares.length },
        ]}
        className="w-fit"
      />

      {/* Reports */}
      {tab === "reports" ? (
        <section ref={reportsRef} aria-labelledby="reports-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 id="reports-title" className="text-[15px] font-medium">
                Reports by session
              </h3>
              <p className="text-[13px] text-muted-foreground">Newest first. Sessions appear once their documentation has started.</p>
            </div>
            {documented.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Segmented<ReportFilter>
                  label="Filter reports"
                  value={reportFilter}
                  onChange={setReportFilter}
                  options={[
                    { value: "all", label: "All", count: documented.length },
                    { value: "write", label: "To write", count: counts.none + counts.draft },
                    { value: "ready", label: "Ready", count: counts.locked },
                    { value: "sent", label: "Sent", count: counts.sent },
                  ]}
                />
                <TableSearch value={reportQuery} onChange={setReportQuery} label="Search reports" placeholder="Examinee, APT code…" />
              </div>
            ) : null}
          </div>

          {documented.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                <FileSignature aria-hidden="true" className="size-5 text-muted-foreground" />
              </span>
              <div className="max-w-sm">
                <p className="font-medium">No reports yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {notStarted > 0
                    ? `${notStarted} session${notStarted === 1 ? " is" : "s are"} booked but documentation hasn't started. Start it from Exam history and the report can be written here.`
                    : "A report is written after a session takes place. This client has no sessions yet."}
                </p>
              </div>
              {notStarted > 0 ? (
                <Link href={`/dashboard/clients/${clientId}/exams` as Route} className="flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
                  Open exam history
                </Link>
              ) : can("appointment:create") ? (
                <Link href={`/dashboard/calendar/book?clientId=${clientId}` as Route} className="flex h-10 items-center gap-2 rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                  <CalendarPlus aria-hidden="true" className="size-4" /> Book exam
                </Link>
              ) : null}
            </div>
          ) : filteredReports.length === 0 ? (
            <p className="border-t border-border/50 px-6 py-12 text-center text-sm text-muted-foreground">{rq ? `No reports match “${reportQuery.trim()}”.` : "Nothing in this view."}</p>
          ) : (
            <div className="overflow-x-auto border-t border-border/50">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                  <tr>
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Examinee</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Session</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Report stage</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {reportPager.rows.map((a) => {
                    const examineeName = a.subject ? formatSubjectName(a.subject) : `Examinee #${a.subject_id}`;
                    const status: ReportWorkflowStatus = reportWorkflow[a.exam_id!] ?? "none";
                    const canSend = status === "locked" || status === "sent";
                    return (
                      <tr key={a.id} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30">
                        <td className="max-w-[280px] py-3 pr-3 pl-5">
                          <span className="block truncate font-medium">{examineeName}</span>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">
                          {formatClinicDateLabel(a.scheduled_at)} · <span className="font-mono">{formatAppointmentCode(a.id)}</span>
                        </td>
                        <td className="px-3 py-3">{workflowLoading ? <span className="text-xs text-muted-foreground">Checking…</span> : <StageTrack status={status} />}</td>
                        <td className="py-3 pr-5 pl-3">
                          <div className="flex justify-end gap-2">
                            {canSend ? (
                              <>
                                <button type="button" onClick={() => openEditor(a.exam_id!, examineeName)} className={PILL}>
                                  <Eye aria-hidden="true" className="size-3.5" /> View
                                </button>
                                <button type="button" onClick={() => openShare(a.exam_id!, a.subject?.email)} className={cn(DARK_PILL, "w-[124px] justify-center")}>
                                  <Mail aria-hidden="true" className="size-3.5" /> {status === "sent" ? "Send again" : "Email report"}
                                </button>
                              </>
                            ) : (
                              <button type="button" onClick={() => openEditor(a.exam_id!, examineeName)} className={cn(DARK_PILL, "w-[124px] justify-center")}>
                                <PenLine aria-hidden="true" className="size-3.5" /> {status === "draft" ? "Continue draft" : "Write report"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePager
            label="Reports"
            page={reportPager.page}
            perPage={reportPager.perPage}
            totalPages={reportPager.totalPages}
            total={reportPager.total}
            onPage={reportPager.setPage}
            onPerPage={reportPager.setPerPage}
            scrollTo={reportsRef}
          />
        </section>
      ) : null}

      {/* Sent links */}
      {tab === "links" ? (
        <section ref={linksRef} aria-labelledby="shares-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
          <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 id="shares-title" className="flex items-center gap-2 text-[15px] font-medium">
                <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" /> Sent links
              </h3>
              <p className="text-[13px] text-muted-foreground">Newest first. Make a new link if one has expired or went to the wrong person.</p>
            </div>
            {shares.length > 0 ? (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Segmented<LinkFilter>
                  label="Filter links"
                  value={linkFilter}
                  onChange={setLinkFilter}
                  options={[
                    { value: "all", label: "All", count: linkCounts.all },
                    { value: "active", label: "Not opened", count: linkCounts.active },
                    { value: "opened", label: "Opened", count: linkCounts.opened },
                    { value: "inactive", label: "Expired", count: linkCounts.inactive },
                  ]}
                />
                <TableSearch value={linkQuery} onChange={setLinkQuery} label="Search links" placeholder="Recipient or examinee…" />
              </div>
            ) : null}
          </div>
          {sharesLoading ? (
            <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : sortedShares.length === 0 ? (
            <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">No reports sent yet.</p>
          ) : filteredShares.length === 0 ? (
            <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">{lq ? `No links match “${linkQuery.trim()}”.` : "Nothing in this view."}</p>
          ) : (
            <div className="overflow-x-auto border-t border-border/50">
              <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                  <tr>
                    <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">Sent to</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Examinee</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Sent</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">PIN</th>
                    <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {linkPager.rows.map((share) => {
                    const st = shareState(share);
                    const dead = st === "expired" || st === "withdrawn";
                    const pin = share.protection_mode !== "secure_link";
                    const revealed = revealedPasswords[share.id];
                    return (
                      <tr key={share.id} className={cn("transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30", dead && "text-muted-foreground")}>
                        <td className="max-w-[240px] py-3 pr-3 pl-5">
                          <span className="block truncate font-medium">{share.recipient_email}</span>
                        </td>
                        <td className="max-w-[220px] px-3 py-3">
                          <span className="block truncate">{share.subject ? `${share.subject.first_name} ${share.subject.last_name}` : "—"}</span>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap text-muted-foreground">{formatClinicDateLabel(share.created_at)}</td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", SHARE_STATE[st].style)}>{SHARE_STATE[st].text}</span>
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {st === "withdrawn" ? "Link withdrawn" : `${dead ? "Expired" : "Expires"} ${relative(share.expires_at)}`}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {pin ? (
                            <span className="inline-flex h-8 items-center gap-0.5 rounded-full bg-[#F3F1EA] pr-1 pl-3 dark:bg-muted">
                              <span className="min-w-14 font-mono text-[13px] font-semibold tracking-wider">{revealed ? share.password || "—" : "••••••"}</span>
                              <button
                                type="button"
                                aria-label={revealed ? "Hide PIN" : "Show PIN"}
                                onClick={() => setRevealedPasswords((prev) => ({ ...prev, [share.id]: !prev[share.id] }))}
                                className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                              >
                                {revealed ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                              </button>
                              {share.password ? (
                                <button
                                  type="button"
                                  aria-label="Copy PIN"
                                  onClick={() => void copy(share.password!, "PIN copied")}
                                  className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                                >
                                  <Copy aria-hidden="true" className="size-3.5" />
                                </button>
                              ) : null}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Link only</span>
                          )}
                        </td>
                        <td className="py-3 pr-5 pl-3">
                          <div className="flex justify-end gap-2">
                            {!dead ? (
                              <button type="button" onClick={() => void copy(`${window.location.origin}/shared/report/${share.token}`, "Secure link copied")} className={PILL}>
                                <Copy aria-hidden="true" className="size-3.5" /> Copy link
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => {
                                setRegenerateId(share.id);
                                setRegenerateMode(share.protection_mode || "password");
                                setRegenerateExpiry(DEFAULT_REPORT_SHARE_EXPIRY_DAYS);
                              }}
                              className={PILL}
                            >
                              <RefreshCw aria-hidden="true" className="size-3.5" /> New link
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <TablePager
            label="Links"
            page={linkPager.page}
            perPage={linkPager.perPage}
            totalPages={linkPager.totalPages}
            total={linkPager.total}
            onPage={linkPager.setPage}
            onPerPage={linkPager.setPerPage}
            scrollTo={linksRef}
          />
        </section>
      ) : null}

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
