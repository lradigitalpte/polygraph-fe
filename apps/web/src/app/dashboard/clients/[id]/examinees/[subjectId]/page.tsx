"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubjectDetail } from "@/components/dashboard/subject-detail-context";
import { formatAppointmentCode } from "@/lib/exam-documentation";
import {
  Activity,
  AlertTriangle,
  Clock,
  FileText,
  Languages,
  Loader2,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Copy,
} from "lucide-react";
import { fetchSecureShares, type SecureReportShare } from "@/lib/reports";
import { formatClinicDateLabel } from "@/lib/clinic-time";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ExamineeOverviewPage() {
  const { clientId, subject, appointments, loading, error } = useSubjectDetail();

  const [shares, setShares] = React.useState<SecureReportShare[]>([]);
  const [sharesLoading, setSharesLoading] = React.useState(true);
  const [revealedPasswords, setRevealedPasswords] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (!subject?.id) return;
    setSharesLoading(true);
    fetchSecureShares({ subject_id: subject.id })
      .then((data) => {
        setShares(data);
      })
      .catch((err) => {
        toast.error("Failed to load secure reports history");
      })
      .finally(() => {
        setSharesLoading(false);
      });
  }, [subject?.id]);

  const handleCopyLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const secureLink = `${origin}/shared/report/${token}`;
    navigator.clipboard.writeText(secureLink);
    toast.success("Secure link copied to clipboard");
  };

  const togglePasswordReveal = (id: number) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

      <Card className={subject.interpreter_required ? "border-amber-500/40 bg-amber-500/5" : undefined}>
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-4">
          <div className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">English proficiency:</span>
            <Badge variant="outline" className="font-medium">
              {subject.english_proficiency || "Not assessed"}
            </Badge>
          </div>
          {subject.interpreter_required && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700">
              <AlertTriangle className="h-4 w-4" />
              Interpreter required
            </span>
          )}
        </CardContent>
      </Card>

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

      <div className="grid gap-6 md:grid-cols-2">
        {/* Recent Sessions */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base">Recent sessions</CardTitle>
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
                        {formatClinicDateLabel(appt.scheduled_at)} · {appt.status}
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

        {/* Secure Reports Sharing Log */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              Secure Shared Reports
            </CardTitle>
            <CardDescription>Secure PDF reports shared for this examinee.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sharesLoading ? (
              <div className="flex justify-center py-6 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 italic">
                No reports shared yet.
              </p>
            ) : (
              <div className="space-y-3">
                {shares.map((share) => {
                  const isExpired = new Date(share.expires_at).getTime() < Date.now();
                  return (
                    <div
                      key={share.id}
                      className="p-3.5 rounded-xl border border-border bg-muted/20 flex flex-col gap-2.5"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate text-foreground/90">
                            Sent to: {share.recipient_email}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Link: {isExpired ? "Expired" : "Active"} · {new Date(share.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg"
                          onClick={() => handleCopyLink(share.token)}
                          title="Copy Link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between bg-background border rounded-lg p-2 text-xs">
                        <span className="text-muted-foreground font-medium">PIN:</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold tracking-wider">
                            {revealedPasswords[share.id] ? (share.password || "—") : "••••••"}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 rounded"
                            onClick={() => togglePasswordReveal(share.id)}
                          >
                            {revealedPasswords[share.id] ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
