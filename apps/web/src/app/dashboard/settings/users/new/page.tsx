"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import Link from "next/link";
import { ArrowLeft, Check, Eye, EyeOff, Loader2, Mail, Sparkles, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { PageHero } from "@/components/dashboard/ui-kit";
import { Input } from "@/components/ui/input";
import { createUser, fetchRoles, type RoleRecord } from "@/lib/users";
import { cn } from "@/lib/utils";

const FIELD = "h-11 rounded-xl border-0 bg-[#F3F1EA] px-3.5 text-sm shadow-none dark:bg-muted";
const CARD = "rounded-[26px] bg-white p-5 shadow-[0_1px_2px_rgba(40,36,20,0.05)] ring-1 ring-border/50 sm:p-6 dark:bg-card";

const ROLE_DESCRIPTIONS: Record<string, string> = {
  Admin: "Full system access including billing and audit logs.",
  Examiner: "Assigned exams, calendar and examinee profiles.",
  User: "Basic read-only access to assigned resources.",
};

function generatePassword(length = 14): string {
  const sets = ["ABCDEFGHJKLMNPQRSTUVWXYZ", "abcdefghijkmnopqrstuvwxyz", "23456789", "!@#$%&*?"];
  const all = sets.join("");
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const out = sets.map(pick); // guarantee one of each kind
  while (out.length < length) out.push(pick(all));
  // Fisher–Yates shuffle
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join("");
}

function strengthOf(password: string): { label: string; bar: string; text: string; pct: number } | null {
  if (!password) return null;
  if (password.length < 8) return { label: "Too short", bar: "bg-[#B94A3E]", text: "text-[#B94A3E]", pct: 25 };
  if (password.length < 10) return { label: "Weak", bar: "bg-[#C98A1F]", text: "text-[#8A5A12] dark:text-amber-300", pct: 50 };
  if (!/[A-Z]/.test(password) || !/[0-9]/.test(password)) return { label: "Fair", bar: "bg-[#B8A21F]", text: "text-[#6B5E10] dark:text-yellow-300", pct: 75 };
  return { label: "Strong", bar: "bg-[#3F7A37]", text: "text-[#2D5A27] dark:text-emerald-300", pct: 100 };
}

export default function NewUserPage() {
  const router = useRouter();
  const [roles, setRoles] = React.useState<RoleRecord[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [rolesLoading, setRolesLoading] = React.useState(true);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [roleId, setRoleId] = React.useState("");

  const strength = React.useMemo(() => strengthOf(password), [password]);
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = name.trim() !== "" && emailValid && roleId !== "" && password.length >= 8 && !loading && !rolesLoading;

  React.useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const data = await fetchRoles();
        if (!mounted) return;
        setRoles(data);
        if (data[0]) setRoleId(String(data[0].id));
      } catch (err) {
        if (mounted) toast.error(err instanceof Error ? err.message : "Failed to load roles");
      } finally {
        if (mounted) setRolesLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleGenerate = () => {
    setPassword(generatePassword());
    setShowPassword(true);
    setCopied(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !roleId || !password) {
      toast.error("All fields are required");
      return;
    }
    if (!emailValid) {
      toast.error("Enter a valid email address");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const authRes = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const authPayload = await authRes.json().catch(() => null);
      if (!authRes.ok) {
        throw new Error(authPayload?.error || "Failed to create auth account");
      }

      const user = await createUser({
        name: name.trim(),
        email: email.trim(),
        role_id: Number(roleId),
      });

      if (authPayload?.emailWarning) {
        toast.warning(`${name.trim()} created, but the set-password email failed: ${authPayload.emailWarning}. Share the temporary password instead.`);
      } else {
        toast.success(`${name.trim()} created — a set-password email has been sent to ${email.trim()}.`);
      }
      router.push(`/dashboard/settings/users/${user.id}` as Route);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-5 pb-10">
      <Link
        href="/dashboard/settings/users"
        className="inline-flex h-9 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-[#F3F1EA] hover:text-foreground dark:hover:bg-muted"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        All users
      </Link>

      <PageHero
        tone="lavender"
        icon={UserPlus}
        eyebrow="People & access"
        title={<>Invite a <strong className="font-semibold">teammate</strong></>}
        description="Set up their details and role. They'll get an email to choose their own password."
      />

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Identity */}
        <section className={cn(CARD, "space-y-4")}>
          <h2 className="text-[15px] font-medium">Who are they?</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Full name">
              <Input id="name" placeholder="Jane Smith" className={FIELD} value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </Field>
            <Field id="email" label="Email address" error={email.trim() !== "" && !emailValid ? "Enter a valid email address." : undefined}>
              <Input
                id="email"
                type="email"
                placeholder="jane@example.com"
                className={FIELD}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                aria-invalid={email.trim() !== "" && !emailValid}
              />
            </Field>
          </div>
        </section>

        {/* Role */}
        <section className={cn(CARD, "space-y-4")}>
          <div>
            <h2 className="text-[15px] font-medium">What can they do?</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">You can fine-tune individual permissions after the account is created.</p>
          </div>
          {rolesLoading ? (
            <div aria-hidden="true" className="grid gap-3 sm:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-2xl bg-[#F3F1EA] dark:bg-muted" />
              ))}
            </div>
          ) : (
            <div role="radiogroup" aria-label="Access role" className="grid gap-3 sm:grid-cols-2">
              {roles.map((role) => {
                const selected = String(role.id) === roleId;
                return (
                  <button
                    key={role.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setRoleId(String(role.id))}
                    className={cn(
                      "flex items-start gap-3 rounded-2xl p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      selected ? "bg-[#30302E] text-[#FAF9F5] dark:bg-secondary dark:text-secondary-foreground" : "bg-[#F7F6F1] hover:bg-[#F0EEE6] dark:bg-muted/40 dark:hover:bg-muted",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-1", selected ? "bg-[#FAF9F5] text-[#30302E] ring-transparent" : "ring-border")}
                    >
                      {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{role.name}</span>
                      <span className={cn("mt-0.5 block text-xs", selected ? "text-[#D9D5CA]" : "text-muted-foreground")}>
                        {role.description || ROLE_DESCRIPTIONS[role.name] || "Custom role."}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Password */}
        <section className={cn(CARD, "space-y-4")}>
          <div>
            <h2 className="text-[15px] font-medium">Temporary password</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">They can change it after signing in, under Profile → Security.</p>
          </div>

          <Field id="password" label="Password">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  className={cn(FIELD, "pr-11", showPassword && "font-mono")}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setCopied(false);
                  }}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white hover:text-foreground dark:hover:bg-card"
                >
                  {showPassword ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                </button>
              </div>
              <button
                type="button"
                onClick={handleGenerate}
                className="flex h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-[#F3F1EA] dark:hover:bg-muted"
              >
                <Sparkles aria-hidden="true" className="size-4" />
                <span className="hidden sm:inline">Generate</span>
              </button>
            </div>
          </Field>

          {strength ? (
            <div className="flex items-center gap-3">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECE9E0] dark:bg-muted">
                <div className={cn("h-full rounded-full transition-all", strength.bar)} style={{ width: `${strength.pct}%` }} />
              </div>
              <span className={cn("w-16 text-right text-xs font-medium", strength.text)}>{strength.label}</span>
              {password ? (
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Actions */}
        <div className="flex flex-col gap-3 rounded-[26px] bg-[#F7F6F1] p-4 sm:flex-row sm:items-center sm:justify-between dark:bg-muted/40">
          <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
            <Mail aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>
              Creating the user sends a set-password email to <span className="font-medium text-foreground">{emailValid ? email.trim() : "their address"}</span>.
            </span>
          </p>
          <div className="flex shrink-0 gap-2">
            <Link
              href="/dashboard/settings/users"
              className="flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium ring-1 ring-border transition-colors hover:bg-white dark:hover:bg-muted"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={!canSubmit}
              className="flex h-10 min-w-32 items-center justify-center gap-2 rounded-full bg-[#30302E] px-5 text-sm font-semibold text-[#FAF9F5] transition-colors hover:bg-[#1F1F1D] disabled:opacity-50 dark:bg-secondary dark:text-secondary-foreground"
            >
              {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
              {loading ? "Creating…" : "Create user"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="px-1 text-[13px] font-medium">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="px-1 text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
