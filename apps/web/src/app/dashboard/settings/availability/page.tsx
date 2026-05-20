"use client";

import * as React from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
import {
  createAvailabilityBlock,
  deleteAvailabilityBlock,
  fetchAvailabilityBlocks,
  updateAvailabilityBlock,
  type AvailabilityBlockRecord,
} from "@/lib/exam-booking";
import { fetchExaminers, type UserRecord } from "@/lib/users";

type FormState = {
  examiner_id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_full_day: boolean;
  reason: string;
};

const emptyForm: FormState = {
  examiner_id: "",
  date: "",
  start_time: "09:00",
  end_time: "17:00",
  is_full_day: false,
  reason: "",
};

export default function AvailabilitySettingsPage() {
  const [blocks, setBlocks] = React.useState<AvailabilityBlockRecord[]>([]);
  const [examiners, setExaminers] = React.useState<UserRecord[]>([]);
  const [selectedExaminerId, setSelectedExaminerId] = React.useState<string>("");
  const [selectedDate, setSelectedDate] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  const loadPageData = React.useCallback(async (examinerId?: string, date?: string) => {
    try {
      setLoading(true);
      setError(null);
      const [examinerData, blockData] = await Promise.all([
        fetchExaminers(),
        fetchAvailabilityBlocks({
          examiner_id: examinerId ? Number(examinerId) : undefined,
          date: date || undefined,
        }),
      ]);
      setExaminers(examinerData);
      setBlocks(blockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load availability");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadPageData(selectedExaminerId, selectedDate);
  }, [loadPageData, selectedExaminerId, selectedDate]);

  const resetForm = React.useCallback(() => {
    setEditingId(null);
    setForm({
      ...emptyForm,
      examiner_id: selectedExaminerId,
      date: selectedDate,
    });
  }, [selectedDate, selectedExaminerId]);

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (block: AvailabilityBlockRecord) => {
    setEditingId(block.id);
    setForm({
      examiner_id: String(block.examiner_id),
      date: block.date.slice(0, 10),
      start_time: block.start_time || "09:00",
      end_time: block.end_time || "17:00",
      is_full_day: block.is_full_day,
      reason: block.reason || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.examiner_id) {
      toast.error("Choose an examiner");
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
        examiner_id: Number(form.examiner_id),
        date: form.date,
        start_time: form.is_full_day ? undefined : form.start_time,
        end_time: form.is_full_day ? undefined : form.end_time,
        is_full_day: form.is_full_day,
        reason: form.reason.trim() || undefined,
      };

      if (editingId) {
        const updated = await updateAvailabilityBlock(editingId, payload);
        setBlocks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Availability block updated");
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
          <h3 className="text-lg font-medium">Examiner Availability</h3>
          <p className="text-sm text-muted-foreground">
            Create full-day or time-range blocks that the booking page respects immediately.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Block
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Focus on one examiner or a single date while you manage schedule exceptions.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="filter-examiner">Examiner</Label>
            <select
              id="filter-examiner"
              className="h-8 rounded-none border border-input bg-background px-3 text-sm"
              value={selectedExaminerId}
              onChange={(event) => setSelectedExaminerId(event.target.value)}
            >
              <option value="">All examiners</option>
              {examiners.map((examiner) => (
                <option key={examiner.id} value={examiner.id}>
                  {examiner.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="filter-date">Date</Label>
            <Input id="filter-date" type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </div>

          <div className="flex items-end">
            <Button variant="outline" onClick={() => {
              setSelectedExaminerId("");
              setSelectedDate("");
            }}>
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading availability blocks...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : blocks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
            <CalendarClock className="h-8 w-8 text-muted-foreground/50" />
            No availability blocks match the current filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {blocks.map((block) => {
            const examiner = examiners.find((item) => item.id === block.examiner_id);
            return (
              <Card key={block.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{examiner?.name || `Examiner #${block.examiner_id}`}</CardTitle>
                      <CardDescription>{formatDate(block.date)}</CardDescription>
                    </div>
                    <Badge variant={block.is_full_day ? "warning" : "outline"}>
                      {block.is_full_day ? "Full Day" : `${block.start_time} - ${block.end_time}`}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="min-h-10 text-sm text-muted-foreground">{block.reason || "No reason provided."}</p>
                  <div className="flex gap-2">
                    <Button variant="outline" className="gap-2" onClick={() => openEdit(block)}>
                      <Pencil className="h-4 w-4" />
                      Edit
                    </Button>
                    <Button variant="destructive" className="gap-2" onClick={() => void handleDelete(block)}>
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Availability Block" : "Create Availability Block"}</DialogTitle>
            <DialogDescription>
              Define a full-day blackout or a specific unavailable time range for an examiner.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="block-examiner">Examiner</Label>
              <select
                id="block-examiner"
                className="h-8 rounded-none border border-input bg-background px-3 text-sm"
                value={form.examiner_id}
                onChange={(event) => setForm((current) => ({ ...current, examiner_id: event.target.value }))}
              >
                <option value="">Select examiner</option>
                {examiners.map((examiner) => (
                  <option key={examiner.id} value={examiner.id}>
                    {examiner.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="block-date">Date</Label>
              <Input id="block-date" type="date" value={form.date} onChange={(event) => setForm((current) => ({ ...current, date: event.target.value }))} />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={form.is_full_day} onCheckedChange={(checked) => setForm((current) => ({ ...current, is_full_day: Boolean(checked) }))} />
              <div>
                <div className="text-sm font-medium">Full day block</div>
                <div className="text-xs text-muted-foreground">Use this for leave days, travel days, or full clinical closures.</div>
              </div>
            </label>

            {!form.is_full_day && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="block-start">Start time</Label>
                  <Input id="block-start" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="block-end">End time</Label>
                  <Input id="block-end" type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
                </div>
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="block-reason">Reason</Label>
              <Input id="block-reason" value={form.reason} onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))} placeholder="Vacation, training, court testimony..." />
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