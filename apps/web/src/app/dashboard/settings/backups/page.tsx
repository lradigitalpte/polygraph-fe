"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarClock, CheckCircle2, DatabaseBackup, Download, HardDrive, Loader2, Lock, LockOpen, RefreshCw, ShieldCheck } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GlassStat, HeroAction, PageHero, Segmented } from "@/components/dashboard/ui-kit";
import { TablePager, usePager } from "@/components/dashboard/table-pager";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { downloadBackup, fetchBackups, formatBytes, startBackup, type BackupConfig, type BackupRecord } from "@/lib/backups";
import { formatClinicDateLabel, formatClinicDateTime, formatClinicClock } from "@/lib/clinic-time";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const OUTLINE = "flex h-10 items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";
const DARK = "flex h-10 items-center justify-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] disabled:opacity-50 dark:bg-foreground dark:text-background";

type View = "all" | "scheduled" | "manual" | "problems";

const STATUS: Record<BackupRecord["status"], { label: string; chip: string }> = {
  running: { label: "Running", chip: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200" },
  completed: { label: "Ready", chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" },
  failed: { label: "Failed", chip: "bg-destructive/10 text-destructive" },
  expired: { label: "Removed (old)", chip: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground" },
};

function duration(b: BackupRecord) {
  if (!b.finished_at) return null;
  const s = Math.max(0, Math.round((new Date(b.finished_at).getTime() - new Date(b.started_at).getTime()) / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function ago(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function BackupsPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();
  const allowed = can("backup:manage");

  const [rows, setRows] = React.useState<BackupRecord[]>([]);
  const [config, setConfig] = React.useState<BackupConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [starting, setStarting] = React.useState(false);
  const [downloading, setDownloading] = React.useState<number | null>(null);
  const [confirmDownload, setConfirmDownload] = React.useState<BackupRecord | null>(null);
  const [view, setView] = React.useState<View>("all");
  const tableRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    if (!userLoading && !allowed) {
      toast.error("Only administrators can manage backups.");
      router.replace("/dashboard/settings");
    }
  }, [userLoading, allowed, router]);

  const load = React.useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await fetchBackups();
      setRows(data.backups);
      setConfig(data.config);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load backups");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (allowed) void load();
  }, [allowed, load]);

  const running = rows.find((r) => r.status === "running");

  // Follow a running backup until it finishes.
  const prevRunning = React.useRef<number | null>(null);
  React.useEffect(() => {
    if (!running) {
      if (prevRunning.current) {
        const finished = rows.find((r) => r.id === prevRunning.current);
        if (finished?.status === "completed") toast.success("Backup finished and saved to S3");
        else if (finished?.status === "failed") toast.error("The backup failed — see the reason in the list");
        prevRunning.current = null;
      }
      return;
    }
    prevRunning.current = running.id;
    const t = setInterval(() => void load(true), 3000);
    return () => clearInterval(t);
  }, [running, rows, load]);

  const handleStart = async () => {
    setStarting(true);
    try {
      await startBackup();
      setConfirmOpen(false);
      toast.success("Backup started — you can keep working while it runs");
      await load(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't start the backup");
    } finally {
      setStarting(false);
    }
  };

  const handleDownload = async (b: BackupRecord) => {
    setDownloading(b.id);
    try {
      await downloadBackup(b.id);
      setConfirmDownload(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloading(null);
    }
  };

  const lastGood = rows.find((r) => r.status === "completed");
  const lastScheduled = rows.find((r) => r.kind === "scheduled" && r.status !== "failed");
  const available = rows.filter((r) => r.status === "completed");
  const storedBytes = available.reduce((sum, r) => sum + r.size_bytes, 0);
  const recentFailures = rows.slice(0, 5).filter((r) => r.status === "failed").length;
  const stale = !lastGood || Date.now() - new Date(lastGood.started_at).getTime() > 8 * 86_400_000;

  const counts = {
    all: rows.length,
    scheduled: rows.filter((r) => r.kind === "scheduled").length,
    manual: rows.filter((r) => r.kind === "manual").length,
    problems: rows.filter((r) => r.status === "failed").length,
  };
  const filtered = rows.filter((r) => (view === "all" ? true : view === "problems" ? r.status === "failed" : r.kind === view));
  const pager = usePager(filtered, view);

  if (userLoading || !allowed) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      </div>
    );
  }

  const setupIssues: { text: string; tone: "red" | "amber" }[] = [];
  if (config && !config.pg_dump_found) setupIssues.push({ tone: "red", text: "The server can't export the database yet (pg_dump isn't installed). Deploy the updated backend image." });
  if (config && !config.storage_s3) setupIssues.push({ tone: "amber", text: "Files are stored on the server's own disk, not S3 — fine for testing, but production backups should go to S3." });
  if (config && !config.encrypted) setupIssues.push({ tone: "amber", text: "Backups are not encrypted. Set BACKUP_ENCRYPTION_KEY on the server (a long random value) and keep a copy of it somewhere safe." });
  if (config && !config.cron_configured) setupIssues.push({ tone: "amber", text: "The weekly schedule isn't set up (CRON_SECRET is missing), so only manual backups will run." });

  return (
    <div className="space-y-5">
      <PageHero
        tone={stale || recentFailures ? "amber" : "sage"}
        icon={DatabaseBackup}
        eyebrow="Settings · Backups"
        title={
          <>
            Keep a <strong className="font-semibold">restorable copy</strong> of everything
          </>
        }
        description="Each backup holds the full database and a list of every stored file, plus a step-by-step restore guide. A backup runs automatically once a week; you can run one any time."
        actions={
          <>
            <HeroAction icon={RefreshCw} onClick={() => void load()} disabled={loading}>
              Refresh
            </HeroAction>
            <HeroAction variant="primary" icon={DatabaseBackup} onClick={() => setConfirmOpen(true)} disabled={Boolean(running) || starting || (config ? !config.pg_dump_found : false)}>
              {running ? "Backup running…" : "Back up now"}
            </HeroAction>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat
            label="Last good backup"
            value={lastGood ? ago(lastGood.started_at) : "Never"}
            hint={lastGood ? formatClinicDateTime(lastGood.started_at) : "Run the first one now"}
            icon={CheckCircle2}
            accent={stale ? "amber" : "sage"}
            loading={loading}
          />
          <GlassStat
            label="Weekly schedule"
            value={config?.cron_configured ? "On" : "Off"}
            hint={lastScheduled ? `Last ran ${formatClinicDateLabel(lastScheduled.started_at)}` : config?.cron_configured ? "Waiting for the first run" : "Needs CRON_SECRET"}
            icon={CalendarClock}
            accent="lavender"
            loading={loading}
          />
          <GlassStat label="Kept in S3" value={available.length} hint={`${formatBytes(storedBytes)} · last ${config?.keep_scheduled ?? 12} weekly + ${config?.keep_manual ?? 10} manual`} icon={HardDrive} loading={loading} />
          <GlassStat
            label="Encryption"
            value={config?.encrypted ? "On" : "Off"}
            hint={config?.encrypted ? "AES-256, key held on the server" : "Set BACKUP_ENCRYPTION_KEY"}
            icon={config?.encrypted ? Lock : LockOpen}
            accent={config?.encrypted ? "sage" : "amber"}
            loading={loading}
          />
        </div>
      </PageHero>

      {setupIssues.length > 0 ? (
        <div className="space-y-2">
          {setupIssues.map((issue) => (
            <div
              key={issue.text}
              className={cn(
                "flex items-start gap-2.5 rounded-2xl px-4 py-3 text-[13px]",
                issue.tone === "red" ? "bg-destructive/5 text-destructive" : "bg-[#F8EEDB] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100",
              )}
            >
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{issue.text}</span>
            </div>
          ))}
        </div>
      ) : null}

      {running ? (
        <div className="flex items-center gap-3 rounded-[22px] bg-[#2B2A27] px-5 py-4 text-[#FAF9F5] dark:bg-[#1B1B19]">
          <Loader2 aria-hidden="true" className="size-5 shrink-0 animate-spin text-[#C9C6BC]" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{running.stage || "Working…"}</p>
            <p className="text-xs text-[#C9C6BC]">
              Started {formatClinicClock(running.started_at)} by {running.triggered_by}. You can leave this page — it keeps running on the server.
            </p>
          </div>
        </div>
      ) : null}

      <section ref={tableRef} aria-labelledby="history-title" className={cn(CARD, "scroll-mt-4 overflow-hidden")}>
        <div className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 id="history-title" className="text-[15px] font-medium">
              Backup history
            </h3>
            <p className="text-[13px] text-muted-foreground">Every run is recorded. Old archives are removed from S3 automatically; their records stay.</p>
          </div>
          {rows.length > 0 ? (
            <Segmented<View>
              label="Show"
              value={view}
              onChange={setView}
              options={[
                { value: "all", label: "All", count: counts.all },
                { value: "scheduled", label: "Weekly", count: counts.scheduled },
                { value: "manual", label: "Manual", count: counts.manual },
                { value: "problems", label: "Failed", count: counts.problems },
              ]}
            />
          ) : null}
        </div>

        {loading ? (
          <div className="space-y-2 border-t border-border/50 p-5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <button type="button" onClick={() => void load()} className={OUTLINE}>
              Try again
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
              <ShieldCheck aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <p className="max-w-sm text-sm text-muted-foreground">No backups yet. Run the first one now — after that, one runs every week.</p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="border-t border-border/50 px-6 py-10 text-center text-sm text-muted-foreground">Nothing in this view.</p>
        ) : (
          <div className="overflow-x-auto border-t border-border/50">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-[#F7F6F1] text-left text-xs text-muted-foreground dark:bg-muted/40">
                <tr>
                  <th scope="col" className="py-2.5 pr-3 pl-5 font-medium">
                    Started
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Type
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Status
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Size
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-medium">
                    Contents
                  </th>
                  <th scope="col" className="py-2.5 pr-5 pl-3 text-right font-medium">
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50">
                {pager.rows.map((b) => {
                  const st = STATUS[b.status];
                  const took = duration(b);
                  return (
                    <tr key={b.id} className="align-middle transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30">
                      <td className="py-3 pr-3 pl-5 whitespace-nowrap tabular-nums">
                        <span className="block font-medium">{formatClinicDateLabel(b.started_at)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatClinicClock(b.started_at)}
                          {took ? ` · took ${took}` : ""}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="block">{b.kind === "scheduled" ? "Weekly" : "Manual"}</span>
                        <span className="block max-w-[200px] truncate text-xs text-muted-foreground" title={b.triggered_by}>
                          {b.triggered_by}
                        </span>
                      </td>
                      <td className="max-w-[280px] px-3 py-3">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", st.chip)}>
                          {b.status === "running" ? <Loader2 aria-hidden="true" className="size-3 animate-spin" /> : null}
                          {st.label}
                        </span>
                        {b.status === "completed" && b.encrypted ? (
                          <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Lock aria-hidden="true" className="size-3" /> Encrypted
                          </span>
                        ) : null}
                        {b.status === "failed" && b.error ? (
                          <span className="mt-1 block text-xs break-words text-destructive" title={b.error}>
                            {b.error.length > 140 ? `${b.error.slice(0, 140)}…` : b.error}
                          </span>
                        ) : null}
                        {b.status === "running" && b.stage ? <span className="mt-1 block text-xs text-muted-foreground">{b.stage}</span> : null}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">{b.status === "completed" || b.status === "expired" ? formatBytes(b.size_bytes) : "—"}</td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {b.status === "completed" || b.status === "expired" ? (
                          <>
                            <span className="block">Database {formatBytes(b.database_bytes)}</span>
                            <span className="block">
                              {b.file_count.toLocaleString()} file{b.file_count === 1 ? "" : "s"} listed ({formatBytes(b.files_bytes)})
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="py-3 pr-5 pl-3 text-right">
                        {b.status === "completed" ? (
                          <button type="button" onClick={() => setConfirmDownload(b)} disabled={downloading === b.id} className={cn(OUTLINE, "ml-auto h-8 px-3")}>
                            {downloading === b.id ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Download aria-hidden="true" className="size-3.5" />}
                            Download
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <TablePager label="Backups" page={pager.page} perPage={pager.perPage} totalPages={pager.totalPages} total={pager.total} onPage={pager.setPage} onPerPage={pager.setPerPage} scrollTo={tableRef} />
      </section>

      <section className={cn(CARD, "p-5 sm:p-6")} aria-labelledby="restore-title">
        <h3 id="restore-title" className="text-[15px] font-medium">
          If you ever need to restore
        </h3>
        <ol className="mt-3 grid gap-3 text-[13px] text-muted-foreground sm:grid-cols-3">
          <li className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
            <span className="mb-1 block font-medium text-foreground">1. Download a backup</span>
            Pick the newest Ready backup from before the problem started.
          </li>
          <li className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
            <span className="mb-1 block font-medium text-foreground">2. Decrypt with the key</span>
            You need the BACKUP_ENCRYPTION_KEY from the server settings. Without it an encrypted backup can&apos;t be opened.
          </li>
          <li className="rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
            <span className="mb-1 block font-medium text-foreground">3. Follow RESTORE.md</span>
            Every backup contains a step-by-step guide for restoring the database and files.
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">There&apos;s deliberately no &ldquo;restore&rdquo; button here — restoring replaces live data, so it&apos;s done on purpose by a technical person.</p>
      </section>

      {/* Confirm: start */}
      <Dialog open={confirmOpen} onOpenChange={(open) => !starting && setConfirmOpen(open)}>
        <DialogContent className="max-w-md rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Back up the system now?</DialogTitle>
            <DialogDescription>
              Exports the full database and lists every stored file, then saves it to S3{config?.encrypted ? ", encrypted" : ""}. It usually takes a minute or two and doesn&apos;t interrupt anyone&apos;s work.
            </DialogDescription>
          </DialogHeader>
          {config && !config.encrypted ? (
            <div className="flex items-start gap-2.5 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
              <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>Encryption is off, so this backup will be readable by anyone who gets the file.</span>
            </div>
          ) : null}
          <DialogFooter>
            <button type="button" onClick={() => setConfirmOpen(false)} disabled={starting} className={OUTLINE}>
              Not now
            </button>
            <button type="button" onClick={() => void handleStart()} disabled={starting} className={DARK}>
              {starting ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <DatabaseBackup aria-hidden="true" className="size-3.5" />}
              Start backup
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm: download (a backup is everything) */}
      <Dialog open={confirmDownload !== null} onOpenChange={(open) => !open && downloading === null && setConfirmDownload(null)}>
        <DialogContent className="max-w-md rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Download this backup?</DialogTitle>
            <DialogDescription>
              It contains every client, examinee, report and payment record. Keep it somewhere secure and delete local copies you no longer need. The download is recorded in the Audit log.
            </DialogDescription>
          </DialogHeader>
          {confirmDownload ? (
            <dl className="space-y-1.5 rounded-2xl bg-[#F7F6F1] px-4 py-3 text-[13px] dark:bg-muted/40">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">File</dt>
                <dd className="truncate font-mono text-xs" title={confirmDownload.file_name}>
                  {confirmDownload.file_name}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Size</dt>
                <dd>{formatBytes(confirmDownload.size_bytes)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">SHA-256</dt>
                <dd className="truncate font-mono text-xs" title={confirmDownload.sha256}>
                  {confirmDownload.sha256.slice(0, 16)}…
                </dd>
              </div>
            </dl>
          ) : null}
          <DialogFooter>
            <button type="button" onClick={() => setConfirmDownload(null)} disabled={downloading !== null} className={OUTLINE}>
              Cancel
            </button>
            <button type="button" onClick={() => confirmDownload && void handleDownload(confirmDownload)} disabled={downloading !== null} className={DARK}>
              {downloading !== null ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Download aria-hidden="true" className="size-3.5" />}
              Download
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
