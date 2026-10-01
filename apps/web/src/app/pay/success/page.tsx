export default function PaySuccessPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-background">
      <div className="max-w-md w-full space-y-4 text-center">
        <h1 className="text-3xl font-black tracking-tight">Thank you</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Your payment was received successfully. You can close this window.
        </p>
      </div>
    </main>
  );
}
