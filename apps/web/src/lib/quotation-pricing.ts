/** Compute VAT and invoice total from subtotal after discount. */
export function computeQuotationTotal(input: {
  subtotal: number;
  discountAmount?: number;
  vatRate?: number;
  applyVat?: boolean;
}) {
  const subtotal = Math.max(0, input.subtotal);
  const discount = Math.min(Math.max(0, input.discountAmount ?? 0), subtotal);
  const afterDiscount = Math.max(0, subtotal - discount);
  const rate = Math.max(0, input.vatRate ?? 0);
  const vatAmount = input.applyVat !== false && rate > 0 ? (afterDiscount * rate) / 100 : 0;
  const total = afterDiscount + vatAmount;
  return {
    subtotal,
    discountAmount: discount,
    afterDiscount,
    vatRate: rate,
    vatAmount: Math.round(vatAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
