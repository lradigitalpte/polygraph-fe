"use client";

import * as React from "react";
import { GripVertical, ListChecks, Loader2, Pencil, Plus, Search, X } from "lucide-react";
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

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/dashboard/ui-kit";
import { fetchExamTypes, type ExamTypeRecord } from "@/lib/exam-booking";
import {
  createQuestionTemplate,
  fetchQuestionTemplates,
  updateQuestionTemplate,
  type QuestionCategory,
  type QuestionTemplateRecord,
} from "@/lib/question-templates";
import { cn } from "@/lib/utils";

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";

const CATEGORIES: { value: QuestionCategory; label: string; hint: string }[] = [
  { value: "relevant", label: "Relevant", hint: "About the issue being tested" },
  { value: "comparison", label: "Comparison", hint: "Control questions to compare reactions against" },
  { value: "irrelevant", label: "Irrelevant", hint: "Neutral baseline questions" },
];

const CATEGORY_TONE: Record<QuestionCategory, string> = {
  relevant: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary",
  comparison: "bg-[#EFEBFE] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200",
  irrelevant: "bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
};

const PLACEHOLDERS = [
  { token: "{{subject_name}}", label: "Examinee name" },
  { token: "{{client_name}}", label: "Client name" },
  { token: "{{exam_date}}", label: "Exam date" },
];

/** Sentinel id for untagged questions (offered for every exam type). */
const ANY = 0;

type FormState = {
  examTypeId: number;
  category: QuestionCategory;
  text: string;
  active: boolean;
};

type DraftItem = FormState & { key: string };

