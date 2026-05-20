"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  createExamType,
  deleteExamType,
  fetchExamTypes,
  updateExamType,
  type ExamTypeRecord,
} from "@/lib/exam-booking";

type FormState = {
  name: string;
  description: string;
  category: string;
  duration: string;
  price: string;
  active: boolean;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  category: "",
  duration: "150",
  price: "0",
  active: true,
};

export default function ExamTypesSettingsPage() {
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  const loadExamTypes = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchExamTypes();
      setExamTypes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load exam types");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadExamTypes();
  }, [loadExamTypes]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (examType: ExamTypeRecord) => {
    setEditingId(examType.id);
    setForm({
      name: examType.name,
      description: examType.description || "",
      category: examType.category || "",
      duration: String(examType.duration),
      price: String(examType.price ?? 0),
      active: examType.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const duration = Number(form.duration);
    const price = Number(form.price);
    if (!form.name.trim()) {
      toast.error("Exam type name is required");
      return;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      toast.error("Duration must be greater than 0");
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      toast.error("Price cannot be negative");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateExamType(editingId, {
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          duration,
          price,
          active: form.active,
        });
        setExamTypes((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Exam type updated");
      } else {
        const created = await createExamType({
          name: form.name.trim(),
          description: form.description.trim(),
          category: form.category.trim(),
          duration,
          price,
          active: form.active,
        });
        setExamTypes((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
        toast.success("Exam type created");
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save exam type");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (examType: ExamTypeRecord) => {
    try {
      await deleteExamType(examType.id);
      setExamTypes((current) => current.filter((item) => item.id !== examType.id));
      toast.success("Exam type deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete exam type");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Exam Types</h3>
          <p className="text-sm text-muted-foreground">
            Control the exam protocols surfaced in booking, scheduling, and downstream summaries.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add Exam Type
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading exam types...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {examTypes.map((examType) => (
            <Card key={examType.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">{examType.name}</CardTitle>
                    <CardDescription>{examType.category || "General"}</CardDescription>
                  </div>
                  <Badge variant={examType.active ? "success" : "outline"}>{examType.active ? "Active" : "Inactive"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground min-h-10">
                  {examType.description || "No description added yet."}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{(examType.duration / 60).toFixed(1)} hours</span>
                  <span>{examType.duration} minutes</span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Base price</span>
                  <span className="font-semibold text-foreground">${(examType.price ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="gap-2" onClick={() => openEdit(examType)}>
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                  <Button variant="destructive" className="gap-2" onClick={() => void handleDelete(examType)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Exam Type" : "Create Exam Type"}</DialogTitle>
            <DialogDescription>
              Configure the protocol name, category, duration, and whether it should be bookable.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="exam-type-name">Name</Label>
              <Input id="exam-type-name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam-type-category">Category</Label>
              <Input id="exam-type-category" value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam-type-duration">Duration (minutes)</Label>
              <Input id="exam-type-duration" type="number" min={30} step={15} value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam-type-price">Price (USD)</Label>
              <Input id="exam-type-price" type="number" min={0} step={0.01} value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="exam-type-description">Description</Label>
              <Textarea
                id="exam-type-description"
                className="min-h-24"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox checked={form.active} onCheckedChange={(checked) => setForm((current) => ({ ...current, active: Boolean(checked) }))} />
              <div>
                <div className="text-sm font-medium">Bookable</div>
                <div className="text-xs text-muted-foreground">Inactive types stay in the database but disappear from new bookings.</div>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Exam Type"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}