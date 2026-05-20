"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Eye, Globe, RefreshCcw, ShieldAlert } from "lucide-react";
import { fetchAuditLogById, fetchAuditLogs, type AuditLogRecord } from "@/lib/audit-logs";

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
    subjects: "subject",
    users: "user",
    appointments: "appointment",
    exams: "exam",
    "audit-logs": "audit log",
    roles: "role",
    permissions: "permission",
    documents: "document",
    clients: "client",
  };

  const label = resourceLabels[resource] ?? resource;
  const plural = `${label}s`;
  const specific = id ? `${label} #${id}` : null;

  if (m === "GET" && specific) return `Viewed ${specific}`;
  if (m === "GET") return `Viewed ${plural} list`;
  if (m === "POST") return `Created a new ${label}`;
  if (m === "PUT" && specific) return `Updated ${specific}`;
  if (m === "PUT") return `Updated a ${label}`;
  if (m === "PATCH" && specific) return `Updated ${specific}`;
  if (m === "PATCH") return `Updated a ${label}`;
  if (m === "DELETE" && specific) return `Deleted ${specific}`;
  if (m === "DELETE") return `Deleted a ${label}`;

  return `${m} ${cleanPath}`;
}

/** Returns a short resource label for the "Resource" column. */
function humanizeResource(path: string, method: string): string {
  if (method.toUpperCase() === "OPTIONS") return "-";
  const cleanPath = path.split("?")[0].replace(/\/$/, "");
  if (cleanPath.includes("/auth/")) return "Authentication";
  const parts = cleanPath.replace(/^\/api\//, "").split("/");
  const resource = parts[0] ?? "";
  const id = parts[1];
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

export default function AuditLogsPage() {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterState>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [logs, setLogs] = useState<AuditLogRecord[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [detailLog, setDetailLog] = useState<AuditLogRecord | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showTechnical, setShowTechnical] = useState(false);

  const loadLogs = async (refresh = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setLogsLoading(true);
    }
    setLogsError(null);
    try {
      const data = await fetchAuditLogs(200);
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

  const filteredLogs = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return logs.filter((log) => {
      const tone = statusTone(log.status);
      if (filter !== "all" && tone !== filter) return false;
      if (!normalized) return true;
      const user = renderUser(log).toLowerCase();
      const { method, path } = splitAction(log.action);
      const readable = humanizeAction(method, path).toLowerCase();
      return (
        user.includes(normalized) ||
        readable.includes(normalized) ||
        log.path.toLowerCase().includes(normalized) ||
        log.ip.toLowerCase().includes(normalized)
      );
    });
  }, [filter, logs, query]);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-3xl border border-border/60 bg-linear-to-br from-primary/10 via-background to-background p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h3 className="text-2xl font-semibold tracking-tight">Audit Logs</h3>
            <p className="text-sm text-muted-foreground">
              Track all critical actions performed within your organization.
            </p>
          </div>
          <Button
            variant="outline"
            className="w-fit gap-2"
            onClick={() => void loadLogs(true)}
            disabled={isRefreshing}
          >
            <RefreshCcw className={cn("h-4 w-4", isRefreshing ? "animate-spin" : "")} />
            Refresh
          </Button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Successful actions</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-500">{stats.success}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Access warnings</p>
              <p className="mt-2 text-2xl font-semibold text-amber-500">{stats.warning}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">System errors</p>
              <p className="mt-2 text-2xl font-semibold text-destructive">{stats.error}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Table card */}
      <Card>
        <CardHeader className="space-y-4">
          <div>
            <CardTitle>Activity History</CardTitle>
            <CardDescription>
              Every action taken in your organization - in plain English.
            </CardDescription>
          </div>
          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by user, action, or IP..."
              className="md:max-w-md"
            />
            <div className="flex items-center gap-2">
              {(["all", "success", "warning", "error"] as const).map((tone) => (
                <Button
                  key={tone}
                  variant={filter === tone ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(tone)}
                  className="capitalize"
                >
                  {tone}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              Loading activity...
            </div>
          ) : logsError ? (
            <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <ShieldAlert className="h-4 w-4" />
              {logsError}
            </div>
          ) : (
            <div className="relative w-full overflow-auto">
              <table className="w-full caption-bottom text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="h-11 px-2 font-medium text-muted-foreground">Who</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">What happened</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">Resource</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">IP address</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">When</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">Outcome</th>
                    <th className="h-11 px-2 font-medium text-muted-foreground">Details</th>
                  </tr>
                </thead>
                <tbody className="[&_tr:last-child]:border-0">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-sm text-muted-foreground">
                        No activity matched your filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => {
                      const { method, path } = splitAction(log.action);
                      const tone = statusTone(log.status);
                      const variant =
                        tone === "success" ? "success" : tone === "warning" ? "warning" : "destructive";
                      const isPreflight = method.toUpperCase() === "OPTIONS";

                      return (
                        <tr
                          key={log.id}
                          className={cn(
                            "border-b transition-colors hover:bg-muted/50",
                            isPreflight ? "opacity-50" : "",
                          )}
                        >
                          <td className="p-2 font-medium">
                            {isPreflight ? (
                              <span className="text-muted-foreground text-xs">System</span>
                            ) : (
                              renderUser(log)
                            )}
                          </td>
                          <td className="p-2">{humanizeAction(method, path)}</td>
                          <td className="p-2 text-muted-foreground">{humanizeResource(path, method)}</td>
                          <td className="p-2">
                            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              {formatIp(log.ip)}
                            </span>
                          </td>
                          <td className="p-2 text-xs text-muted-foreground">{formatRelativeTime(log.createdAt)}</td>
                          <td className="p-2">
                            <Badge variant={variant}>
                              {statusLabel(log.status)} | {log.status}
                            </Badge>
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="gap-1"
                              onClick={() => setSelectedId(log.id)}
                            >
                              <Eye className="h-4 w-4" />
                              View
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail modal */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              What happened, who did it, and when.
            </DialogDescription>
          </DialogHeader>

          {detailLoading ? (
            <p className="text-sm text-muted-foreground py-4">Loading...</p>
          ) : detailError || !detailLog ? (
            <p className="text-sm text-destructive">{detailError ?? "Unable to load event details."}</p>
          ) : (() => {
            const { method, path } = splitAction(detailLog.action);
            const tone = statusTone(detailLog.status);
            const outcomeColor =
              tone === "success"
                ? "text-emerald-600"
                : tone === "warning"
                  ? "text-amber-600"
                  : "text-destructive";

            return (
              <div className="space-y-5 text-sm">
                {/* Summary strip */}
                <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                  <SummaryRow label="What happened">
                    <span className="font-medium">{humanizeAction(method, path)}</span>
                  </SummaryRow>
                  <SummaryRow label="Who">
                    {renderUser(detailLog)}
                  </SummaryRow>
                  <SummaryRow label="When">
                    {new Date(detailLog.createdAt).toLocaleString(undefined, {
                      dateStyle: "long",
                      timeStyle: "medium",
                    })}
                  </SummaryRow>
                  <SummaryRow label="From IP">
                    {formatIp(detailLog.ip)}
                  </SummaryRow>
                  <SummaryRow label="Resource">
                    {humanizeResource(path, method)}
                  </SummaryRow>
                  <SummaryRow label="Outcome">
                    <span className={outcomeColor}>
                      {humanizeStatus(detailLog.status)}
                    </span>
                  </SummaryRow>
                </div>

                {/* Technical details toggle */}
                <button
                  type="button"
                  onClick={() => setShowTechnical((v) => !v)}
                  className="flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs text-muted-foreground hover:bg-muted/40 transition-colors"
                >
                  <span className="font-medium uppercase tracking-wide">Technical details</span>
                  {showTechnical ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                </button>

                {showTechnical && (
                  <div className="space-y-3 text-xs">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Detail label="HTTP Method" value={detailLog.method} />
                      <Detail label="HTTP Status" value={String(detailLog.status)} />
                      <Detail label="Endpoint path" value={detailLog.path} />
                      <Detail label="Event ID" value={String(detailLog.id)} />
                    </div>
                    <Detail label="Browser / client" value={detailLog.userAgent || "-"} />
                    {detailLog.payload && detailLog.payload !== "{}" && (
                      <div>
                        <p className="mb-1 font-semibold uppercase tracking-wide text-muted-foreground">
                          Request data
                        </p>
                        <pre className="max-h-40 overflow-auto rounded-lg border bg-muted/40 p-3 font-mono whitespace-pre-wrap break-all">
                          {detailLog.payload}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 break-words">{children}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-all font-mono">{value}</p>
    </div>
  );
}

function cn(...classes: string[]) {
  return classes.filter(Boolean).join(" ");
}

