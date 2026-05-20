"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CorporateClientOverview } from "@/components/dashboard/corporate-client-overview";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { isOrganizationClient } from "@/lib/client-types";
import { 
  Activity, 
  Clock, 
  AlertCircle, 
  FileText,
  Loader2,
} from "lucide-react";

function toRelativeTime(iso?: string): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export default function ClientOverviewPage() {
  const { client, appointments, documents, loading, error } = useClientDetail();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading overview...
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

  if (isOrganizationClient(client)) {
    return <CorporateClientOverview />;
  }

  const completed = appointments.filter((a) => a.status.toLowerCase() === "completed");
  const totalMinutes = appointments.reduce((sum, a) => sum + (a.duration || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const recentAppointments = appointments.slice(0, 3);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Client Overview</h2>
          <p className="text-muted-foreground">Detailed record and forensic history for {client.name}.</p>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
          Last Activity: {toRelativeTime(client.updated_at)}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-primary/5 to-transparent border-primary/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Test Stability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {appointments.length > 0
                ? `${Math.round((completed.length / appointments.length) * 100)}%`
                : "—"}
            </div>
            <p className="text-xs text-muted-foreground">
              {completed.length} of {appointments.length} sessions completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Total Exam Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalHours > 0 ? `${totalHours}h ` : ""}
              {remainingMins}m
            </div>
            <p className="text-xs text-muted-foreground">
              Across {appointments.length} scheduled session{appointments.length === 1 ? "" : "s"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <AlertCircle className="h-4 w-4 text-warning" />
              Inconsistencies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{documents.length}</div>
            <p className="text-xs text-muted-foreground">Files and forms in vault</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Exams</CardTitle>
            <CardDescription>The most recent forensic evaluations for this subject.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No appointments yet.</p>
            ) : (
              recentAppointments.map((appointment) => (
                <div
                  key={appointment.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded bg-muted flex items-center justify-center">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="text-sm font-bold">
                        APT-{String(appointment.id).padStart(4, "0")}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(appointment.scheduled_at).toLocaleDateString()} • {appointment.status}
                      </div>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {appointment.payment_status || "—"}
                  </Badge>
                </div>
              ))
            )}
            <Button
              variant="outline"
              className="w-full text-xs"
              render={<Link href={`/dashboard/clients/${client.id}/exams`} />}
            >
              View Full History
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Biometric Baseline</CardTitle>
            <CardDescription>Standard physiological responses detected during rest.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[200px] flex items-end gap-2 px-2 py-4">
              {[40, 70, 45, 90, 65, 80, 50, 85, 60, 75].map((h, i) => (
                <div 
                  key={i} 
                  className="flex-1 bg-primary/20 rounded-t-sm transition-all hover:bg-primary/40 group relative"
                  style={{ height: `${h}%` }}
                >
                   <div className="absolute -top-6 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-bold bg-primary text-primary-foreground px-1 rounded">
                     {h}
                   </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-2 px-2">
              <span>HR</span>
              <span>GSR</span>
              <span>RESP</span>
              <span>BVP</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
