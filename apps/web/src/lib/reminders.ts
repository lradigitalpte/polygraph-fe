import { fetchBillingLedger, type AccountLedgerEntry } from "@/lib/billing";
import { fetchPendingFormRequests, type FormRequestRecord } from "@/lib/forms";
import { sendAppointmentPaymentReminder, formatMoney } from "@/lib/client-account";
import { fetchAppointments, type AppointmentRecord } from "@/lib/exam-booking";

export type ReminderUrgency = "Overdue" | "Pending" | "Upcoming";

export type PaymentReminderItem = {
  id: string;
  appointmentId: number;
  client: string;
  email?: string;
  amount: string;
  balance: number;
  due: string;
  status: ReminderUrgency;
  sessionDate: string;
  title: string;
};

export type SessionReminderItem = {
  id: string;
  appointmentId: number;
  clientId: number;
  client: string;
  email?: string;
  type: string;
  appointment: string;
  status: "Ready" | "Queued" | "Sent";
  scheduledAt: string;
};

const SENT_STORAGE_KEY = "polygraph-reminders-sent";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function getSentReminderIdsToday(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SENT_STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as { date: string; ids: string[] };
    if (parsed.date !== todayKey()) return new Set();
    return new Set(parsed.ids);
  } catch {
    return new Set();
  }
}

export function markReminderSent(id: string) {
  const existing = getSentReminderIdsToday();
  existing.add(id);
  localStorage.setItem(
    SENT_STORAGE_KEY,
    JSON.stringify({ date: todayKey(), ids: [...existing] })
  );
}

export function formatDueWindow(sessionDateISO: string): { label: string; status: ReminderUrgency } {
  const target = new Date(sessionDateISO);
  const now = new Date();
  const ms = target.getTime() - now.getTime();

  if (Number.isNaN(target.getTime())) {
    return { label: "Date unknown", status: "Pending" };
  }

  if (ms < 0) {
    const absHours = Math.abs(ms) / 3600000;
    const absDays = Math.abs(ms) / 86400000;
    if (absDays >= 1) {
      const days = Math.floor(absDays);
      return { label: `${days} day${days === 1 ? "" : "s"} ago`, status: "Overdue" };
    }
    const hours = Math.max(1, Math.floor(absHours));
    return { label: `${hours} hour${hours === 1 ? "" : "s"} ago`, status: "Overdue" };
  }

  const hours = ms / 3600000;
  const days = ms / 86400000;

  if (hours <= 24) {
    if (hours < 1) {
      const mins = Math.max(1, Math.round(ms / 60000));
      return { label: `In ${mins} min`, status: "Upcoming" };
    }
    const h = Math.round(hours);
    return { label: `In ${h} hour${h === 1 ? "" : "s"}`, status: "Upcoming" };
  }

  if (days <= 3) {
    const d = Math.ceil(days);
    return { label: `In ${d} day${d === 1 ? "" : "s"}`, status: "Upcoming" };
  }

  return {
    label: target.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    status: "Pending",
  };
}

function titleFromNotes(notes?: string) {
  return (notes || "").split("\n")[0]?.trim() || "Polygraph session";
}

export function buildPaymentReminders(entries: AccountLedgerEntry[]): PaymentReminderItem[] {
  return entries
    .filter((e) => e.balance_due > 0.009 && e.appointment_id)
    .map((e) => {
      const { label, status } = formatDueWindow(e.date);
      return {
        id: e.code,
        appointmentId: e.appointment_id!,
        client: e.client_name || `Client #${e.client_id}`,
        email: e.client_email,
        amount: formatMoney(e.balance_due),
        balance: e.balance_due,
        due: label,
        status,
        sessionDate: e.date,
        title: e.title,
      };
    })
    .sort((a, b) => {
      const order = { Overdue: 0, Upcoming: 1, Pending: 2 };
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime();
    });
}

