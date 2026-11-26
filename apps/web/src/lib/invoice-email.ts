import { formatMoney } from "@/lib/client-account";
import { bankDetailsEmailText, type BankDetails } from "@/lib/bank-accounts";

/**
 * How the client is asked to pay: the online pay link and bank details together,
 * only the pay link, or only bank transfer (no pay button, no card fee).
 */
export type InvoicePayBy = "both" | "link" | "bank";

/** Default client email for invoice + deposit / full online payment. */
export function buildInvoicePaymentEmailBody(input: {
  clientName: string;
  code: string;
  currency: string;
  totalAmount: number;
  paidAmount: number;
  /** Amount credited to the invoice (deposit or balance). */
  chargeAmount: number;
  /** What the customer pays at checkout when processing fee is included (optional). */
  checkoutPayTotal?: number;
  /** The email carries a "Review & sign agreements" button for the client's terms. */
  includeAgreements?: boolean;
  /** Bank transfer option listed after the card payment steps. */
  bankAccounts?: BankDetails[];
  /** Defaults to "both". "bank" falls back to the pay link when there are no bank accounts. */
  payBy?: InvoicePayBy;
}) {
  const { clientName, code, currency, totalAmount, paidAmount, chargeAmount, includeAgreements } = input;
  const hasBanks = Boolean(input.bankAccounts?.length);
  const payBy: InvoicePayBy = !hasBanks ? "link" : (input.payBy ?? "both");
  const bankOnly = payBy === "bank";
  const bankAccounts = payBy === "link" ? undefined : input.bankAccounts;
  // Bank transfers carry no card fee.
  const checkoutPayTotal = bankOnly ? undefined : input.checkoutPayTotal;
  const balance = Math.max(0, totalAmount - paidAmount);
  const safeCharge = Math.max(0, Math.min(chargeAmount || balance, balance));
  const remainingAfter = Math.max(0, balance - safeCharge);
  const isDeposit = safeCharge + 0.0001 < balance;
  const payNow =
    checkoutPayTotal != null && checkoutPayTotal > safeCharge ? checkoutPayTotal : safeCharge;
  const totalLabel = formatMoney(totalAmount, currency);
  const chargeLabel = formatMoney(safeCharge, currency);
  const payNowLabel = formatMoney(payNow, currency);
  const remainingLabel = formatMoney(remainingAfter, currency);
  const paidLabel = formatMoney(paidAmount, currency);
  const includesProcessing = payNow > safeCharge + 0.0001;
  const fullBalanceCardPay =
    includesProcessing && !isDeposit && safeCharge + 0.0001 >= balance;

  // Paid in full: a receipt, not a payment request (no amounts due, no pay steps, no bank details).
  if (balance <= 0.0001 && totalAmount > 0) {
    const receipt = [
      `Hello ${clientName || "there"},`,
      "",
      `Thank you — we have received your payment in full for invoice ${code}. The paid invoice is attached for your records.`,
      "",
      `Total paid: ${paidLabel}`,
      `Balance due: ${formatMoney(0, currency)}`,
    ];
    if (includeAgreements) {
      receipt.push("");
      receipt.push(`Before we proceed, please review and sign your agreements with the "Review & sign agreements" button below.`);
    }
    receipt.push("");
    receipt.push("If you have any questions, just reply to this email.");
    return receipt.join("\n");
  }

  const lines = [
    `Hello ${clientName || "there"},`,
    "",
    `Please find your invoice ${code} (PDF attached).`,
    "",
  ];
  if (fullBalanceCardPay) {
    lines.push(`Total due: ${payNowLabel}`);
    lines.push(`Amount due now: ${payNowLabel}`);
  } else {
    lines.push(`Total fee: ${totalLabel}`);
    if (paidAmount > 0) {
      lines.push(`Already paid: ${paidLabel}`);
    }
    lines.push(`Balance due: ${formatMoney(balance, currency)}`);
    if (isDeposit) {
      lines.push(
        includesProcessing ? `Deposit due now: ${payNowLabel}` : `Deposit due now: ${chargeLabel}`,
      );
      lines.push(`Remaining after this deposit: ${remainingLabel}`);
    } else {
      lines.push(includesProcessing ? `Amount due now: ${payNowLabel}` : `Amount due now: ${chargeLabel}`);
    }
  }
  lines.push("");
  lines.push("Next steps:");
  let step = 1;
  if (includeAgreements) {
    lines.push(`${step++}) Review and sign your agreements with the "Review & sign agreements" button below (required before we proceed).`);
  }
  const how = bankOnly ? "by bank transfer using the details below" : `with the "Pay invoice online" button below`;
  lines.push(
    isDeposit ? `${step++}) Pay the deposit of ${payNowLabel} ${how}.` : `${step++}) Pay ${payNowLabel} ${how}.`,
  );
  if (isDeposit) {
    lines.push(
      bankOnly
        ? `${step++}) The remaining ${remainingLabel} can be paid later.`
        : `${step++}) The remaining ${remainingLabel} can be paid later (we can send another payment link when ready).`,
    );
  }
  const bankText = bankDetailsEmailText(
    bankAccounts,
    code,
    bankOnly ? "Bank transfer details:" : "Prefer to pay by bank transfer?",
  );
  if (bankText) {
    lines.push("");
    lines.push(bankText);
  }
  lines.push("");
  lines.push("If you have any questions, just reply to this email.");
  return lines.join("\n");
}
