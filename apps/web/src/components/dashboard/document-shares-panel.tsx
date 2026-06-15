"use client";

import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  resendDocumentShare,
  shareStatusLabel,
  type DocumentShareRecord,
} from "@/lib/document-shares";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, RefreshCcw, Send } from "lucide-react";
import { toast } from "sonner";

function formatDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function DocumentSharesPanel({
  shares,
  loading,
  onRefresh,
}: {
  shares: DocumentShareRecord[];
  loading?: boolean;
  onRefresh?: () => void;
}) {
  const [resendingId, setResendingId] = React.useState<number | null>(null);

  const handleResend = async (id: number) => {
    setResendingId(id);
    try {
      await resendDocumentShare(id);
      toast.success("Document link re-sent");
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
        <CardTitle className="text-base">Sent to client</CardTitle>
        <CardDescription>
          Sent = email delivered with the link. Viewed = the client opened the document.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : shares.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No documents sent yet. Use <strong>Send to client</strong> on any uploaded file.
          </p>
        ) : (
          shares.map((share) => (
            <div
              key={share.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border border-border"
            >
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold truncate">{share.name}</p>
                <p className="text-xs text-muted-foreground">
                  {share.recipient_email} · sent {formatDate(share.sent_at)}
                </p>
                {share.status === "viewed" && share.viewed_at && (
                  <p className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Viewed {formatDate(share.viewed_at)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className={cn(
                    share.status === "viewed" && "border-emerald-500/30 text-emerald-700",
                    share.status === "sent" && "border-amber-500/30 text-amber-700"
                  )}
                >
                  {shareStatusLabel(share.status)}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={resendingId === share.id}
                  onClick={() => void handleResend(share.id)}
                >
                  {resendingId === share.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3 w-3 mr-1" />
                  )}
                  Resend
                </Button>
              </div>
            </div>
          ))
        )}
        {shares.length > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground pt-1">
            <Send className="h-3 w-3" />
            {shares.length} document{shares.length === 1 ? "" : "s"} shared.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
