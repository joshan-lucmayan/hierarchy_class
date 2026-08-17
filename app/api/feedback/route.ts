import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase";
import { sendEmail } from "@/lib/email";
import { createServiceClient } from "@/lib/supabase/serviceClient";

// Feedback / report endpoint.
//
// The browser sends { feedback, page, attachmentPaths }. Everything else -
// who the user is, their email, role, and school - is looked up server-side
// from the session, so no credentials or personal data logic ever lives in
// client code.
//
// Attachments: the client uploads files to the private "feedback" storage
// bucket first (paths {school_id}/{user_id}/{uuid}.ext, enforced by storage
// RLS), then sends the resulting paths here. The route re-validates that
// every path belongs to the caller's own school/user folder, stores the
// report row (feedback_reports, RLS-scoped), signs the objects with the
// server-only client, and emails the developer with working links.
//
// Email is sent through Resend's REST API (no SDK needed). Configure:
//   RESEND_API_KEY=re_...          (from https://resend.com/api-keys)
//   FEEDBACK_EMAIL=you@example.com (where feedback is delivered)
//   FEEDBACK_FROM_EMAIL=Hierarchy Class <noreply@yourdomain.com>
//                                  (optional; defaults to Resend's sandbox)

const MAX_ATTACHMENTS = 3;

function isOwnAttachmentPath(path: string, schoolId: string, userId: string): boolean {
  if (!path || path.length > 300) return false;
  // Path must be exactly {school_id}/{user_id}/{name} - no traversal, no
  // other folders, no query strings.
  const parts = path.split("/");
  if (parts.length !== 3) return false;
  if (parts[0] !== schoolId || parts[1] !== userId) return false;
  if (!parts[2] || parts[2].includes("..")) return false;
  return /^[a-zA-Z0-9_.-]+$/.test(parts[2]);
}

export async function POST(request: Request) {
  let body: { feedback?: string; page?: string; attachmentPaths?: string[] } = {};
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

  const attachmentPaths = (body.attachmentPaths ?? []).slice(0, MAX_ATTACHMENTS);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let fullName = "Unknown user";
  let email: string | null = null;
  let role = "unknown";
  let schoolName: string | null = null;
  let schoolId: string | null = null;
  let profileId: string | null = null;
  let verifiedPaths: string[] = [];

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
        .select("id, full_name, role, school_id")
        .eq("user_id", user.id)
        .maybeSingle()) as unknown as {
        data: { id: string; full_name: string; role: string; school_id: string } | null;
        error: Error | null;
      };
      if (profile) {
        profileId = profile.id;
        fullName = profile.full_name;
        role = profile.role;
        schoolId = profile.school_id;
        // Every attachment path must sit in the caller's own school/user
        // folder - a forged path can never point at another user's files.
        verifiedPaths = attachmentPaths.filter((p) => isOwnAttachmentPath(p, profile.school_id, profile.id));
        const { data: school } = (await supabase
          .from("schools")
          .select("name")
          .eq("id", profile.school_id)
          .maybeSingle()) as unknown as { data: { name: string } | null; error: Error | null };
        schoolName = school?.name ?? null;
      }

      // Persist the report row (RLS: the caller's own session insert policy
      // gates this - a forged path set is filtered above).
      if (profileId && schoolId) {
        await (supabase.from("feedback_reports") as any).insert({
          school_id: schoolId,
          user_id: profileId,
          page: body.page?.slice(0, 300) || null,
          message: feedback,
          attachment_paths: verifiedPaths,
        });
      }
    }
  }

  // Sign attachment URLs with the server-only client (the reporter cannot
  // read objects back through the anon key - only same-school admins can).
  const signedLinks: string[] = [];
  const svc = createServiceClient();
  if (svc && verifiedPaths.length > 0) {
    const { data } = await svc.storage.from("feedback").createSignedUrls(verifiedPaths, 60 * 60 * 24);
    ((data ?? []) as { signedUrl: string | null }[]).forEach((s) => {
      if (s?.signedUrl) signedLinks.push(s.signedUrl);
    });
  }

  const to = process.env.FEEDBACK_EMAIL?.trim();
  if (!to) {
    console.error("[feedback] FEEDBACK_EMAIL not set - feedback was stored but not emailed.");
    return NextResponse.json(
      { ok: true, warning: "Feedback stored, but the delivery email isn't configured yet." },
      { status: 201 }
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
    "",
    signedLinks.length > 0 ? "Attachments (signed links, expire in 24h):" : "",
    ...signedLinks.map((l) => `  - ${l}`),
    verifiedPaths.length > signedLinks.length
      ? `Note: ${verifiedPaths.length - signedLinks.length} attachment(s) could not be signed (storage or config issue).`
      : "",
  ].filter(Boolean).join("\n");

  const result = await sendEmail({
    to,
    subject: `Hierarchy Class feedback from ${fullName} (${role})`,
    text: lines,
  });

  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: "Couldn't send the feedback email. Your report was saved and can be reviewed by your school admin." },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true });
}
