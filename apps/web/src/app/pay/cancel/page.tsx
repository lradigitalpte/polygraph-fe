import Link from "next/link";

export default function PayCancelPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-3xl font-black tracking-tight">Payment cancelled</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          No charge was made. You can use the payment link in your invoice email again when you are ready.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-border text-sm font-bold"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
