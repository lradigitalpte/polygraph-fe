"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  formRequestStatusLabel,
  formatFormDate,
  parseTemplateSchema,
  resendFormRequest,
  type FormField,
  type FormRequestRecord,
} from "@/lib/forms";
import { cn } from "@/lib/utils";
import { Eye, Loader2, RefreshCcw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

// Build an ordered [label, value] list for a completed request's submission,
// using the template schema for labels/order and falling back to raw keys.
function buildAnswerRows(req: FormRequestRecord): { label: string; value: string }[] {
  let data: Record<string, unknown> = {};
  try {
    data = req.submitted_data ? (JSON.parse(req.submitted_data) as Record<string, unknown>) : {};
  } catch {
    data = {};
  }

  const fmt = (v: unknown): string => {
    if (v === true) return "Yes";
    if (v === false) return "No";
    if (v === null || v === undefined || v === "") return "—";
    return String(v);
  };

  const fields: FormField[] = req.template ? parseTemplateSchema(req.template).fields : [];
  if (fields.length > 0) {
    return fields.map((f) => ({ label: f.label, value: fmt(data[f.key]) }));
  }
  return Object.entries(data).map(([k, v]) => ({ label: k, value: fmt(v) }));
}

export function FormRequestsPanel({
  requests,
  loading,
  onRefresh,
}: {
  requests: FormRequestRecord[];
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const [resendingId, setResendingId] = React.useState<number | null>(null);
  const [viewing, setViewing] = React.useState<FormRequestRecord | null>(null);

  const pending = requests.filter((r) => r.status === "sent" || r.status === "opened");

  const handleResend = async (id: number) => {
    setResendingId(id);
    try {
      await resendFormRequest(id);
      toast.success("Reminder email sent");
      onRefresh?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
          <CardTitle className="text-base">Form link status</CardTitle>
          <CardDescription>
            Awaiting = email sent, client has not submitted yet. Completed = answers are in the
            Received tab.
          </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No forms sent yet. Use &quot;Send form link&quot; to email consent, privacy, or intake
            forms.
          </p>
        ) : (
          requests.map((req) => (
            <div
              key={req.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold truncate">
                  {req.template?.name ?? `Form #${req.template_id}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {req.recipient_email} · sent {formatFormDate(req.sent_at)}
                </p>
                {req.status === "completed" && req.completed_at && (
                  <p
                    className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"
                    title={`Signed off ${formatFormDate(req.completed_at)}`}
                  >
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Signed off {formatFormDate(req.completed_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    req.status === "completed" && "border-emerald-500/30 text-emerald-700",
                    (req.status === "sent" || req.status === "opened") &&
                      "border-amber-500/30 text-amber-700"
                  )}
                >
                  {formRequestStatusLabel(req.status)}
                </Badge>
                {(req.status === "sent" || req.status === "opened") && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={resendingId === req.id}
                    onClick={() => void handleResend(req.id)}
                  >
                    {resendingId === req.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCcw className="h-3 w-3 mr-1" />
                    )}
                    Remind
                  </Button>
                )}
                {req.status === "completed" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setViewing(req)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
        {pending.length > 0 && (
          <p className="text-xs text-muted-foreground pt-1">
            {pending.length} form{pending.length === 1 ? "" : "s"} still awaiting completion.
          </p>
        )}
      </CardContent>

      {/* Submitted answers dialog */}
      <Dialog open={viewing !== null} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{viewing?.template?.name ?? "Submitted form"}</DialogTitle>
            <DialogDescription>
              {viewing?.recipient_email}
              {viewing?.completed_at
                ? ` · completed ${formatFormDate(viewing.completed_at)}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {viewing && (
            <dl className="divide-y divide-border text-sm">
              {buildAnswerRows(viewing).map((row, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.2fr] gap-3 py-2">
                  <dt className="text-muted-foreground">{row.label}</dt>
                  <dd className="font-medium wrap-break-word">{row.value}</dd>
                </div>
              ))}
              {buildAnswerRows(viewing).length === 0 && (
                <p className="py-4 text-center text-muted-foreground">
                  No submitted data is available for this form.
                </p>
              )}
            </dl>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
