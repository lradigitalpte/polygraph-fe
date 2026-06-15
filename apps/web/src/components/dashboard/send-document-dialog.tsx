"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createDocumentShare } from "@/lib/document-shares";
import { FileText, Loader2, Send } from "lucide-react";
import { toast } from "sonner";

export type SendDocumentTarget = {
  documentId: number;
  documentName: string;
};

export function SendDocumentDialog({
  open,
  onOpenChange,
  scope,
  clientId,
  subjectId,
  target,
  defaultEmail,
  defaultName,
  onSent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scope: "client" | "subject";
  clientId: number;
  subjectId?: number;
  target: SendDocumentTarget | null;
  defaultEmail?: string;
  defaultName?: string;
  onSent?: () => void;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [sending, setSending] = React.useState(false);

  // Reset the recipient fields whenever a new document is targeted.
  React.useEffect(() => {
    if (open) {
      setEmail(defaultEmail ?? "");
      setName(defaultName ?? "");
    }
  }, [open, target?.documentId, defaultEmail, defaultName]);

  const handleSend = async () => {
    if (!target) return;
    if (!email.trim() || !email.includes("@")) {
      toast.error("Enter a valid recipient email");
      return;
    }
    setSending(true);
    try {
      await createDocumentShare({
        scope,
        client_id: clientId,
        subject_id: scope === "subject" ? subjectId : undefined,
        document_id: target.documentId,
        recipient_email: email.trim(),
        recipient_name: name.trim() || undefined,
      });
      toast.success(`Document sent to ${email.trim()}`);
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send document");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send document to client</DialogTitle>
          <DialogDescription>
            Emails a secure link. The client can view or download the file — they cannot edit it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {target && (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
              <FileText className="h-4 w-4 text-primary shrink-0" />
              <span className="text-sm font-medium truncate">{target.documentName}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="share-email">Recipient email</Label>
            <Input
              id="share-email"
              type="email"
              placeholder="client@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="share-name">Recipient name (optional)</Label>
            <Input
              id="share-name"
              placeholder="e.g. HR Manager"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button className="gap-2" onClick={() => void handleSend()} disabled={sending || !target}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send document
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
