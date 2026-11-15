"use client";

import * as React from "react";
import { Check, GripVertical, Library, ListChecks, Loader2, Plus, Save, Search, Trash2, Undo2 } from "lucide-react";
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

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Segmented } from "@/components/dashboard/ui-kit";
import {
  addAppointmentQuestionsFromTemplates,
  fetchAppointmentQuestions,
  replaceAppointmentQuestions,
} from "@/lib/appointment-questions";
import { addExamQuestionsFromTemplates, fetchExamQuestions, saveExamQuestions, type ExamQuestionRecord } from "@/lib/exam-questions";
import { fetchQuestionTemplates, type QuestionCategory, type QuestionTemplateRecord } from "@/lib/question-templates";
import { cn } from "@/lib/utils";

const CATEGORIES: { value: QuestionCategory; label: string; short: string; style: string; dot: string }[] = [
  {
    value: "relevant",
    label: "Relevant",
    short: "R",
    style: "bg-primary/12 text-[oklch(0.45_0.12_39)] dark:text-primary",
    dot: "bg-primary",
  },
  {
    value: "comparison",
    label: "Comparison",
    short: "C",
    style: "bg-[#E8E4F7] text-[#4A3F8C] dark:bg-violet-950/60 dark:text-violet-200",
    dot: "bg-[#8B7FD1]",
  },
  {
    value: "irrelevant",
    label: "Irrelevant",
    short: "I",
    style: "bg-[#ECE9E0] text-[#55534C] dark:bg-muted dark:text-muted-foreground",
    dot: "bg-[#A8A496]",
  },
];
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.value, c])) as Record<QuestionCategory, (typeof CATEGORIES)[number]>;

const RESPONSES: { value: string; label: string; active: string }[] = [
  { value: "Truthful", label: "Truthful", active: "bg-[#E7F1E4] text-[#2D5A27] ring-[#BFD9B8] dark:bg-emerald-950 dark:text-emerald-300 dark:ring-emerald-900" },
  { value: "Deceptive", label: "Deceptive", active: "bg-destructive/10 text-destructive ring-destructive/30" },
  { value: "Inconclusive", label: "Inconclusive", active: "bg-[#F8EEDB] text-[#8A5A12] ring-[#E9D3A8] dark:bg-amber-950/60 dark:text-amber-200 dark:ring-amber-900" },
];

