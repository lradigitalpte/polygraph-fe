"use client";

import * as React from "react";
import { Bold, Italic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { wrapRichTextSelection } from "@/lib/report-rich-text";
import { cn } from "@/lib/utils";

type ReportRichTextFieldProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
  placeholder?: string;
  className?: string;
  hint?: string;
};

export function ReportRichTextField({
  id,
  value,
  onChange,
  disabled,
  rows = 3,
  placeholder,
  className,
  hint,
}: ReportRichTextFieldProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const applyWrap = (marker: "**" | "_") => {
    const el = textareaRef.current;
    if (!el || disabled) return;
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = wrapRichTextSelection(value, start, end, marker);
    onChange(next);
    window.requestAnimationFrame(() => {
      el.focus();
      const cursor = start + marker.length + (end > start ? end - start : 4) + marker.length;
      el.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 rounded-lg"
          disabled={disabled}
          onClick={() => applyWrap("**")}
          title="Bold (**text**)"
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 rounded-lg"
          disabled={disabled}
          onClick={() => applyWrap("_")}
          title="Italic (_text_)"
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[10px] text-muted-foreground pl-1">Use **bold** or _italic_ in text</span>
      </div>
      <Textarea
        ref={textareaRef}
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={cn("rounded-xl text-xs bg-card", className)}
      />
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
