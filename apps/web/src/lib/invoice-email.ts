import { formatMoney } from "@/lib/client-account";

/** Default client email for invoice + deposit / full Stripe payment. */
export function buildInvoicePaymentEmailBody(input: {
  clientName: string;
  code: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  chargeAmount: number;
  agreementLink?: string;
}) {
  const { clientName, code, currency, totalAmount, paidAmount, chargeAmount, agreementLink } = input;
  const balance = Math.max(0, totalAmount - paidAmount);
  const safeCharge = Math.max(0, Math.min(chargeAmount || balance, balance));
  const remainingAfter = Math.max(0, balance - safeCharge);
  const isDeposit = safeCharge + 0.0001 < balance;
  const totalLabel = formatMoney(totalAmount, currency);
  const chargeLabel = formatMoney(safeCharge, currency);
  const remainingLabel = formatMoney(remainingAfter, currency);
  const paidLabel = formatMoney(paidAmount, currency);

  const lines = [
    `Hello ${clientName || "there"},`,
    "",
    `Please find your invoice ${code} (PDF attached).`,
    "",
    `Total fee: ${totalLabel}`,
  ];
  if (paidAmount > 0) {
    lines.push(`Already paid: ${paidLabel}`);
  }
  lines.push(`Balance due: ${formatMoney(balance, currency)}`);
  if (isDeposit) {
    lines.push(`Deposit due now: ${chargeLabel}`);
    lines.push(`Remaining after this deposit: ${remainingLabel}`);
  } else {
    lines.push(`Amount due now: ${chargeLabel}`);
  }
  lines.push("");
  lines.push("Next steps:");
  lines.push("1) Review and sign the payment / booking approval agreement (required before we proceed).");
  if (agreementLink) {
    lines.push(`   Sign here: ${agreementLink}`);
  } else {
    lines.push(
      "   If you received a separate agreement email, please sign that first. Otherwise reply to this email and we will resend the signing link.",
    );
  }
  lines.push(
    isDeposit
      ? `2) Pay the deposit of ${chargeLabel} using the secure Stripe payment link at the bottom of this email.`
      : `2) Pay ${chargeLabel} using the secure Stripe payment link at the bottom of this email.`,
  );
  if (isDeposit) {
    lines.push(
      `3) The remaining ${remainingLabel} can be paid later (we can send another payment link when ready).`,
    );
  }
  lines.push("");
  lines.push("If you have any questions, just reply to this email.");
  return lines.join("\n");
}
