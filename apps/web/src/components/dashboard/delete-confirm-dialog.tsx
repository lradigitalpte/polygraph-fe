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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type DeleteConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  confirmPlaceholder?: string;
  expectedValue?: string;
  triggerLabel: string;
  triggerVariant?: "destructive" | "outline";
  onConfirm: (typedValue?: string) => Promise<void>;
};

export function DeleteConfirmDialog({
  title,
  description,
  confirmLabel,
  confirmPlaceholder,
  expectedValue,
  triggerLabel,
  triggerVariant = "destructive",
  onConfirm,
}: DeleteConfirmDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const needsMatch = Boolean(expectedValue?.trim());
  const canConfirm = !needsMatch || value.trim() === expectedValue?.trim();

  const handleConfirm = async () => {
    if (!canConfirm) return;
    setLoading(true);
    try {
      await onConfirm(needsMatch ? value.trim() : undefined);
      setOpen(false);
      setValue("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant={triggerVariant} />}>{triggerLabel}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {needsMatch ? (
          <div className="grid gap-2 py-2">
            <Label htmlFor="delete-confirm">{confirmLabel}</Label>
            <Input
              id="delete-confirm"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={confirmPlaceholder ?? expectedValue}
              autoComplete="off"
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={!canConfirm || loading} onClick={() => void handleConfirm()}>
            {loading ? "Deleting…" : "Confirm delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
