"use client";

import * as React from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchFormTemplates,
  sendClientFormRequest,
  sendSubjectFormRequest,
  type FormTemplateRecord,
} from "@/lib/forms";

type SendFormDialogProps = {
  clientId: number;
  clientName: string;
  defaultEmail?: string;
  subjectId?: number;
  subjectName?: string;
  audience?: "individual" | "corporate" | "examinee" | "all";
  onSent?: () => void;
  trigger?: React.ReactElement;
};

export function SendFormDialog({
  clientId,
  clientName,
  defaultEmail = "",
  subjectId,
  subjectName,
  audience = "all",
  onSent,
  trigger,
}: SendFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<FormTemplateRecord[]>([]);
  const [templateId, setTemplateId] = React.useState("");
  const [email, setEmail] = React.useState(defaultEmail);
  const [recipientName, setRecipientName] = React.useState(
    subjectName || clientName
  );
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setEmail(defaultEmail);
    setRecipientName(subjectName || clientName);
    setLoading(true);
    void fetchFormTemplates(audience)
      .then((list) => {
        setTemplates(list);
        if (list.length > 0 && !templateId) {
          setTemplateId(String(list[0].id));
        }
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Failed to load templates");
        setTemplates([]);
      })
      .finally(() => setLoading(false));
  }, [open, audience, defaultEmail, clientName, subjectName, templateId]);

  const handleSend = async () => {
    if (!templateId) {
      toast.error("Select a form");
      return;
    }
    setSending(true);
    try {
      if (subjectId) {
        await sendSubjectFormRequest(subjectId, {
          template_id: Number(templateId),
          client_id: clientId,
          recipient_email: email.trim() || undefined,
          recipient_name: recipientName.trim() || undefined,
        });
      } else {
        await sendClientFormRequest(clientId, {
          template_id: Number(templateId),
          recipient_email: email.trim() || undefined,
          recipient_name: recipientName.trim() || undefined,
        });
      }
      toast.success("Form link sent by email");
      setOpen(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send form");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger} />
      ) : (
        <DialogTrigger render={<Button />}>
          <Send className="h-4 w-4 mr-2" />
          Send form link
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Send form by email</DialogTitle>
          <DialogDescription>
            The recipient gets a secure link to complete the form online. Results are saved to
            the document vault automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Form template</Label>
            {loading ? (
              <div className="flex items-center text-sm text-muted-foreground py-2">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Loading templates...
              </div>
            ) : (
              <Select value={templateId} onValueChange={(value) => setTemplateId(String(value))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient-name">Recipient name</Label>
            <Input
              id="recipient-name"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recipient-email">Recipient email</Label>
            <Input
              id="recipient-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void handleSend()} disabled={sending || loading}>
            {sending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Send link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
