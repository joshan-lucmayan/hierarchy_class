"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";
import type { EnrollmentStatusRow } from "@/types/supabase";

export type EffectiveEnrollment = "enrolled" | "expired" | "revoked" | "unknown";

export interface EnrollmentInfo {
  row: EnrollmentStatusRow | null;
  effective: EffectiveEnrollment;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface AdminEnrollment {
  studentId: string;
  status: string | null;
  startedAt: string | null;
  expiresAt: string | null;
}

/**
 * Effective status is computed here rather than stored: an enrollment with a
 * past expiry date is treated as expired even if no job has flipped the row.
 */
export function effectiveFrom(row: EnrollmentStatusRow | null): EffectiveEnrollment {
  if (!row) return "unknown";
  if (row.status === "revoked") return "revoked";
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return "expired";
  return "enrolled";
}

/** My own enrollment status (student view). */
export function useMyEnrollment(): EnrollmentInfo {
  const { profile } = useMyProfile();
  const [row, setRow] = useState<EnrollmentStatusRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("enrollment_status")
      .select("*")
      .eq("student_id", profile.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        setRow(fetchError ? null : (data as EnrollmentStatusRow | null));
        setError(fetchError ? "Couldn't load your enrollment status." : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, tick]);

  // Re-evaluate once a minute so a badge that expires while the page is open
  // disappears without a reload - effective status always comes from the
  // stored expires_at vs the current time, never from a client-side timer
  // pretending to be the source of truth.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { row, effective: effectiveFrom(row), loading, error, refetch };
}

/**
 * All enrollment statuses for the caller's school. Works for admins (full
 * management) and teachers (read-only, via the teacher RLS policy added in
 * migration 024). Students never see anyone but themselves.
 */
export function useSchoolEnrollments() {
  const { profile } = useMyProfile();
  const [statuses, setStatuses] = useState<Record<string, AdminEnrollment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("enrollment_status")
      .select("*")
      .eq("school_id", profile.school_id)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        const map: Record<string, AdminEnrollment> = {};
        ((data ?? []) as EnrollmentStatusRow[]).forEach((r) => {
          map[r.student_id] = { studentId: r.student_id, status: r.status, startedAt: r.started_at, expiresAt: r.expires_at };
        });
        setStatuses(map);
        setError(fetchError ? "Couldn't load enrollment statuses." : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  return { statuses, loading, error, refetch };
}

/** Admin: all enrollment statuses for the school, plus upsert/revoke actions. */
export function useAdminEnrollments() {
  const { profile } = useMyProfile();
  const [statuses, setStatuses] = useState<Record<string, AdminEnrollment>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured || !profile) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    const supabase = createClient();
    supabase
      .from("enrollment_status")
      .select("*")
      .eq("school_id", profile.school_id)
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        const map: Record<string, AdminEnrollment> = {};
        ((data ?? []) as EnrollmentStatusRow[]).forEach((r) => {
          map[r.student_id] = { studentId: r.student_id, status: r.status, startedAt: r.started_at, expiresAt: r.expires_at };
        });
        setStatuses(map);
        setError(fetchError ? "Couldn't load enrollment statuses." : null);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);

  /** Set or renew an enrollment; returns false on RLS/validation failure. */
  const setEnrollment = useCallback(
    async (studentId: string, expiresAt: string | null): Promise<boolean> => {
      if (!profile) return false;
      const supabase = createClient();
      const { error: upsertError } = await (supabase.from("enrollment_status") as any)
        .upsert(
          {
            student_id: studentId,
            school_id: profile.school_id,
            status: "enrolled",
            expires_at: expiresAt,
            started_at: statuses[studentId]?.startedAt ?? new Date().toISOString(),
            updated_by: profile.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id" }
        );
      if (upsertError) {
        setError("Couldn't update the enrollment status.");
        return false;
      }
      refetch();
      return true;
    },
    [profile, statuses, refetch]
  );

  /** Revoke an enrollment (no expiry, revoked immediately). */
  const revokeEnrollment = useCallback(
    async (studentId: string): Promise<boolean> => {
      if (!profile) return false;
      const supabase = createClient();
      const { error } = await (supabase.from("enrollment_status") as any)
        .update({ status: "revoked", updated_by: profile.id, updated_at: new Date().toISOString() })
        .eq("student_id", studentId);
      if (error) {
        setError("Couldn't revoke the enrollment.");
        return false;
      }
      refetch();
      return true;
    },
    [profile, refetch]
  );

  return { statuses, loading, error, setEnrollment, revokeEnrollment, refetch };
}
