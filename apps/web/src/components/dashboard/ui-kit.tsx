"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* GlowPanel — dark surface lit from behind: a soft colour glow, a     */
/* hairline of light with a glowing orb on it, and a faint dot grid.   */
/* Pure CSS, so it is crisp at any size and needs no image asset.      */
/* ------------------------------------------------------------------ */

export type GlowTone = "terracotta" | "lavender" | "sage" | "amber" | "ink";

const GLOW: Record<GlowTone, string> = {
  terracotta: "rgba(201,100,66,0.55)",
  lavender: "rgba(156,135,245,0.5)",
  sage: "rgba(110,170,120,0.45)",
  amber: "rgba(217,164,65,0.45)",
  ink: "rgba(250,249,245,0.18)",
};

export function GlowPanel({
  tone = "terracotta",
  orb = "50%",
  lineTop = 44,
  className,
  children,
}: {
  tone?: GlowTone;
  /** Horizontal position of the orb on the light line (CSS length). */
  orb?: string;
  /** Distance of the light line from the top, in px. */
  lineTop?: number;
  className?: string;
  children: React.ReactNode;
}) {
  const glow = GLOW[tone];
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-[30px] bg-[#1E1D1B] text-[#FAF9F5] shadow-[0_24px_48px_-28px_rgba(20,20,19,0.7)] ring-1 ring-white/[0.06]",
        className,
      )}
    >
      {/* Colour glow behind the orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: orb, top: lineTop, background: `radial-gradient(closest-side, ${glow}, transparent)` }}
      />
      {/* Secondary low glow for depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -bottom-48 -z-10 size-[420px] rounded-full"
        style={{ background: `radial-gradient(closest-side, ${glow.replace(/[\d.]+\)$/, "0.18)")}, transparent)` }}
      />
      {/* Dot grid, fading downwards */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.08] [background-image:radial-gradient(rgba(255,255,255,0.9)_1px,transparent_1px)] [background-size:16px_16px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]"
      />
      {/* Hairline of light */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -z-10 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
        style={{ top: lineTop }}
      />
      {/* Orb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
        style={{ left: orb, top: lineTop, boxShadow: `0 0 10px 3px rgba(255,255,255,0.7), 0 0 36px 12px ${glow}` }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -z-10 size-9 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-white/25"
        style={{ left: orb, top: lineTop }}
      />
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* GlassStat — frosted stat tile for use inside a GlowPanel.           */
/* ------------------------------------------------------------------ */

const ACCENT_DOT: Record<GlowTone, string> = {
  terracotta: "bg-primary",
  lavender: "bg-chart-2",
  sage: "bg-[#7FBF8A]",
  amber: "bg-[#E2B35A]",
  ink: "bg-[#FAF9F5]",
};

export function GlassStat({
  label,
  value,
  hint,
  icon: Icon,
  accent = "terracotta",
  loading,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  accent?: GlowTone;
  loading?: boolean;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 rounded-[22px] bg-white/[0.05] p-4 ring-1 ring-white/10 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-[13px] text-[#C9C6BC]">
          <span aria-hidden="true" className={cn("size-1.5 shrink-0 rounded-full", ACCENT_DOT[accent])} />
          <span className="truncate">{label}</span>
        </span>
        {Icon ? (
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.07] text-[#ECE9E0] ring-1 ring-white/10">
            <Icon aria-hidden="true" className="size-4" />
          </span>
        ) : null}
      </div>
      <div className="flex flex-col gap-1">
        {/* Fixed-height row: the skeleton and the value occupy exactly the same box,
            so tiles don't jump when data arrives. */}
        <span className="flex h-6 items-center truncate text-2xl leading-none font-medium tracking-[-0.02em] tabular-nums sm:h-8 sm:text-[32px]">
          {loading ? <span aria-hidden="true" className="block h-full w-16 animate-pulse rounded-lg bg-white/10" /> : value}
        </span>
        {hint ? <span className="block h-4 truncate text-xs leading-4 text-[#B5B2A8]">{loading ? " " : hint}</span> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PageHero — the dark glowing page header used across the dashboard:   */
/* eyebrow, headline, blurb, actions and (optionally) GlassStat tiles.  */
/* ------------------------------------------------------------------ */

type HeroIcon = React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true"; strokeWidth?: number }>;

export function PageHero({
  tone = "terracotta",
  orb = "72%",
  lineTop = 40,
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  children,
  className,
}: {
  tone?: GlowTone;
  orb?: string;
  lineTop?: number;
  icon?: HeroIcon;
  eyebrow: string;
  /** Headline. Wrap the emphasised word in <strong className="font-semibold">. */
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Usually a grid of GlassStat tiles. */
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <GlowPanel tone={tone} orb={orb} lineTop={lineTop} className={cn("p-5 sm:p-7", className)}>
      <div className="flex flex-col gap-6 pt-6 sm:gap-8 sm:pt-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div className="flex max-w-2xl flex-col gap-2">
            <span className="flex items-center gap-2 text-[13px] font-medium tracking-[0.1em] text-[#C9C6BC] uppercase">
              {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
              {eyebrow}
            </span>
            <h1 className="text-3xl leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">{title}</h1>
            {description ? <p className="max-w-xl text-[15px] text-[#C9C6BC]">{description}</p> : null}
          </div>
          {actions ? <div className="flex w-full flex-wrap items-center gap-2.5 sm:w-auto">{actions}</div> : null}
        </div>
        {children}
      </div>
    </GlowPanel>
  );
}

/** Button for use on a PageHero. `glass` is the quiet one, `primary` the cream call-to-action. */
export function HeroAction({
  variant = "glass",
  icon: Icon,
  href,
  onClick,
  disabled,
  type = "button",
  children,
}: {
  variant?: "glass" | "primary";
  icon?: HeroIcon;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  children: React.ReactNode;
}) {
  const base = "flex h-11 flex-1 items-center justify-center gap-2 rounded-full text-sm transition-colors disabled:opacity-40 sm:flex-initial";
  const glass = "bg-white/[0.07] px-5 font-medium text-[#FAF9F5] ring-1 ring-white/15 hover:bg-white/[0.12]";
  const primary = "bg-[#FAF9F5] pr-5 pl-2.5 font-semibold text-[#1A1915] hover:bg-white";
  const className = cn(base, variant === "primary" ? primary : glass);
  const content =
    variant === "primary" ? (
      <>
        {Icon ? (
          <span className="bg-primary flex size-6 items-center justify-center rounded-full">
            <Icon aria-hidden="true" className="size-3.5" strokeWidth={3} />
          </span>
        ) : null}
        {children}
      </>
    ) : (
      <>
        {Icon ? <Icon aria-hidden="true" className="size-4" /> : null}
        {children}
      </>
    );
  if (href) {
    return (
      <Link href={href as Route} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {content}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented — pill toggle group (single choice).                      */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
}: {
  value: T;
  options: readonly { value: T; label: string; count?: number; disabled?: boolean; title?: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("flex max-w-full shrink-0 gap-1 overflow-x-auto rounded-full bg-[#E9E6DD] p-1 no-scrollbar dark:bg-muted", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? "bg-white font-semibold text-foreground shadow-[0_1px_2px_rgba(40,36,20,0.08)] dark:bg-card"
                : "text-[#3D3929] hover:text-foreground dark:text-muted-foreground",
            )}
          >
            {option.label}
            {option.count !== undefined ? (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-[#F3F1EA] dark:bg-muted" : "bg-white/60 dark:bg-background/40",
                )}
              >
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status & payment pills                                              */
/* ------------------------------------------------------------------ */

const STATUS_STYLES: Record<string, { chip: string; dot: string }> = {
  confirmed: { chip: "bg-[#E7F1E4] text-[#2D5A27] dark:bg-emerald-950 dark:text-emerald-300", dot: "bg-[#3F7A37] dark:bg-emerald-400" },
  pending: { chip: "bg-primary/12 text-[oklch(0.42_0.12_39)] dark:text-primary", dot: "bg-primary" },
  completed: { chip: "bg-[#ECE9E0] text-[#1A1915] dark:bg-muted dark:text-foreground", dot: "bg-[#55534C] dark:bg-foreground/60" },
  cancelled: { chip: "bg-[#F6E3E1] text-[#8A2C22] dark:bg-red-950 dark:text-red-300", dot: "bg-[#B94A3E] dark:bg-red-400" },
};

const STATUS_DOT_ON_DARK: Record<string, string> = {
  confirmed: "bg-[#7FBF8A]",
  pending: "bg-chart-2",
  completed: "bg-[#ECE9E0]",
  cancelled: "bg-[#E58A7E]",
};

export function StatusPill({ status, className, onDark }: { status: string; className?: string; onDark?: boolean }) {
  const key = status.toLowerCase();
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.completed;
  if (onDark) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[13px] font-medium whitespace-nowrap text-[#FAF9F5] ring-1 ring-white/15",
          className,
        )}
      >
        <span aria-hidden="true" className={cn("size-1.5 rounded-full", STATUS_DOT_ON_DARK[key] ?? "bg-[#ECE9E0]")} />
        {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-medium whitespace-nowrap", style.chip, className)}>
      <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot)} />
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </span>
  );
}

const PAYMENT_STYLES: Record<string, string> = {
  paid: "text-[#2D5A27] dark:text-emerald-300",
  partial: "text-[#8A5A12] dark:text-amber-300",
  unpaid: "text-[#8A2C22] dark:text-red-300",
};

export function PaymentPill({ payment, amount }: { payment: string; amount: string }) {
  const key = payment.toLowerCase();
  return (
    <span className="flex flex-col gap-0.5">
      <span className="font-mono text-[13px] tabular-nums">{amount}</span>
      <span className={cn("text-xs font-medium", PAYMENT_STYLES[key] ?? "text-muted-foreground")}>{payment}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* PropertyRow — label on the left, borderless control on the right.   */
/* ------------------------------------------------------------------ */

/** Borderless field style for controls inside a PropertyRow. */
export const GHOST_FIELD =
  "h-10 w-full rounded-lg border border-transparent bg-transparent px-3 text-sm shadow-none transition-colors hover:bg-[#F3F1EA] focus-visible:border-border focus-visible:bg-white focus-visible:ring-0 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:hover:bg-muted dark:focus-visible:bg-card";

export function PropertyRow({
  icon: Icon,
  label,
  htmlFor,
  hint,
  children,
}: {
  icon?: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" }>;
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 gap-1 py-1 sm:grid-cols-[148px_minmax(0,1fr)] sm:items-start sm:gap-3">
      <label htmlFor={htmlFor} className="flex h-10 items-center gap-2.5 text-[13px] text-muted-foreground">
        {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint ? <p className="px-3 pt-1 pb-1 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* StatusPicker — four lifecycle chips with coloured dots.             */
/* ------------------------------------------------------------------ */

export function StatusPicker<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string; disabled?: boolean; title?: string }[];
  onChange: (value: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5 px-1.5 py-1">
      {options.map((option) => {
        const active = option.value === value;
        const style = STATUS_STYLES[option.value.toLowerCase()] ?? STATUS_STYLES.completed;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-35",
              active
                ? cn(style.chip, "font-medium ring-1 ring-current/15")
                : "text-muted-foreground ring-1 ring-border hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted",
            )}
          >
            <span aria-hidden="true" className={cn("size-1.5 rounded-full", style.dot, !active && "opacity-60")} />
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Search results dropdown                                             */
/* ------------------------------------------------------------------ */

/** Floating results panel; place inside a `relative` wrapper under the input. */
export function SearchResults({
  children,
  footer,
  label,
  className,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "absolute top-full right-0 left-0 z-50 mt-2 overflow-hidden rounded-2xl bg-white shadow-[0_24px_48px_-16px_rgba(40,36,20,0.28),0_2px_6px_rgba(40,36,20,0.06)] ring-1 ring-border/60 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-150 dark:bg-popover",
        className,
      )}
    >
      <div role="listbox" aria-label={label} className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
        {children}
      </div>
      {footer ? <div className="border-t border-border/60 p-1.5">{footer}</div> : null}
    </div>
  );
}

/** Wraps the part of `text` matching `query` (case-insensitive) in a highlight. */
export function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const index = text.toLowerCase().indexOf(q.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded-sm bg-primary/20 px-0.5 text-inherit">{text.slice(index, index + q.length)}</mark>
      {text.slice(index + q.length)}
    </>
  );
}

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export function SearchResultOption({
  name,
  secondary,
  query = "",
  badge,
  avatarTone = "neutral",
  selected,
  onSelect,
}: {
  name: string;
  secondary?: string;
  query?: string;
  badge?: string;
  avatarTone?: "neutral" | "org" | "person";
  selected?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={Boolean(selected)}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-[#F7F6F1] focus-visible:bg-[#F7F6F1] focus-visible:outline-none dark:hover:bg-muted dark:focus-visible:bg-muted",
        selected && "bg-primary/10",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex size-9 shrink-0 items-center justify-center text-xs font-semibold",
          avatarTone === "org"
            ? "rounded-xl bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground"
            : avatarTone === "person"
              ? "rounded-full bg-chart-2/20 text-[oklch(0.42_0.14_290)] dark:text-chart-2"
              : "rounded-full bg-[#ECE9E0] text-[#3D3929] dark:bg-muted dark:text-foreground",
        )}
      >
        {initialsOf(name)}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">
          <Highlight text={name} query={query} />
        </span>
        {secondary ? <span className="truncate text-[13px] text-muted-foreground">{secondary}</span> : null}
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full bg-[#F3F1EA] px-2 py-0.5 text-[11px] font-medium text-[#55534C] dark:bg-muted dark:text-muted-foreground">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

/** Hides placeholder e-mails generated by bulk imports (import+…@import.local). */
export function displayEmail(email?: string | null): string | undefined {
  if (!email) return undefined;
  return /@import\.local$/i.test(email) ? "Imported record · no email on file" : email;
}
