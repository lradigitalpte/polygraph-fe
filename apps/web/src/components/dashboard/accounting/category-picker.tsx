"use client";

import * as React from "react";
import { Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const DEFAULT_CATEGORIES = ["General", "Office supplies", "Software", "Travel", "Utilities", "Rent", "Marketing", "Equipment", "Professional fees"];

/**
 * Pick a category with one click, or add your own. A category only exists because
 * something uses it, so `known` should carry what past expenses and catalog items use.
 */
export function CategoryPicker({
  value,
  onChange,
  known = [],
  label = "Category",
}: {
  value: string;
  onChange: (category: string) => void;
  known?: string[];
  label?: string;
}) {
  const labelId = React.useId();
  const [added, setAdded] = React.useState<string[]>([]);
  const [adding, setAdding] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const categories = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const c of [...DEFAULT_CATEGORIES, ...known, ...added, value]) {
      const name = (c || "").trim();
      if (name && !seen.has(name.toLowerCase())) seen.set(name.toLowerCase(), name);
    }
    const rest = Array.from(seen.values()).filter((c) => c.toLowerCase() !== "general").sort((a, b) => a.localeCompare(b));
    return ["General", ...rest];
  }, [known, added, value]);

  function commit() {
    const name = draft.trim().replace(/\s+/g, " ");
    setAdding(false);
    setDraft("");
    if (!name) return;
    const existing = categories.find((c) => c.toLowerCase() === name.toLowerCase());
    if (existing) {
      onChange(existing);
      return;
    }
    setAdded((list) => [...list, name]);
    onChange(name);
  }

  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="px-1 text-[13px] font-medium">
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {categories.map((c) => {
          const active = c.toLowerCase() === value.trim().toLowerCase();
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c)}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
                active ? "bg-primary text-white shadow-sm" : "bg-[#F3F1EA] text-[#3D3929] hover:bg-[#ECE9E0] dark:bg-muted dark:text-foreground",
              )}
            >
              {active ? <Check aria-hidden="true" className="size-3.5" strokeWidth={3} /> : null}
              {c}
            </button>
          );
        })}
        {adding ? (
          <input
            autoFocus
            aria-label="New category name"
            placeholder="New category"
            value={draft}
            maxLength={40}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setAdding(false);
                setDraft("");
              }
            }}
            onBlur={commit}
            className="ring-primary h-9 w-40 rounded-full bg-white px-3.5 text-[13px] ring-2 outline-none dark:bg-card"
          />
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex h-9 items-center gap-1 rounded-full px-3 text-[13px] font-medium text-muted-foreground ring-1 ring-border transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
          >
            <Plus aria-hidden="true" className="size-3.5" />
            New
          </button>
        )}
      </div>
    </div>
  );
}