const PILL = "flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted";
const normalise = (t: string) => t.trim().toLowerCase().replace(/\s+/g, " ");

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
  autoFocus,
  onChange,
  onDelete,
}: {
  question: EditableQuestion;
  index: number;
  showResponses: boolean;
  autoFocus: boolean;
  onChange: (id: number, patch: Partial<EditableQuestion>) => void;
  onDelete: (id: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(question.id) });
  const empty = !question.text.trim();

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group rounded-[20px] bg-[#F7F6F1] p-3 ring-1 ring-black/[0.03] transition-shadow sm:p-4 dark:bg-muted/40 dark:ring-white/5",
        isDragging && "relative z-10 shadow-[0_18px_36px_-18px_rgba(43,42,39,0.45)] ring-primary/40",
      )}
    >
      <div className="flex items-start gap-2 sm:gap-3">
        <button
          type="button"
          className="mt-2 flex h-8 shrink-0 cursor-grab touch-none items-center text-muted-foreground/60 hover:text-foreground active:cursor-grabbing"
          aria-label={`Drag to reorder question ${index + 1}`}
          {...attributes}
          {...listeners}
        >
          <GripVertical aria-hidden="true" className="size-4" />
        </button>
        <span className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold tabular-nums shadow-sm dark:bg-card">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <textarea
            rows={2}
            autoFocus={autoFocus}
            aria-label={`Question ${index + 1}`}
            placeholder="Type the question…"
            className={cn(
              "w-full resize-y rounded-2xl bg-white px-4 py-2.5 text-[15px] leading-relaxed ring-1 ring-black/[0.05] outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-primary dark:bg-card dark:ring-white/10",
              empty && !autoFocus && "ring-destructive/40",
            )}
            value={question.text}
            onChange={(e) => onChange(question.id, { text: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <div role="radiogroup" aria-label={`Type of question ${index + 1}`} className="flex gap-1">
              {CATEGORIES.map((c) => {
                const on = question.category === c.value;
                return (
                  <button
                    key={c.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => onChange(question.id, { category: c.value })}
                    className={cn(
                      "h-7 rounded-full px-3 text-xs font-medium transition-colors",
                      on ? c.style : "text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card",
                    )}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            {showResponses ? (
              <div role="radiogroup" aria-label={`Response to question ${index + 1}`} className="flex flex-wrap items-center gap-1">
                <span className="mr-1 text-xs text-muted-foreground">Response</span>
                {RESPONSES.map((r) => {
                  const on = question.response === r.value;
                  return (
                    <button
                      key={r.value}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => onChange(question.id, { response: on ? "" : r.value })}
                      title={on ? "Click again to clear" : undefined}
                      className={cn(
                        "h-7 rounded-full px-3 text-xs font-medium ring-1 transition-colors",
                        on ? r.active : "bg-white ring-border text-muted-foreground hover:text-foreground dark:bg-card",
                      )}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDelete(question.id)}
          aria-label={`Remove question ${index + 1}`}
          className="mt-2 flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100"
        >
          <Trash2 aria-hidden="true" className="size-4" />
        </button>
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
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);
  const [focusId, setFocusId] = React.useState<number | null>(null);
  const [removed, setRemoved] = React.useState<{ question: EditableQuestion; index: number } | null>(null);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [templatesLoading, setTemplatesLoading] = React.useState(false);
  const [showAllTemplates, setShowAllTemplates] = React.useState(false);
  const [templateQuery, setTemplateQuery] = React.useState("");
  const [templateCategory, setTemplateCategory] = React.useState<"all" | QuestionCategory>("all");
  const [selectedTemplateIds, setSelectedTemplateIds] = React.useState<number[]>([]);
  const [adding, setAdding] = React.useState(false);

  const usingExam = Boolean(examId);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      if (examId) {
        const rows = await fetchExamQuestions(examId);
        setOriginal(rows);
        setItems(rows.map((r) => ({ id: r.id, text: r.text, category: (r.category || "") as QuestionCategory | "", response: r.response || "", sort_order: r.sort_order })));
      } else {
        const rows = await fetchAppointmentQuestions(appointmentId);
        setOriginal([]);
        setItems(rows.map((r) => ({ id: r.id, text: r.text, category: (r.category || "") as QuestionCategory | "", response: "", sort_order: r.sort_order })));
      }
      setDirty(false);
      setRemoved(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [appointmentId, examId]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // Warn before closing the tab with unsaved edits.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const counts = React.useMemo(() => {
    const c: Record<QuestionCategory, number> = { relevant: 0, comparison: 0, irrelevant: 0 };
    for (const q of items) if (q.category) c[q.category as QuestionCategory] += 1;
    return c;
  }, [items]);
  const answered = items.filter((q) => q.response).length;
  const blankCount = items.filter((q) => !q.text.trim()).length;

  const handleChange = (id: number, patch: Partial<EditableQuestion>) => {
    setItems((current) => current.map((q) => (q.id === id ? { ...q, ...patch } : q)));
    setDirty(true);
  };

  const handleDelete = (id: number) => {
    setItems((current) => {
      const index = current.findIndex((q) => q.id === id);
      if (index >= 0) setRemoved({ question: current[index], index });
      return current.filter((q) => q.id !== id);
    });
    setDirty(true);
  };

  const undoDelete = () => {
    if (!removed) return;
    setItems((current) => {
      const next = [...current];
      next.splice(Math.min(removed.index, next.length), 0, removed.question);
      return next;
    });
    setRemoved(null);
  };

  const handleAddBlank = () => {
    const id = nextTempId();
    setItems((current) => [...current, { id, text: "", category: "relevant", response: "", sort_order: current.length }]);
    setFocusId(id);
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

  /** Writes the current list. Returns false (and says why) when it can't. */
  const persist = async (): Promise<boolean> => {
    if (blankCount > 0) {
      toast.error(blankCount === 1 ? "One question is empty — type it or remove it." : `${blankCount} questions are empty — type them or remove them.`);
      return false;
    }
    if (examId) {
      await saveExamQuestions(
        examId,
        items.map((q, index) => ({ id: q.id, exam_id: examId, text: q.text.trim(), category: q.category, response: q.response, sort_order: index })),
        original,
      );
    } else {
      await replaceAppointmentQuestions(
        appointmentId,
        items.map((q) => ({ text: q.text.trim(), category: q.category })),
      );
    }
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (!(await persist())) return;
      toast.success("Questions saved");
      await load();
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      setSaving(false);
    }
  };

  // Ctrl/⌘+S saves while the editor has focus.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (dirty && !saving) void handleSave();
    }
  };

  const loadTemplates = async (all: boolean) => {
    setTemplatesLoading(true);
    try {
      setTemplates(await fetchQuestionTemplates(all || !examTypeId ? {} : { examTypeId }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load the question library");
    } finally {
      setTemplatesLoading(false);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    setSelectedTemplateIds([]);
    setTemplateQuery("");
    setTemplateCategory("all");
    void loadTemplates(showAllTemplates);
  };

  const toggleShowAll = (all: boolean) => {
    setShowAllTemplates(all);
    void loadTemplates(all);
  };

  const existingTexts = React.useMemo(() => new Set(items.map((q) => normalise(q.text))), [items]);
  const tq = templateQuery.trim().toLowerCase();
  const visibleTemplates = templates.filter(
    (t) => (templateCategory === "all" || t.category === templateCategory) && (!tq || t.text.toLowerCase().includes(tq)),
  );
  const selectable = visibleTemplates.filter((t) => !existingTexts.has(normalise(t.text)));
  const allVisibleSelected = selectable.length > 0 && selectable.every((t) => selectedTemplateIds.includes(t.id));

  const handleAddFromLibrary = async () => {
    if (selectedTemplateIds.length === 0) return;
    setAdding(true);
    try {
      // Unsaved edits would be lost when the list reloads, so save them first.
      if (dirty && !(await persist())) return;
      if (examId) await addExamQuestionsFromTemplates(examId, selectedTemplateIds);
      else await addAppointmentQuestionsFromTemplates(appointmentId, selectedTemplateIds);
      setPickerOpen(false);
      toast.success(`${selectedTemplateIds.length} question${selectedTemplateIds.length === 1 ? "" : "s"} added`);
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
      <div className="space-y-3" aria-busy="true" aria-label="Loading questions">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-[92px] animate-pulse rounded-[20px] bg-[#F3F1EA] dark:bg-muted" />
        ))}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-[20px] bg-destructive/5 px-6 py-10 text-center">
        <p className="text-sm text-destructive">{loadError}</p>
        <button type="button" className={PILL} onClick={() => void load()}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4" onKeyDown={onKeyDown}>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {items.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="mr-1 text-sm font-medium">
              {items.length} question{items.length === 1 ? "" : "s"}
            </span>
            {CATEGORIES.map((c) =>
              counts[c.value] ? (
                <span key={c.value} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-medium", c.style)}>
                  {counts[c.value]} {c.label.toLowerCase()}
                </span>
              ) : null,
            )}
            {showResponses ? (
              <span className="ml-1 text-muted-foreground">
                · {answered} of {items.length} answered
              </span>
            ) : null}
          </div>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <button type="button" className={PILL} onClick={openPicker}>
            <Library aria-hidden="true" className="size-4" /> Add from library
          </button>
          <button type="button" className={PILL} onClick={handleAddBlank}>
            <Plus aria-hidden="true" className="size-4" /> Write one
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[22px] border border-dashed border-border px-6 py-12 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-[#F3F1EA] text-muted-foreground dark:bg-muted">
            <ListChecks aria-hidden="true" className="size-5" />
          </span>
          <div className="max-w-sm">
            <p className="font-medium">No questions yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {usingExam
                ? "Pick from the library or write your own for this session."
                : "Pick from the library or write your own. They'll be waiting on the documentation page when the session starts."}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              className="flex h-10 items-center gap-1.5 rounded-full bg-[#2B2A27] px-4 text-[13px] font-medium text-[#FAF9F5] transition-colors hover:bg-[#3A3935] dark:bg-foreground dark:text-background"
            >
              <Library aria-hidden="true" className="size-4" /> Choose from library
            </button>
            <button type="button" className={PILL} onClick={handleAddBlank}>
              <Plus aria-hidden="true" className="size-4" /> Write one
            </button>
          </div>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((q) => String(q.id))} strategy={verticalListSortingStrategy}>
            <ul className="space-y-2.5">
              {items.map((question, index) => (
                <SortableQuestionRow
                  key={question.id}
                  question={question}
                  index={index}
                  showResponses={showResponses}
                  autoFocus={focusId === question.id}
                  onChange={handleChange}
                  onDelete={handleDelete}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {/* Save bar: sticks to the bottom while there are unsaved edits */}
      {items.length > 0 || dirty ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-[20px] px-4 py-3 sm:flex-row sm:items-center sm:justify-between",
            dirty ? "sticky bottom-3 z-20 bg-[#2B2A27] text-[#FAF9F5] shadow-[0_18px_40px_-20px_rgba(20,20,19,0.8)] dark:bg-[#1B1B19] dark:ring-1 dark:ring-white/10" : "bg-transparent px-0",
          )}
        >
          <p className={cn("flex items-center gap-2 text-[13px]", dirty ? "text-[#E6E3DA]" : "text-muted-foreground")}>
            {dirty ? (
              <>
                Unsaved changes{blankCount ? ` · ${blankCount} empty` : ""}
                {removed ? (
                  <button type="button" onClick={undoDelete} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-[#FAF9F5] underline-offset-4 hover:underline">
                    <Undo2 aria-hidden="true" className="size-3.5" /> Undo remove
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <Check aria-hidden="true" className="size-3.5" /> All changes saved
              </>
            )}
          </p>
          {dirty ? (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void load()}
                disabled={saving}
                className="h-9 rounded-full px-3.5 text-[13px] font-medium text-[#E6E3DA] ring-1 ring-white/20 transition-colors hover:bg-white/10 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving}
                className="flex h-9 items-center gap-1.5 rounded-full bg-[#FAF9F5] px-4 text-[13px] font-semibold text-[#1A1915] transition-colors hover:bg-white disabled:opacity-60"
              >
                {saving ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Save aria-hidden="true" className="size-3.5" />}
                Save questions
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Library picker */}
      <Dialog open={pickerOpen} onOpenChange={(open) => !adding && setPickerOpen(open)}>
        <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-4 rounded-[26px]">
          <DialogHeader>
            <DialogTitle>Add from the Question Library</DialogTitle>
            <DialogDescription>Chosen questions are copied into this session, so later library edits never change it.</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                aria-label="Search the library"
                placeholder="Search questions…"
                value={templateQuery}
                onChange={(e) => setTemplateQuery(e.target.value)}
                className="h-10 w-full rounded-full bg-[#F3F1EA] pr-4 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-muted"
              />
            </div>
            <Segmented<"all" | QuestionCategory>
              label="Question type"
              value={templateCategory}
              onChange={setTemplateCategory}
              options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            {examTypeId ? (
              <label className="flex cursor-pointer items-center gap-2 text-muted-foreground select-none">
                <button
                  type="button"
                  role="switch"
                  aria-checked={showAllTemplates}
                  onClick={() => toggleShowAll(!showAllTemplates)}
                  className={cn("relative h-5 w-9 rounded-full transition-colors", showAllTemplates ? "bg-primary" : "bg-[#D9D5CA] dark:bg-muted")}
                >
                  <span className={cn("absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform", showAllTemplates && "translate-x-4")} />
                </button>
                {showAllTemplates ? "Showing every question" : "Only this exam type (and untagged)"}
              </label>
            ) : (
              <span className="text-muted-foreground">Showing every question</span>
            )}
            {selectable.length > 0 ? (
              <button
                type="button"
                onClick={() =>
                  setSelectedTemplateIds((cur) =>
                    allVisibleSelected ? cur.filter((id) => !selectable.some((t) => t.id === id)) : [...new Set([...cur, ...selectable.map((t) => t.id)])],
                  )
                }
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                {allVisibleSelected ? "Clear these" : `Select all ${selectable.length}`}
              </button>
            ) : null}
          </div>

          <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1">
            {templatesLoading ? (
              <div className="space-y-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
                ))}
              </div>
            ) : templates.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">The Question Library is empty. Add questions in Settings → Question Library.</p>
            ) : visibleTemplates.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">No questions match.</p>
            ) : (
              visibleTemplates.map((t) => {
                const already = existingTexts.has(normalise(t.text));
                const checked = selectedTemplateIds.includes(t.id);
                const cat = CATEGORY[t.category];
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={already}
                    onClick={() => setSelectedTemplateIds((cur) => (checked ? cur.filter((id) => id !== t.id) : [...cur, t.id]))}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-2xl p-3 text-left ring-1 transition-colors",
                      checked ? "bg-primary/[0.06] ring-primary/40" : "ring-border/60 hover:bg-[#F7F6F1] dark:hover:bg-muted/40",
                      already && "cursor-not-allowed opacity-55 hover:bg-transparent",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md ring-1 transition-colors",
                        checked || already ? "bg-primary text-primary-foreground ring-primary" : "bg-white ring-border dark:bg-card",
                      )}
                    >
                      {checked || already ? <Check className="size-3.5" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="text-sm leading-relaxed">{t.text}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-1.5">
                        {cat ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", cat.style)}>{cat.label}</span> : null}
                        {t.exam_type?.name ? <span className="text-[11px] text-muted-foreground">{t.exam_type.name}</span> : null}
                        {already ? <span className="text-[11px] font-medium text-muted-foreground">Already in this session</span> : null}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-xs text-muted-foreground">{dirty && selectedTemplateIds.length ? "Your unsaved edits will be saved first." : " "}</p>
            <div className="flex gap-2">
              <button type="button" className={cn(PILL, "h-9")} onClick={() => setPickerOpen(false)} disabled={adding}>
                Cancel
              </button>
              <button
                type="button"
                disabled={adding || selectedTemplateIds.length === 0}
                onClick={() => void handleAddFromLibrary()}
                className="flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {adding ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Plus aria-hidden="true" className="size-3.5" />}
                {selectedTemplateIds.length ? `Add ${selectedTemplateIds.length} question${selectedTemplateIds.length === 1 ? "" : "s"}` : "Add questions"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
