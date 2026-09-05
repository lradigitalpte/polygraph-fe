"use client";

import * as React from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import {
  createQuestionTemplate,
  deleteQuestionTemplate,
  fetchQuestionTemplates,
  updateQuestionTemplate,
  type QuestionCategory,
  type QuestionTemplateRecord,
} from "@/lib/question-templates";

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "relevant", label: "Relevant" },
  { value: "comparison", label: "Comparison" },
  { value: "irrelevant", label: "Irrelevant" },
];

const MERGE_FIELD_HINT =
  "Available placeholders: {{subject_name}}, {{client_name}}, {{exam_date}}";

type FormState = {
  examTypeId: string;
  category: QuestionCategory;
  text: string;
  active: boolean;
};

const emptyForm: FormState = {
  examTypeId: "",
  category: "relevant",
  text: "",
  active: true,
};

function SortableTemplateRow({
  template,
  onEdit,
  onDelete,
}: {
  template: QuestionTemplateRecord;
  onEdit: (t: QuestionTemplateRecord) => void;
  onDelete: (t: QuestionTemplateRecord) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(template.id),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-start justify-between gap-3 rounded-lg border p-3 bg-card"
    >
      <button
        type="button"
        className="mt-1 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="capitalize">
            {template.category}
          </Badge>
          {!template.active ? <Badge variant="outline">Inactive</Badge> : null}
        </div>
        <p className="text-sm">{template.text}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="icon" onClick={() => onEdit(template)}>
          <Pencil className="h-4 w-4" />
        </Button>
        {template.active ? (
          <Button variant="destructive" size="icon" onClick={() => void onDelete(template)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export default function QuestionLibrarySettingsPage() {
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [templates, setTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [form, setForm] = React.useState<FormState>(emptyForm);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [types, tpls] = await Promise.all([fetchExamTypes(), fetchQuestionTemplates({ includeInactive: true })]);
      setExamTypes(types);
      setTemplates(tpls);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load question templates");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setEditingId(null);
    setForm({ ...emptyForm, examTypeId: examTypes[0] ? String(examTypes[0].id) : "" });
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (template: QuestionTemplateRecord) => {
    setEditingId(template.id);
    setForm({
      examTypeId: String(template.exam_type_id),
      category: template.category,
      text: template.text,
      active: template.active,
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const examTypeId = Number(form.examTypeId);
    if (!examTypeId) {
      toast.error("Choose an exam type");
      return;
    }
    if (!form.text.trim()) {
      toast.error("Question text is required");
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateQuestionTemplate(editingId, {
          exam_type_id: examTypeId,
          category: form.category,
          text: form.text.trim(),
          active: form.active,
        });
        setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Question template updated");
      } else {
        const nextSortOrder =
          templates
            .filter((t) => t.exam_type_id === examTypeId)
            .reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;
        const created = await createQuestionTemplate({
          exam_type_id: examTypeId,
          category: form.category,
          text: form.text.trim(),
          sort_order: nextSortOrder,
          active: form.active,
        });
        setTemplates((current) => [...current, created]);
        toast.success("Question template created");
      }
      setOpen(false);
      resetForm();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save question template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: QuestionTemplateRecord) => {
    try {
      await deleteQuestionTemplate(template.id);
      setTemplates((current) =>
        current.map((item) => (item.id === template.id ? { ...item, active: false } : item))
      );
      toast.success("Question template deactivated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to deactivate question template");
    }
  };

  const examTypeName = (id: number) => examTypes.find((t) => t.id === id)?.name || `Exam type #${id}`;

  const groupedByExamType = React.useMemo(() => {
    const groups = new Map<number, QuestionTemplateRecord[]>();
    for (const template of templates) {
      const list = groups.get(template.exam_type_id) ?? [];
      list.push(template);
      groups.set(template.exam_type_id, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    }
    return groups;
  }, [templates]);

  const handleDragEnd = async (examTypeId: number, items: QuestionTemplateRecord[], event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((t) => String(t.id) === String(active.id));
    const newIndex = items.findIndex((t) => String(t.id) === String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);
    const withNewOrder = reordered.map((t, index) => ({ ...t, sort_order: index }));

    // Optimistic update so the drag feels instant.
    setTemplates((current) => {
      const others = current.filter((t) => t.exam_type_id !== examTypeId);
      return [...others, ...withNewOrder];
    });

    try {
      await Promise.all(
        withNewOrder.map((t) => updateQuestionTemplate(t.id, { sort_order: t.sort_order }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save new order");
      void load();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Question Library</h3>
          <p className="text-sm text-muted-foreground">
            Default questions per exam type. Drag to reorder. Populating a session copies these in, so editing
            here never changes a past exam&apos;s record.
          </p>
        </div>
        <Button className="gap-2" onClick={openCreate} disabled={examTypes.length === 0}>
          <Plus className="h-4 w-4" />
          Add Question
        </Button>
      </div>

      {loading ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading question templates...</CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            No question templates yet. Add one for an exam type to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Array.from(groupedByExamType.entries()).map(([examTypeId, items]) => (
            <Card key={examTypeId}>
              <CardHeader>
                <CardTitle className="text-base">{examTypeName(examTypeId)}</CardTitle>
                <CardDescription>{items.length} question template{items.length === 1 ? "" : "s"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => void handleDragEnd(examTypeId, items, event)}
                >
                  <SortableContext
                    items={items.map((t) => String(t.id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {items.map((template) => (
                      <SortableTemplateRow
                        key={template.id}
                        template={template}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Question Template" : "Create Question Template"}</DialogTitle>
            <DialogDescription>{MERGE_FIELD_HINT}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-2">
              <Label>Exam Type</Label>
              <Select
                value={form.examTypeId}
                onValueChange={(value) => setForm((current) => ({ ...current, examTypeId: String(value) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose an exam type">
                    {examTypes.find((t) => String(t.id) === form.examTypeId)?.name}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {examTypes.map((type) => (
                    <SelectItem key={type.id} value={String(type.id)}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Category</Label>
              <Select
                value={form.category}
                onValueChange={(value) => setForm((current) => ({ ...current, category: value as QuestionCategory }))}
              >
                <SelectTrigger>
                  <SelectValue>{CATEGORIES.find((c) => c.value === form.category)?.label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="question-text">Question Text</Label>
              <Textarea
                id="question-text"
                className="min-h-24"
                value={form.text}
                onChange={(event) => setForm((current) => ({ ...current, text: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{MERGE_FIELD_HINT}</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={form.active}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, active: Boolean(checked) }))}
              />
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  Inactive templates stay in the library but won&apos;t be used to populate new sessions.
                </div>
              </div>
            </label>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Save Changes" : "Create Question"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
