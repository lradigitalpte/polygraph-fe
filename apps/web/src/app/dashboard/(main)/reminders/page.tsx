"use client";

import * as React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Bell,
  Mail,
  Send,
  Clock,
  CheckCircle2,
  Search,
  Wallet,
  Calendar,
  FileText,
  ClipboardList,
  RefreshCcw,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { toast } from "sonner";
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

type ComposeTarget =
  | (PaymentReminderItem & { kind: "payment" })
  | (SessionReminderItem & { kind: "session" });

export default function RemindersPage() {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [paymentReminders, setPaymentReminders] = React.useState<PaymentReminderItem[]>([]);
  const [sessionReminders, setSessionReminders] = React.useState<SessionReminderItem[]>([]);
  const [formReminders, setFormReminders] = React.useState<FormReminderItem[]>([]);
  const [sentCount, setSentCount] = React.useState(0);

  const [isComposeOpen, setIsComposeOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<ComposeTarget | null>(null);
  const [subject, setSubject] = React.useState("");
  const [body, setBody] = React.useState("");
  const [toEmail, setToEmail] = React.useState("");
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
      const message = err instanceof Error ? err.message : "Failed to load reminders";
      setError(message);
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

  const openCompose = (target: ComposeTarget | null) => {
    setSelected(target);
    if (target?.kind === "payment") {
      const tpl = paymentReminderTemplate(target);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setToEmail(target.email || "");
    } else if (target?.kind === "session") {
      const tpl = sessionReminderTemplate(target);
      setSubject(tpl.subject);
      setBody(tpl.body);
      setToEmail(target.email || "");
    } else {
      setSubject("");
      setBody("");
      setToEmail("");
    }
    setIsComposeOpen(true);
  };

  const applyTemplate = (name: string) => {
    if (!selected) return;
    if (name === "Payment Due" && selected.kind === "payment") {
      const tpl = paymentReminderTemplate(selected);
      setSubject(tpl.subject);
      setBody(tpl.body);
      return;
    }
    if (selected.kind === "session") {
      const map: Record<string, string> = {
        "Prep Guide": "Prep instructions",
        Confirmation: "Confirm schedule",
        "Result Followup": "Follow-up report",
      };
      const type = map[name];
      if (type) {
        const tpl = sessionReminderTemplate({ ...selected, type });
        setSubject(tpl.subject);
        setBody(tpl.body);
      }
    }
  };

  const handleSend = async () => {
    if (!selected?.appointmentId) {
      toast.error("Select a session from the list to send a tracked reminder");
      return;
    }
    if (!toEmail.trim() || !toEmail.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setSending(true);
    try {
      await dispatchAppointmentReminder(
        selected.appointmentId,
        {
          to_email: toEmail.trim(),
          subject: subject.trim(),
          body: body.trim(),
        },
        selected.id
      );
      toast.success("Reminder sent", {
        description: `Logged for ${selected.client}`,
      });
      setIsComposeOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const quickSendPayment = async (item: PaymentReminderItem) => {
    if (!item.email) {
      openCompose({ ...item, kind: "payment" });
      toast.message("Add recipient email before sending");
      return;
    }
    setSending(true);
    try {
      const tpl = paymentReminderTemplate(item);
      await dispatchAppointmentReminder(
        item.appointmentId,
        { to_email: item.email, subject: tpl.subject, body: tpl.body },
        item.id
      );
      toast.success(`Payment reminder sent to ${item.client}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const needle = search.trim().toLowerCase();
  const filterText = (client: string, id: string) =>
    !needle || client.toLowerCase().includes(needle) || id.toLowerCase().includes(needle);

  const filteredPayment = paymentReminders.filter((r) => filterText(r.client, r.id));
  const filteredSession = sessionReminders.filter((r) => filterText(r.client, r.id));
  const filteredForms = formReminders.filter((r) => filterText(r.client, r.id));
  const overduePayment = filteredPayment.filter((r) => r.status === "Overdue").length;

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tighter text-foreground flex items-center gap-3">
            <Bell className="h-8 w-8 text-primary" />
            Clinical Communications
          </h1>
          <p className="text-muted-foreground text-sm font-medium max-w-xl">
            Payment and session reminders from live bookings and billing. Sends email via your
            configured SMTP server.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <RefreshCcw className="mr-2 h-3 w-3" />
            )}
            Refresh
          </Button>
          <Button
            onClick={() => openCompose(null)}
            className="h-10 px-5 rounded-xl font-black text-[10px] uppercase tracking-widest"
          >
            <Plus className="mr-2 h-4 w-4" />
            Compose
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search client or reference..."
          className="pl-10 h-10 rounded-xl"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <div>
            <p>{error}</p>
            <Button variant="link" className="h-auto p-0 text-destructive" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        </div>
      )}

      <Tabs defaultValue="payment" className="space-y-6">
        <div className="flex items-center justify-between border-b border-border/50 pb-1 overflow-x-auto">
          <TabsList className="bg-transparent h-12 p-0 gap-8">
            <TabsTrigger
              value="payment"
              className="bg-transparent border-none p-0 h-12 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary font-black text-xs uppercase tracking-widest text-muted-foreground"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Payment Due ({filteredPayment.length})
            </TabsTrigger>
            <TabsTrigger
              value="forms"
              className="bg-transparent border-none p-0 h-12 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary font-black text-xs uppercase tracking-widest text-muted-foreground"
            >
              <ClipboardList className="mr-2 h-4 w-4" />
              Forms ({filteredForms.length})
            </TabsTrigger>
            <TabsTrigger
              value="general"
              className="bg-transparent border-none p-0 h-12 rounded-none data-[state=active]:bg-transparent data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary font-black text-xs uppercase tracking-widest text-muted-foreground"
            >
              <Calendar className="mr-2 h-4 w-4" />
              Sessions ({filteredSession.length})
            </TabsTrigger>
          </TabsList>

          <div className="hidden md:flex items-center gap-4 text-xs font-bold text-muted-foreground shrink-0">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              {sentCount} sent today
            </span>
            <span className="w-px h-3 bg-border/50" />
            <span className="flex items-center gap-1.5">
              <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
              {filteredForms.length} forms pending
            </span>
            <span className="w-px h-3 bg-border/50" />
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-amber-500" />
              {overduePayment} payments overdue
            </span>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading communications...
          </div>
        ) : (
          <>
            <TabsContent value="payment" className="space-y-4 outline-none">
              {filteredPayment.length === 0 ? (
                <EmptyState
                  title="No outstanding balances"
                  description="Unpaid or partial invoices from bookings will appear here."
                  href="/dashboard/payments"
                  linkLabel="Open Financial Hub"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredPayment.map((rem) => (
                    <Card
                      key={`${rem.id}-${rem.appointmentId}`}
                      className="border-border/50 bg-card/30 backdrop-blur-md overflow-hidden hover:border-primary/30 transition-all shadow-sm"
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1 min-w-0">
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter">
                              {rem.id}
                            </p>
                            <h3 className="text-lg font-black text-foreground leading-tight truncate">
                              {rem.client}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">{rem.title}</p>
                          </div>
                          <UrgencyBadge status={rem.status} />
                        </div>

                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3 mb-6">
                          <Row label="Outstanding" value={rem.amount} />
                          <Row label="Session" value={rem.due} />
                          {rem.email ? (
                            <Row label="Email" value={rem.email} />
                          ) : (
                            <p className="text-[10px] text-amber-600 font-semibold">No email on file</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            disabled={sending}
                            onClick={() => void quickSendPayment(rem)}
                          >
                            <Send className="mr-2 h-3.5 w-3.5" />
                            Send reminder
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl"
                            onClick={() => openCompose({ ...rem, kind: "payment" })}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="forms" className="space-y-4 outline-none">
              {filteredForms.length === 0 ? (
                <EmptyState
                  title="No forms awaiting completion"
                  description="Send consent, privacy, or intake forms from a client's Document Vault. Incomplete links appear here for reminders."
                  href="/dashboard/clients"
                  linkLabel="Go to clients"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredForms.map((rem) => (
                    <Card
                      key={rem.id}
                      className="border-border/50 bg-card/30 backdrop-blur-md overflow-hidden hover:border-primary/30 transition-all shadow-sm"
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1 min-w-0">
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter">
                              {rem.id}
                            </p>
                            <h3 className="text-lg font-black text-foreground leading-tight truncate">
                              {rem.client}
                            </h3>
                            <p className="text-xs text-muted-foreground truncate">{rem.formName}</p>
                          </div>
                          <Badge
                            className={cn(
                              "rounded-lg px-2 py-0.5 font-black uppercase tracking-widest text-[9px] shrink-0",
                              rem.status === "Opened"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                            )}
                          >
                            {rem.status}
                          </Badge>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3 mb-6">
                          <Row label="Sent" value={rem.due} />
                          <Row
                            label="Link expires"
                            value={formatFormExpires(rem.expiresAt)}
                          />
                          {rem.email ? (
                            <Row label="Email" value={rem.email} />
                          ) : (
                            <p className="text-[10px] text-amber-600 font-semibold">No email on file</p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            onClick={async () => {
                              try {
                                await resendFormRequest(rem.requestId);
                                toast.success("Form link resent");
                                await load();
                              } catch (err) {
                                toast.error(
                                  err instanceof Error ? err.message : "Failed to resend"
                                );
                              }
                            }}
                          >
                            <RefreshCcw className="mr-2 h-3.5 w-3.5" />
                            Resend link
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl"
                            render={
                              <Link
                                href={
                                  rem.subjectId
                                    ? `/dashboard/clients/${rem.clientId}/examinees/${rem.subjectId}/documents`
                                    : `/dashboard/clients/${rem.clientId}/documents`
                                }
                              />
                            }
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="general" className="space-y-4 outline-none">
              {filteredSession.length === 0 ? (
                <EmptyState
                  title="No upcoming sessions"
                  description="Book exams on the calendar to send prep and confirmation messages."
                  href="/dashboard/calendar/book"
                  linkLabel="Book new exam"
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredSession.map((rem) => (
                    <Card
                      key={`${rem.id}-${rem.appointmentId}`}
                      className="border-border/50 bg-card/30 backdrop-blur-md overflow-hidden hover:border-primary/30 transition-all shadow-sm"
                    >
                      <CardContent className="p-6">
                        <div className="flex justify-between items-start mb-6">
                          <div className="space-y-1 min-w-0">
                            <p className="text-[10px] font-black text-primary uppercase tracking-tighter">
                              {rem.id}
                            </p>
                            <h3 className="text-lg font-black text-foreground leading-tight truncate">
                              {rem.client}
                            </h3>
                          </div>
                          <Badge
                            className={cn(
                              "rounded-lg px-2 py-0.5 font-black uppercase tracking-widest text-[9px]",
                              rem.status === "Ready"
                                ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                : rem.status === "Queued"
                                  ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                  : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                            )}
                          >
                            {rem.status}
                          </Badge>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/20 border border-border/30 space-y-3 mb-6">
                          <Row label="Template" value={rem.type} />
                          <Row label="Schedule" value={rem.appointment} />
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="flex-1 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest"
                            onClick={() => openCompose({ ...rem, kind: "session" })}
                          >
                            <Send className="mr-2 h-3.5 w-3.5" />
                            Send reminder
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10 rounded-xl"
                            render={<Link href={`/dashboard/clients/${rem.clientId}/exams`} />}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </>
        )}
      </Tabs>

      <Sheet open={isComposeOpen} onOpenChange={setIsComposeOpen}>
        <SheetContent className="sm:max-w-xl border-l border-border/50 p-0 overflow-hidden">
          <div className="h-full flex flex-col">
            <SheetHeader className="p-6 border-b border-border/50 text-left space-y-2">
              <SheetTitle className="text-xl font-black">
                {selected ? `Message to ${selected.client}` : "Compose message"}
              </SheetTitle>
              <SheetDescription>
                {selected
                  ? `${selected.id} — uses appointment email API`
                  : "Pick a card from the list to link an appointment"}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Recipient email
                </label>
                <Input
                  type="email"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Template
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["Payment Due", "Prep Guide", "Confirmation", "Result Followup"].map((tmp) => (
                    <Button
                      key={tmp}
                      type="button"
                      variant="outline"
                      className="h-10 rounded-xl text-xs font-bold"
                      onClick={() => applyTemplate(tmp)}
                      disabled={!selected}
                    >
                      {tmp}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Subject
                </label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-11 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Message
                </label>
                <textarea
                  className="w-full min-h-[200px] p-4 rounded-xl bg-muted/20 border border-border/50 text-sm resize-none focus:outline-none focus:border-primary/50"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              </div>

              <Button
                className="w-full h-12 rounded-xl font-black text-xs uppercase tracking-widest"
                disabled={sending || !selected}
                onClick={() => void handleSend()}
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Dispatch email
              </Button>

              {!selected && (
                <p className="text-xs text-muted-foreground text-center">
                  Open compose from a payment or session card to attach an appointment.
                </p>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function formatFormExpires(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-[11px] font-bold gap-2">
      <span className="text-muted-foreground uppercase tracking-wider shrink-0">{label}</span>
      <span className="text-foreground text-right truncate">{value}</span>
    </div>
  );
}

function UrgencyBadge({ status }: { status: PaymentReminderItem["status"] }) {
  return (
    <Badge
      className={cn(
        "rounded-lg px-2 py-0.5 font-black uppercase tracking-widest text-[9px] shrink-0",
        status === "Overdue"
          ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
          : status === "Pending"
            ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
            : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      )}
    >
      {status}
    </Badge>
  );
}

function EmptyState({
  title,
  description,
  href,
  linkLabel,
}: {
  title: string;
  description: string;
  href: string;
  linkLabel: string;
}) {
  return (
    <Card className="border-dashed border-border/50">
      <CardContent className="py-16 text-center space-y-3">
        <p className="font-bold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">{description}</p>
        <Button variant="outline" render={<Link href={href as "/dashboard/payments"} />}>
          {linkLabel}
        </Button>
      </CardContent>
    </Card>
  );
}
