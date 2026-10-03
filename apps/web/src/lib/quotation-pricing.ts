import { wholeMoneyAmount } from "@/lib/client-account";

/** Compute VAT and invoice total from subtotal after discount (whole currency units only). */
export function computeQuotationTotal(input: {
  subtotal: number;
  discountAmount?: number;
  vatRate?: number;
  applyVat?: boolean;
}) {
  const subtotal = wholeMoneyAmount(Math.max(0, input.subtotal));
  const discountRaw = Math.min(Math.max(0, input.discountAmount ?? 0), subtotal);
  const discount = wholeMoneyAmount(discountRaw);
  const afterDiscount = Math.max(0, subtotal - discount);
  const rate = Math.max(0, input.vatRate ?? 0);
  const vatRaw =
    input.applyVat !== false && rate > 0 ? (afterDiscount * rate) / 100 : 0;
  const vatAmount = wholeMoneyAmount(vatRaw);
  const total = afterDiscount + vatAmount;
  return {
    subtotal,
    discountAmount: discount,
    afterDiscount,
    vatRate: rate,
    vatAmount,
    total,
  };
}

/** Recompute display/storage totals from quotation fields (whole currency units). */
export function normalizedQuotationAmounts(quote: {
  amount?: number;
  subtotal_amount?: number;
  discount_amount?: number;
  vat_rate?: number;
  vat_amount?: number;
}) {
  const subtotal = wholeMoneyAmount(Number(quote.subtotal_amount || quote.amount || 0));
  const discount = wholeMoneyAmount(Number(quote.discount_amount || 0));
  const vatRate = Number(quote.vat_rate || 0);
  const applyVat = vatRate > 0 || Number(quote.vat_amount || 0) > 0;
  return computeQuotationTotal({
    subtotal,
    discountAmount: discount,
    vatRate,
    applyVat,
  });
}
