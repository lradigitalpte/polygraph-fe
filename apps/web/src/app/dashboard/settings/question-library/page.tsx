"use client";

import * as React from "react";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type DraftItem = FormState & { key: string };

function ExamTypeField({
  examTypes,
  value,
  onChange,
}: {
  examTypes: ExamTypeRecord[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Exam Type (optional)</Label>
      <Select value={value || "any"} onValueChange={(v) => onChange(String(v) === "any" ? "" : String(v))}>
        <SelectTrigger>
          <SelectValue placeholder="Any exam type">
            {examTypes.find((t) => String(t.id) === value)?.name ?? "Any exam type"}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any exam type</SelectItem>
          {examTypes.map((type) => (
            <SelectItem key={type.id} value={String(type.id)}>
              {type.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Tagging is only a filter. An untagged question is offered for every booking.
      </p>
    </div>
  );
}

function CategoryField({
  value,
  onChange,
}: {
  value: QuestionCategory;
  onChange: (value: QuestionCategory) => void;
}) {
  return (
    <div className="grid gap-2">
      <Label>Category</Label>
      <Select value={value} onValueChange={(v) => onChange(v as QuestionCategory)}>
        <SelectTrigger>
          <SelectValue>{CATEGORIES.find((c) => c.value === value)?.label}</SelectValue>
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
  );
}

function SortableTableRow({
  id,
  onEdit,
  onDeactivate,
  active,
  children,
}: {
  id: string;
  onEdit: () => void;
  onDeactivate: () => void;
  active: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} className="cursor-pointer" onClick={onEdit}>
      <TableCell className="w-8 pr-0">
        <button
          type="button"
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          onClick={(event) => event.stopPropagation()}
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </TableCell>
      {children}
      <TableCell className="w-20 text-right">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Edit question"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          {active ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              aria-label="Deactivate question"
              onClick={(event) => {
                event.stopPropagation();
                onDeactivate();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

function DraftRow({ item, onRemove }: { item: DraftItem; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.key,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-3 rounded-lg border p-2 bg-card">
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
        <Badge variant="outline" className="capitalize">
          {item.category}
        </Badge>
        <p className="text-sm line-clamp-2">{item.text}</p>
      </div>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function QuestionLibrarySettingsPage() {
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [templates, setTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<FormState>(emptyForm);
  const [draftItems, setDraftItems] = React.useState<DraftItem[]>([]);
  const [creating, setCreating] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [editingTemplate, setEditingTemplate] = React.useState<QuestionTemplateRecord | null>(null);
  const [editForm, setEditForm] = React.useState<FormState>(emptyForm);
  const [savingEdit, setSavingEdit] = React.useState(false);

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

  const openCreate = () => {
    setCreateForm({ ...emptyForm });
    setDraftItems([]);
    setCreateOpen(true);
  };

  const addDraftItem = () => {
    if (!createForm.text.trim()) {
      toast.error("Question text is required");
      return;
    }
    setDraftItems((current) => [
      ...current,
      { ...createForm, text: createForm.text.trim(), key: crypto.randomUUID() },
    ]);
    // Keep exam type/category since consecutive questions usually share them; only clear the text.
    setCreateForm((current) => ({ ...current, text: "" }));
  };

  const removeDraftItem = (key: string) => {
    setDraftItems((current) => current.filter((item) => item.key !== key));
  };

  const handleDraftDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDraftItems((current) => {
      const oldIndex = current.findIndex((item) => item.key === active.id);
      const newIndex = current.findIndex((item) => item.key === over.id);
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
  };

  const pendingCount = draftItems.length + (createForm.text.trim() ? 1 : 0);

  const handleSaveAll = async () => {
    // The question currently being composed is saved too, so "Save" always
    // captures whatever is on screen without forcing an extra "Add" click.
    const items = createForm.text.trim()
      ? [...draftItems, { ...createForm, text: createForm.text.trim(), key: "__current__" }]
      : draftItems;
    if (items.length === 0) {
      toast.error("Add at least one question");
      return;
    }

    setCreating(true);
    try {
      const created: QuestionTemplateRecord[] = [];
      for (const item of items) {
        const examTypeId = Number(item.examTypeId) || 0;
        const nextSortOrder =
          [...templates, ...created]
            .filter((t) => (t.exam_type_id ?? 0) === examTypeId)
            .reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;
        const record = await createQuestionTemplate({
          exam_type_id: examTypeId,
          category: item.category,
          text: item.text,
          sort_order: nextSortOrder,
          active: item.active,
        });
        created.push(record);
      }
      setTemplates((current) => [...current, ...created]);
      toast.success(`Added ${created.length} question${created.length === 1 ? "" : "s"}`);
      setCreateOpen(false);
      setCreateForm({ ...emptyForm });
      setDraftItems([]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save question templates");
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (template: QuestionTemplateRecord) => {
    setEditingTemplate(template);
    setEditForm({
      examTypeId: template.exam_type_id ? String(template.exam_type_id) : "",
      category: template.category,
      text: template.text,
      active: template.active,
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;
    if (!editForm.text.trim()) {
      toast.error("Question text is required");
      return;
    }

    setSavingEdit(true);
    try {
      const updated = await updateQuestionTemplate(editingTemplate.id, {
        exam_type_id: Number(editForm.examTypeId) || 0,
        category: editForm.category,
        text: editForm.text.trim(),
        active: editForm.active,
      });
      setTemplates((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      toast.success("Question template updated");
      setEditOpen(false);
      setEditingTemplate(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save question template");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeactivateTemplate = async (template: QuestionTemplateRecord) => {
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

  const handleDeactivate = async () => {
    if (!editingTemplate) return;
    await handleDeactivateTemplate(editingTemplate);
    setEditOpen(false);
    setEditingTemplate(null);
  };

  // Untagged templates are grouped under the sentinel id 0.
  const examTypeName = (id: number) =>
    id === 0
      ? "Any exam type"
      : examTypes.find((t) => t.id === id)?.name || `Exam type #${id}`;

  const groupedByExamType = React.useMemo(() => {
    const groups = new Map<number, QuestionTemplateRecord[]>();
    for (const template of templates) {
      const key = template.exam_type_id ?? 0;
      const list = groups.get(key) ?? [];
      list.push(template);
      groups.set(key, list);
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
      const others = current.filter((t) => (t.exam_type_id ?? 0) !== examTypeId);
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
            <div key={examTypeId} className="space-y-2">
              <div>
                <h4 className="text-sm font-medium">{examTypeName(examTypeId)}</h4>
                <p className="text-xs text-muted-foreground">
                  {items.length} question template{items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="rounded-lg border">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => void handleDragEnd(examTypeId, items, event)}
                >
                  <SortableContext items={items.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8" />
                          <TableHead>Title</TableHead>
                          <TableHead className="w-20" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((template) => (
                          <SortableTableRow
                            key={template.id}
                            id={String(template.id)}
                            onEdit={() => openEdit(template)}
                            onDeactivate={() => void handleDeactivateTemplate(template)}
                            active={template.active}
                          >
                            <TableCell className="whitespace-normal">
                              <span className={template.active ? "" : "text-muted-foreground"}>
                                {template.text}
                              </span>
                              {!template.active ? (
                                <span className="ml-2 text-xs text-muted-foreground">(Inactive)</span>
                              ) : null}
                            </TableCell>
                          </SortableTableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </SortableContext>
                </DndContext>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Question: build up a batch of questions, reorder them, then save them all together. */}
      <Dialog
        open={createOpen}
        onOpenChange={(next) => {
          setCreateOpen(next);
          if (!next) {
            setCreateForm({ ...emptyForm });
            setDraftItems([]);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Questions</DialogTitle>
            <DialogDescription>{MERGE_FIELD_HINT}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ExamTypeField
              examTypes={examTypes}
              value={createForm.examTypeId}
              onChange={(value) => setCreateForm((current) => ({ ...current, examTypeId: value }))}
            />

            <CategoryField
              value={createForm.category}
              onChange={(value) => setCreateForm((current) => ({ ...current, category: value }))}
            />

            <div className="grid gap-2">
              <Label htmlFor="question-text">Question Text</Label>
              <Textarea
                id="question-text"
                className="min-h-20"
                value={createForm.text}
                onChange={(event) => setCreateForm((current) => ({ ...current, text: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{MERGE_FIELD_HINT}</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={createForm.active}
                onCheckedChange={(checked) =>
                  setCreateForm((current) => ({ ...current, active: Boolean(checked) }))
                }
              />
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  Inactive templates stay in the library but won&apos;t be used to populate new sessions.
                </div>
              </div>
            </label>

            <Button type="button" variant="outline" className="w-full gap-2" onClick={addDraftItem}>
              <Plus className="h-4 w-4" />
              Add Another Question
            </Button>

            {draftItems.length > 0 ? (
              <div className="space-y-2">
                <Label>Queued questions ({draftItems.length})</Label>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDraftDragEnd}>
                  <SortableContext items={draftItems.map((item) => item.key)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {draftItems.map((item) => (
                        <DraftRow key={item.key} item={item} onRemove={() => removeDraftItem(item.key)} />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSaveAll()} disabled={creating || pendingCount === 0}>
              {creating
                ? "Saving..."
                : `Save ${pendingCount} Question${pendingCount === 1 ? "" : "s"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Row click opens this: the full detail view/edit for one existing question. */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Question Template</DialogTitle>
            <DialogDescription>{MERGE_FIELD_HINT}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ExamTypeField
              examTypes={examTypes}
              value={editForm.examTypeId}
              onChange={(value) => setEditForm((current) => ({ ...current, examTypeId: value }))}
            />

            <CategoryField
              value={editForm.category}
              onChange={(value) => setEditForm((current) => ({ ...current, category: value }))}
            />

            <div className="grid gap-2">
              <Label htmlFor="edit-question-text">Question Text</Label>
              <Textarea
                id="edit-question-text"
                className="min-h-24"
                value={editForm.text}
                onChange={(event) => setEditForm((current) => ({ ...current, text: event.target.value }))}
              />
              <p className="text-xs text-muted-foreground">{MERGE_FIELD_HINT}</p>
            </div>

            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={editForm.active}
                onCheckedChange={(checked) => setEditForm((current) => ({ ...current, active: Boolean(checked) }))}
              />
              <div>
                <div className="text-sm font-medium">Active</div>
                <div className="text-xs text-muted-foreground">
                  Inactive templates stay in the library but won&apos;t be used to populate new sessions.
                </div>
              </div>
            </label>
          </div>

          <DialogFooter className="sm:justify-between">
            {editingTemplate?.active ? (
              <Button variant="destructive" onClick={() => void handleDeactivate()}>
                Deactivate
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button onClick={() => void handleSaveEdit()} disabled={savingEdit}>
                {savingEdit ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
