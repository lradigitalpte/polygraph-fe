import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json() as { name: string; email: string; password: string };

  if (!body.name || !body.email || !body.password) {
    return NextResponse.json({ error: "name, email, and password are required" }, { status: 400 });
  }

  try {
    await auth.api.signUpEmail({
      body: {
        name: body.name,
        email: body.email,
        password: body.password,
      },
    });

    // Email the new user a "set your password" link so they choose their own
    // credentials. Reuses the same flow as the password-reset email. Best-effort:
    // if the email fails, the account still exists (admin can share the temp
    // password or resend later), so we report it as a warning, not an error.
    let emailWarning: string | undefined;
    try {
      const origin =
        process.env.BETTER_AUTH_URL ?? request.nextUrl.origin;
      await auth.api.requestPasswordReset({
        body: {
          email: body.email,
          redirectTo: `${origin}/reset-password`,
        },
      });
    } catch (mailErr: unknown) {
      emailWarning =
        mailErr instanceof Error ? mailErr.message : "Set-password email could not be sent";
    }

    return NextResponse.json({ ok: true, emailWarning });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create auth account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
