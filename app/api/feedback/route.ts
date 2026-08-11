import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase";

// Feedback / report endpoint.
//
// The browser only sends { feedback, page }. Everything else - who the user
// is, their email, role, and school - is looked up server-side from the
// session, so no credentials or personal data logic ever lives in client
// code.
//
// Email is sent through Resend's REST API (no SDK needed). Configure:
//   RESEND_API_KEY=re_...          (from https://resend.com/api-keys)
//   FEEDBACK_EMAIL=you@example.com (where feedback is delivered)
//   FEEDBACK_FROM_EMAIL=Hierarchy Class <noreply@yourdomain.com>
//                          (optional; defaults to Resend's onboarding sandbox)

export async function POST(request: Request) {
  let body: { feedback?: string; page?: string } = {};
  try {
    body = await request.json();
  } catch {
    // malformed body handled below
  }

  const feedback = (body.feedback ?? "").trim();
  if (!feedback) {
    return NextResponse.json({ ok: false, error: "Feedback text is required." }, { status: 400 });
  }
  if (feedback.length > 5000) {
    return NextResponse.json({ ok: false, error: "Feedback is too long (5,000 character limit)." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let fullName = "Unknown user";
  let email: string | null = null;
  let role = "unknown";
  let schoolName: string | null = null;

  if (url && anonKey) {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(url, anonKey, {
      cookies: {
        getAll: async () => {
          return cookieStore.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value }));
        },
        setAll: async () => {
          // Read-only handler for this endpoint; nothing is set.
        },
      },
    });

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (user) {
      email = user.email ?? null;
      const { data: profile } = (await supabase
        .from("profiles")
        .select("full_name, role, school_id")
        .eq("user_id", user.id)
        .maybeSingle()) as unknown as { data: { full_name: string; role: string; school_id: string } | null; error: Error | null };
      if (profile) {
        fullName = profile.full_name;
        role = profile.role;
        const { data: school } = (await supabase
          .from("schools")
          .select("name")
          .eq("id", profile.school_id)
          .maybeSingle()) as unknown as { data: { name: string } | null; error: Error | null };
        schoolName = school?.name ?? null;
      }
    }
  }

  const to = process.env.FEEDBACK_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.FEEDBACK_FROM_EMAIL?.trim() ?? (apiKey ? "Hierarchy Class <onboarding@resend.dev>" : undefined);

  if (!to || !apiKey || !from) {
    console.error(
      "[feedback] Email not configured. Set FEEDBACK_EMAIL, RESEND_API_KEY (and optionally FEEDBACK_FROM_EMAIL)."
    );
    return NextResponse.json(
      { ok: false, error: "Feedback email isn't configured yet on this deployment." },
      { status: 501 }
    );
  }

  const lines = [
    "Website: Hierarchy Class",
    `User: ${fullName}`,
    `Email: ${email ?? "not available"}`,
    `Role: ${role}`,
    schoolName ? `School: ${schoolName}` : "",
    body.page ? `Page: ${body.page}` : "",
    `Timestamp: ${new Date().toISOString()}`,
    "",
    "Feedback / report:",
    feedback,
  ].filter(Boolean).join("\n");

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Hierarchy Class feedback from ${fullName} (${role})`,
        text: lines,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[feedback] Resend error ${res.status}: ${detail}`);
      return NextResponse.json(
        { ok: false, error: "Couldn't send the feedback email. Please try again later." },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[feedback] Failed to send email", err);
    return NextResponse.json(
      { ok: false, error: "Couldn't send the feedback email. Please try again later." },
      { status: 502 }
    );
  }
}
