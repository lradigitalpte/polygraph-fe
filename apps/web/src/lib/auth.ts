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

function logoUrl() {
  const base = process.env.BETTER_AUTH_URL ?? "https://polygraph-fe-web.vercel.app";
  return `${base.replace(/\/$/, "")}/logo.png`;
}

// brandedEmail wraps content in the same premium template the backend uses:
// a dark logo banner over a clean white card.
function brandedEmail(opts: {
  heading: string;
  intro: string;
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
}) {
  return `<!DOCTYPE html><html><body style="margin:0;padding:24px;background:#f4f4f5">
  <div style="max-width:600px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
    <div style="background:#000;padding:18px;text-align:center;border-radius:8px 8px 0 0">
      <img src="${logoUrl()}" alt="Polygraph Forensic System" style="height:40px;width:auto" />
    </div>
    <div style="padding:28px;background:#ffffff;border:1px solid #e5e5e5;border-top:none;line-height:1.6;font-size:15px">
      <h2 style="margin:0 0 12px;font-size:20px;color:#111">${opts.heading}</h2>
      <p style="margin:0 0 20px;color:#333">${opts.intro}</p>
      <p style="margin:0 0 24px;text-align:center">
        <a href="${opts.buttonUrl}" style="display:inline-block;background:#c0392b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:6px;font-weight:bold">${opts.buttonLabel}</a>
      </p>
      <p style="margin:0;color:#777;font-size:13px;word-break:break-all">Or paste this link into your browser:<br>${opts.buttonUrl}</p>
      <p style="margin:20px 0 0;color:#777;font-size:13px">${opts.footnote}</p>
    </div>
    <p style="text-align:center;color:#999;font-size:12px;margin:16px 0">Polygraph Forensic System</p>
  </div>
</body></html>`;
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
      const name = user.name ?? user.email;
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.FROM_ADDRESS ?? "noreply@polygraph.ae",
        to: user.email,
        subject: "Set your Polygraph password",
        text: `Hello ${name},\n\nUse the link below to set your password. The link expires in 1 hour.\n\n${url}\n\nIf you did not request this, you can safely ignore this email.\n\nPolygraph Forensic System`,
        html: brandedEmail({
          heading: `Hello ${name},`,
          intro:
            "Use the button below to set your password and access your forensic dashboard. For your security, this link expires in 1 hour.",
          buttonLabel: "Set your password",
          buttonUrl: url,
          footnote: "If you did not request this, you can safely ignore this email.",
        }),
      });
    },
  },
  session: {
    // Absolute lifetime of a session. Combined with a sliding refresh below, this
    // acts as an inactivity timeout: 30 minutes after the last activity the session
    // expires and the backend rejects it.
    expiresIn: 60 * 30, // 30 minutes
    // Refresh the expiry when a session is used and is older than this — gives a
    // sliding window during active use without a DB write on every request.
    updateAge: 60 * 5, // 5 minutes
  },
  plugins: [
    admin(),
  ],
});