export function buildSessionReminders(
  appointments: AppointmentRecord[],
  sentToday: Set<string>
): SessionReminderItem[] {
  const now = Date.now();
  const weekMs = 7 * 86400000;

  return appointments
    .filter((a) => {
      const status = (a.status || "").toLowerCase();
      return status !== "cancelled";
    })
    .map((a) => {
      const scheduled = new Date(a.scheduled_at);
      const ms = scheduled.getTime() - now;
      const statusLower = (a.status || "").toLowerCase();
      const code = `APT-${String(a.id).padStart(4, "0")}`;

      let type = "Session reminder";
      if (statusLower === "completed") {
        type = "Follow-up report";
      } else if (ms > 0 && ms <= 3 * 86400000) {
        type = "Confirm schedule";
      } else if (ms > 0 && ms <= weekMs) {
        type = "Prep instructions";
      } else if (ms > weekMs) {
        type = "Upcoming session";
      }

      const appointmentLabel = Number.isNaN(scheduled.getTime())
        ? "TBD"
        : statusLower === "completed"
          ? "Completed"
          : scheduled.toLocaleString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

      let cardStatus: SessionReminderItem["status"] = "Queued";
      if (sentToday.has(code)) {
        cardStatus = "Sent";
      } else if (statusLower === "completed" || (ms > 0 && ms <= weekMs)) {
        cardStatus = "Ready";
      }

      return {
        id: code,
        appointmentId: a.id,
        clientId: a.client_id,
        client: a.client?.name || `Client #${a.client_id}`,
        email: a.client?.email,
        type,
        appointment: appointmentLabel,
        status: cardStatus,
        scheduledAt: a.scheduled_at,
      };
    })
    .filter((item) => {
      const scheduled = new Date(item.scheduledAt).getTime();
      const isFuture = scheduled >= now - 86400000;
      const isRecentComplete =
        item.type === "Follow-up report" && scheduled >= now - 14 * 86400000;
      return isFuture || isRecentComplete;
    })
    .sort(
      (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
    .slice(0, 24);
}

export type FormReminderItem = {
  id: string;
  requestId: number;
  clientId: number;
  subjectId?: number;
  client: string;
  email: string;
  formName: string;
  due: string;
  status: "Pending" | "Opened";
  expiresAt: string;
};

export function buildFormReminders(requests: FormRequestRecord[]): FormReminderItem[] {
  return requests.map((r) => {
    const sent = new Date(r.sent_at);
    const days = Math.floor((Date.now() - sent.getTime()) / 86400000);
    const due =
      days === 0 ? "Sent today" : days === 1 ? "Sent 1 day ago" : `Sent ${days} days ago`;
    return {
      id: `FRM-${String(r.id).padStart(4, "0")}`,
      requestId: r.id,
      clientId: r.client_id,
      subjectId: r.subject_id,
      client: r.recipient_name || r.recipient_email,
      email: r.recipient_email,
      formName: r.template?.name ?? "Form",
      due,
      status: r.status === "opened" ? "Opened" : "Pending",
      expiresAt: r.expires_at,
    };
  });
}

export async function loadRemindersData() {
  const [{ entries }, appointments, pendingForms] = await Promise.all([
    fetchBillingLedger(),
    fetchAppointments(),
    fetchPendingFormRequests().catch(() => [] as FormRequestRecord[]),
  ]);
  const sentToday = getSentReminderIdsToday();
  return {
    paymentReminders: buildPaymentReminders(entries),
    sessionReminders: buildSessionReminders(appointments, sentToday),
    formReminders: buildFormReminders(pendingForms),
    sentToday,
  };
}

export function paymentReminderTemplate(item: PaymentReminderItem) {
  return {
    subject: `Payment reminder — ${item.id}`,
    body: `Hello,\n\nThis is a reminder regarding your scheduled polygraph session (${item.id} — ${item.title}).\n\nBalance due: ${item.amount}\n\nPlease contact us to arrange payment before your appointment.\n\nThank you,\nPolygraph Forensic System`,
  };
}

export function sessionReminderTemplate(item: SessionReminderItem) {
  const lines: Record<string, string> = {
    "Prep instructions": `Hello,\n\nYour polygraph session (${item.id}) is coming up on ${item.appointment}.\n\nPlease arrive 15 minutes early, bring valid ID, and avoid caffeine for 4 hours before the exam.\n\nThank you,\nPolygraph Forensic System`,
    "Confirm schedule": `Hello,\n\nPlease confirm your attendance for your polygraph session on ${item.appointment} (${item.id}).\n\nReply to this email or contact our office if you need to reschedule.\n\nThank you,\nPolygraph Forensic System`,
    "Follow-up report": `Hello,\n\nYour session (${item.id}) is complete. We will share your report through secure channels when it is finalized.\n\nContact us if you have any questions.\n\nThank you,\nPolygraph Forensic System`,
  };
  const body =
    lines[item.type] ||
    `Hello,\n\nThis is a reminder about your polygraph session (${item.id}) scheduled for ${item.appointment}.\n\nThank you,\nPolygraph Forensic System`;
  return {
    subject: `${item.type} — ${item.id}`,
    body,
  };
}

export async function dispatchAppointmentReminder(
  appointmentId: number,
  input: { to_email?: string; subject: string; body: string },
  trackingId: string
) {
  await sendAppointmentPaymentReminder(appointmentId, input);
  markReminderSent(trackingId);
}
