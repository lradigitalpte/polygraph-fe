import { wholeMoneyAmount } from "@/lib/client-account";

/** Estimated gross charge so the invoice receives `netAmount` after processing fees (whole units). */
export function estimateStripeGrossCharge(
  netAmount: number,
  percent = 2.9,
  fixed = 1,
): { gross: number; fee: number } {
  const net = wholeMoneyAmount(netAmount);
  if (net <= 0) {
    return { gross: 0, fee: 0 };
  }
  const rate = Math.max(0, percent) / 100;
  if (rate >= 1) {
    return { gross: net, fee: 0 };
  }
  const fixedFee = wholeMoneyAmount(Math.max(0, fixed));
  const gross = wholeMoneyAmount((net + fixedFee) / (1 - rate));
  const fee = Math.max(0, gross - net);
  return { gross, fee };
}
