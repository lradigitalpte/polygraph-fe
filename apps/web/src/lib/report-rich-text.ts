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

export function wrapRichTextSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  marker: "**" | "_",
): string {
  const selected = value.slice(selectionStart, selectionEnd);
  const wrapped = `${marker}${selected || "text"}${marker}`;
  return value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** True when TipTap/HTML or plain report rich text has no visible content. */
export function isReportRichTextEmpty(value?: string | null): boolean {
  return richTextToPlain(value).length === 0;
}

/** Strip tags / markup to plain visible text. */
export function richTextToPlain(value?: string | null): string {
  if (!value) return "";
  if (/^<[a-z][\s\S]*>/i.test(value.trim())) {
    return value
      .replace(/<br\s*\/?>/gi, " ")
      .replace(/<\/(p|div|li|h[1-6])>/gi, " ")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/\u00a0/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return value.replace(/\*\*/g, "").replace(/_/g, "").replace(/\s+/g, " ").trim();
}

function markupLineToHTML(line: string): string {
  return parseReportRichText(line)
    .map((segment) => {
      let html = escapeHTML(segment.text);
      if (segment.bold) html = `<strong>${html}</strong>`;
      if (segment.italic) html = `<em>${html}</em>`;
      return html;
    })
    .join("");
}

/** Convert legacy markdown/plain text (or pass through HTML) into TipTap HTML. */
export function reportToEditorHTML(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "<p></p>";
  if (/^<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const html = block.split("\n").map((line) => markupLineToHTML(line)).join("<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}
