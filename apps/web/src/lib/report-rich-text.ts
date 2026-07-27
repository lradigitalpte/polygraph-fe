export type RichTextSegment = {
  text: string;
  bold?: boolean;
  italic?: boolean;
};

/** Parse lightweight markup: **bold**, _italic_ */
export function parseReportRichText(input: string): RichTextSegment[] {
  const segments: RichTextSegment[] = [];
  let i = 0;
  while (i < input.length) {
    if (input.startsWith("**", i)) {
      const end = input.indexOf("**", i + 2);
      if (end > i + 2) {
        segments.push({ text: input.slice(i + 2, end), bold: true });
        i = end + 2;
        continue;
      }
    }
    if (input[i] === "_" && input[i + 1] !== " ") {
      const end = input.indexOf("_", i + 1);
      if (end > i + 1) {
        segments.push({ text: input.slice(i + 1, end), italic: true });
        i = end + 1;
        continue;
      }
    }
    let next = input.length;
    const boldAt = input.indexOf("**", i);
    const italicAt = input.indexOf("_", i);
    if (boldAt >= 0) next = Math.min(next, boldAt);
    if (italicAt >= 0) next = Math.min(next, italicAt);
    segments.push({ text: input.slice(i, next) });
    i = next;
  }
  return segments.filter((segment) => segment.text.length > 0);
}

export function wrapRichTextSelection(value: string, selectionStart: number, selectionEnd: number, marker: "**" | "_"): string {
  const selected = value.slice(selectionStart, selectionEnd);
  const wrapped = `${marker}${selected || "text"}${marker}`;
  return value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
}