export default function QuestionLibrarySettingsPage() {
  const [examTypes, setExamTypes] = React.useState<ExamTypeRecord[]>([]);
  const [templates, setTemplates] = React.useState<QuestionTemplateRecord[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [selected, setSelected] = React.useState<number>(ANY);
  const [search, setSearch] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState<"all" | QuestionCategory>("all");
  const [showInactive, setShowInactive] = React.useState(true);
  const [togglingId, setTogglingId] = React.useState<number | null>(null);

  // One dialog for both adding (a batch) and editing (a single question).
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<QuestionTemplateRecord | null>(null);
  const [form, setForm] = React.useState<FormState>({ examTypeId: ANY, category: "relevant", text: "", active: true });
  const [drafts, setDrafts] = React.useState<DraftItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const load = React.useCallback(async () => {
    try {
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

  const examTypeName = React.useCallback(
    (id: number) => (id === ANY ? "Any exam type" : examTypes.find((t) => t.id === id)?.name || `Exam type #${id}`),
    [examTypes],
  );

  const byGroup = React.useMemo(() => {
    const groups = new Map<number, QuestionTemplateRecord[]>();
    for (const t of templates) {
      const key = t.exam_type_id ?? ANY;
      groups.set(key, [...(groups.get(key) ?? []), t]);
    }
    for (const list of groups.values()) list.sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
    return groups;
  }, [templates]);

  /** Left-hand list: "Any exam type" first, then types with questions, then the rest. */
  const groupList = React.useMemo(() => {
    const ids = new Set<number>([ANY, ...examTypes.map((t) => t.id), ...byGroup.keys()]);
    return [...ids]
      .map((id) => {
        const items = byGroup.get(id) ?? [];
        const active = items.filter((t) => t.active).length;
        const archivedType = id !== ANY && examTypes.find((t) => t.id === id)?.active === false;
        return { id, name: examTypeName(id), total: items.length, active, archivedType };
      })
      .sort((a, b) => {
        if (a.id === ANY) return -1;
        if (b.id === ANY) return 1;
        if ((a.total > 0) !== (b.total > 0)) return a.total > 0 ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
  }, [byGroup, examTypes, examTypeName]);

  // On first load, open the first group that actually has questions.
  const pickedInitial = React.useRef(false);
  React.useEffect(() => {
    if (loading || pickedInitial.current) return;
    pickedInitial.current = true;
    const first = groupList.find((g) => g.total > 0);
    if (first) setSelected(first.id);
  }, [loading, groupList]);

  const groupItems = byGroup.get(selected) ?? [];
  const needle = search.trim().toLowerCase();
  const filtering = needle !== "" || categoryFilter !== "all" || !showInactive;
  const visibleItems = groupItems.filter(
    (t) => (showInactive || t.active) && (categoryFilter === "all" || t.category === categoryFilter) && (!needle || t.text.toLowerCase().includes(needle)),
  );
  const categoryCounts = CATEGORIES.map((c) => ({ ...c, count: groupItems.filter((t) => t.category === c.value && t.active).length }));

  /* ---------------- dialog ---------------- */

  const openCreate = (examTypeId = selected) => {
    setEditing(null);
    setForm({ examTypeId, category: "relevant", text: "", active: true });
    setDrafts([]);
    setDialogOpen(true);
  };

  const openEdit = (template: QuestionTemplateRecord) => {
    setEditing(template);
    setForm({ examTypeId: template.exam_type_id ?? ANY, category: template.category, text: template.text, active: template.active });
    setDrafts([]);
    setDialogOpen(true);
  };

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  const insertPlaceholder = (token: string) => {
    const el = textRef.current;
    if (!el) {
      setField("text", `${form.text}${token}`);
      return;
    }
    const start = el.selectionStart ?? form.text.length;
    const end = el.selectionEnd ?? form.text.length;
    const next = form.text.slice(0, start) + token + form.text.slice(end);
    setField("text", next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const queueCurrent = () => {
    if (!form.text.trim()) {
      toast.error("Write the question first");
      return;
    }
    setDrafts((current) => [...current, { ...form, text: form.text.trim(), key: crypto.randomUUID() }]);
    // Consecutive questions usually share exam type and category; only clear the text.
    setForm((current) => ({ ...current, text: "" }));
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const handleDraftDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setDrafts((current) => {
      const from = current.findIndex((d) => d.key === active.id);
      const to = current.findIndex((d) => d.key === over.id);
      return from === -1 || to === -1 ? current : arrayMove(current, from, to);
    });
  };

  const pendingCount = drafts.length + (form.text.trim() ? 1 : 0);

  const handleSave = async () => {
    if (editing) {
      if (!form.text.trim()) {
        toast.error("Question text is required");
        return;
      }
      setSaving(true);
      try {
        const updated = await updateQuestionTemplate(editing.id, {
          exam_type_id: form.examTypeId || 0,
          category: form.category,
          text: form.text.trim(),
          active: form.active,
        });
        setTemplates((current) => current.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Question updated");
        setDialogOpen(false);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save question");
      } finally {
        setSaving(false);
      }
      return;
    }

    // Adding: save the queue plus whatever is still in the box.
    const items = form.text.trim() ? [...drafts, { ...form, text: form.text.trim(), key: "__current__" }] : drafts;
    if (items.length === 0) {
      toast.error("Add at least one question");
      return;
    }
    setSaving(true);
    const created: QuestionTemplateRecord[] = [];
    try {
      for (const item of items) {
        const examTypeId = item.examTypeId || 0;
        const nextSortOrder =
          [...templates, ...created].filter((t) => (t.exam_type_id ?? 0) === examTypeId).reduce((max, t) => Math.max(max, t.sort_order), -1) + 1;
        created.push(
          await createQuestionTemplate({ exam_type_id: examTypeId, category: item.category, text: item.text, sort_order: nextSortOrder, active: item.active }),
        );
      }
      toast.success(`Added ${created.length} question${created.length === 1 ? "" : "s"}`);
      setDialogOpen(false);
      setSelected(items[items.length - 1].examTypeId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save questions");
    } finally {
      // Keep whatever made it in, even if a later one failed.
      if (created.length) setTemplates((current) => [...current, ...created]);
      setSaving(false);
    }
  };

  /* ---------------- list actions ---------------- */

  const toggleActive = async (template: QuestionTemplateRecord) => {
    setTogglingId(template.id);
    try {
      const updated = await updateQuestionTemplate(template.id, { active: !template.active });
      setTemplates((current) => current.map((t) => (t.id === template.id ? { ...t, ...updated, active: !template.active } : t)));
      toast.success(template.active ? "Question turned off — it won't be added to new sessions" : "Question turned back on");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update question");
    } finally {
      setTogglingId(null);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = groupItems.findIndex((t) => String(t.id) === String(active.id));
    const to = groupItems.findIndex((t) => String(t.id) === String(over.id));
    if (from === -1 || to === -1) return;

    const reordered = arrayMove(groupItems, from, to).map((t, index) => ({ ...t, sort_order: index }));
    const changed = reordered.filter((t) => groupItems.find((g) => g.id === t.id)?.sort_order !== t.sort_order);
    setTemplates((current) => [...current.filter((t) => (t.exam_type_id ?? ANY) !== selected), ...reordered]);
    try {
      await Promise.all(changed.map((t) => updateQuestionTemplate(t.id, { sort_order: t.sort_order })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save the new order");
      void load();
    }
  };

  const selectedName = examTypeName(selected);
  const canDrag = !filtering;

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em]">Question library</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Default questions for each exam type. Starting a session copies them in, so editing here never changes a past exam&apos;s record.
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCreate()}
          disabled={loading}
          className="flex h-10 items-center gap-2 self-start rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 sm:self-auto dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add questions
        </button>
      </div>

      {error ? (
        <div className="flex flex-col items-center gap-3 rounded-[26px] bg-white px-6 py-12 text-center ring-1 ring-border/50 dark:bg-card">
          <p className="text-sm text-destructive">{error}</p>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              void load();
            }}
            className="flex h-9 items-center rounded-full px-4 text-sm font-medium ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted"
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
          {/* Exam type picker — list on desktop, dropdown on mobile */}
          <div className="lg:hidden">
            <Select value={String(selected)} onValueChange={(v) => setSelected(Number(v))}>
              <SelectTrigger aria-label="Exam type" className={cn(FIELD, "w-full bg-white dark:bg-card")}>
                <SelectValue>{selectedName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {groupList.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name} ({g.active})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <nav
            aria-label="Exam types"
            className="hidden max-h-[calc(100vh-12rem)] flex-col gap-0.5 self-start overflow-y-auto rounded-[26px] bg-white p-2 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 no-scrollbar lg:sticky lg:top-0 lg:flex dark:bg-card"
          >
            {loading
              ? Array.from({ length: 7 }, (_, i) => <div key={i} aria-hidden="true" className="m-1 h-9 animate-pulse rounded-xl bg-[#F3F1EA] dark:bg-muted" />)
              : groupList.map((g, index) => {
                  const isActive = g.id === selected;
                  const firstEmpty = g.total === 0 && index > 0 && groupList[index - 1].total > 0;
                  return (
                    <React.Fragment key={g.id}>
                      {firstEmpty ? <span className="mt-2 mb-1 px-3 text-[11px] font-medium tracking-[0.08em] text-muted-foreground/80 uppercase">No questions yet</span> : null}
                      <button
                        type="button"
                        onClick={() => setSelected(g.id)}
                        aria-current={isActive ? "true" : undefined}
                        className={cn(
                          "flex h-10 shrink-0 items-center justify-between gap-2 rounded-[13px] px-3 text-left text-[14px] transition-colors",
                          isActive
                            ? "bg-primary/12 font-medium text-[oklch(0.45_0.12_39)] dark:text-primary"
                            : cn("hover:bg-[#F3F1EA] dark:hover:bg-muted", g.total === 0 ? "text-muted-foreground" : "text-[#3D3929] dark:text-foreground"),
                        )}
                      >
                        <span className="truncate">
                          {g.name}
                          {g.archivedType ? <span className="ml-1 text-xs text-muted-foreground">(hidden)</span> : null}
                        </span>
                        {g.total > 0 ? (
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                              isActive ? "bg-white/70 dark:bg-background/40" : "bg-[#F3F1EA] dark:bg-muted",
                            )}
                          >
                            {g.active}
                          </span>
                        ) : null}
                      </button>
                      {g.id === ANY ? <span aria-hidden="true" className="mx-3 my-1.5 h-px bg-border/60" /> : null}
                    </React.Fragment>
                  );
                })}
          </nav>

          {/* Questions for the selected exam type */}
          <section aria-labelledby="group-title" className="flex min-w-0 flex-col gap-4 rounded-[26px] bg-white p-4 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-6 dark:bg-card">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 id="group-title" className="truncate text-[17px] font-medium tracking-[-0.01em]">
                  {selectedName}
                </h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {selected === ANY ? "Offered for every exam type, alongside that type's own questions." : "Added when a session for this exam type is populated."}
                </p>
                {groupItems.length > 0 ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {categoryCounts.map((c) => (
                      <span key={c.value} className={cn("rounded-full px-2 py-0.5 text-xs font-medium tabular-nums", CATEGORY_TONE[c.value])}>
                        {c.count} {c.label.toLowerCase()}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => openCreate(selected)}
                className="flex h-9 shrink-0 items-center gap-1.5 self-start rounded-full px-3.5 text-[13px] font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                <Plus aria-hidden="true" className="size-3.5" />
                Add here
              </button>
            </div>

            {groupItems.length > 0 ? (
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <Segmented
                  label="Category"
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  options={[{ value: "all", label: "All" }, ...CATEGORIES.map((c) => ({ value: c.value, label: c.label }))]}
                  className="[&_button]:h-8 [&_button]:px-3 [&_button]:text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1 lg:w-60 lg:flex-initial">
                    <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      aria-label="Search questions"
                      placeholder="Search questions"
                      className={cn(FIELD, "h-9 rounded-full pl-9 text-[13px]")}
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    aria-pressed={!showInactive}
                    onClick={() => setShowInactive((v) => !v)}
                    className={cn(
                      "h-9 shrink-0 rounded-full px-3 text-[13px] whitespace-nowrap transition-colors",
                      !showInactive ? "bg-[#30302E] font-medium text-[#FAF9F5] dark:bg-[#ECE9E0] dark:text-[#1A1915]" : "ring-1 ring-border hover:bg-[#F3F1EA] dark:hover:bg-muted",
                    )}
                  >
                    {showInactive ? "Hide turned-off" : "Show turned-off"}
                  </button>
                </div>
              </div>
            ) : null}

            {loading ? (
              <div aria-hidden="true" className="flex flex-col gap-2">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="h-16 animate-pulse rounded-2xl bg-[#F7F6F1] dark:bg-muted/40" />
                ))}
              </div>
            ) : groupItems.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl bg-[#F7F6F1] px-6 py-12 text-center dark:bg-muted/40">
                <span className="flex size-11 items-center justify-center rounded-full bg-white dark:bg-card">
                  <ListChecks aria-hidden="true" className="size-5 text-muted-foreground" />
                </span>
                <div>
                  <p className="text-sm font-medium">No questions for {selectedName} yet</p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {selected === ANY ? "Questions here are offered for every exam type." : "Sessions of this type will only get the “Any exam type” questions."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openCreate(selected)}
                  className="flex h-9 items-center gap-1.5 rounded-full bg-[#30302E] px-4 text-[13px] font-medium text-[#FAF9F5] dark:bg-[#ECE9E0] dark:text-[#1A1915]"
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Add the first question
                </button>
              </div>
            ) : visibleItems.length === 0 ? (
              <p className="rounded-2xl bg-[#F7F6F1] px-4 py-8 text-center text-sm text-muted-foreground dark:bg-muted/40">No questions match these filters.</p>
            ) : (
              <>
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => void handleDragEnd(e)}>
                  <SortableContext items={visibleItems.map((t) => String(t.id))} strategy={verticalListSortingStrategy}>
                    <ol className="flex flex-col gap-2">
                      {visibleItems.map((t) => (
                        <QuestionRow
                          key={t.id}
                          template={t}
                          number={groupItems.indexOf(t) + 1}
                          canDrag={canDrag}
                          toggling={togglingId === t.id}
                          onEdit={() => openEdit(t)}
                          onToggle={() => void toggleActive(t)}
                        />
                      ))}
                    </ol>
                  </SortableContext>
                </DndContext>
                <p className="px-1 text-xs text-muted-foreground">
                  {canDrag ? "Drag the handle to change the order questions are added in." : "Clear the filters to reorder."}
                </p>
              </>
            )}
          </section>
        </div>
      )}

      {/* Add / edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl flex-col gap-0 overflow-hidden rounded-[28px] p-0 sm:max-w-3xl sm:rounded-[28px] dark:bg-card">
          <div className="flex shrink-0 items-start gap-4 border-b border-border/50 px-6 pt-6 pr-14 pb-5 sm:px-8 sm:pt-7">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#F3F1EA] text-[#3D3929] dark:bg-muted dark:text-foreground">
              <ListChecks aria-hidden="true" className="size-5" />
            </span>
            <DialogHeader className="min-w-0 gap-1 text-left">
              <DialogTitle className="text-xl font-medium tracking-[-0.01em]">{editing ? "Edit question" : "Add questions"}</DialogTitle>
              <DialogDescription className="text-[13px]">
                {editing ? "Changes apply to sessions populated from now on." : "Write a question, press Add to queue it, and save them all together."}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
            <div className="grid gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <span className="px-1 text-[13px] font-medium">Exam type</span>
                  <Select value={String(form.examTypeId)} onValueChange={(v) => setField("examTypeId", Number(v))}>
                    <SelectTrigger aria-label="Exam type" className={cn(FIELD, "w-full")}>
                      <SelectValue>{examTypeName(form.examTypeId)}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(ANY)}>Any exam type</SelectItem>
                      {[...examTypes]
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((type) => (
                          <SelectItem key={type.id} value={String(type.id)}>
                            {type.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <p className="px-1 text-xs text-muted-foreground">&ldquo;Any exam type&rdquo; questions are offered for every booking.</p>
                </div>
                <div className="grid content-start gap-1.5">
                  <span className="px-1 text-[13px] font-medium">Category</span>
                  <Segmented label="Category" value={form.category} onChange={(v) => setField("category", v)} options={CATEGORIES} className="w-fit" />
                  <p className="px-1 text-xs text-muted-foreground">{CATEGORIES.find((c) => c.value === form.category)?.hint}</p>
                </div>
              </div>

              <div className="grid gap-1.5">
                <label htmlFor="question-text" className="px-1 text-[13px] font-medium">
                  Question
                </label>
                <Textarea
                  id="question-text"
                  ref={textRef}
                  className="min-h-32 rounded-xl border-0 bg-[#F3F1EA] px-3.5 py-3 text-[15px] leading-relaxed shadow-none dark:bg-muted"
                  placeholder="Did you take any money from {{client_name}}?"
                  value={form.text}
                  onChange={(e) => setField("text", e.target.value)}
                  onKeyDown={(e) => {
                    if (!editing && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      queueCurrent();
                    }
                  }}
                />
                <div className="flex flex-wrap items-center gap-1.5 px-1">
                  <span className="text-xs text-muted-foreground">Insert:</span>
                  {PLACEHOLDERS.map((p) => (
                    <button
                      key={p.token}
                      type="button"
                      onClick={() => insertPlaceholder(p.token)}
                      title={p.token}
                      className="h-7 rounded-full px-2.5 text-xs ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-start justify-between gap-4 rounded-2xl bg-[#F7F6F1] p-4 dark:bg-muted/40">
                <div className="min-w-0">
                  <p className="text-sm font-medium">On</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">When off, it stays in the library but isn&apos;t added to new sessions.</p>
                </div>
                <Switch checked={form.active} onChange={() => setField("active", !form.active)} label="Question on" />
              </div>

              {!editing ? (
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={queueCurrent}
                    disabled={!form.text.trim()}
                    className="flex h-10 items-center justify-center gap-2 rounded-full text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] disabled:opacity-50 dark:hover:bg-muted"
                  >
                    <Plus aria-hidden="true" className="size-4" />
                    Add to list and write another
                    <kbd className="ml-1 hidden rounded bg-[#F3F1EA] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline dark:bg-muted">Ctrl ↵</kbd>
                  </button>

                  {drafts.length > 0 ? (
                    <div className="grid gap-2 pt-2">
                      <p className="px-1 text-[13px] font-medium">Queued · {drafts.length}</p>
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDraftDragEnd}>
                        <SortableContext items={drafts.map((d) => d.key)} strategy={verticalListSortingStrategy}>
                          <ol className="grid gap-2">
                            {drafts.map((d, i) => (
                              <DraftRow
                                key={d.key}
                                item={d}
                                number={i + 1}
                                examTypeName={d.examTypeId !== form.examTypeId ? examTypeName(d.examTypeId) : undefined}
                                onRemove={() => setDrafts((current) => current.filter((x) => x.key !== d.key))}
                              />
                            ))}
                          </ol>
                        </SortableContext>
                      </DndContext>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border/50 px-6 py-4 sm:flex-row sm:items-center sm:justify-end sm:px-8">
            <button
              type="button"
              onClick={() => setDialogOpen(false)}
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || (editing ? !form.text.trim() : pendingCount === 0)}
              className="flex h-10 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-[#ECE9E0] dark:text-[#1A1915] dark:hover:bg-white"
            >
              {saving ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {saving ? "Saving…" : editing ? "Save changes" : `Save ${pendingCount || ""} question${pendingCount === 1 ? "" : "s"}`.replace("  ", " ")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function CategoryChip({ category }: { category: QuestionCategory }) {
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-medium", CATEGORY_TONE[category])}>
      {CATEGORIES.find((c) => c.value === category)?.label ?? category}
    </span>
  );
}

/** Make {{placeholders}} visible in the list. */
function QuestionText({ text, muted }: { text: string; muted?: boolean }) {
  const parts = text.split(/(\{\{[a-z_]+\}\})/g);
  return (
    <p className={cn("text-[15px] leading-relaxed", muted && "text-muted-foreground")}>
      {parts.map((part, i) =>
        /^\{\{[a-z_]+\}\}$/.test(part) ? (
          <span key={i} className="rounded-md bg-[#EFEBFE] px-1 py-px font-mono text-[12px] text-[#3B2E86] dark:bg-violet-950 dark:text-violet-200">
            {PLACEHOLDERS.find((p) => p.token === part)?.label ?? part}
          </span>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </p>
  );
}

function QuestionRow({
  template,
  number,
  canDrag,
  toggling,
  onEdit,
  onToggle,
}: {
  template: QuestionTemplateRecord;
  number: number;
  canDrag: boolean;
  toggling: boolean;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(template.id), disabled: !canDrag });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "group flex items-start gap-3 rounded-2xl bg-[#F7F6F1] p-3 pr-2 transition-shadow sm:p-4 sm:pr-3 dark:bg-muted/40",
        isDragging && "relative z-10 shadow-lg ring-1 ring-border",
        !template.active && "opacity-60",
      )}
    >
      <button
        type="button"
        aria-label={`Drag question ${number} to reorder`}
        disabled={!canDrag}
        className="mt-0.5 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-white hover:text-foreground active:cursor-grabbing disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent dark:hover:bg-card"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <span className="mt-1 w-5 shrink-0 text-right text-xs text-muted-foreground tabular-nums">{number}</span>
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
        <QuestionText text={template.text} />
        <span className="mt-1.5 flex flex-wrap items-center gap-2">
          <CategoryChip category={template.category} />
          {!template.active ? <span className="text-xs text-muted-foreground">Off — not added to new sessions</span> : null}
        </span>
      </button>
      <div className="flex shrink-0 items-center gap-1">
        <Switch checked={template.active} disabled={toggling} onChange={onToggle} label={template.active ? "Turn question off" : "Turn question on"} />
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit question ${number}`}
          title="Edit"
          className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:hover:bg-card"
        >
          <Pencil aria-hidden="true" className="size-4" />
        </button>
      </div>
    </li>
  );
}

function DraftRow({ item, number, examTypeName, onRemove }: { item: DraftItem; number: number; examTypeName?: string; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-start gap-2 rounded-2xl bg-[#F7F6F1] p-2.5 dark:bg-muted/40", isDragging && "relative z-10 shadow-lg")}
    >
      <button
        type="button"
        aria-label={`Drag queued question ${number}`}
        className="mt-0.5 flex size-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg text-muted-foreground hover:bg-white active:cursor-grabbing dark:hover:bg-card"
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" className="size-4" />
      </button>
      <div className="min-w-0 flex-1 py-0.5">
        <QuestionText text={item.text} />
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <CategoryChip category={item.category} />
          {examTypeName ? <span className="text-xs text-muted-foreground">{examTypeName}</span> : null}
          {!item.active ? <span className="text-xs text-muted-foreground">Off</span> : null}
        </span>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove queued question ${number}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-card"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}

function Switch({ checked, disabled, onChange, label }: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60",
        checked ? "bg-[#30302E] dark:bg-[#5FA86C]" : "bg-[#D9D5CA] dark:bg-zinc-600",
      )}
    >
      <span
        aria-hidden="true"
        className={cn("absolute top-0.5 left-0.5 block size-5 rounded-full bg-white shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0")}
      />
    </button>
  );
}
