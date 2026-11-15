"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowUpRight,
  Bell,
  CalendarClock,
  ClipboardList,
  Loader2,
  Mail,
  PenLine,
  RefreshCcw,
  Search,
  Send,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { useCurrentUser } from "@/components/dashboard/use-current-user";
import { DeleteConfirmDialog } from "@/components/dashboard/delete-confirm-dialog";
import { GlassStat, GlowPanel, Highlight, Segmented } from "@/components/dashboard/ui-kit";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { deleteInvoice } from "@/lib/billing";
import { formatClinicDateLabel, formatClinicDateTime } from "@/lib/clinic-time";
import { resendFormRequest } from "@/lib/forms";
import {
  dispatchAppointmentReminder,
  getSentReminderIdsToday,
  loadRemindersData,
  paymentReminderTemplate,
  sessionReminderTemplate,
  type FormReminderItem,
  type PaymentReminderItem,
  type SessionReminderItem,
} from "@/lib/reminders";
import { cn } from "@/lib/utils";

type Tab = "payment" | "forms" | "sessions";
type ComposeTarget = (PaymentReminderItem & { kind: "payment" }) | (SessionReminderItem & { kind: "session" });

/** Balances below this are almost always leftover rounding between invoice and payment. */
const SMALL_BALANCE = 5;

type PendingSend = {
  title: string;
  recipient: string;
  subject?: string;
  run: () => Promise<void>;
};

const TEMPLATES = ["Payment Due", "Prep Guide", "Confirmation", "Result Followup"] as const;

