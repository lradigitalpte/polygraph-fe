import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: false, // STARTTLS on 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Idempotency guard: prevents the same reset/set-password email from being sent
// twice in quick succession (double-submit, create-user + a manual resend, etc.).
// Every reset trigger funnels through sendResetPassword, so guarding here covers
// all paths. Keyed by email; entries expire after the window.
const RESET_DEDUPE_MS = 90_000;
const recentResetSends = new Map<string, number>();

function shouldSkipResetEmail(email: string): boolean {
  const key = email.trim().toLowerCase();
  const now = Date.now();
  for (const [k, t] of recentResetSends) {
    if (now - t > RESET_DEDUPE_MS) recentResetSends.delete(k);
  }
  const last = recentResetSends.get(key);
  if (last !== undefined && now - last < RESET_DEDUPE_MS) return true;
  recentResetSends.set(key, now);
  return false;
}

const BRAND = "Polygraph Forensic System";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

// brandedEmail matches the backend's email design (internal/email): cream page,
// white rounded card, terracotta pill button, text wordmark — no logo.
function brandedEmail(opts: { title: string; greeting: string; intro: string; buttonLabel: string; buttonUrl: string; footnote: string }) {
  const url = escapeHtml(opts.buttonUrl);
  const font = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.title)}</title></head>
<body style="margin:0;padding:0;background:#F3F1EA;font-family:${font}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.intro)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F3F1EA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
<tr><td style="padding:0 8px 18px"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#C96442;vertical-align:middle"></span><span style="margin-left:10px;font-size:14px;font-weight:600;color:#2B2A27;vertical-align:middle">${BRAND}</span></td></tr>
<tr><td style="background:#FFFFFF;border:1px solid #E9E6DD;border-radius:26px;padding:36px 32px 28px">
<h1 style="margin:0 0 22px;font-size:22px;line-height:1.3;font-weight:600;color:#1A1915">${escapeHtml(opts.title)}</h1>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3D3929">${escapeHtml(opts.greeting)}</p>
<p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:#3D3929">${escapeHtml(opts.intro)}</p>
<div style="margin:8px 0 24px;text-align:center"><a href="${url}" style="display:inline-block;background:#C96442;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1;padding:15px 28px;border-radius:999px">${escapeHtml(opts.buttonLabel)}</a></div>
<p style="margin:0 0 20px;text-align:center;font-size:12px;line-height:1.7;color:#8A877E;word-break:break-all">Button not working? Paste this link into your browser:<br><a href="${url}" style="color:#C96442">${url}</a></p>
<p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#8A877E">${escapeHtml(opts.footnote)}</p>
<p style="margin:0;font-size:15px;line-height:1.65;color:#3D3929">Thank you,<br>${BRAND}</p>
</td></tr>
<tr><td style="padding:22px 12px 0;text-align:center"><p style="margin:0;font-size:13px;font-weight:600;color:#3D3929">${BRAND}</p></td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Sends through Resend's HTTPS API when RESEND_API_KEY is set — the same path the
 * backend uses, because hosts like Vercel/Railway block outbound SMTP. Falls back to
 * SMTP for local development.
 */
async function sendAuthEmail(message: { to: string; subject: string; text: string; html: string }) {
  const replyTo = process.env.REPLY_TO_EMAIL?.trim() || undefined;
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (apiKey) {
    const configured = process.env.RESEND_FROM ?? process.env.SMTP_FROM ?? process.env.FROM_ADDRESS ?? "onboarding@resend.dev";
    const from = configured.includes("<") ? configured : `${BRAND} <${configured}>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, text: message.text, html: message.html, ...(replyTo ? { reply_to: replyTo } : {}) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) throw new Error(`Resend send failed (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
    return;
  }
  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? process.env.FROM_ADDRESS ?? "noreply@polygraph.ae",
    replyTo,
    ...message,
  });
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    sendResetPassword: async ({ user, url }) => {
      // Skip if we just sent a reset email to this address (prevents duplicates).
      if (shouldSkipResetEmail(user.email)) return;
      const name = user.name ?? user.email;
      try {
        await sendAuthEmail({
          to: user.email,
          subject: "Set your Polygraph password",
          text: `Hello ${name},

Use the link below to set your password. For your security it expires in 1 hour.

${url}

If you didn't ask for this, you can ignore this email — your account stays as it is.

Thank you,
${BRAND}`,
          html: brandedEmail({
            title: "Set your password",
            greeting: `Hello ${name},`,
            intro: "Use the button below to set your password and sign in to your dashboard. For your security, this link expires in 1 hour.",
            buttonLabel: "Set your password",
            buttonUrl: url,
            footnote: "If you didn't ask for this, you can ignore this email — your account stays as it is.",
          }),
        });
      } catch (e) {
        // Send failed — clear the dedupe entry so a retry isn't blocked.
        recentResetSends.delete(user.email.trim().toLowerCase());
        throw e;
      }
    },
  },
  session: {
    // Absolute lifetime of a session. Combined with a sliding refresh below, this
    // acts as an inactivity timeout: 30 minutes after the last activity the session
    // expires and the backend rejects it.
    expiresIn: 60 * 60 * 8, // 8 hours; the UI still enforces 30 minutes of real inactivity
    // Refresh the expiry when a session is used and is older than this — gives a
    // sliding window during active use without a DB write on every request.
    updateAge: 60 * 5, // 5 minutes
  },
  plugins: [
    admin(),
  ],
});
