"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ListChecks, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useClientDetail } from "@/components/dashboard/client-detail-context";
import { SessionQuestionsPanel } from "@/components/dashboard/session-questions-panel";
import { fetchExamByAppointment, formatAppointmentCode, type ExamRecord } from "@/lib/exam-documentation";

export default function SessionQuestionsPage() {
  const params = useParams();
  const clientId = Number(params.id);
  const appointmentId = Number(params.appointmentId);
  const { appointments } = useClientDetail();

  const appointment = appointments.find((a) => a.id === appointmentId) ?? null;

  const [exam, setExam] = React.useState<ExamRecord | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!Number.isFinite(appointmentId)) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchExamByAppointment(appointmentId);
        if (!cancelled) setExam(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Failed to load the session");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appointmentId]);

  if (!Number.isFinite(clientId) || !Number.isFinite(appointmentId)) {
    return <p className="py-12 text-center text-destructive">Invalid session link.</p>;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
        Loading questions...
      </div>
    );
  }

  const started = Boolean(exam);

  return (
    <Card className="border-border/50 shadow-sm">
      <CardHeader className="bg-muted/30 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-primary" />
          Questions for {formatAppointmentCode(appointmentId)}
        </CardTitle>
        <CardDescription className="text-sm">
          {started
            ? "This session has started, so these are its own record — edits here affect only this session."
            : "Prepare what you'll ask. These are copied into the session when you start documentation, so later Question Library edits never change them."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <SessionQuestionsPanel
          appointmentId={appointmentId}
          examId={exam?.id}
          examTypeId={exam?.exam_type?.id ?? appointment?.exam_type_id ?? null}
          showResponses={started}
        />
        {started ? (
          <div className="mt-6 flex justify-end">
            <Button variant="outline" render={<Link href={`/dashboard/clients/${clientId}/exams/${appointmentId}`} />}>
              Back to documentation
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
