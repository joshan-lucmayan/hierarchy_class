"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Thin wrappers around the SECURITY DEFINER notification functions in
 * migrations/014_notifications.sql. These are the ONLY ways notifications
 * get created - the table has no client INSERT policy.
 */

export async function notifyUser(
  recipientId: string,
  type: string,
  title: string,
  body?: string,
  link?: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await (supabase as any).rpc("create_notification", {
    p_recipient_id: recipientId,
    p_type: type,
    p_title: title,
    p_body: body ?? null,
    p_link: link ?? null,
  });
  return !error;
}

export async function notifyAdmins(
  schoolId: string,
  type: string,
  title: string,
  body?: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await (supabase as any).rpc("notify_admins", {
    p_school_id: schoolId,
    p_type: type,
    p_title: title,
    p_body: body ?? null,
  });
  return !error;
}

/** After an admin creates/edits a feed post, fan out to the chosen audience. */
export async function notifyPostAudience(postId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await (supabase as any).rpc("notify_post_audience", {
    p_post_id: postId,
  });
  return !error;
}
