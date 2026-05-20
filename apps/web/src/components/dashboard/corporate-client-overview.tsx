"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Activity,
  Building2,
  ChevronRight,
  Clock,
  Loader2,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { fetchClientExaminees, type ExamineeRosterEntry } from "@/lib/clients";
import { formatSubjectCode, formatSubjectName } from "@/lib/subjects";

function toRelativeTime(iso?: string): string {
  if (!iso) return "Unknown";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days < 1) return "Today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function CorporateClientOverview() {
  const { client, appointments, loading } = useClientDetail();
  const [roster, setRoster] = React.useState<ExamineeRosterEntry[]>([]);
  const [rosterLoading, setRosterLoading] = React.useState(true);

  React.useEffect(() => {
    if (!client) return;
    let cancelled = false;
    setRosterLoading(true);
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
    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  if (loading || !client) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        Loading account...
      </div>
    );
  }

  const completed = appointments.filter((a) => a.status.toLowerCase() === "completed");
  const totalMinutes = appointments.reduce((sum, a) => sum + (a.duration || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMins = totalMinutes % 60;
  const previewRoster = roster.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="h-5 w-5 text-primary" />
            <h2 className="text-2xl font-bold tracking-tight">Account overview</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            {client.name} — billing and scheduling account. Examinee records and test results live
            under each person in the roster.
          </p>
          {client.contact_person && (
            <p className="text-xs text-muted-foreground mt-2">
              Contact: <span className="font-medium text-foreground">{client.contact_person}</span>
            </p>
          )}
        </div>
        <Badge variant="outline" className="w-fit bg-primary/5 text-primary border-primary/20">
          {client.client_type}
        </Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              Examinees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{roster.length}</div>
            <p className="text-xs text-muted-foreground">On roster or with sessions</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Activity className="h-4 w-4" />
              Sessions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{appointments.length}</div>
            <p className="text-xs text-muted-foreground">
              {completed.length} completed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              Clinic time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalHours > 0 ? `${totalHours}h ` : ""}
              {remainingMins}m
            </div>
            <p className="text-xs text-muted-foreground">All examinees combined</p>
          </CardContent>
        </Card>
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Billing
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              render={<Link href={`/dashboard/clients/${client.id}/account`} />}
            >
              Open account
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Examinee roster</CardTitle>
            <CardDescription>
              Each person tested under this account has their own profile, exams, and biometrics.
            </CardDescription>
          </div>
          <Button size="sm" render={<Link href={`/dashboard/clients/${client.id}/roster`} />}>
            Manage roster
          </Button>
        </CardHeader>
        <CardContent>
          {rosterLoading ? (
            <div className="flex justify-center py-8 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : previewRoster.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">No examinees yet.</p>
              <Button render={<Link href={`/dashboard/clients/${client.id}/roster`} />}>
                Add first examinee
              </Button>
            </div>
          ) : (
            <ul className="divide-y divide-border/50">
              {previewRoster.map((entry) => (
                <li key={entry.subject.id}>
                  <Link
                    href={`/dashboard/clients/${client.id}/examinees/${entry.subject.id}`}
                    className="flex items-center justify-between py-3 hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{formatSubjectName(entry.subject)}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {formatSubjectCode(entry.subject.id)} · {entry.session_count} session
                        {entry.session_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Last account activity: {toRelativeTime(client.updated_at)}
      </p>
    </div>
  );
}
