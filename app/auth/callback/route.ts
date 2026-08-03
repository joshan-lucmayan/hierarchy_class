import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { Database } from "@/types/supabase";

// Type for cookie objects set by Supabase
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

// Landing page for links Supabase Auth sends by email (signup confirmation,
// password reset, etc). Exchanges the one-time `code` for a real session,
// then sends the person on to log in.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (url && anonKey) {
      const cookieStore = await cookies();
      const supabase = createServerClient<Database>(url, anonKey, {
        cookies: {
          getAll: async () => {
            return cookieStore.getAll().map((cookie) => ({
              name: cookie.name,
              value: cookie.value,
            }));
          },
          setAll: async (cookiesToSet: CookieToSet[]) => {
            cookiesToSet.forEach(({ name, value, options }: CookieToSet) => {
              cookieStore.set(name, value, options);
            });
          },
        },
      });

      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) {
        return NextResponse.redirect(`${origin}/login?confirmed=1`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?confirmed=0`);
}
