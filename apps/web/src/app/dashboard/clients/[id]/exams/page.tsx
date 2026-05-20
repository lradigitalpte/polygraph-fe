"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentDetailSheet } from "@/components/dashboard/appointment-detail-sheet";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { isOrganizationClient } from "@/lib/client-types";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import type { AppointmentRecord } from "@/lib/exam-booking";
import {
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  FileText,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

function statusVariant(status: string): "default" | "secondary" | "outline" | "destructive" {
  const normalized = status.toLowerCase();
  if (normalized === "completed") return "default";
  if (normalized === "confirmed") return "secondary";
  if (normalized === "cancelled") return "destructive";
  return "outline";
}

function AppointmentRow({
  appointment,
  clientId,
  onSelect,
}: {
  appointment: AppointmentRecord;
  clientId: number;
  onSelect: () => void;
}) {
  const docHref = `/dashboard/clients/${clientId}/exams/${appointment.id}`;
  const hasDoc = Boolean(appointment.exam_id);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-border",
        "hover:bg-muted/50 hover:border-primary/20 transition-all group cursor-pointer"
      )}
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-11 w-11 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <FileText className="h-5 w-5" />
        </div>
        <div className="space-y-1.5 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold">{formatAppointmentCode(appointment.id)}</span>
            {hasDoc && (
              <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
                Documented
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {formatDateTime(appointment.scheduled_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDuration(appointment.duration)}
            </span>
            {appointment.exam_fee != null && appointment.exam_fee > 0 && (
              <span className="inline-flex items-center gap-1">
                <CreditCard className="h-3 w-3" />
                ${appointment.exam_fee.toFixed(2)}
              </span>
            )}
          </div>
          {appointment.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{appointment.notes}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-center sm:self-auto">
        <div className="flex flex-wrap gap-1.5 justify-end">
          <Badge variant={statusVariant(appointment.status)} className="capitalize">
            {appointment.status}
          </Badge>
          {appointment.payment_status && (
            <Badge variant="outline">{appointment.payment_status}</Badge>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="hidden sm:inline-flex text-xs h-8"
            render={
              <Link href={docHref} onClick={(e) => e.stopPropagation()} />
            }
          >
            {hasDoc ? "Open" : "Document"}
          </Button>
          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
        </div>
      </div>
    </button>
  );
}

export default function ClientExamHistoryPage() {
  const { client, appointments, loading, error, refresh } = useClientDetail();
  const [selected, setSelected] = React.useState<AppointmentRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  const openAppointment = (appointment: AppointmentRecord) => {
    setSelected(appointment);
    setSheetOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading exam history...
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error || "Client record not found."}
      </div>
    );
  }

  const upcoming = appointments.filter((a) => {
    const when = new Date(a.scheduled_at).getTime();
    return when >= Date.now() && a.status.toLowerCase() !== "cancelled";
  });
  const documented = appointments.filter((a) => a.exam_id).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Exam History</h2>
          <p className="text-muted-foreground text-sm mt-1">
            {isOrganizationClient(client)
              ? `All sessions billed to ${client.name}. Open an examinee profile for per-person history.`
              : `Scheduled sessions for ${client.name}. Click a row to open documentation.`}
          </p>
        </div>
        <Button render={<Link href="/dashboard/calendar/book" />}>Schedule appointment</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{upcoming.length}</div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              With documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documented}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50">
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            Each appointment can hold booking notes, examination documentation, phase logs, and
            uploaded charts or reports.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No appointments scheduled yet for this client.
            </p>
          ) : (
            appointments.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                clientId={client.id}
                appointment={appointment}
                onSelect={() => openAppointment(appointment)}
              />
            ))
          )}
        </CardContent>
      </Card>

      <AppointmentDetailSheet
        clientId={client.id}
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => void refresh()}
      />
    </div>
  );
}
