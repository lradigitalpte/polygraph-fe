"use client";

import * as React from "react";
import { parseReportRichText } from "@/lib/report-rich-text";
import { cn } from "@/lib/utils";

export function ReportRichTextContent({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!text.trim()) return null;
  const segments = parseReportRichText(text);
  return (
    <span className={cn("whitespace-pre-line", className)}>
      {segments.map((segment, index) => (
        <span
          key={`${index}-${segment.text.slice(0, 12)}`}
          className={cn(segment.bold && "font-bold", segment.italic && "italic")}
        >
          {segment.text}
        </span>
      ))}
    </span>
  );
}
