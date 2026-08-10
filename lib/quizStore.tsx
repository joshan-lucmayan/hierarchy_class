"use client";

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useMyProfile } from "@/lib/useMyProfile";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  id: string;
  title: string;
  courseId: string;
  courseName: string;
  timeLimitSeconds: number;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: string;
  quizId: string;
  quizTitle: string;
  score: number;
  total: number;
  completedAt: string;
}

interface QuizContextValue {
  quizzes: Quiz[];
  addQuiz: (quiz: Omit<Quiz, "id">) => Promise<void>;
  attempts: QuizAttempt[];
  addAttempt: (attempt: Omit<QuizAttempt, "id" | "completedAt">) => Promise<void>;
  bonusPoints: number;
  loading: boolean;
  error: string | null;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useMyProfile();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchTick, setRefetchTick] = useState(0);

  const supabaseConfigured =
    !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false);
      setError("Supabase isn't configured yet.");
      return;
    }
    if (!profile) return;

    let cancelled = false;
    const supabase = createClient();

    async function loadAll() {
      setLoading(true);

      const [{ data: quizzesData, error: quizzesErr }, { data: attemptsData, error: attemptsErr }] =
        (await Promise.all([
          supabase
            .from("quizzes")
            .select("*, quiz_questions(*), courses(name)")
            .order("created_at", { ascending: false }),
          supabase.from("quiz_attempts").select("*, quizzes(title)").order("completed_at", { ascending: false }),
        ])) as any[];

      if (cancelled) return;

      if (quizzesErr || attemptsErr) {
        setError("Couldn't load quizzes. Please refresh and try again.");
        setLoading(false);
        return;
      }

      setQuizzes(
        ((quizzesData ?? []) as any[]).map((q: any) => ({
          id: q.id,
          title: q.title,
          courseId: q.course_id,
          courseName: q.courses?.name ?? "Unknown course",
          timeLimitSeconds: q.time_limit_seconds,
          questions: (q.quiz_questions ?? []).map((qq: any) => ({
            id: qq.id,
            question: qq.question,
            options: qq.options,
            correctIndex: qq.correct_index,
          })),
        }))
      );

      setAttempts(
        ((attemptsData ?? []) as any[]).map((a: any) => ({
          id: a.id,
          quizId: a.quiz_id,
          quizTitle: a.quizzes?.title ?? "Quiz",
          score: a.score,
          total: a.total,
          completedAt: a.completed_at,
        }))
      );

      setError(null);
      setLoading(false);
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, [supabaseConfigured, profile, refetchTick]);

  const refetch = useCallback(() => setRefetchTick((t) => t + 1), []);

  const addQuiz = useCallback(
    async (quiz: Omit<Quiz, "id">) => {
      if (!profile) return;
      const supabase = createClient();

      const { data: inserted, error: insertErr } = await (supabase.from("quizzes") as any)
        .insert({
          school_id: profile.school_id,
          title: quiz.title,
          subject: quiz.courseName ?? "General",
          course_id: quiz.courseId,
          time_limit_seconds: quiz.timeLimitSeconds,
          created_by: profile.id,
        })
        .select()
        .single();

      if (insertErr || !inserted) return;

      await (supabase.from("quiz_questions") as any).insert(
        quiz.questions.map((q) => ({
          quiz_id: (inserted as any).id,
          question: q.question,
          options: q.options,
          correct_index: q.correctIndex,
        }))
      );

      refetch();
    },
    [profile, refetch]
  );

  const addAttempt = useCallback(
    async (attempt: Omit<QuizAttempt, "id" | "completedAt">) => {
      if (!profile) return;
      const supabase = createClient();
      await (supabase.from("quiz_attempts") as any).insert({
        school_id: profile.school_id,
        student_id: profile.id,
        quiz_id: attempt.quizId,
        score: attempt.score,
        total: attempt.total,
      });
      refetch();
    },
    [profile, refetch]
  );

  const bonusPoints = useMemo(() => {
    const raw = attempts.reduce((sum, a) => sum + Math.round((a.score / a.total) * 3), 0);
    return Math.min(9, raw);
  }, [attempts]);

  const value = useMemo(
    () => ({ quizzes, addQuiz, attempts, addAttempt, bonusPoints, loading, error }),
    [quizzes, attempts, bonusPoints, loading, error]
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuizStore() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuizStore must be used within QuizProvider");
  return ctx;
}
