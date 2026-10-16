const INVOICE_NUMBER_DIGITS = 6;

function invoiceNumericValue(code: string | undefined | null, quotationId?: number): number | null {
  const raw = (code || "").trim();
  if (raw) {
    const withoutPrefix = raw.toUpperCase().startsWith("INV-") ? raw.slice(4).trim() : raw;
    const digits = withoutPrefix.replace(/\D/g, "");
    if (digits) {
      const n = parseInt(digits, 10);
      if (Number.isFinite(n)) return n;
    }
  }
  if (quotationId != null && quotationId > 0) {
    return 9000 + quotationId;
  }
  return null;
}

/** Invoice number on PDFs and headers: numeric only, zero-padded to 6 digits (e.g. 009278). */
export function formatInvoiceDisplayNumber(code: string | undefined | null, quotationId?: number): string {
  const n = invoiceNumericValue(code, quotationId);
  if (n == null) return "—";
  const s = String(n);
  return s.length >= INVOICE_NUMBER_DIGITS ? s : s.padStart(INVOICE_NUMBER_DIGITS, "0");
}
