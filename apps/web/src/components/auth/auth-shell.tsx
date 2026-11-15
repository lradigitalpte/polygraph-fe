"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Two-panel auth card (sign-in, forgot and reset password): the form on the left, a
 * brand panel on the right whose edge curls into the form like a cloud. On phones the
 * brand panel folds away and the logo sits above the form.
 */
export function AuthShell({
  children,
  panelTitle = "Welcome back!",
  panelText = "Sessions, reports and payments for your lab — all in one secure place.",
}: {
  children: React.ReactNode;
  panelTitle?: string;
  panelText?: string;
}) {
  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#EFEDE6] p-4 py-10 dark:bg-background">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] bg-white shadow-[0_30px_60px_-30px_rgba(43,42,39,0.45)] ring-1 ring-black/[0.04] md:min-h-[540px] md:grid-cols-[1fr_1.05fr] dark:bg-card dark:ring-white/10">
        {/* Form */}
        <div className="relative z-10 flex flex-col justify-center px-6 py-10 sm:px-12">
          <Link href="/" aria-label="Polygraph home" className="mx-auto mb-8 inline-flex rounded-[14px] bg-[#2B2A27] px-4 py-2.5 shadow-sm md:hidden">
            <Image src="/logo.png" alt="Polygraph" width={2048} height={674} priority className="h-8 w-auto" />
          </Link>
          <div className="mx-auto w-full max-w-[340px]">{children}</div>
        </div>

        {/* Brand panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#D9774F] via-[#B4552F] to-[#2B2A27] md:block">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 right-[-60px] size-80 rounded-full bg-[#F2B48F]/40 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute bottom-[-80px] left-1/3 size-72 rounded-full bg-[#2B2A27]/60 blur-3xl" />

          {/* Cloud edge: white puffs spilling in from the form side */}
          <svg aria-hidden="true" viewBox="0 0 120 540" preserveAspectRatio="none" className="absolute inset-y-0 left-0 h-full w-[120px] text-white dark:text-card">
            <path
              fill="currentColor"
              d="M0 0 H62 C92 0 104 26 88 48 C112 58 110 96 82 104 C106 122 98 160 70 162 C96 182 90 222 60 222 C88 246 80 284 52 284 C82 302 78 344 50 346 C80 366 74 408 46 408 C76 428 70 470 42 472 C70 492 66 530 40 540 H0 Z"
            />
          </svg>
          <svg aria-hidden="true" viewBox="0 0 120 540" preserveAspectRatio="none" className="absolute inset-y-0 left-6 h-full w-[120px] text-white/25">
            <path
              fill="currentColor"
              d="M0 0 H62 C92 0 104 26 88 48 C112 58 110 96 82 104 C106 122 98 160 70 162 C96 182 90 222 60 222 C88 246 80 284 52 284 C82 302 78 344 50 346 C80 366 74 408 46 408 C76 428 70 470 42 472 C70 492 66 530 40 540 H0 Z"
            />
          </svg>

          <div className="relative flex h-full flex-col justify-between py-10 pr-10 pl-32 text-[#FAF9F5]">
            <Link href="/" aria-label="Polygraph home" className="w-fit self-end">
              <Image src="/logo.png" alt="Polygraph" width={2048} height={674} priority className="h-8 w-auto opacity-95" />
            </Link>
            <div>
              <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.02em]">{panelTitle}</h2>
              <p className="mt-3 max-w-xs text-[15px] leading-relaxed text-white/80">{panelText}</p>
            </div>
            <p className="text-xs text-white/60">Authorised staff only</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Pill field; leaves room on the left for the icon badge. */
export const AUTH_FIELD =
  "h-[52px] w-full rounded-full border-0 bg-[#F7F6F1] pr-4 pl-[60px] text-[15px] shadow-[0_6px_16px_-10px_rgba(43,42,39,0.35)] ring-1 ring-black/[0.05] outline-none transition-shadow placeholder:text-muted-foreground/70 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-60 dark:bg-muted dark:ring-white/10";

export const AUTH_BUTTON =
  "mx-auto flex h-12 w-full max-w-[220px] items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[#D9774F] to-[#B4552F] text-[14px] font-semibold tracking-[0.06em] text-white uppercase shadow-[0_12px_24px_-12px_rgba(180,85,47,0.9)] transition-[filter,transform] hover:brightness-105 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none";

function IconBadge({ icon: Icon }: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }> }) {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute top-1/2 left-1.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[#D9774F] to-[#B4552F] text-white shadow-sm">
      <Icon aria-hidden="true" className="size-[18px]" />
    </span>
  );
}

export function AuthHeading({ title, subtitle }: { title: React.ReactNode; subtitle?: React.ReactNode }) {
  return (
    <div className="mb-8 text-center">
      <h1 className="text-[30px] leading-tight font-semibold tracking-[-0.02em]">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p> : null}
    </div>
  );
}

export function AuthNotice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: React.ReactNode }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "mb-5 rounded-2xl px-4 py-3 text-[13px] leading-relaxed",
        tone === "error" && "bg-destructive/10 text-destructive",
        tone === "info" && "bg-[#F8EEDB] text-[#5C3D0C] dark:bg-amber-950/60 dark:text-amber-100",
        tone === "success" && "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950/60 dark:text-emerald-200",
      )}
    >
      {children}
    </div>
  );
}

/** Email pill with the envelope badge. */
export function EmailField({
  value,
  onChange,
  disabled,
  invalid,
  autoFocus,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="relative">
      <IconBadge icon={Mail} />
      <input
        id="email"
        type="email"
        autoComplete="username"
        inputMode="email"
        placeholder="Email"
        aria-label="Email"
        required
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        className={cn(AUTH_FIELD, invalid && "ring-2 ring-destructive/60")}
      />
    </div>
  );
}

/** Password pill with the lock badge, a show/hide toggle and a Caps Lock hint. */
export function PasswordField({
  id,
  value,
  onChange,
  disabled,
  autoComplete,
  placeholder = "Password",
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoComplete: "current-password" | "new-password";
  placeholder?: string;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = React.useState(false);
  const [capsOn, setCapsOn] = React.useState(false);
  const capsId = `${id}-caps`;
  return (
    <div>
      <div className="relative">
        <IconBadge icon={LockKeyhole} />
        <input
          id={id}
          type={visible ? "text" : "password"}
          required
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-label={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyUp={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
          onKeyDown={(e) => setCapsOn(e.getModifierState?.("CapsLock") ?? false)}
          onBlur={() => setCapsOn(false)}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={[describedBy, capsOn ? capsId : undefined].filter(Boolean).join(" ") || undefined}
          className={cn(AUTH_FIELD, "pr-12", invalid && "ring-2 ring-destructive/60")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-[#B4552F] transition-colors hover:bg-black/[0.04] dark:text-primary"
        >
          {visible ? <EyeOff aria-hidden="true" className="size-[18px]" /> : <Eye aria-hidden="true" className="size-[18px]" />}
        </button>
      </div>
      {capsOn ? (
        <p id={capsId} className="mt-1.5 px-4 text-xs font-medium text-[#8A5A12] dark:text-amber-300">
          Caps Lock is on
        </p>
      ) : null}
    </div>
  );
}
