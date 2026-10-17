import { cn } from "@/lib/utils";
import { isInvoiceFullyPaid } from "@/lib/invoice-pdf";

export { isInvoiceFullyPaid };

type InvoicePaidStampProps = {
  className?: string;
  size?: "sm" | "md" | "lg";
};

/** Rubber-stamp style PAID mark for fully settled invoices. */
export function InvoicePaidStamp({ className, size = "md" }: InvoicePaidStampProps) {
  const sizeClass =
    size === "sm"
      ? "text-lg px-3 py-0.5 border-2 tracking-[0.12em]"
      : size === "lg"
        ? "text-4xl px-6 py-2 border-[3px] tracking-[0.22em]"
        : "text-2xl px-4 py-1 border-[3px] tracking-[0.18em]";

  return (
    <div
      className={cn(
        "pointer-events-none select-none font-black uppercase text-emerald-600 border-emerald-600 rounded-md rotate-[-14deg] opacity-[0.42]",
        sizeClass,
        className,
      )}
      aria-hidden
    >
      Paid
    </div>
  );
}
