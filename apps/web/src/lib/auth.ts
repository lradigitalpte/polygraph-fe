import { betterAuth } from "better-auth";
import { admin } from "better-auth/plugins";
import { Pool } from "pg";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
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
