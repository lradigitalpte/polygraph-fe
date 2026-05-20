"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formRequestStatusLabel,
  formatFormDate,
  resendFormRequest,
  type FormRequestRecord,
} from "@/lib/forms";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

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
    </Card>
  );
}
