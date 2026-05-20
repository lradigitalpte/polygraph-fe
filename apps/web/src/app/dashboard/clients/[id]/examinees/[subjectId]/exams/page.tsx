"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AppointmentDetailSheet } from "@/components/dashboard/appointment-detail-sheet";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { formatSubjectName } from "@/lib/subjects";
import type { AppointmentRecord } from "@/lib/exam-booking";
import { Calendar, ChevronRight, Clock, FileText, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

function formatDateTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ExamineeExamHistoryPage() {
  const { clientId, subject, appointments, loading, error, refresh } = useSubjectDetail();
  const [selected, setSelected] = React.useState<AppointmentRecord | null>(null);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
      </div>
    );
  }

  if (error || !subject) {
    return <p className="text-destructive">{error || "Examinee not found"}</p>;
  }

  const name = formatSubjectName(subject);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Exam history</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Sessions for {name} only (under this account).
          </p>
        </div>
        <Button render={<Link href={`/dashboard/calendar/book?clientId=${clientId}&subjectId=${subject.id}`} />}>
          Book session
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>Click to view booking details or open examination documentation.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sessions yet.</p>
          ) : (
            appointments.map((appointment) => {
              const docHref = `/dashboard/clients/${clientId}/exams/${appointment.id}`;
              return (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    setSelected(appointment);
                    setSheetOpen(true);
                  }}
                  className={cn(
                    "w-full text-left flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border",
                    "hover:bg-muted/50 transition-all group"
                  )}
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-sm">{formatAppointmentCode(appointment.id)}</p>
                      <p className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(appointment.scheduled_at)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {appointment.duration}m
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {appointment.status}
                    </Badge>
                    <Link
                      href={docHref}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex h-8 items-center rounded-md border border-input bg-background px-3 text-xs font-medium hover:bg-muted"
                    >
                      Document
                    </Link>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              );
            })
          )}
        </CardContent>
      </Card>

      <AppointmentDetailSheet
        clientId={clientId}
        appointment={selected}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={() => void refresh()}
      />
    </div>
  );
}
