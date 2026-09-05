"use client";

import * as React from "react";
import { GripVertical, Library, Loader2, Plus, Save, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  addAppointmentQuestionsFromTemplates,
  fetchAppointmentQuestions,
  replaceAppointmentQuestions,
} from "@/lib/appointment-questions";
import {
  addExamQuestionsFromTemplates,
  fetchExamQuestions,
  saveExamQuestions,
  type ExamQuestionRecord,
} from "@/lib/exam-questions";
import {
  fetchQuestionTemplates,
  type QuestionCategory,
  type QuestionTemplateRecord,
} from "@/lib/question-templates";

const CATEGORIES: { value: QuestionCategory; label: string }[] = [
  { value: "relevant", label: "Relevant" },
  { value: "comparison", label: "Comparison" },
  { value: "irrelevant", label: "Irrelevant" },
];
const RESPONSES = ["", "Truthful", "Deceptive", "Inconclusive"] as const;

/** One row in the editor. Negative ids are unsaved, client-side rows. */
type EditableQuestion = {
  id: number;
  text: string;
  category: QuestionCategory | "";
  response: string;
  sort_order: number;
};

let tempIdCounter = -1;
const nextTempId = () => tempIdCounter--;

function SortableQuestionRow({
  question,
  index,
  showResponses,
  onChange,
  onDelete,
}: {
  question: EditableQuestion;
  index: number;
  showResponses: boolean;
  onChange: (id: number, patch: Partial<EditableQuestion>) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(question.id),
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="rounded-xl border border-border/60 bg-card px-4 py-3 space-y-3"
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-2 shrink-0 cursor-grab touch-none text-muted-foreground hover:text-foreground active:cursor-grabbing"
          aria-label="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <span className="mt-2 shrink-0 text-xs font-semibold text-muted-foreground">{index + 1}.</span>
        <Textarea
          className="min-h-[52px] rounded-lg resize-y text-sm"
          value={question.text}
          onChange={(e) => onChange(question.id, { text: e.target.value })}
        />
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-destructive"
          onClick={() => onDelete(question.id)}
          aria-label="Remove question"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className={`grid gap-3 pl-6 ${showResponses ? "sm:grid-cols-2" : ""}`}>
        <Select
          value={question.category || ""}
          onValueChange={(v) => onChange(question.id, { category: String(v) as QuestionCategory })}
        >
          <SelectTrigger className="h-10 rounded-lg">
            <SelectValue placeholder="Category">
              {CATEGORIES.find((c) => c.value === question.category)?.label}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {showResponses ? (
          <Select
            value={question.response || ""}
            onValueChange={(v) => onChange(question.id, { response: String(v) })}
          >
            <SelectTrigger className="h-10 rounded-lg">
              <SelectValue placeholder="Response">{question.response || "Not recorded"}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RESPONSES.map((r) => (
                <SelectItem key={r || "none"} value={r}>
                  {r || "Not recorded"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The one question editor used everywhere: the session's Questions tab, the
 * client-level Session Questions page, and the documentation page.
 *
 * Before documentation starts it edits the booking's prepared questions; once
 * an exam exists (`examId`) it edits that session's own record instead, which
 * is also where responses are captured.
 */
export function SessionQuestionsPanel({
  appointmentId,
  examId,
  examTypeId,
  showResponses = false,
  onSaved,
}: {
  appointmentId: number;
  examId?: number | null;
  examTypeId?: number | null;
  showResponses?: boolean;
  onSaved?: () => void;
}) {
  const [items, setItems] = React.useState<EditableQuestion[]>([]);
  const [original, setOriginal] = React.useState<ExamQuestionRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [showAllTemplates, setShowAllTemplates] = React.useState(false);
  const [selectedTemplateIds, setSelectedTemplateIds] = React.useState<number[]>([]);
  const [adding, setAdding] = React.useState(false);

  const usingExam = Boolean(examId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      if (examId) {
        const rows = await fetchExamQuestions(examId);
        setOriginal(rows);
        setItems(
          rows.map((r) => ({
            id: r.id,
            text: r.text,
            category: (r.category || "") as QuestionCategory | "",
            response: r.response || "",
            sort_order: r.sort_order,
          }))
        );
      } else {
        const rows = await fetchAppointmentQuestions(appointmentId);
        setOriginal([]);
        setItems(
          rows.map((r) => ({
            id: r.id,
            text: r.text,
            category: (r.category || "") as QuestionCategory | "",
            response: "",
            sort_order: r.sort_order,
          }))
        );
      }
      setDirty(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, examId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const handleChange = (id: number, patch: Partial<EditableQuestion>) => {
    setItems((current) => current.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  const handleDelete = (id: number) => {
    setItems((current) => current.filter((q) => q.id !== id));
    setDirty(true);
  };

  const handleAddBlank = () => {
    setItems((current) => [
      ...current,
      { id: nextTempId(), text: "", category: "relevant", response: "", sort_order: current.length },
    ]);
    setDirty(true);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setItems((current) => {
      const oldIndex = current.findIndex((q) => String(q.id) === String(active.id));
      const newIndex = current.findIndex((q) => String(q.id) === String(over.id));
      if (oldIndex === -1 || newIndex === -1) return current;
      return arrayMove(current, oldIndex, newIndex);
    });
    setDirty(true);
  };

  const handleSave = async () => {
    if (items.some((q) => !q.text.trim())) {
      toast.error("Every question needs text");
      return;
    }
    setSaving(true);
    try {
      if (examId) {
        await saveExamQuestions(
          examId,
          items.map((q, index) => ({
            id: q.id,
            exam_id: examId,
            text: q.text.trim(),
            category: q.category,
            response: q.response,
            sort_order: index,
          })),
          original
        );
      } else {
        await replaceAppointmentQuestions(
          appointmentId,
          items.map((q) => ({ text: q.text.trim(), category: q.category }))
        );
      }
      toast.success("Questions saved");
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  const openPicker = async () => {
    setPickerOpen(true);
    setSelectedTemplateIds([]);
    setTemplatesLoading(true);
    try {
      const rows = await fetchQuestionTemplates(
        showAllTemplates || !examTypeId ? {} : { examTypeId }
      );
      setTemplates(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the question library");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const reloadTemplates = async (all: boolean) => {
    setShowAllTemplates(all);
    setTemplatesLoading(true);
    try {
      const rows = await fetchQuestionTemplates(all || !examTypeId ? {} : { examTypeId });
      setTemplates(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the question library");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const handleAddFromLibrary = async () => {
    if (selectedTemplateIds.length === 0) return;
    if (dirty) {
      toast.error("Save your current edits first");
      return;
    }
    setAdding(true);
    try {
      if (examId) {
        await addExamQuestionsFromTemplates(examId, selectedTemplateIds);
      } else {
        await addAppointmentQuestionsFromTemplates(appointmentId, selectedTemplateIds);
      }
      setPickerOpen(false);
      toast.success("Questions added from the library");
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add questions");
    } finally {
      setAdding(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading questions...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {items.length === 0
            ? "No questions yet."
            : `${items.length} question${items.length === 1 ? "" : "s"}${
                usingExam ? " for this session" : " prepared for this booking"
              }`}
        </p>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="gap-2" onClick={() => void openPicker()}>
            <Library className="h-4 w-4" />
            Add from library
          </Button>
          <Button type="button" variant="outline" className="gap-2" onClick={handleAddBlank}>
            <Plus className="h-4 w-4" />
            Add blank
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
          Pick questions from the library, or add your own — they&apos;ll be waiting on the documentation
          page when the session starts.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((q) => String(q.id))} strategy={verticalListSortingStrategy}>
            <ul className="space-y-3">
              {items.map((question, index) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                  showResponses={showResponses}
                  onChange={handleChange}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {items.length > 0 ? (
        <div className="flex justify-end">
          <Button className="gap-2" disabled={saving || !dirty} onClick={() => void handleSave()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {dirty ? "Save questions" : "Saved"}
          </Button>
        </div>
      ) : null}

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add from the Question Library</DialogTitle>
            <DialogDescription>
              Chosen questions are copied into this session, so later library edits never change it.
            </DialogDescription>
          </DialogHeader>

          {examTypeId ? (
            <label className="flex items-center gap-3 rounded-lg border p-3">
              <Checkbox
                checked={showAllTemplates}
                onCheckedChange={(checked) => void reloadTemplates(Boolean(checked))}
              />
              <div>
                <div className="text-sm font-medium">Show every question</div>
                <div className="text-xs text-muted-foreground">
                  Off: only questions for this booking&apos;s exam type, plus untagged ones.
                </div>
              </div>
            </label>
          ) : null}

          <div className="space-y-2">
            {templatesLoading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading library...
              </div>
            ) : templates.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                The Question Library is empty. Add questions in Settings → Question Library.
              </p>
            ) : (
              templates.map((template) => {
                const checked = selectedTemplateIds.includes(template.id);
                return (
                  <label
                    key={template.id}
                    className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        setSelectedTemplateIds((current) =>
                          value
                            ? [...current, template.id]
                            : current.filter((id) => id !== template.id)
                        )
                      }
                    />
                    <div className="space-y-1">
                      <Badge variant="outline" className="capitalize">
                        {template.category}
                      </Badge>
                      <p className="text-sm">{template.text}</p>
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={adding || selectedTemplateIds.length === 0}
              onClick={() => void handleAddFromLibrary()}
            >
              {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Add {selectedTemplateIds.length > 0 ? selectedTemplateIds.length : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

