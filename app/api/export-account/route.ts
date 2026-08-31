import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database, ProfileRow } from "@/types/supabase";

// Account data export ("Download My Data").
//
// Runs with the caller's own session against the anon-key server client, so
// RLS gates every query - a user can only export their own rows (and only
// what their role is allowed to read). No service role, no bypassing RLS.
// Returns a JSON file download.

interface CookieToSet {
  name: string;
  value: string;
  options?: {
    maxAge?: number;
    expires?: Date;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
  };
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return new Response(JSON.stringify({ error: "Not configured" }), { status: 500 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll: async () => cookieStore.getAll(),
      setAll: async (cookiesToSet: CookieToSet[]) => {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Not signed in." }), { status: 401 });
  }

  const { data: profile } = (await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .single()) as { data: ProfileRow | null };
  if (!profile) {
    return new Response(JSON.stringify({ error: "Profile not found." }), { status: 404 });
  }

  const out: Record<string, unknown> = {
    exported_at: new Date().toISOString(),
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      role: profile.role,
      level_label: profile.level_label,
      section: profile.section,
      educational_level: profile.educational_level,
      program: profile.program,
      bio: profile.bio,
      hobbies: profile.hobbies,
      favorite_subject: profile.favorite_subject,
      created_at: profile.created_at,
    },
  };

  // Every query is filtered to the caller's own id (and additionally gated by
  // RLS), so no other user's data is exported.
  if (profile.role === "student") {
    const [
      grades,
      enrollments,
      courses,
      rankState,
      achievements,
      music,
      habits,
      quizAttempts,
      florin,
      seasonHistory,
    ] = await Promise.all([
      supabase.from("grade_entries").select("course_id, type, label, score, entry_date, approval_status").eq("student_id", profile.id),
      supabase.from("course_enrollments").select("course_id, created_at").eq("student_id", profile.id),
      supabase.from("courses").select("id, name, code"),
      supabase.from("student_rank_state").select("current_rank, current_bar, ex_score, peak_rank_this_season, highest_rank_ever").eq("student_id", profile.id).maybeSingle(),
      supabase.from("student_achievements").select("title, school_year, date_awarded, school").eq("student_id", profile.id),
      supabase.from("student_music").select("music_url, platform, title, artist").eq("student_id", profile.id),
      supabase.from("habits").select("name, category, goal_type, target_value, target_unit, frequency_type, scheduled_days, status, created_at").eq("student_id", profile.id),
      supabase.from("quiz_attempts").select("quiz_id, score, total, completed_at").eq("student_id", profile.id),
      (supabase.from("florin_balances").select("balance").eq("student_id", profile.id).maybeSingle()) as unknown as Promise<{ data: { balance: number } | null }>,
      (supabase as any).rpc("get_season_history", { p_student_id: profile.id }),
    ]);

    out.grades = grades.data ?? [];
    out.courses = courses.data ?? [];
    out.course_enrollments = enrollments.data ?? [];
    out.rank = rankState.data ?? null;
    out.achievements = achievements.data ?? [];
    out.music = music.data ?? [];
    out.habits = habits.data ?? [];
    out.quiz_attempts = quizAttempts.data ?? [];
    out.florin_balance = florin.data?.balance ?? null;
    out.season_history = seasonHistory.data ?? [];
  } else if (profile.role === "teacher") {
    const [courses, materials, tasks, notes, schedule, lessonPlans] = await Promise.all([
      supabase.from("courses").select("id, name, code, section_id").eq("teacher_id", profile.id),
      supabase.from("learning_materials").select("title, subject, type, description, created_at").eq("uploaded_by", profile.id),
      supabase.from("teacher_tasks").select("title, description, due_date, status, created_at").eq("teacher_id", profile.id),
      supabase.from("teacher_notes").select("*").eq("teacher_id", profile.id),
      supabase.from("teacher_schedule").select("*").eq("teacher_id", profile.id),
      supabase.from("teacher_lesson_plans").select("*").eq("teacher_id", profile.id),
    ]);

    out.courses_taught = courses.data ?? [];
    out.materials_uploaded = materials.data ?? [];
    out.teacher_tasks = tasks.data ?? [];
    out.teacher_notes = notes.data ?? [];
    out.teacher_schedule = schedule.data ?? [];
    out.teacher_lesson_plans = lessonPlans.data ?? [];
  }

  const filename = `hierarchy-class-export-${new Date().toISOString().slice(0, 10)}.json`;
  return new Response(JSON.stringify(out, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
