"use client";

import { useEffect, useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useQuizStore, Quiz } from "@/lib/quizStore";
import { CURRENT_STUDENT } from "@/data/mockStudents";

export default function StudentQuizPage() {
  const { quizzes, addAttempt } = useQuizStore();
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const available = quizzes.filter((q) => q.gradeLevel === CURRENT_STUDENT.gradeLevel);

  useEffect(() => {
    if (!activeQuiz || result) return;
    if (timeLeft <= 0) {
      finishQuiz();
      return;
    }
    const timer = setTimeout(() => setTimeLeft((t) => t - 1), 1000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, activeQuiz, result]);

  function startQuiz(quiz: Quiz) {
    setActiveQuiz(quiz);
    setQuestionIndex(0);
    setAnswers([]);
    setTimeLeft(quiz.timeLimitSeconds);
    setResult(null);
  }

  function selectAnswer(index: number) {
    setAnswers((prev) => {
      const next = [...prev];
      next[questionIndex] = index;
      return next;
    });
  }

  function nextQuestion() {
    if (!activeQuiz) return;
    if (questionIndex < activeQuiz.questions.length - 1) {
      setQuestionIndex((i) => i + 1);
    } else {
      finishQuiz();
    }
  }

  function finishQuiz() {
    if (!activeQuiz) return;
    const score = activeQuiz.questions.reduce(
      (sum, q, i) => sum + (answers[i] === q.correctIndex ? 1 : 0),
      0
    );
    const total = activeQuiz.questions.length;
    addAttempt({
      id: `attempt-${Date.now()}`,
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      score,
      total,
      completedAt: new Date().toISOString(),
    });
    setResult({ score, total });
  }

  if (activeQuiz && !result) {
    const question = activeQuiz.questions[questionIndex];
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="mx-auto max-w-xl">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-navy p-6 text-white shadow-xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{activeQuiz.title}</p>
            <span className={`rounded-full px-3 py-1 text-sm font-bold ${timeLeft <= 10 ? "bg-red-500/30 text-red-200" : "bg-white/10"}`}>
              {minutes}:{seconds.toString().padStart(2, "0")}
            </span>
          </div>
          <p className="mt-2 text-xs opacity-70">
            Question {questionIndex + 1} of {activeQuiz.questions.length}
          </p>
        </CornerFrame>

        <CornerFrame className="mt-6 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-lg font-semibold text-navy">{question.question}</p>
          <div className="mt-5 space-y-3">
            {question.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectAnswer(i)}
                className={`w-full rounded-2xl border px-4 py-3 text-left text-sm transition ${
                  answers[questionIndex] === i
                    ? "border-gold bg-[var(--surface-strong)] font-semibold text-navy"
                    : "border-base bg-surface text-navy hover:border-gold"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={nextQuestion}
            disabled={answers[questionIndex] === undefined}
            className="mt-6 w-full rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy disabled:opacity-40"
          >
            {questionIndex < activeQuiz.questions.length - 1 ? "Next question" : "Submit quiz"}
          </button>
        </CornerFrame>
      </div>
    );
  }

  if (result) {
    const bonus = Math.round((result.score / result.total) * 3);
    return (
      <div className="mx-auto max-w-xl">
        <CornerFrame className="rounded-3xl border-2 border-gold bg-navy p-8 text-center text-white shadow-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Quiz complete</p>
          <p className="mt-3 text-4xl font-bold">{result.score} / {result.total}</p>
          <p className="mt-2 text-sm opacity-80">+{bonus} pts added toward your rank</p>
          <button
            type="button"
            onClick={() => { setActiveQuiz(null); setResult(null); }}
            className="mt-6 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-navy transition hover:opacity-90"
          >
            Back to quizzes
          </button>
        </CornerFrame>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-navy p-6 text-white shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Quiz</p>
        <h1 className="mt-2 text-3xl font-bold">Test your knowledge</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 opacity-80">
          Play anytime. Your score contributes to your Academic Excellence rank.
        </p>
      </CornerFrame>

      {available.length === 0 ? (
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 text-muted shadow-card">
          No quizzes available for your grade yet. Check back soon.
        </CornerFrame>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {available.map((quiz) => (
            <CornerFrame key={quiz.id} className="rounded-3xl border border-base bg-surface p-6 shadow-card transition hover:border-gold hover:-translate-y-0.5 hover:shadow-lg">
              <p className="text-xs uppercase tracking-[0.25em] text-muted">{quiz.subject}</p>
              <p className="mt-2 text-lg font-semibold text-navy">{quiz.title}</p>
              <p className="mt-2 text-sm text-muted">{quiz.questions.length} questions · {quiz.timeLimitSeconds}s timer</p>
              <button
                type="button"
                onClick={() => startQuiz(quiz)}
                className="mt-4 inline-flex items-center rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
              >
                Start quiz
              </button>
            </CornerFrame>
          ))}
        </div>
      )}
    </div>
  );
}
