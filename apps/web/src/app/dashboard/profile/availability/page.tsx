"use client";

import * as React from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  fetchAvailabilityBlocks,
  updateAvailabilityBlock,
  type AvailabilityBlockRecord,
} from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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

type FormState = {
  date: string;
  start_time: string;
  end_time: string;
  is_full_day: boolean;
  reason: string;
};

const emptyForm: FormState = {
  date: "",
  start_time: "09:00",
  end_time: "17:00",
  is_full_day: false,
  reason: "",
};

export default function ProfileAvailabilityPage() {
  const [currentExaminer, setCurrentExaminer] = React.useState<UserRecord | null>(null);
  const [blocks, setBlocks] = React.useState<AvailabilityBlockRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  const loadBlocks = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await authClient.getSession();
      const email =
        (session?.data as { user?: { email?: string } } | null)?.user?.email ||
        (session?.data as { email?: string } | null)?.email ||
        "";

      if (!email) {
        throw new Error("Could not determine the signed-in user");
      }

      const examiners = await fetchExaminers();
      const examiner = examiners.find((item) => item.email.toLowerCase() === email.toLowerCase()) || null;
      if (!examiner) {
        throw new Error("This account is not linked to an examiner profile with availability access");
      }

      const availabilityBlocks = await fetchAvailabilityBlocks({ examiner_id: examiner.id });
      setCurrentExaminer(examiner);
      setBlocks(availabilityBlocks.sort(compareBlocks));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your availability");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadBlocks();
  }, [loadBlocks]);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (block: AvailabilityBlockRecord) => {
    setEditingId(block.id);
    setForm({
      date: block.date.slice(0, 10),
      start_time: block.start_time || "09:00",
      end_time: block.end_time || "17:00",
      is_full_day: block.is_full_day,
      reason: block.reason || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!currentExaminer) {
      toast.error("Examiner profile not found");
      return;
    }
    if (!form.date) {
      toast.error("Choose a date");
      return;
    }
    if (!form.is_full_day && (!form.start_time || !form.end_time)) {
      toast.error("Partial-day blocks require start and end times");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        examiner_id: currentExaminer.id,
        date: form.date,
        start_time: form.is_full_day ? undefined : form.start_time,
        end_time: form.is_full_day ? undefined : form.end_time,
        is_full_day: form.is_full_day,
        reason: form.reason.trim() || undefined,
      };

      if (editingId) {
        const updated = await updateAvailabilityBlock(editingId, payload);
        setBlocks((current) => current.map((item) => (item.id === updated.id ? updated : item)).sort(compareBlocks));
        toast.success("Availability updated");
      } else {
        const created = await createAvailabilityBlock(payload);
        setBlocks((current) => [...current, created].sort(compareBlocks));
        toast.success("Availability block created");
      }

      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save availability block");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (block: AvailabilityBlockRecord) => {
    try {
      await deleteAvailabilityBlock(block.id);
      setBlocks((current) => current.filter((item) => item.id !== block.id));
      toast.success("Availability block deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete availability block");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-medium">My Availability</h3>
          <p className="text-sm text-muted-foreground">
            Block days or time ranges on your own calendar so schedulers cannot place exams there.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate} disabled={!currentExaminer}>
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading your availability...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Linked Examiner Profile</CardTitle>
              <CardDescription>These blocks are applied to your examiner record only.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="font-medium text-foreground">{currentExaminer?.name}</div>
              <div className="text-muted-foreground">{currentExaminer?.email}</div>
              <Badge variant="outline" className="uppercase">{currentExaminer?.status}</Badge>
            </CardContent>
          </Card>

          {blocks.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
                <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
                No availability blocks yet.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {blocks.map((block) => (
                <Card key={block.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">{formatDate(block.date)}</CardTitle>
                        <CardDescription>{block.reason || "No reason provided"}</CardDescription>
                      </div>
                      <Badge variant={block.is_full_day ? "warning" : "outline"}>
                        {block.is_full_day ? "Full Day" : `${block.start_time} - ${block.end_time}`}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openEdit(block)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="destructive" className="gap-2" onClick={() => void handleDelete(block)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Availability Block" : "Create Availability Block"}</DialogTitle>
            <DialogDescription>
              Use full-day blocks for leave and time-range blocks for shorter unavailability.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-block-date">Date</Label>
              <Input id="profile-block-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={form.is_full_day} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_full_day: Boolean(checked) }))} />
              <div>
                <div className="text-sm font-medium">Full day block</div>
                <div className="text-xs text-muted-foreground">Best for leave days, travel, illness, or full-day training.</div>
              </div>
            </label>

            {!form.is_full_day && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="profile-block-start">Start time</Label>
                  <Input id="profile-block-start" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-block-end">End time</Label>
                  <Input id="profile-block-end" type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="profile-block-reason">Reason</Label>
              <Input id="profile-block-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Vacation, court testimony, training..." />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function compareBlocks(a: AvailabilityBlockRecord, b: AvailabilityBlockRecord) {
  return `${a.date}-${a.start_time || "00:00"}`.localeCompare(`${b.date}-${b.start_time || "00:00"}`);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}