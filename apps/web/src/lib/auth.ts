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
      await transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.FROM_ADDRESS ?? "noreply@polygraph.ae",
        to: user.email,
        subject: "Reset your Polygraph password",
        text: `Hi ${user.name ?? user.email},\n\nClick the link below to reset your password. This link expires in 1 hour.\n\n${url}\n\nIf you didn't request this, you can ignore this email.\n\n— Polygraph Team`,
        html: `<p>Hi ${user.name ?? user.email},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${url}">${url}</a></p><p>If you didn't request this, you can ignore this email.</p><p>— Polygraph Team</p>`,
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
