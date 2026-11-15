"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Globe, RefreshCw, ScrollText, Search, ShieldAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { HeroAction, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { describeActivity } from "@/lib/activity-describe";
import { fetchAuditLogById, fetchAuditLogs, type AuditLogRecord } from "@/lib/audit-logs";
import { cn } from "@/lib/utils";

type FilterState = "all" | "success" | "warning" | "error";

// ---------------------------------------------------------------------------
// Human-readable helpers
// ---------------------------------------------------------------------------

/** Maps HTTP method + API path pattern to plain English sentence. */
function humanizeAction(method: string, path: string): string {
  const m = method.toUpperCase();
  // Strip query string
  const cleanPath = path.split("?")[0].replace(/\/$/, "");

  // Preflight / browser security check
  if (m === "OPTIONS") return "Browser security check";

  // Auth
  if (cleanPath.includes("/auth/sign-in")) return "Signed in";
  if (cleanPath.includes("/auth/sign-out")) return "Signed out";
  if (cleanPath.includes("/auth/")) return "Authentication request";

  // Extract resource + optional ID: /api/leads/123 -> ["leads", "123"]
  const parts = cleanPath.replace(/^\/api\//, "").split("/");
  const resource = parts[0] ?? "";
  const id = parts[1];

  const resourceLabels: Record<string, string> = {
    leads: "lead",
    subjects: "examinee",
    users: "user",
    appointments: "appointment",
    exams: "exam",
    "audit-logs": "audit log",
    roles: "role",
    permissions: "permission",
    documents: "document",
    clients: "client",
    quotations: "invoice",
    "intake-requests": "roster request",
    availability: "availability block",
    settings: "setting",
  };

  const label = resourceLabels[resource] ?? resource;
  const plural = `${label}s`;
  const specific = id ? `${label} #${id}` : null;
  const last = parts[parts.length - 1];

  // Semantic actions — so meaningful operations read clearly instead of being
  // mislabeled as a generic "Updated/Created #X".

  // Email / outbound
  if (cleanPath.endsWith("/send-payment-reminder"))
    return `Sent payment reminder${id ? ` for appointment #${id}` : ""}`;
  if (resource === "intake-requests" && last === "resend") return "Resent examinee roster request";
  if (resource === "intake-requests" && last === "submission") return "Viewed submitted roster";
  if (resource === "intake-requests" && m === "POST" && parts.length === 1)
    return "Sent examinee roster request";
  if (last === "form-requests" && m === "POST") return `Sent a form to ${label} #${id}`;
  if (resource === "forms" && parts[1] === "requests" && last === "resend")
    return "Resent a form reminder";
  if (resource === "cron" && last === "run-reminders") return "Ran scheduled session reminders";

  // Users & access
  if (resource === "users" && last === "status") return `Changed account status for user #${id}`;
  if (resource === "users" && last === "role") return `Changed role for user #${id}`;
  if (resource === "users" && last === "permissions") return `Updated permissions for user #${id}`;
  if (resource === "users" && last === "require-password-reset")
    return `Required a password reset for user #${id}`;
  if (resource === "users" && m === "POST" && parts.length === 1) return "Created a user account";
  if (resource === "me" && m === "PATCH") return "Updated their own profile";
  if (resource === "me" && m === "DELETE") return "Deleted their own account";

  // Roles
  if (resource === "rbac" && parts[1] === "roles" && m === "POST") return "Created a role";
  if (resource === "rbac" && parts[1] === "roles" && parts[2]) return `Updated role #${parts[2]}`;

  // Appointments & billing
  if (resource === "appointments" && last === "bulk-schedule") return "Batch-scheduled appointments";
  if (resource === "appointments" && last === "status") return `Changed status of appointment #${id}`;
  if (resource === "appointments" && last === "payment") return `Updated payment for appointment #${id}`;
  if (resource === "appointments" && last === "collect-payment")
    return `Collected payment for appointment #${id}`;
  if (resource === "appointments" && m === "POST" && parts.length === 1) return "Booked an appointment";
  if (resource === "appointments" && m === "DELETE" && id) return `Cancelled appointment #${id}`;

  // Invoices / quotations
  if (resource === "quotations" && last === "send-email") return `Emailed invoice #${id}`;
  if (resource === "quotations" && last === "collect-payment") return `Collected payment on invoice #${id}`;
  if (resource === "quotations" && last === "convert") return `Converted quotation #${id} to a booking`;
  if (resource === "quotations" && m === "POST" && parts.length === 1) return "Created an invoice";
  if (resource === "quotations" && m === "DELETE" && id) return `Deleted invoice #${id}`;

  // Clients & examinees
  if (resource === "clients" && last === "examinees") return `Added examinees to client #${id}`;
  if (resource === "clients" && (last === "documents" || last === "form"))
    return `Uploaded a document for client #${id}`;
  if (resource === "subjects" && last === "documents") return `Uploaded a document for examinee #${id}`;
  if (resource === "subjects" && m === "POST" && parts.length === 1) return "Added an examinee";

  // Exams
  if (resource === "exams" && last === "start") return "Started exam documentation";
  if (resource === "exams" && parts[1] === "types" && m === "POST") return "Created an exam type";
  if (resource === "exams" && parts[1] === "types" && parts[2])
    return m === "DELETE" ? `Deleted exam type #${parts[2]}` : `Updated exam type #${parts[2]}`;
  if (resource === "exams" && last === "referral") return "Created a case referral";
  if (resource === "exams" && last === "assessment") return "Recorded a clinical assessment";
  if (resource === "exams" && last === "phase") return "Added an exam phase";
  if (resource === "exams" && last === "report") return "Created an exam report";
  if (resource === "exams" && m === "POST" && parts.length === 1) return "Created an exam";

  // Availability
  if (resource === "availability" && parts[1] === "blocks" && m === "POST") return "Blocked off availability";
  if (resource === "availability" && parts[1] === "blocks" && parts[2])
    return m === "DELETE" ? "Removed an availability block" : "Updated an availability block";

  // Organization settings
  if (resource === "settings" && m === "PATCH") return "Updated organization settings";
  if (resource === "settings" && m === "DELETE") return "Reset organization settings";

  // Everything else: the shared wording helper (also used on the user and roles pages).
  return describeActivity({ method: m, path: cleanPath, action: "" }).title;
}

/** Returns a short resource label for the "Resource" column. */
function humanizeResource(path: string, method: string): string {
  if (method.toUpperCase() === "OPTIONS") return "-";
  const cleanPath = path.split("?")[0].replace(/\/$/, "");
  if (cleanPath.includes("/auth/")) return "Authentication";
  const parts = cleanPath.replace(/^\/api\//, "").split("/");
  const resource = parts[0] ?? "";
  const id = /^\d+$/.test(parts[1] ?? "") ? parts[1] : undefined;
  const labels: Record<string, string> = {
    leads: "Leads",
    subjects: "Subjects",
    users: "Users",
    appointments: "Appointments",
    exams: "Exams",
    "audit-logs": "Audit Logs",
    roles: "Roles",
    documents: "Documents",
    clients: "Clients",
  };
  const base = labels[resource] ?? (resource ? resource.charAt(0).toUpperCase() + resource.slice(1) : "-");
  return id ? `${base.replace(/s$/, "")} #${id}` : base;
}

/** Maps an HTTP status code to a plain-English outcome description. */
function humanizeStatus(status: number): string {
  const map: Record<number, string> = {
    200: "Completed successfully",
    201: "Created successfully",
    204: "Completed (no content)",
    400: "Invalid request",
    401: "Not logged in",
    403: "Access denied",
    404: "Not found",
    409: "Conflict - already exists",
    422: "Validation failed",
    429: "Too many requests",
    500: "Server error",
    502: "Gateway error",
    503: "Service unavailable",
  };
  return map[status] ?? (status >= 500 ? "Server error" : status >= 400 ? "Client error" : `HTTP ${status}`);
}

function statusTone(status: number): FilterState {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  return "success";
}

function statusLabel(status: number): string {
  if (status >= 500) return "error";
  if (status >= 400) return "warning";
  return "success";
}

function formatRelativeTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diff = date.getTime() - Date.now();
  const sec = Math.round(diff / 1000);
  const min = Math.round(sec / 60);
  const hr = Math.round(min / 60);
  const day = Math.round(hr / 24);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(sec) < 60) return rtf.format(sec, "second");
  if (Math.abs(min) < 60) return rtf.format(min, "minute");
  if (Math.abs(hr) < 24) return rtf.format(hr, "hour");
  return rtf.format(day, "day");
}

