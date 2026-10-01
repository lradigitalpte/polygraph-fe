import Link from "next/link";

export default function PaySuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-3xl font-black tracking-tight">Payment received</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Thank you. Your payment was submitted successfully. You can close this window.
        </p>
        <Link
          href="/"
          className="inline-flex items-center justify-center h-11 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-bold"
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
