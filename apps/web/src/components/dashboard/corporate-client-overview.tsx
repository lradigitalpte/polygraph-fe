"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { toast } from "sonner";
import { ArrowRight, Building2, CalendarClock, CalendarPlus, ClipboardCheck, Clock, Loader2, Mail, Phone, Ticket, UserPlus, Users, Wallet } from "lucide-react";

import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { GlassStat, HeroAction, PageHero } from "@/components/dashboard/ui-kit";
import { fetchClientExaminees, formatClientCode, type ExamineeRosterEntry } from "@/lib/clients";
import { fetchBillingLedger } from "@/lib/billing";
import { formatMoney } from "@/lib/client-account";
import { formatClinicClock, formatClinicDateLabel } from "@/lib/clinic-time";
import { formatSubjectCode, formatSubjectName } from "@/lib/subjects";
import { fetchPrepaidSlotSummary, type PrepaidSlotSummary } from "@/lib/prepaid-slots";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { cn } from "@/lib/utils";

const CARD = "rounded-[26px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card";
const isCancelled = (a: AppointmentRecord) => ["cancelled", "canceled", "no_show", "no-show"].includes(a.status.toLowerCase());
const isCompleted = (a: AppointmentRecord) => a.status.toLowerCase() === "completed";

function formatDuration(minutes: number) {
  if (minutes <= 0) return "0m";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
}

function relativeDays(iso?: string) {
  if (!iso) return "—";
  const days = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (Number.isNaN(days)) return "—";
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days === -1) return "tomorrow";
  if (days < 0) return `in ${-days} days`;
  if (days < 45) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

const STATUS_STYLE: Record<string, string> = {
  confirmed: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  scheduled: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
  pending: "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950/60 dark:text-amber-200",
  in_progress: "bg-primary/15 text-[oklch(0.45_0.12_39)] dark:text-primary",
};

