/** Invoice number shown on PDFs and emails (no INV- prefix). */
export function formatInvoiceDisplayNumber(code: string | undefined | null, quotationId?: number): string {
  const raw = (code || "").trim();
  if (raw) {
    const upper = raw.toUpperCase();
    if (upper.startsWith("INV-")) {
      return raw.slice(4).trim() || raw;
    }
    return raw;
  }
  if (quotationId != null && quotationId > 0) {
    return String(9000 + quotationId);
  }
  return "—";
}
