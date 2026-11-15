"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileSignature,
  IdCard,
  Languages,
  Loader2,
  Mail,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { GlassStat, HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { formatClinicClock, formatClinicDateLabel, formatClinicDateTime } from "@/lib/clinic-time";
import { fetchSecureShares, type SecureReportShare } from "@/lib/reports";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { formatSubjectCode, formatSubjectName } from "@/lib/subjects";
import { cn } from "@/lib/utils";
import { sessionBase } from "@/components/dashboard/session-route";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";

const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isCompleted = (a: AppointmentRecord) => a.status.toLowerCase() === "completed";
const isUpcoming = (a: AppointmentRecord) => !isCancelled(a) && !isCompleted(a) && new Date(a.scheduled_at).getTime() >= Date.now();

const STATUS_STYLE: Record<string, string> = {
  completed: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300",
  confirmed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  scheduled: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  pending: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  cancelled: "bg-destructive/10 text-destructive",
  canceled: "bg-destructive/10 text-destructive",
};
const NEUTRAL = "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground";

function hoursLabel(minutes: number) {
  if (minutes <= 0) return "0h";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Couldn't copy — your browser blocked the clipboard.");
  }
}

export default function ExamineeOverviewPage() {
  const { clientId, subject, appointments, loading, error } = useSubjectDetail();
  const { can } = useCurrentUser();

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [revealed, setRevealed] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (!subject?.id) return;
    let cancelled = false;
    setSharesLoading(true);
    fetchSecureShares({ subject_id: subject.id })
      .then((data) => {
        if (!cancelled) setShares(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load secure reports");
      })
      .finally(() => {
        if (!cancelled) setSharesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [subject?.id]);

  const stats = React.useMemo(() => {
    const byTime = (a: AppointmentRecord) => new Date(a.scheduled_at).getTime();
    const live = appointments.filter((a) => !isCancelled(a));
    const done = live.filter(isCompleted);
    const upcoming = live.filter(isUpcoming).sort((a, b) => byTime(a) - byTime(b));
    return {
      live,
      done,
      upcoming,
      cancelled: appointments.length - live.length,
      // Time actually spent in sessions: completed ones only.
      minutes: done.reduce((sum, a) => sum + (a.duration || 0), 0),
      recent: [...appointments].sort((a, b) => byTime(b) - byTime(a)).slice(0, 5),
    };
  }, [appointments]);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading examinee…
      </div>
    );
  }

  if (error || !subject) {
    return <div className="rounded-[26px] bg-destructive/5 p-6 text-destructive ring-1 ring-destructive/20">{error || "Examinee not found."}</div>;
  }

  const name = formatSubjectName(subject).trim();
  const base = `/dashboard/clients/${clientId}/examinees/${subject.id}`;
  const bookHref = `/dashboard/calendar/book?clientId=${clientId}&subjectId=${subject.id}`;
  const next = stats.upcoming[0];
  const sortedShares = [...shares].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const activeShares = shares.filter((s) => !s.archived_at && new Date(s.expires_at).getTime() >= Date.now()).length;

  return (
    <div className="space-y-5">
      <PageHero
        tone="terracotta"
        eyebrow={`Examinee · ${formatSubjectCode(subject.id)}`}
        title={name ? <strong className="font-semibold">{name}</strong> : <span className="text-[#E2B35A] italic">No name yet</span>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {subject.email ? (
              <span className="inline-flex items-center gap-1.5">
                <Mail aria-hidden="true" className="size-3.5" /> {subject.email}
              </span>
            ) : null}
            {subject.phone ? (
              <span className="inline-flex items-center gap-1.5 tabular-nums">
                <Phone aria-hidden="true" className="size-3.5" /> {subject.phone}
              </span>
            ) : null}
            {subject.employee_ref ? (
              <span className="inline-flex items-center gap-1.5">
                <IdCard aria-hidden="true" className="size-3.5" /> {subject.employee_ref}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Languages aria-hidden="true" className="size-3.5" /> English: {subject.english_proficiency || "not assessed"}
            </span>
          </span>
        }
        actions={
          <>
            <HeroAction href={`${base}/details`}>Edit details</HeroAction>
            {can("appointment:create") ? (
              <HeroAction variant="primary" icon={CalendarPlus} href={bookHref}>
                Book session
              </HeroAction>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat
            label="Sessions done"
            value={`${stats.done.length} of ${stats.live.length}`}
            hint={stats.cancelled ? `${stats.cancelled} cancelled, not counted` : stats.live.length ? `${Math.round((stats.done.length / stats.live.length) * 100)}% complete` : "None booked yet"}
            icon={CheckCircle2}
            accent="sage"
          />
          <GlassStat label="Upcoming" value={stats.upcoming.length} hint={next ? `Next ${formatClinicDateLabel(next.scheduled_at)}` : "Nothing scheduled"} icon={CalendarClock} accent="lavender" />
          <GlassStat label="Time examined" value={hoursLabel(stats.minutes)} hint="Completed sessions" icon={Clock} accent="amber" />
          <GlassStat label="Reports sent" value={shares.length} hint={shares.length ? `${activeShares} link${activeShares === 1 ? "" : "s"} still active` : "None yet"} icon={FileSignature} loading={sharesLoading} />
        </div>
      </PageHero>

      {subject.interpreter_required ? (
        <div className="flex items-start gap-2.5 rounded-2xl bg-[#F8EEDB] px-4 py-3 text-[13px] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong className="font-semibold">Interpreter required.</strong> Arrange one before booking — English level: {subject.english_proficiency || "not assessed"}.
          </span>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Sessions */}
        <section aria-labelledby="sessions-title" className={cn(CARD, "overflow-hidden")}>
          <div className="flex items-center justify-between gap-3 p-5 pb-4">
            <div>
              <h3 id="sessions-title" className="text-[15px] font-medium">
                Sessions
              </h3>
              <p className="text-[13px] text-muted-foreground">Newest first.</p>
            </div>
            {appointments.length > 0 ? (
              <Link href={`${base}/exams` as Route} className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                All {appointments.length} <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : null}
          </div>

          {next ? (
            <Link
              href={sessionBase(clientId, next.id, subject.id) as Route}
              className="mx-5 mb-4 flex items-center gap-4 rounded-[20px] bg-[#2B2A27] p-4 text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-[#1B1B19]"
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary">
                <CalendarClock aria-hidden="true" className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-medium tracking-[0.08em] text-[#C9C6BC] uppercase">Next session</span>
                <span className="block truncate font-medium">{formatClinicDateTime(next.scheduled_at)}</span>
                <span className="block text-xs text-[#C9C6BC]">
                  <span className="font-mono">{formatAppointmentCode(next.id)}</span> · {hoursLabel(next.duration || 0)}
                </span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-[#C9C6BC]" />
            </Link>
          ) : null}

          {stats.recent.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
              <p className="text-sm text-muted-foreground">No sessions yet.</p>
              {can("appointment:create") ? (
                <Link href={bookHref as Route} className="flex h-10 items-center gap-2 rounded-full bg-[#2B2A27] px-4 text-sm font-medium text-[#FAF9F5] hover:bg-[#3A3935] dark:bg-foreground dark:text-background">
                  <CalendarPlus aria-hidden="true" className="size-4" /> Book first session
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="divide-y divide-border/50 border-t border-border/50">
              {stats.recent.map((a) => {
                const statusKey = a.status.toLowerCase().replace(/[\s-]+/g, "_");
                const cancelled = isCancelled(a);
                const pay = (a.payment_status || "").toLowerCase();
                return (
                  <li key={a.id}>
                    <Link
                      href={sessionBase(clientId, a.id, subject.id) as Route}
                      className={cn("flex items-center gap-4 px-5 py-3 transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/30", cancelled && "opacity-70")}
                    >
                      <span className="w-[88px] shrink-0 text-xs text-muted-foreground tabular-nums">
                        <span className="block font-medium text-foreground">{formatClinicDateLabel(a.scheduled_at)}</span>
                        {formatClinicClock(a.scheduled_at)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-mono text-[13px]">{formatAppointmentCode(a.id)}</span>
                        <span className="mt-1 flex flex-wrap gap-1.5">
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[statusKey] ?? NEUTRAL)}>{a.status.replace(/[_-]+/g, " ")}</span>
                          {/* Payment means nothing on a cancelled session */}
                          {!cancelled && a.prepaid_slot_id ? <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", NEUTRAL)}>Prepaid</span> : null}
                          {!cancelled && !a.prepaid_slot_id && pay === "paid" ? (
                            <span className="rounded-full bg-[#E7F1E4] px-2.5 py-0.5 text-xs font-medium text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300">Paid</span>
                          ) : null}
                          {!cancelled && !a.prepaid_slot_id && pay && pay !== "paid" ? (
                            <span className="rounded-full bg-[#F8EEDB] px-2.5 py-0.5 text-xs font-medium text-[#8A5A12] capitalize dark:bg-amber-950/60 dark:text-amber-200">{a.payment_status}</span>
                          ) : null}
                          {a.exam_id ? <span className="rounded-full bg-primary/12 px-2.5 py-0.5 text-xs font-medium text-[oklch(0.45_0.12_39)] dark:text-primary">Documented</span> : null}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Reports */}
        <section aria-labelledby="reports-title" className={cn(CARD, "overflow-hidden")}>
          <div className="p-5 pb-4">
            <h3 id="reports-title" className="flex items-center gap-2 text-[15px] font-medium">
              <ShieldCheck aria-hidden="true" className="size-4 text-muted-foreground" /> Secure reports
            </h3>
            <p className="text-[13px] text-muted-foreground">Encrypted report links sent for this person.</p>
          </div>
          {sharesLoading ? (
            <div className="space-y-2 border-t border-border/50 p-5">
              {[0, 1].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
              ))}
            </div>
          ) : sortedShares.length === 0 ? (
            <p className="border-t border-border/50 px-6 py-12 text-center text-sm text-muted-foreground">No reports sent yet. They&apos;re written and sent from the account&apos;s Secure reports page.</p>
          ) : (
            <ul className="divide-y divide-border/50 border-t border-border/50">
              {sortedShares.slice(0, 5).map((share) => {
                const withdrawn = Boolean(share.archived_at);
                const expired = new Date(share.expires_at).getTime() < Date.now();
                const dead = withdrawn || expired;
                const pin = share.protection_mode !== "secure_link";
                const state = withdrawn
                  ? { text: "Withdrawn", style: NEUTRAL }
                  : expired
                    ? { text: "Expired", style: "bg-destructive/10 text-destructive" }
                    : share.status === "viewed"
                      ? { text: "Opened", style: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" }
                      : { text: "Not opened yet", style: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200" };
                return (
                  <li key={share.id} className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                        <span className="truncate">{share.recipient_email}</span>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", state.style)}>{state.text}</span>
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Sent {formatClinicDateLabel(share.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {pin ? (
                        <span className="inline-flex h-8 items-center gap-0.5 rounded-full bg-[#F3F1EA] pr-1 pl-3 dark:bg-muted">
                          <span className="min-w-12 font-mono text-[13px] font-semibold tracking-wider">{revealed[share.id] ? share.password || "—" : "••••••"}</span>
                          <button
                            type="button"
                            aria-label={revealed[share.id] ? "Hide PIN" : "Show PIN"}
                            onClick={() => setRevealed((p) => ({ ...p, [share.id]: !p[share.id] }))}
                            className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
                          >
                            {revealed[share.id] ? <EyeOff aria-hidden="true" className="size-3.5" /> : <Eye aria-hidden="true" className="size-3.5" />}
                          </button>
                        </span>
                      ) : null}
                      {!dead ? (
                        <button
                          type="button"
                          aria-label="Copy secure link"
                          title="Copy secure link"
                          onClick={() => void copy(`${window.location.origin}/shared/report/${share.token}`, "Secure link copied")}
                          className="flex size-8 items-center justify-center rounded-full ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                        >
                          <Copy aria-hidden="true" className="size-3.5" />
                        </button>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {sortedShares.length > 5 ? (
            <div className="border-t border-border/50 px-5 py-3">
              <Link href={`/dashboard/clients/${clientId}/reports` as Route} className="flex items-center gap-1 text-[13px] font-medium text-muted-foreground hover:text-foreground">
                All {sortedShares.length} on Secure reports <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
