"use client";

import * as React from "react";
import {
  isReportRichTextEmpty,
  parseReportRichText,
  reportToEditorHTML,
} from "@/lib/report-rich-text";
import { cn } from "@/lib/utils";

export function ReportRichTextContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (isReportRichTextEmpty(text)) return null;

  const trimmed = text.trim();
  if (/^<[a-z][\s\S]*>/i.test(trimmed)) {
    return (
      <div
        className={cn("report-rich-content", className)}
        dangerouslySetInnerHTML={{ __html: reportToEditorHTML(text) }}
      />
    );
  }

  const segments = parseReportRichText(text);
  return (
    <div className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text.slice(0, 12)}`}
          className={cn(segment.bold && "font-bold", segment.italic && "italic")}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
}