export default function RemindersPage() {
  const router = useRouter();
  const { loading: userLoading, can } = useCurrentUser();

  React.useEffect(() => {
    if (!userLoading && !can("reminder:view")) {
      toast.error("You don't have permission to access this page.");
      router.replace("/dashboard");
    }
  }, [userLoading, can, router]);

  const canManagePayments = can("payment:manage");

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<Tab>("payment");
  const [search, setSearch] = React.useState("");
  const [hideSmall, setHideSmall] = React.useState(true);
  const [paymentReminders, setPaymentReminders] = React.useState<PaymentReminderItem[]>([]);
  const [sessionReminders, setSessionReminders] = React.useState<SessionReminderItem[]>([]);
  const [formReminders, setFormReminders] = React.useState<FormReminderItem[]>([]);
  const [sentCount, setSentCount] = React.useState(0);

  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ComposeTarget | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [toEmail, setToEmail] = React.useState("");
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const [pendingSend, setPendingSend] = React.useState<PendingSend | null>(null);
  const [sending, setSending] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loadRemindersData();
      setPaymentReminders(data.paymentReminders);
      setSessionReminders(data.sessionReminders);
      setFormReminders(data.formReminders);
      setSentCount(getSentReminderIdsToday().size);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reminders");
      setPaymentReminders([]);
      setSessionReminders([]);
      setFormReminders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  /* ---------------- sending (always confirmed first) ---------------- */

  const confirmAndSend = async () => {
    if (!pendingSend) return;
    setSending(true);
    try {
      await pendingSend.run();
      setPendingSend(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const requestPaymentSend = (item: PaymentReminderItem) => {
    if (!item.email) {
      openCompose({ ...item, kind: "payment" });
      toast.message("Add a recipient email before sending");
      return;
    }
    const tpl = paymentReminderTemplate(item);
    setPendingSend({
      title: "Send payment reminder?",
      recipient: item.email,
      subject: tpl.subject,
      run: async () => {
        await dispatchAppointmentReminder(item.appointmentId, { to_email: item.email!, subject: tpl.subject, body: tpl.body }, item.id);
        toast.success(`Payment reminder sent to ${item.client}`);
        await load();
      },
    });
  };

  const requestFormResend = (item: FormReminderItem) => {
    setPendingSend({
      title: "Resend form link?",
      recipient: item.email,
      subject: item.formName,
      run: async () => {
        await resendFormRequest(item.requestId);
        toast.success(`Form link resent to ${item.client}`);
        await load();
      },
    });
  };

  const requestComposeSend = () => {
    if (!selected?.appointmentId) {
      toast.error("Open compose from a row so the message is linked to a booking");
      return;
    }
    const to = toEmail.trim();
    if (!to || !to.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("Add a subject and a message");
      return;
    }
    const target = selected;
    setPendingSend({
      title: "Send this email?",
      recipient: to,
      subject: subject.trim(),
      run: async () => {
        await dispatchAppointmentReminder(target.appointmentId, { to_email: to, subject: subject.trim(), body: body.trim() }, target.id);
        toast.success("Reminder sent", { description: `Logged for ${target.client}` });
        setIsComposeOpen(false);
        await load();
      },
    });
  };

  /* ---------------- compose ---------------- */

  const openCompose = (target: ComposeTarget) => {
    setSelected(target);
    const tpl = target.kind === "payment" ? paymentReminderTemplate(target) : sessionReminderTemplate(target);
    setSubject(tpl.subject);
    setBody(tpl.body);
    setToEmail(target.email || "");
    setIsComposeOpen(true);
  };

  const applyTemplate = (name: (typeof TEMPLATES)[number]) => {
    if (!selected) return;
    if (name === "Payment Due") {
      const item: PaymentReminderItem =
        selected.kind === "payment"
          ? selected
          : {
              id: selected.id,
              appointmentId: selected.appointmentId,
              client: selected.client,
              email: selected.email,
              amount: "",
              balance: 0,
              due: "",
              status: "Pending",
              sessionDate: selected.scheduledAt,
              title: selected.client,
            };
      const tpl = paymentReminderTemplate(item);
      setSubject(tpl.subject);
      setBody(tpl.body);
      return;
    }
    const type = { "Prep Guide": "Prep instructions", Confirmation: "Confirm schedule", "Result Followup": "Follow-up report" }[name];
    const sessionItem: SessionReminderItem =
      selected.kind === "session"
        ? { ...selected, type }
        : {
            id: selected.id,
            appointmentId: selected.appointmentId,
            clientId: 0,
            client: selected.client,
            email: selected.email,
            type,
            appointment: formatClinicDateTime(selected.sessionDate) || "your scheduled time",
            status: "Ready",
            scheduledAt: selected.sessionDate,
          };
    const tpl = sessionReminderTemplate(sessionItem);
    setSubject(tpl.subject);
    setBody(tpl.body);
  };

  async function deletePaymentReminder(rem: PaymentReminderItem) {
    setDeletingId(rem.id);
    try {
      await deleteInvoice({ quotationId: rem.quotationId, appointmentId: rem.appointmentId });
      setPaymentReminders((current) => current.filter((item) => item.id !== rem.id));
      toast.success(`${rem.id} removed from billing`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete invoice");
    } finally {
      setDeletingId(null);
    }
  }

  /* ---------------- filtering ---------------- */

  const needle = search.trim().toLowerCase();
  const matches = (...values: (string | undefined)[]) => !needle || values.some((v) => (v ?? "").toLowerCase().includes(needle));

  const smallBalances = paymentReminders.filter((r) => r.balance < SMALL_BALANCE);
  const payments = paymentReminders.filter((r) => (!hideSmall || r.balance >= SMALL_BALANCE) && matches(r.client, r.id, r.title, r.email));
  const forms = formReminders.filter((r) => matches(r.client, r.id, r.formName, r.email));
  const sessions = sessionReminders.filter((r) => matches(r.client, r.id, r.type, r.email));

  const realOverdue = paymentReminders.filter((r) => r.status === "Overdue" && r.balance >= SMALL_BALANCE);
  const overdueTotal = realOverdue.reduce((sum, r) => sum + r.balance, 0);
  const currencyMatch = /^[A-Z]{3}/.exec(paymentReminders[0]?.amount ?? "");
  const currency = currencyMatch?.[0] ?? "AED";

  const tabOptions = [
    { value: "payment" as const, label: "Payment due", count: paymentReminders.filter((r) => !hideSmall || r.balance >= SMALL_BALANCE).length },
    { value: "forms" as const, label: "Forms", count: formReminders.length },
    { value: "sessions" as const, label: "Sessions", count: sessionReminders.length },
  ];

  return (
    <div className="mx-auto max-w-[1440px] space-y-5 pb-10">
      {/* Hero */}
      <GlowPanel tone="lavender" orb="68%" lineTop={40} className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
          <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
            <div className="flex max-w-2xl flex-col gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
                <Bell aria-hidden="true" className="size-4" />
                Reminders
              </span>
              <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
                Client <span className="font-semibold">reminders</span>
              </h1>
              <p className="max-w-xl text-[15px] text-[#C9C6BC]">Chase payments, nudge unfinished forms and prepare examinees for their sessions. Every email is confirmed before it sends.</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="flex h-11 items-center justify-center gap-2 self-start rounded-full bg-white/[0.07] px-5 text-sm font-medium text-[#FAF9F5] ring-1 ring-white/15 transition-colors hover:bg-white/[0.12] disabled:opacity-50 md:self-auto"
            >
              <RefreshCcw aria-hidden="true" className={cn("size-4", loading && "animate-spin")} />
              Refresh
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <GlassStat
              label="Overdue payments"
              value={realOverdue.length}
              hint={realOverdue.length ? `${currency} ${overdueTotal.toLocaleString("en-US", { maximumFractionDigits: 2 })} outstanding` : "Nothing overdue"}
              icon={Wallet}
              accent="terracotta"
              loading={loading}
            />
            <GlassStat label="Forms pending" value={formReminders.length} hint="Sent but not completed" icon={ClipboardList} accent="amber" loading={loading} />
            <GlassStat label="Upcoming sessions" value={sessionReminders.length} hint="Ready for prep or confirmation" icon={CalendarClock} accent="lavender" loading={loading} />
            <GlassStat label="Sent today" value={sentCount} hint="From this browser" icon={Send} accent="sage" loading={loading} />
          </div>
        </div>
      </GlowPanel>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[26px] bg-white p-3 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-4 lg:flex-row lg:items-center lg:justify-between dark:bg-card">
        <Segmented label="Reminder type" value={tab} onChange={setTab} options={tabOptions} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {tab === "payment" && smallBalances.length > 0 ? (
            <label className="flex h-10 cursor-pointer items-center gap-2.5 rounded-full px-3 text-[13px] text-muted-foreground hover:bg-[#F7F6F1] dark:hover:bg-muted/50">
              <input type="checkbox" className="size-4 accent-[#30302E]" checked={hideSmall} onChange={(e) => setHideSmall(e.target.checked)} />
              Hide balances under {SMALL_BALANCE} ({smallBalances.length})
            </label>
          ) : null}
          <div className="relative w-full sm:w-80">
            <label htmlFor="reminder-search" className="sr-only">
              Search reminders
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="reminder-search"
              placeholder="Search client, reference or email…"
              className="h-11 rounded-full border-0 bg-[#F3F1EA] pr-10 pl-11 text-sm shadow-none dark:bg-muted"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search ? (
              <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute top-1/2 right-2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground hover:bg-white dark:hover:bg-card">
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
          </div>
        </div>
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

      {/* Tables */}
      <div className="overflow-hidden rounded-[28px] bg-white shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 dark:bg-card">
        <div className="overflow-x-auto">
          {tab === "payment" ? (
            <table className="w-full min-w-[960px] border-collapse text-left text-sm">
              <TableHead columns={["Reference", "Client", "Session", "Outstanding", "Status", "Email"]} />
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <SkeletonRows cols={7} />
                ) : payments.length === 0 ? (
                  <EmptyRow cols={7} title={needle ? "No payment reminders match your search" : "No outstanding balances"} hint="Unpaid or partly paid bookings appear here." href="/dashboard/payments" linkLabel="Open payments" />
                ) : (
                  payments.map((rem) => (
                    <tr key={`${rem.id}-${rem.appointmentId}`} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{rem.id}</td>
                      <td className="max-w-[280px] px-6 py-4">
                        <span className="flex flex-col gap-0.5">
                          <span className="truncate font-medium">
                            <Highlight text={rem.client} query={search} />
                          </span>
                          <span className="truncate text-[13px] text-muted-foreground">{rem.title}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="flex flex-col gap-0.5">
                          <span>{formatClinicDateLabel(rem.sessionDate) || "—"}</span>
                          <span className="text-[13px] text-muted-foreground">{rem.due}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn("font-mono tabular-nums", rem.balance >= SMALL_BALANCE ? "text-[#8A2C22] dark:text-red-300" : "text-muted-foreground")}>{rem.amount}</span>
                        {rem.balance < SMALL_BALANCE ? <span className="block text-xs text-muted-foreground">Likely rounding</span> : null}
                      </td>
                      <td className="px-6 py-4">
                        <UrgencyChip status={rem.status} />
                      </td>
                      <td className="max-w-[220px] px-6 py-4">
                        <EmailCell email={rem.email} />
                      </td>
                      <td className="px-6 py-4">
                        <RowActions>
                          <ActionButton primary label="Send reminder" icon={Send} disabled={deletingId === rem.id} onClick={() => requestPaymentSend(rem)} />
                          <ActionButton label="Edit message" icon={PenLine} iconOnly onClick={() => openCompose({ ...rem, kind: "payment" })} />
                          {canManagePayments ? (
                            <DeleteConfirmDialog
                              title={`Delete ${rem.id}`}
                              description={rem.quotationId ? "This permanently removes the invoice from billing. The linked session is kept." : "This permanently deletes the session and its billing record."}
                              confirmLabel="Delete"
                              triggerLabel=""
                              trigger={
                                <button type="button" aria-label={`Delete invoice ${rem.id}`} disabled={deletingId === rem.id} className="flex size-9 items-center justify-center rounded-full text-[#8A2C22] transition-colors hover:bg-[#F6E3E1] disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950">
                                  {deletingId === rem.id ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
                                </button>
                              }
                              onConfirm={async () => deletePaymentReminder(rem)}
                            />
                          ) : null}
                        </RowActions>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : tab === "forms" ? (
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
              <TableHead columns={["Reference", "Recipient", "Form", "Sent", "Link expires", "Status"]} />
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <SkeletonRows cols={7} />
                ) : forms.length === 0 ? (
                  <EmptyRow cols={7} title={needle ? "No forms match your search" : "No forms awaiting completion"} hint="Send consent, privacy or intake forms from a client's documents. Unfinished ones appear here." href="/dashboard/clients" linkLabel="Go to clients" />
                ) : (
                  forms.map((rem) => (
                    <tr key={rem.id} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{rem.id}</td>
                      <td className="max-w-[260px] px-6 py-4">
                        <span className="flex flex-col gap-0.5">
                          <span className="truncate font-medium">
                            <Highlight text={rem.client} query={search} />
                          </span>
                          <span className="truncate text-[13px] text-muted-foreground">{rem.email}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">{rem.formName}</td>
                      <td className="px-6 py-4 text-muted-foreground">{rem.due}</td>
                      <td className="px-6 py-4">{formatClinicDateLabel(rem.expiresAt) || rem.expiresAt}</td>
                      <td className="px-6 py-4">
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium", rem.status === "Opened" ? "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200" : "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300")}>
                          <span aria-hidden="true" className={cn("size-1.5 rounded-full", rem.status === "Opened" ? "bg-[#7C6BD6]" : "bg-[#E2B35A]")} />
                          {rem.status === "Opened" ? "Opened, not finished" : "Not opened"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <RowActions>
                          <ActionButton primary label="Resend link" icon={RefreshCcw} onClick={() => requestFormResend(rem)} />
                          <Link
                            href={rem.subjectId ? `/dashboard/clients/${rem.clientId}/examinees/${rem.subjectId}/documents` : `/dashboard/clients/${rem.clientId}/documents`}
                            aria-label="Open documents"
                            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                          >
                            <ArrowUpRight aria-hidden="true" className="size-4" />
                          </Link>
                        </RowActions>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <TableHead columns={["Reference", "Client", "Session", "Suggested message", "Status"]} />
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <SkeletonRows cols={6} />
                ) : sessions.length === 0 ? (
                  <EmptyRow cols={6} title={needle ? "No sessions match your search" : "No upcoming sessions"} hint="Book exams to send prep and confirmation messages." href="/dashboard/calendar/book" linkLabel="Book an exam" />
                ) : (
                  sessions.map((rem) => (
                    <tr key={`${rem.id}-${rem.appointmentId}`} className="transition-colors hover:bg-[#FAF9F5] dark:hover:bg-muted/40">
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{rem.id}</td>
                      <td className="max-w-[260px] px-6 py-4">
                        <span className="flex flex-col gap-0.5">
                          <span className="truncate font-medium">
                            <Highlight text={rem.client} query={search} />
                          </span>
                          <EmailCell email={rem.email} compact />
                        </span>
                      </td>
                      <td className="px-6 py-4">{rem.appointment}</td>
                      <td className="px-6 py-4">{rem.type}</td>
                      <td className="px-6 py-4">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium",
                            rem.status === "Sent" ? "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300" : rem.status === "Queued" ? "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300" : "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200",
                          )}
                        >
                          <span aria-hidden="true" className={cn("size-1.5 rounded-full", rem.status === "Sent" ? "bg-[#3F7A37]" : rem.status === "Queued" ? "bg-[#E2B35A]" : "bg-[#7C6BD6]")} />
                          {rem.status === "Sent" ? "Sent today" : rem.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <RowActions>
                          <ActionButton primary label="Write reminder" icon={Mail} onClick={() => openCompose({ ...rem, kind: "session" })} />
                          <Link
                            href={`/dashboard/clients/${rem.clientId}/exams`}
                            aria-label="Open client exams"
                            className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
                          >
                            <ArrowUpRight aria-hidden="true" className="size-4" />
                          </Link>
                        </RowActions>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        {!loading ? (
          <div className="border-t border-border/50 px-6 py-3.5 text-[13px] text-muted-foreground">
            {tab === "payment"
              ? `${payments.length} of ${paymentReminders.length} balances${hideSmall && smallBalances.length ? ` · ${smallBalances.length} under ${SMALL_BALANCE} hidden` : ""}`
              : tab === "forms"
                ? `${forms.length} of ${formReminders.length} forms`
                : `${sessions.length} of ${sessionReminders.length} sessions`}
          </div>
        ) : null}
      </div>

      {/* Compose */}
      <Sheet open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <SheetContent className="w-full gap-0 overflow-hidden border-l border-border/50 bg-white p-0 shadow-2xl sm:max-w-[600px] dark:bg-card [&_[data-slot=sheet-close]]:top-5 [&_[data-slot=sheet-close]]:right-5 [&_[data-slot=sheet-close]]:z-30 [&_[data-slot=sheet-close]]:flex [&_[data-slot=sheet-close]]:size-9 [&_[data-slot=sheet-close]]:items-center [&_[data-slot=sheet-close]]:justify-center [&_[data-slot=sheet-close]]:rounded-full [&_[data-slot=sheet-close]]:bg-white/10! [&_[data-slot=sheet-close]]:text-[#FAF9F5] [&_[data-slot=sheet-close]]:opacity-100 [&_[data-slot=sheet-close]]:ring-1 [&_[data-slot=sheet-close]]:ring-white/15">
          {selected ? (
            <div className="flex h-full flex-col">
              <GlowPanel tone={selected.kind === "payment" ? "terracotta" : "lavender"} orb="60%" lineTop={0} className="shrink-0 rounded-none px-6 pt-6 pb-5 shadow-none ring-0 sm:px-7">
                <div className="flex flex-col gap-2 pr-12">
                  <span className="font-mono text-xs text-[#B5B2A8]">{selected.id}</span>
                  <SheetTitle className="text-2xl leading-tight font-medium tracking-[-0.02em] text-[#FAF9F5]">Message to {selected.client}</SheetTitle>
                  <SheetDescription className="text-sm text-[#C9C6BC]">
                    {selected.kind === "payment" ? `Balance ${selected.amount} · ${selected.due}` : `${selected.type} · ${selected.appointment}`}
                  </SheetDescription>
                </div>
              </GlowPanel>
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-5 px-4 py-5 sm:px-6">
                  <div className="grid gap-1.5">
                    <label htmlFor="compose-to" className="px-1 text-[13px] font-medium">
                      To
                    </label>
                    <Input id="compose-to" type="email" value={toEmail} onChange={(e) => setToEmail(e.target.value)} placeholder="client@example.com" className="h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 shadow-none dark:bg-muted" />
                  </div>
                  <div className="grid gap-2">
                    <span className="px-1 text-[13px] font-medium">Start from a template</span>
                    <div className="flex flex-wrap gap-1.5">
                      {TEMPLATES.map((t) => (
                        <button key={t} type="button" onClick={() => applyTemplate(t)} className="h-9 rounded-full px-3.5 text-[13px] ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="compose-subject" className="px-1 text-[13px] font-medium">
                      Subject
                    </label>
                    <Input id="compose-subject" value={subject} onChange={(e) => setSubject(e.target.value)} className="h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 shadow-none dark:bg-muted" />
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor="compose-body" className="px-1 text-[13px] font-medium">
                      Message
                    </label>
                    <Textarea id="compose-body" value={body} onChange={(e) => setBody(e.target.value)} className="min-h-[260px] resize-y rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-sm leading-relaxed shadow-none dark:bg-muted" />
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 px-4 py-4 sm:px-6">
                <span className="text-[13px] text-muted-foreground">You&apos;ll confirm before it sends.</span>
                <button type="button" onClick={requestComposeSend} className="flex h-11 items-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground">
                  <Send aria-hidden="true" className="size-4" />
                  Review &amp; send
                </button>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Send confirmation — no email leaves without an explicit second click */}
      <Dialog open={pendingSend !== null} onOpenChange={(open) => !open && !sending && setPendingSend(null)}>
        <DialogContent className="rounded-[24px] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{pendingSend?.title}</DialogTitle>
            <DialogDescription>This emails the recipient immediately and can&apos;t be undone.</DialogDescription>
          </DialogHeader>
          <dl className="grid gap-2 rounded-2xl bg-[#F7F6F1] p-4 text-sm dark:bg-muted/50">
            <div className="flex gap-3">
              <dt className="w-16 shrink-0 text-muted-foreground">To</dt>
              <dd className="min-w-0 font-medium break-all">{pendingSend?.recipient}</dd>
            </div>
            {pendingSend?.subject ? (
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-muted-foreground">Subject</dt>
                <dd className="min-w-0">{pendingSend.subject}</dd>
              </div>
            ) : null}
          </dl>
          <DialogFooter>
            <button type="button" disabled={sending} onClick={() => setPendingSend(null)} className="h-10 rounded-full px-4 text-sm font-medium transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted">
              Cancel
            </button>
            <button type="button" disabled={sending} onClick={() => void confirmAndSend()} className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-60 dark:bg-secondary dark:text-secondary-foreground">
              {sending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Send aria-hidden="true" className="size-4" />}
              {sending ? "Sending…" : "Send email"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr className="border-b border-border/50 text-[13px] text-muted-foreground">
        {columns.map((c) => (
          <th key={c} className="px-6 pt-5 pb-3 font-medium">
            {c}
          </th>
        ))}
        <th className="relative px-6 pt-5 pb-3 text-right font-medium">Actions</th>
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
}: {
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  onClick: () => void;
  primary?: boolean;
  iconOnly?: boolean;
  disabled?: boolean;
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
        !iconOnly && (primary ? "bg-[#30302E] text-[#FAF9F5] hover:bg-[#1F1F1D] dark:bg-secondary dark:text-secondary-foreground" : "ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"),
      )}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {iconOnly ? null : label}
    </button>
  );
}

function EmailCell({ email, compact }: { email?: string; compact?: boolean }) {
  if (!email || /@import\.local$/i.test(email)) {
    return <span className={cn("inline-flex items-center gap-1.5 text-[#8A5A12] dark:text-amber-300", compact ? "text-[13px]" : "text-sm")}>No email on file</span>;
  }
  return <span className={cn("block truncate text-muted-foreground", compact ? "text-[13px]" : "text-sm")}>{email}</span>;
}

function UrgencyChip({ status }: { status: PaymentReminderItem["status"] }) {
  const style =
    status === "Overdue"
      ? "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300"
      : status === "Upcoming"
        ? "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200"
        : "bg-[#F8EEDB] text-[#8A5A12] dark:bg-amber-950 dark:text-amber-300";
  const dot = status === "Overdue" ? "bg-[#B94A3E]" : status === "Upcoming" ? "bg-[#7C6BD6]" : "bg-[#E2B35A]";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium", style)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", dot)} />
      {status}
    </span>
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

function EmptyRow({ cols, title, hint, href, linkLabel }: { cols: number; title: string; hint: string; href: string; linkLabel: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-6 py-14 text-center">
        <p className="text-[15px] font-medium">{title}</p>
        <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">{hint}</p>
        <Link href={href as "/dashboard/payments"} className="mt-2 inline-block text-sm text-[oklch(0.45_0.12_39)] hover:underline dark:text-primary">
          {linkLabel}
        </Link>
      </td>
    </tr>
  );
}
