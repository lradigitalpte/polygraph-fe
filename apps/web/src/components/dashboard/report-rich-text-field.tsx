"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, List, ListOrdered, Underline as UnderlineIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { isReportRichTextEmpty, reportToEditorHTML } from "@/lib/report-rich-text";
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

const reportEditorExtensions = [
  StarterKit.configure({
    heading: false,
    link: false,
    bulletList: {
      HTMLAttributes: { class: "list-disc pl-5 my-1 space-y-0.5" },
    },
    orderedList: {
      HTMLAttributes: { class: "list-decimal pl-5 my-1 space-y-0.5" },
    },
  }),
];

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="icon"
      variant={active ? "secondary" : "ghost"}
      className={cn("h-8 w-8 rounded-lg", active && "bg-primary/10 text-primary")}
      disabled={disabled}
      onClick={onClick}
      title={title}
    >
      {children}
    </Button>
  );
}

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
  const lastEmittedRef = React.useRef(value);
  const minHeight = Math.max(72, rows * 22);

  const editor = useEditor({
    extensions: reportEditorExtensions,
    content: reportToEditorHTML(value),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        id: id || "",
        class: cn(
          "report-rich-editor px-3 py-2 text-xs leading-relaxed outline-none focus:outline-none overflow-y-auto",
          className,
        ),
        style: `min-height:${minHeight}px`,
        "data-placeholder": placeholder || "",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      const next = isReportRichTextEmpty(html) ? "" : html;
      lastEmittedRef.current = next;
      onChange(next);
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [disabled, editor]);

  React.useEffect(() => {
    if (!editor) return;
    if (value === lastEmittedRef.current) return;
    if (isReportRichTextEmpty(value) && isReportRichTextEmpty(editor.getHTML())) {
      lastEmittedRef.current = value;
      return;
    }
    editor.commands.setContent(reportToEditorHTML(value), { emitUpdate: false });
    lastEmittedRef.current = value;
  }, [editor, value]);

  if (!editor) {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border bg-card px-3 py-6 text-xs text-muted-foreground">Loading editor…</div>
        {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-1.5 py-1">
          <ToolbarButton
            title="Bold"
            disabled={disabled}
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Italic"
            disabled={disabled}
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Underline"
            disabled={disabled}
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </ToolbarButton>
          <div className="mx-1 h-5 w-px bg-border" />
          <ToolbarButton
            title="Bullet list"
            disabled={disabled}
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </ToolbarButton>
          <ToolbarButton
            title="Numbered list"
            disabled={disabled}
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </ToolbarButton>
        </div>
        <EditorContent editor={editor} />
      </div>
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