function renderUser(log: AuditLogRecord): string {
  if (log.userEmail) return log.userEmail;
  if (log.userId) return `User #${log.userId}`;
  return "System";
}

/** Normalise raw action string to { method, path } */
function splitAction(action: string): { method: string; path: string } {
  const parts = action.trim().split(" ");
  return { method: parts[0] ?? "GET", path: parts.slice(1).join(" ") || action };
}

function formatIp(ip: string | null | undefined): string {
  if (!ip) return "Unknown";
  if (ip === "::1" || ip === "127.0.0.1") return "Local machine";
  if (ip.startsWith("::ffff:127.")) return "Local machine";
  return ip;
}

const PAGE_STEP = 25;

type ViewState = "changes" | "all";

function dayLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function formatClock(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

const TONE_DOT: Record<FilterState, string> = {
  all: "bg-[#C9C5B8]",
  success: "bg-[#3F7A37] dark:bg-emerald-400",
  warning: "bg-[#C98A1F] dark:bg-amber-400",
  error: "bg-[#B94A3E] dark:bg-red-400",
};

const TONE_PILL: Record<FilterState, string> = {
  all: "",
  success: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  warning: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-300",
  error: "bg-[#F8E4E0] text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200",
};

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

function isNoise(log: AuditLogRecord): boolean {
  const { method, path } = splitAction(log.action);
  if (method.toUpperCase() === "OPTIONS") return true;
  return describeActivity({ method: log.method || method, path: log.path || path, action: "" }).kind === "background";
}

function isChange(log: AuditLogRecord): boolean {
  const { method, path } = splitAction(log.action);
  return describeActivity({ method: log.method || method, path: log.path || path, action: "" }).kind === "change";
}

export default function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [view, setView] = useState<ViewState | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLogRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);
  const [shown, setShown] = useState(PAGE_STEP);

  const loadLogs = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setLogsLoading(true);
    }
    setLogsError(null);
    try {
      const data = await fetchAuditLogs(500);
      setLogs(data);
    } catch {
      setLogsError("Failed to load audit logs. Please refresh.");
    } finally {
      setLogsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLogs(false);
  }, []);

  // Start from the top whenever the filters change.
  useEffect(() => {
    setShown(PAGE_STEP);
  }, [query, filter, view, dateFrom, dateTo]);

  useEffect(() => {
    if (selectedId === null) {
      setDetailLog(null);
      setDetailError(null);
      setDetailLoading(false);
      setShowTechnical(false);
      return;
    }
    setDetailLoading(true);
    setDetailError(null);
    void fetchAuditLogById(selectedId)
      .then((data) => setDetailLog(data))
      .catch(() => setDetailError("Unable to load event details."))
      .finally(() => setDetailLoading(false));
  }, [selectedId]);

  const stats = useMemo(() => {
    const success = logs.filter((log) => statusTone(log.status) === "success").length;
    const warning = logs.filter((log) => statusTone(log.status) === "warning").length;
    const error = logs.filter((log) => statusTone(log.status) === "error").length;
    return { success, warning, error };
  }, [logs]);

  const changeCount = useMemo(() => logs.filter(isChange).length, [logs]);
  const activeView: ViewState = view ?? (changeCount > 0 ? "changes" : "all");

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;
    return logs.filter((log) => {
      // Failures always matter, so they stay visible even if they were just page loads.
      const failed = log.status >= 400;
      if (!failed) {
        if (activeView === "changes" ? !isChange(log) : isNoise(log)) return false;
      } else if (isNoise(log)) {
        return false;
      }

      const tone = statusTone(log.status);
      if (filter !== "all" && tone !== filter) return false;

      if (fromTime !== null || toTime !== null) {
        const logTime = new Date(log.createdAt).getTime();
        if (Number.isNaN(logTime)) return false;
        if (fromTime !== null && logTime < fromTime) return false;
        if (toTime !== null && logTime > toTime) return false;
      }

      if (!normalized) return true;
      const user = renderUser(log).toLowerCase();
      const { method, path } = splitAction(log.action);
      const readable = humanizeAction(method, path).toLowerCase();
      return user.includes(normalized) || readable.includes(normalized) || log.path.toLowerCase().includes(normalized) || log.ip.toLowerCase().includes(normalized);
    });
  }, [filter, logs, query, dateFrom, dateTo, activeView]);

  const visible = filteredLogs.slice(0, shown);
  const groups = useMemo(() => {
    const out: { label: string; items: AuditLogRecord[] }[] = [];
    for (const log of visible) {
      const label = dayLabel(log.createdAt);
      const last = out[out.length - 1];
      if (last && last.label === label) last.items.push(log);
      else out.push({ label, items: [log] });
    }
    return out;
  }, [visible]);

  const hasFilters = query.trim() !== "" || filter !== "all" || dateFrom !== "" || dateTo !== "";

  return (
    <div className="space-y-5 pb-10">
      <PageHero
        tone="ink"
        icon={ScrollText}
        eyebrow="People & access"
        title={<>Audit <strong className="font-semibold">log</strong></>}
        description="Track all critical actions performed within your organization, in plain English."
        actions={
          <HeroAction icon={RefreshCw} onClick={() => void loadLogs(true)} disabled={isRefreshing}>
            {isRefreshing ? "Refreshing…" : "Refresh"}
          </HeroAction>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <OutcomeTile label="Successful actions" value={stats.success} tone="success" active={filter === "success"} onClick={() => setFilter(filter === "success" ? "all" : "success")} />
          <OutcomeTile label="Access warnings" value={stats.warning} tone="warning" active={filter === "warning"} onClick={() => setFilter(filter === "warning" ? "all" : "warning")} />
          <OutcomeTile label="System errors" value={stats.error} tone="error" active={filter === "error"} onClick={() => setFilter(filter === "error" ? "all" : "error")} />
        </div>
      </PageHero>

      {/* Toolbar */}
      <div className={cn(CARD, "flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-center")}>
        <div className="relative min-w-0 flex-1 lg:min-w-64">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input aria-label="Search the audit log" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by person, action or IP…" className={cn(FIELD, "pl-10")} />
        </div>
        <Segmented<ViewState>
          label="What to show"
          value={activeView}
          onChange={setView}
          options={[
            { value: "changes", label: "Changes", count: changeCount },
            { value: "all", label: "All activity" },
          ]}
        />
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} max={dateTo || undefined} onChange={(e) => setDateFrom(e.target.value)} className={cn(FIELD, "w-auto")} aria-label="From date" />
          <span className="text-sm text-muted-foreground">to</span>
          <Input type="date" value={dateTo} min={dateFrom || undefined} onChange={(e) => setDateTo(e.target.value)} className={cn(FIELD, "w-auto")} aria-label="To date" />
        </div>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFilter("all");
              setDateFrom("");
              setDateTo("");
            }}
            className="flex h-11 items-center gap-1.5 self-start rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground lg:self-auto dark:hover:bg-muted"
          >
            <X aria-hidden="true" className="size-4" />
            Clear
          </button>
        ) : null}
      </div>

      {/* Log */}
      {logsLoading ? (
        <div aria-hidden="true" className={cn(CARD, "divide-y divide-border/50")}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <div className="size-2 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-64 max-w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-40 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : logsError ? (
        <div role="alert" className="flex items-center gap-3 rounded-[26px] bg-[#F8E4E0] p-5 text-sm text-[#7A2A1E] dark:bg-red-950/60 dark:text-red-200">
          <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
          <span className="flex-1">{logsError}</span>
          <button type="button" onClick={() => void loadLogs(false)} className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-current/30 transition-colors hover:bg-white/50">
            Try again
          </button>
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className={cn(CARD, "px-6 py-14 text-center")}>
          <p className="font-medium">{hasFilters ? "No activity matches your filters" : activeView === "changes" ? "No changes recorded yet" : "No activity recorded yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters ? "Try a different search or clear the filters." : activeView === "changes" && logs.length > 0 ? "Switch to All activity to see pages people opened." : "Actions will appear here as they happen."}
          </p>
          {!hasFilters && activeView === "changes" && logs.length > 0 ? (
            <button type="button" onClick={() => setView("all")} className="mt-4 inline-flex h-10 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
              Show all activity
            </button>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="space-y-2">
              <h2 className="px-1 text-[13px] font-medium text-muted-foreground">{group.label}</h2>
              <ul className={cn(CARD, "divide-y divide-border/50 overflow-hidden")}>
                {group.items.map((log) => {
                  const { method, path } = splitAction(log.action);
                  const tone = statusTone(log.status);
                  return (
                    <li key={log.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(log.id)}
                        className="group flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F7F6F1] focus-visible:bg-[#F7F6F1] focus-visible:outline-none dark:hover:bg-muted/40"
                      >
                        <span aria-hidden="true" className={cn("size-2 shrink-0 rounded-full", TONE_DOT[tone])} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{humanizeAction(method, path)}</span>
                          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="truncate">{renderUser(log)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <Globe aria-hidden="true" className="size-3" />
                              {formatIp(log.ip)}
                            </span>
                          </span>
                        </span>
                        {tone !== "success" ? (
                          <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-xs font-medium", TONE_PILL[tone])}>{humanizeStatus(log.status)}</span>
                        ) : null}
                        <time className="w-16 shrink-0 text-right text-xs text-muted-foreground tabular-nums" dateTime={log.createdAt} title={formatRelativeTime(log.createdAt)}>
                          {formatClock(log.createdAt)}
                        </time>
                        <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-muted-foreground">
              Showing {visible.length} of {filteredLogs.length}
            </p>
            {filteredLogs.length > visible.length ? (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_STEP)}
                className="flex h-10 items-center rounded-full px-5 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                Show {Math.min(PAGE_STEP, filteredLogs.length - visible.length)} more
              </button>
            ) : null}
          </div>
        </div>
      )}

      {/* Detail modal */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-[26px] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Event details</DialogTitle>
            <DialogDescription>What happened, who did it, and when.</DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <div aria-hidden="true" className="space-y-3 py-2">
              <div className="h-24 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
              <div className="h-9 animate-pulse rounded-full bg-[#F3F1EA] dark:bg-muted" />
            </div>
          ) : detailError || !detailLog ? (
            <p role="alert" className="text-sm text-destructive">{detailError ?? "Unable to load event details."}</p>
          ) : (
            (() => {
              const { method, path } = splitAction(detailLog.action);
              const tone = statusTone(detailLog.status);
              return (
                <div className="space-y-4 text-sm">
                  <div className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                    <p className="text-base font-medium">{humanizeAction(method, path)}</p>
                    <span className={cn("mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium", TONE_PILL[tone])}>
                      <span aria-hidden="true" className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
                      {humanizeStatus(detailLog.status)}
                    </span>
                  </div>

                  <dl className="divide-y divide-border/50">
                    <SummaryRow label="Who">{renderUser(detailLog)}</SummaryRow>
                    <SummaryRow label="When">
                      {new Date(detailLog.createdAt).toLocaleString(undefined, { dateStyle: "long", timeStyle: "medium" })}
                    </SummaryRow>
                    <SummaryRow label="From">{formatIp(detailLog.ip)}</SummaryRow>
                    <SummaryRow label="Resource">{humanizeResource(path, method)}</SummaryRow>
                  </dl>

                  <button
                    type="button"
                    onClick={() => setShowTechnical((v) => !v)}
                    aria-expanded={showTechnical}
                    className="flex h-10 w-full items-center justify-between rounded-full px-4 text-[13px] font-medium text-muted-foreground ring-1 ring-border transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                  >
                    Technical details
                    <ChevronDown aria-hidden="true" className={cn("size-4 transition-transform", showTechnical && "rotate-180")} />
                  </button>

                  {showTechnical && (
                    <div className="space-y-3 text-xs">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Detail label="HTTP method" value={detailLog.method} />
                        <Detail label="HTTP status" value={String(detailLog.status)} />
                        <Detail label="Endpoint path" value={detailLog.path} />
                        <Detail label="Event ID" value={String(detailLog.id)} />
                      </div>
                      <Detail label="Browser / client" value={detailLog.userAgent || "-"} />
                      {detailLog.payload && detailLog.payload !== "{}" && (
                        <div>
                          <p className="mb-1.5 px-1 text-[11px] font-medium text-muted-foreground">Request data</p>
                          <pre className="max-h-40 overflow-auto rounded-2xl bg-[#F7F6F1] p-3 font-mono break-all whitespace-pre-wrap dark:bg-muted/40">{detailLog.payload}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OutcomeTile({ label, value, tone, active, onClick }: { label: string; value: number; tone: FilterState; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-[22px] bg-white/[0.05] p-4 text-left ring-1 transition-colors focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none sm:p-5",
        active ? "bg-white/[0.1] ring-white/50" : "ring-white/10 hover:bg-white/[0.08]",
      )}
    >
      <span className="flex items-center gap-2 text-[13px] text-[#C9C6BC]">
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", tone === "success" ? "bg-[#7FBF8A]" : tone === "warning" ? "bg-[#E2B35A]" : "bg-[#E58A7E]")} />
        {label}
      </span>
      <span className="text-3xl font-medium tracking-[-0.02em] tabular-nums sm:text-[32px]">{value.toLocaleString()}</span>
    </button>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-[13px] text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F7F6F1] p-3 dark:bg-muted/40">
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono break-all">{value}</p>
    </div>
  );
}
