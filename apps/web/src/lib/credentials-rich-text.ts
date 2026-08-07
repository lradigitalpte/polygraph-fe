/** True when TipTap/HTML credentials contain no visible text. */
export function isCredentialsEmpty(value?: string | null): boolean {
  if (!value) return true;
  const text = value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<\/li>/gi, " ")
    .replace(/<\/h[1-6]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\u00a0/g, " ")
    .trim();
  return text.length === 0;
}

/** Convert legacy plain-text credentials into TipTap-friendly HTML. */
export function credentialsToEditorHTML(value?: string | null): string {
  const raw = (value || "").trim();
  if (!raw) return "<p></p>";
  if (/^<[a-z][\s\S]*>/i.test(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((block) => {
      const html = block
        .split("\n")
        .map((line) => escapeHTML(line))
        .join("<br>");
      return `<p>${html}</p>`;
    })
    .join("");
}

function escapeHTML(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
