"use client";

import * as React from "react";
import { ArrowRight, FileSignature, Loader2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { REPORT_SHARE_EXPIRY_OPTIONS } from "@/lib/reports";

type ShareReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipientEmail: string;
  onRecipientEmailChange: (value: string) => void;
  expiryDays: number;
  onExpiryDaysChange: (value: number) => void;
  sharing: boolean;
  onSubmit: () => void | Promise<void>;
};

export function ShareReportDialog({
  open,
  onOpenChange,
  recipientEmail,
  onRecipientEmailChange,
  expiryDays,
  onExpiryDaysChange,
  sharing,
  onSubmit,
}: ShareReportDialogProps) {
  const expiryLabel =
    REPORT_SHARE_EXPIRY_OPTIONS.find((option) => option.value === expiryDays)?.label ??
    `${expiryDays} days`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-3xl border-border/50 max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-primary" />
            Secure Document Share
          </DialogTitle>
          <DialogDescription>
            Send a password-encrypted PDF to the recipient. They will also receive a time-limited link to reveal the PDF passcode.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            The report must already be finalized and locked in the Report Builder before it can be emailed.
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-recipient-email">Recipient email</Label>
            <Input
              id="share-recipient-email"
              type="email"
              placeholder="client@company.com"
              value={recipientEmail}
              onChange={(e) => onRecipientEmailChange(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="share-expiry-days">Unlock link expires after</Label>
            <Select
              value={String(expiryDays)}
              onValueChange={(value) => onExpiryDaysChange(Number(value))}
            >
              <SelectTrigger id="share-expiry-days" className="rounded-xl">
                <SelectValue placeholder="Choose expiry..." />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {REPORT_SHARE_EXPIRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={String(option.value)}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              The secure unlock link and passcode page will stop working after {expiryLabel.toLowerCase()}. The attached PDF keeps its own passcode until you rotate the share.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            disabled={sharing}
          >
            Cancel
          </Button>
          <Button
            className="rounded-xl gap-2 font-bold"
            onClick={() => void onSubmit()}
            disabled={sharing}
          >
            {sharing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <ArrowRight className="h-4 w-4" />
                Send Secure Report
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
