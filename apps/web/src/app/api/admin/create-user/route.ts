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
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create auth account";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
