"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Clock,
  CreditCard,
  FileText,
  Loader2,
  User,
  ClipboardList,
  ArrowRight,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import type { AppointmentRecord } from "@/lib/exam-booking";
import {
  fetchExamByAppointment,
  formatAppointmentCode,
  updateAppointment,
} from "@/lib/exam-documentation";
import { fetchExaminers, type UserRecord } from "@/lib/users";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

const APPOINTMENT_STATUSES = ["pending", "confirmed", "completed", "cancelled"] as const;

type Props = {
  clientId: number;
  appointment: AppointmentRecord | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
};

export function AppointmentDetailSheet({
  clientId,
  appointment,
  open,
  onOpenChange,
  onUpdated,
}: Props) {
  const router = useRouter();
  const [detail, setDetail] = React.useState<AppointmentRecord | null>(null);
  const [hasExamRecord, setHasExamRecord] = React.useState(false);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [schedulingNotes, setSchedulingNotes] = React.useState("");
  const [appointmentStatus, setAppointmentStatus] = React.useState("pending");
  const [savingScheduling, setSavingScheduling] = React.useState(false);

  const load = React.useCallback(async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      const [examData, examinerList] = await Promise.all([
        fetchExamByAppointment(appointment.id),
        fetchExaminers(),
      ]);
      setDetail(appointment);
      setHasExamRecord(Boolean(examData));
      setExaminers(examinerList);
      setSchedulingNotes(appointment.notes ?? "");
      setAppointmentStatus(appointment.status ?? "pending");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load appointment");
    } finally {
      setLoading(false);
    }
  }, [appointment]);

  React.useEffect(() => {
    if (open && appointment) {
      void load();
    }
  }, [open, appointment, load]);

  const examinerName =
    examiners.find((e) => e.id === detail?.examiner_id)?.name ??
    (detail?.examiner_id ? `Examiner #${detail.examiner_id}` : "—");

  const documentationHref = detail
    ? `/dashboard/clients/${clientId}/exams/${detail.id}`
    : "#";

  const handleSaveScheduling = async () => {
    if (!detail) return;
    setSavingScheduling(true);
    try {
      const updated = await updateAppointment(detail.id, {
        notes: schedulingNotes,
        status: appointmentStatus,
      });
      setDetail(updated);
      toast.success("Scheduling details saved");
      onUpdated?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSavingScheduling(false);
    }
  };

  const goToDocumentation = () => {
    if (!detail) return;
    onOpenChange(false);
    router.push(documentationHref);
  };

  const inputClass = "h-10 rounded-lg";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md overflow-hidden p-0 flex flex-col"
      >
        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center p-8 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading...
          </div>
        ) : (
          <>
            <SheetHeader className="p-6 pb-4 border-b border-border/50 text-left space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SheetTitle className="text-xl">
                  {formatAppointmentCode(detail.id)}
                </SheetTitle>
                <Badge variant="outline" className="capitalize">
                  {detail.status}
                </Badge>
                {detail.payment_status && (
                  <Badge variant="secondary">{detail.payment_status}</Badge>
                )}
              </div>
              <SheetDescription
                render={<div className="space-y-2 text-sm text-muted-foreground" />}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatDateTime(detail.scheduled_at)}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    {formatDuration(detail.duration)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3.5 w-3.5" />
                    {examinerName}
                  </span>
                  {detail.exam_fee != null && detail.exam_fee > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <CreditCard className="h-3.5 w-3.5" />
                      ${detail.exam_fee.toFixed(2)}
                    </span>
                  )}
                </div>
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <section className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    Session details
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Booking and scheduling only. Examination notes, phases, and file uploads
                    are on the documentation page.
                  </p>
                </div>

                <div className="rounded-lg bg-muted/30 border border-border/50 p-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Payment</span>
                    <span className="font-medium capitalize">
                      {detail.payment_status ?? "—"}
                      {detail.payment_mode ? ` · ${detail.payment_mode}` : ""}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Subject ID</span>
                    <span className="font-medium">#{detail.subject_id}</span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Appointment status
                  </Label>
                  <Select
                    value={appointmentStatus}
                    onValueChange={(v) => setAppointmentStatus(String(v))}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPOINTMENT_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.charAt(0).toUpperCase() + s.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Booking notes
                  </Label>
                  <Textarea
                    className="min-h-[88px] rounded-lg resize-none text-sm"
                    placeholder="Reason for exam, referral context..."
                    value={schedulingNotes}
                    onChange={(e) => setSchedulingNotes(e.target.value)}
                  />
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  disabled={savingScheduling}
                  onClick={handleSaveScheduling}
                  className="w-full"
                >
                  {savingScheduling && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                  Save scheduling
                </Button>
              </section>
            </div>

            <SheetFooter className="p-6 pt-4 border-t border-border/50">
              <Button onClick={goToDocumentation} className="w-full gap-2 h-11">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="flex-1 text-left">
                  {hasExamRecord ? "Open examination documentation" : "Start examination documentation"}
                </span>
                <ArrowRight className="h-4 w-4 shrink-0" />
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
