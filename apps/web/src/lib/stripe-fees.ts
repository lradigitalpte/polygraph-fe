/** Estimated gross charge so the invoice receives `netAmount` after card fees. */
export function estimateStripeGrossCharge(
  netAmount: number,
  percent = 2.9,
  fixed = 1,
): { gross: number; fee: number } {
  if (!Number.isFinite(netAmount) || netAmount <= 0) {
    return { gross: 0, fee: 0 };
  }
  const rate = Math.max(0, percent) / 100;
  if (rate >= 1) {
    return { gross: netAmount, fee: 0 };
  }
  const fixedFee = Math.max(0, fixed);
  const gross = Math.round(((netAmount + fixedFee) / (1 - rate)) * 100) / 100;
  const fee = Math.round((gross - netAmount) * 100) / 100;
  return { gross, fee: Math.max(0, fee) };
}
