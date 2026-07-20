"use client";

import * as React from "react";
import { ArrowRight, FileSignature, Loader2, LockKeyhole, Link2 } from "lucide-react";
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
  protectionMode: "password" | "secure_link";
  onProtectionModeChange: (value: "password" | "secure_link") => void;
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
  protectionMode,
  onProtectionModeChange,
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
            Choose how the finalized report should be securely delivered.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-2xl border border-border/50 bg-muted/20 px-4 py-3 text-xs text-muted-foreground leading-relaxed">
            The report must already be finalized and locked in the Report Builder before it can be emailed.
          </div>

          <div className="space-y-2">
            <Label>PDF protection</Label>
            <div className="grid gap-2">
              <button type="button" onClick={() => onProtectionModeChange("password")} className={`rounded-xl border p-3 text-left transition-colors ${protectionMode === "password" ? "border-primary bg-primary/5" : "border-border"}`}>
                <span className="flex items-center gap-2 text-sm font-bold"><LockKeyhole className="h-4 w-4" />Password-protected PDF</span>
                <span className="mt-1 block text-xs text-muted-foreground">Attached to the email. The PIN is revealed through the expiring secure portal.</span>
              </button>
              <button type="button" onClick={() => onProtectionModeChange("secure_link")} className={`rounded-xl border p-3 text-left transition-colors ${protectionMode === "secure_link" ? "border-primary bg-primary/5" : "border-border"}`}>
                <span className="flex items-center gap-2 text-sm font-bold"><Link2 className="h-4 w-4" />Secure link · No PDF password</span>
                <span className="mt-1 block text-xs text-muted-foreground">The open PDF is attached to the email. The secure portal remains available for verification and re-download.</span>
              </button>
            </div>
            {protectionMode === "secure_link" && <p className="rounded-xl bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-800">The attachment can be opened and forwarded without a password and cannot be revoked after the email is sent.</p>}
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
              The secure link stops working after {expiryLabel.toLowerCase()}.{protectionMode === "password" ? " The attached PDF keeps its PIN until the share is rotated." : " The attached open PDF remains accessible in the recipient’s email."}
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
