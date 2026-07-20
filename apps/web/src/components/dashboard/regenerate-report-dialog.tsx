"use client";

import { Loader2, LockKeyhole, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REPORT_SHARE_EXPIRY_OPTIONS } from "@/lib/reports";

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; protectionMode: "password" | "secure_link";
  onProtectionModeChange: (mode: "password" | "secure_link") => void; expiryDays: number;
  onExpiryDaysChange: (days: number) => void; submitting: boolean; onSubmit: () => void | Promise<void>;
};

export function RegenerateReportDialog(props: Props) {
  return <Dialog open={props.open} onOpenChange={props.onOpenChange}><DialogContent className="max-w-md rounded-3xl">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><RefreshCw className="h-5 w-5 text-primary" />Regenerate report delivery</DialogTitle><DialogDescription>The previous link will expire immediately. Choose protection for the new delivery.</DialogDescription></DialogHeader>
    <div className="space-y-4 py-2">
      <div className="space-y-2"><Label>PDF protection</Label><Select value={props.protectionMode} onValueChange={(value) => props.onProtectionModeChange(value as "password" | "secure_link")}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="password">Password-protected PDF</SelectItem><SelectItem value="secure_link">Secure link · No PDF password</SelectItem></SelectContent></Select></div>
      <div className="space-y-2"><Label>New link expiry</Label><Select value={String(props.expiryDays)} onValueChange={(value) => props.onExpiryDaysChange(Number(value))}><SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger><SelectContent>{REPORT_SHARE_EXPIRY_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent></Select></div>
      <div className={`rounded-xl p-3 text-xs ${props.protectionMode === "password" ? "bg-emerald-500/10 text-emerald-800" : "bg-amber-500/10 text-amber-800"}`}><LockKeyhole className="mr-2 inline h-4 w-4" />{props.protectionMode === "password" ? "The updated PDF will be attached and require a new PIN." : "The updated open PDF will be attached and cannot be revoked after sending."}</div>
    </div>
    <DialogFooter><Button variant="outline" onClick={() => props.onOpenChange(false)} disabled={props.submitting}>Cancel</Button><Button onClick={() => void props.onSubmit()} disabled={props.submitting}>{props.submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Regenerate & Send</Button></DialogFooter>
  </DialogContent></Dialog>;
}
