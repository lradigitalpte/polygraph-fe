"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Route } from "next";
import { CalendarClock, ChevronDown, ChevronRight, ExternalLink, ListChecks } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { formatClinicDateTime } from "@/lib/clinic-time";

export default function ClientSessionQuestionsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const { appointments, loading } = useClientDetail();
  const [expandedId, setExpandedId] = React.useState<number | null>(null);

  // Newest first — the sessions you are most likely preparing for.
  const sessions = React.useMemo(
    () =>
      [...appointments].sort(
        (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
      ),
    [appointments]
  );

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Session Questions</h3>
        <p className="text-sm text-muted-foreground">
          Prepare what you&apos;ll ask for each booking. Questions are copied into the session when
          documentation starts, so later Question Library edits never change a past session.
        </p>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading sessions...</CardContent>
        </Card>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No sessions booked for this client yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((appointment) => {
            const expanded = expandedId === appointment.id;
            const sessionHref = `/dashboard/clients/${clientId}/exams/${appointment.id}/questions`;
            return (
              <Card key={appointment.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      className="flex items-center gap-2 text-left"
                      onClick={() => setExpandedId(expanded ? null : appointment.id)}
                    >
                      {expanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div>
                        <CardTitle className="text-base">
                          {formatAppointmentCode(appointment.id)}
                          {appointment.subject
                            ? ` · ${appointment.subject.first_name} ${appointment.subject.last_name}`
                            : ""}
                        </CardTitle>
                        <CardDescription className="flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {formatClinicDateTime(appointment.scheduled_at) || appointment.scheduled_at}
                        </CardDescription>
                      </div>
                    </button>
                    <div className="flex items-center gap-2">
                      {appointment.questions_prepared ? (
                        <Badge variant="success" className="gap-1">
                          <ListChecks className="h-3.5 w-3.5" />
                          Questions prepared
                        </Badge>
                      ) : (
                        <Badge variant="outline">No questions yet</Badge>
                      )}
                      {appointment.exam_id ? <Badge variant="outline">Session started</Badge> : null}
                      <Button variant="ghost" size="icon" render={<Link href={sessionHref as Route} />}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {expanded ? (
                  <CardContent className="pt-2">
                    <SessionQuestionsPanel
                      appointmentId={appointment.id}
                      examId={appointment.exam_id}
                      examTypeId={appointment.exam_type_id ?? null}
                      showResponses={Boolean(appointment.exam_id)}
                    />
                  </CardContent>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
