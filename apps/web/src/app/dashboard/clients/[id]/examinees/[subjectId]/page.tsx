"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import { Activity, Clock, FileText, Loader2 } from "lucide-react";

export default function ExamineeOverviewPage() {
  const { clientId, subject, appointments, loading, error } = useSubjectDetail();

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading examinee...
      </div>
    );
  }

  if (error || !subject) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
        {error || "Examinee not found."}
      </div>
    );
  }

  const completed = appointments.filter((a) => a.status.toLowerCase() === "completed");
  const totalMinutes = appointments.reduce((sum, a) => sum + (a.duration || 0), 0);
  const recent = appointments.slice(0, 3);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Examinee overview</h2>
        <p className="text-sm text-muted-foreground">
          Forensic record for this person under the account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              Completion
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {appointments.length > 0
                ? `${Math.round((completed.length / appointments.length) * 100)}%`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {completed.length} of {appointments.length} sessions done
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Total time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions</CardTitle>
          <CardDescription>Documentation and scheduling for this examinee only.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No sessions yet.</p>
          ) : (
            recent.map((appt) => (
              <div
                key={appt.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border"
              >
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-bold">{formatAppointmentCode(appt.id)}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(appt.scheduled_at).toLocaleDateString()} · {appt.status}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {appt.payment_status || "—"}
                </Badge>
              </div>
            ))
          )}
          <Button
            variant="outline"
            className="w-full"
            render={<Link href={`/dashboard/clients/${clientId}/examinees/${subject.id}/exams`} />}
          >
            View all sessions
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