export function CorporateClientOverview() {
  const { client, appointments, loading } = useClientDetail();
  const { can, showExaminerWorkspace } = useCurrentUser();
  const canSeeBilling = can("client:manage") && !showExaminerWorkspace;
  const [roster, setRoster] = React.useState<ExamineeRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = React.useState(true);
  const [prepaid, setPrepaid] = React.useState<PrepaidSlotSummary | null>(null);
  const [balance, setBalance] = React.useState<number | null>(null);
  const [extraLoading, setExtraLoading] = React.useState(true);

  React.useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setRosterLoading(true);
    setExtraLoading(true);
    fetchClientExaminees(client.id)
      .then((data) => {
        if (!cancelled) setRoster(data);
      })
      .catch((err) => {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Failed to load roster");
      })
      .finally(() => {
        if (!cancelled) setRosterLoading(false);
      });
    Promise.all([
      fetchPrepaidSlotSummary(client.id).catch(() => null),
      canSeeBilling ? fetchBillingLedger(client.id).catch(() => null) : Promise.resolve(null),
    ])
      .then(([slots, ledger]) => {
        if (cancelled) return;
        setPrepaid(slots);
        setBalance(ledger ? ledger.summary.balance_due : null);
      })
      .finally(() => {
        if (!cancelled) setExtraLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [client, canSeeBilling]);

  const now = Date.now();
  const upcoming = React.useMemo(
    () =>
      appointments
        .filter((a) => !isCancelled(a) && !isCompleted(a) && new Date(a.scheduled_at).getTime() >= now - 3 * 3600000)
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- "now" read once per appointments change
    [appointments],
  );

  if (loading || !client) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 aria-hidden="true" className="mr-2 size-5 animate-spin" />
        Loading account…
      </div>
    );
  }

  const base = `/dashboard/clients/${client.id}`;
  const active = appointments.filter((a) => !isCancelled(a));
  const completed = appointments.filter(isCompleted);
  const examMinutes = completed.reduce((sum, a) => sum + (a.duration || 0), 0);

  // People on the roster who have never had a session and have nothing booked.
  const waiting = roster.filter((r) => (r.session_count ?? 0) === 0 && (r.upcoming_count ?? 0) === 0 && !r.next_scheduled_at);
  const recentlyTested = [...roster]
    .filter((r) => r.last_scheduled_at && (r.completed_count ?? 0) > 0)
    .sort((a, b) => (b.last_scheduled_at ?? "").localeCompare(a.last_scheduled_at ?? ""))
    .slice(0, 5);
  const lastSession = [...completed].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0];

  const examineeName = (a: AppointmentRecord) => (a.subject ? formatSubjectName(a.subject) : `Examinee #${a.subject_id}`);

  return (
    <div className="space-y-6">
      <PageHero
        tone="sage"
        icon={Building2}
        eyebrow={`${client.client_type || "Corporate"} account · ${formatClientCode(client.id)}`}
        title={<strong className="font-semibold">{client.name}</strong>}
        description={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
            {client.contact_person ? <span>Contact: {client.contact_person}</span> : null}
            {client.email ? (
              <a href={`mailto:${client.email}`} className="inline-flex items-center gap-1.5 hover:text-[#FAF9F5]">
                <Mail aria-hidden="true" className="size-3.5" /> {client.email}
              </a>
            ) : null}
            {client.phone ? (
              <a href={`tel:${client.phone.replace(/\s+/g, "")}`} className="inline-flex items-center gap-1.5 hover:text-[#FAF9F5]">
                <Phone aria-hidden="true" className="size-3.5" /> {client.phone}
              </a>
            ) : null}
          </span>
        }
        actions={
          <>
            <HeroAction icon={Users} href={`${base}/roster`}>
              Roster
            </HeroAction>
            {can("appointment:create") ? (
              <HeroAction variant="primary" icon={CalendarPlus} href={`/dashboard/calendar/book?clientId=${client.id}`}>
                Book session
              </HeroAction>
            ) : null}
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <GlassStat label="Examinees" value={roster.length} hint={waiting.length ? `${waiting.length} not booked yet` : "Everyone has a session"} icon={Users} accent="sage" loading={rosterLoading} />
          <GlassStat
            label="Sessions"
            value={active.length}
            hint={`${completed.length} done${upcoming.length ? ` · ${upcoming.length} upcoming` : ""}`}
            icon={ClipboardCheck}
            accent="lavender"
          />
          <GlassStat
            label="Prepaid slots"
            value={prepaid && prepaid.total > 0 ? `${prepaid.available} free` : "—"}
            hint={
              prepaid && prepaid.total > 0
                ? `${prepaid.consumed} used of ${prepaid.total}${prepaid.awaiting_payment ? ` · ${prepaid.awaiting_payment} unpaid` : ""}`
                : "No bulk invoice"
            }
            icon={Ticket}
            accent="amber"
            loading={extraLoading}
          />
          {balance !== null || extraLoading ? (
            <GlassStat
              label="Balance due"
              value={formatMoney(balance ?? 0, "AED")}
              hint={(balance ?? 0) > 0 ? "Open invoices" : "All paid up"}
              icon={Wallet}
              accent="terracotta"
              loading={extraLoading && canSeeBilling}
            />
          ) : (
            <GlassStat label="Exam time" value={formatDuration(examMinutes)} hint="Completed sessions" icon={Clock} accent="terracotta" />
          )}
        </div>
      </PageHero>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Upcoming */}
        <section aria-labelledby="upcoming-title" className={cn(CARD, "overflow-hidden lg:col-span-3")}>
          <div className="flex items-center justify-between gap-3 p-6 pb-4">
            <div>
              <h2 id="upcoming-title" className="text-[15px] font-medium">
                Upcoming sessions
              </h2>
              <p className="text-[13px] text-muted-foreground">{upcoming.length ? "Soonest first." : "Nothing booked right now."}</p>
            </div>
            <Link href={`${base}/exams` as Route} className="flex h-9 items-center gap-1 rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
              All sessions <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t border-border/50 px-6 py-12 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] dark:bg-muted">
                <CalendarClock aria-hidden="true" className="size-5 text-muted-foreground" />
              </span>
              <p className="max-w-sm text-sm text-muted-foreground">
                {waiting.length ? `${waiting.length} people on the roster are waiting for a session.` : "Book the next session when the company sends new examinees."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border/50 border-t border-border/50">
              {upcoming.slice(0, 6).map((a) => {
                const date = new Date(a.scheduled_at);
                const key = a.status.toLowerCase().replace(/[\s-]+/g, "_");
                return (
                  <li key={a.id}>
                    <Link href={`${base}/exams/${a.id}` as Route} className="flex items-center gap-4 px-6 py-3 transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                      <span className="flex w-12 shrink-0 flex-col items-center rounded-xl bg-[#F7F6F1] py-1.5 dark:bg-muted/50">
                        <span className="text-[10px] font-medium text-primary uppercase">{date.toLocaleDateString(undefined, { month: "short" })}</span>
                        <span className="text-lg leading-none font-semibold tabular-nums">{date.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{examineeName(a)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatClinicClock(a.scheduled_at)} · {relativeDays(a.scheduled_at)}
                          {a.prepaid_slot_id ? " · prepaid slot" : ""}
                        </span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize", STATUS_STYLE[key] ?? "bg-[#ECE9E0] text-[#55534C] dark:bg-muted")}>{a.status.replace(/[_-]+/g, " ")}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          {upcoming.length > 6 ? <p className="border-t border-border/50 px-6 py-3 text-center text-xs text-muted-foreground">+ {upcoming.length - 6} more in All sessions</p> : null}
        </section>

        {/* Roster */}
        <div className="space-y-6 lg:col-span-2">
          <section aria-labelledby="waiting-title" className={cn(CARD, "overflow-hidden")}>
            <div className="flex items-center justify-between gap-3 p-6 pb-4">
              <div>
                <h2 id="waiting-title" className="text-[15px] font-medium">
                  Waiting for a session
                </h2>
                <p className="text-[13px] text-muted-foreground">{rosterLoading ? "Loading…" : waiting.length ? `${waiting.length} on the roster, never booked.` : "Everyone on the roster has been booked."}</p>
              </div>
              {waiting.length > 0 ? <span className="shrink-0 rounded-full bg-[#F8EEDB] px-2.5 py-1 text-xs font-semibold text-[#8A5A12] tabular-nums dark:bg-amber-950/60 dark:text-amber-200">{waiting.length}</span> : null}
            </div>
            {!rosterLoading && waiting.length > 0 ? (
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {waiting.slice(0, 5).map((r) => (
                  <li key={r.subject.id}>
                    <Link href={`${base}/examinees/${r.subject.id}` as Route} className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{formatSubjectName(r.subject)}</span>
                        <span className="block font-mono text-[11px] text-muted-foreground">{formatSubjectCode(r.subject.id)}</span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="border-t border-border/50 p-3">
              <Link href={`${base}/roster` as Route} className="flex h-10 items-center justify-center gap-1.5 rounded-full text-[13px] font-medium transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
                <UserPlus aria-hidden="true" className="size-4" /> Open roster ({roster.length})
              </Link>
            </div>
          </section>

          {recentlyTested.length > 0 ? (
            <section aria-labelledby="recent-title" className={cn(CARD, "overflow-hidden")}>
              <div className="p-6 pb-4">
                <h2 id="recent-title" className="text-[15px] font-medium">
                  Recently tested
                </h2>
                <p className="text-[13px] text-muted-foreground">{lastSession ? `Last session ${relativeDays(lastSession.scheduled_at)}.` : ""}</p>
              </div>
              <ul className="divide-y divide-border/50 border-t border-border/50">
                {recentlyTested.map((r) => (
                  <li key={r.subject.id}>
                    <Link href={`${base}/examinees/${r.subject.id}` as Route} className="flex items-center gap-3 px-6 py-2.5 transition-colors hover:bg-[#F7F6F1] dark:hover:bg-muted/40">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{formatSubjectName(r.subject)}</span>
                        <span className="block text-xs text-muted-foreground">
                          {r.last_scheduled_at ? formatClinicDateLabel(r.last_scheduled_at) : ""} · {r.completed_count} session{r.completed_count === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );
}
