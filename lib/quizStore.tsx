"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface Quiz {
  id: string;
  title: string;
  subject: string;
  gradeLevel: number;
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

const STORAGE_QUIZZES = "hc-quizzes";
const STORAGE_ATTEMPTS = "hc-quiz-attempts";

const DEFAULT_QUIZZES: Quiz[] = [
  {
    id: "quiz-math-1",
    title: "Linear Equations Quick Check",
    subject: "Mathematics",
    gradeLevel: 10,
    timeLimitSeconds: 90,
    questions: [
      { id: "q1", question: "Solve for x: 2x + 4 = 12", options: ["2", "4", "6", "8"], correctIndex: 1 },
      { id: "q2", question: "What is the slope of y = 3x + 5?", options: ["3", "5", "1/3", "-3"], correctIndex: 0 },
      { id: "q3", question: "Solve for x: x - 7 = 3", options: ["4", "10", "-4", "0"], correctIndex: 1 },
    ],
  },
  {
    id: "quiz-science-1",
    title: "Energy Transformation Basics",
    subject: "Science",
    gradeLevel: 10,
    timeLimitSeconds: 90,
    questions: [
      { id: "q1", question: "Energy cannot be created or destroyed, only transformed. This is the law of:", options: ["Gravity", "Conservation of Energy", "Motion", "Thermodynamics Zero"], correctIndex: 1 },
      { id: "q2", question: "A moving car has mostly what type of energy?", options: ["Potential", "Chemical", "Kinetic", "Nuclear"], correctIndex: 2 },
    ],
  },
];

interface QuizContextValue {
  quizzes: Quiz[];
  addQuiz: (quiz: Quiz) => void;
  attempts: QuizAttempt[];
  addAttempt: (attempt: QuizAttempt) => void;
  bonusPoints: number;
}

const QuizContext = createContext<QuizContextValue | null>(null);

export function QuizProvider({ children }: { children: React.ReactNode }) {
  const [quizzes, setQuizzes] = useState<Quiz[]>(DEFAULT_QUIZZES);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const savedQuizzes = window.localStorage.getItem(STORAGE_QUIZZES);
      const savedAttempts = window.localStorage.getItem(STORAGE_ATTEMPTS);
      if (savedQuizzes) setQuizzes(JSON.parse(savedQuizzes));
      if (savedAttempts) setAttempts(JSON.parse(savedAttempts));
    } catch {
      // ignore corrupt storage
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_QUIZZES, JSON.stringify(quizzes));
  }, [quizzes, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_ATTEMPTS, JSON.stringify(attempts));
  }, [attempts, hydrated]);

  function addQuiz(quiz: Quiz) {
    setQuizzes((prev) => [quiz, ...prev]);
  }

  function addAttempt(attempt: QuizAttempt) {
    setAttempts((prev) => [attempt, ...prev]);
  }

  const bonusPoints = useMemo(() => {
    const raw = attempts.reduce((sum, a) => sum + Math.round((a.score / a.total) * 3), 0);
    return Math.min(9, raw);
  }, [attempts]);

  const value = useMemo(
    () => ({ quizzes, addQuiz, attempts, addAttempt, bonusPoints }),
    [quizzes, attempts, bonusPoints]
  );

  return <QuizContext.Provider value={value}>{children}</QuizContext.Provider>;
}

export function useQuizStore() {
  const ctx = useContext(QuizContext);
  if (!ctx) throw new Error("useQuizStore must be used within QuizProvider");
  return ctx;
}
