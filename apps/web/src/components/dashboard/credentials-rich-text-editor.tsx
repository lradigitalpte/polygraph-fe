"use client";

import * as React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Underline as UnderlineIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { credentialsToEditorHTML, isCredentialsEmpty } from "@/lib/credentials-rich-text";
import { cn } from "@/lib/utils";

type CredentialsRichTextEditorProps = {
  value: string;
  onChange: (html: string) => void;
  disabled?: boolean;
  className?: string;
};

const credentialsEditorExtensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    link: false,
    bulletList: {
      HTMLAttributes: { class: "list-disc pl-5 my-2 space-y-1" },
    },
    orderedList: {
      HTMLAttributes: { class: "list-decimal pl-5 my-2 space-y-1" },
    },
  }),
  TextAlign.configure({ types: ["heading", "paragraph"] }),
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

export function CredentialsRichTextEditor({
  value,
  onChange,
  disabled,
  className,
}: CredentialsRichTextEditorProps) {
  const lastEmittedRef = React.useRef(value);

  const editor = useEditor({
    extensions: credentialsEditorExtensions,
    content: credentialsToEditorHTML(value),
    editable: !disabled,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        class:
          "credentials-editor min-h-[280px] max-h-[480px] overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = current.getHTML();
      const next = isCredentialsEmpty(html) ? "" : html;
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
    if (isCredentialsEmpty(value) && isCredentialsEmpty(editor.getHTML())) {
      lastEmittedRef.current = value;
      return;
    }
    editor.commands.setContent(credentialsToEditorHTML(value), { emitUpdate: false });
    lastEmittedRef.current = value;
  }, [editor, value]);

  if (!editor) {
    return (
      <div className={cn("rounded-xl border bg-card px-4 py-8 text-sm text-muted-foreground", className)}>
        Loading editor…
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-xl border bg-card", className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b bg-muted/30 px-2 py-1.5">
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
        <ToolbarButton
          title="Heading"
          disabled={disabled}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 className="h-3.5 w-3.5" />
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
        <div className="mx-1 h-5 w-px bg-border" />
        <ToolbarButton
          title="Align left"
          disabled={disabled}
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Align center"
          disabled={disabled}
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Align right"
          disabled={disabled}
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
        >
          <AlignRight className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

export function CredentialsRichTextContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  if (isCredentialsEmpty(html)) return null;
  return (
    <div
      className={cn("credentials-content text-[11px] leading-relaxed text-zinc-800", className)}
      dangerouslySetInnerHTML={{ __html: credentialsToEditorHTML(html) }}
    />
  );
}
