"use client";

import { useEffect, useState } from "react";
import { useQuizStore, Quiz } from "@/lib/quizStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

export default function StudentQuizPage() {
  const { quizzes, addAttempt } = useQuizStore();
  const { profile } = useMyProfile();
  const { getStudentRecordsByProfile } = useClassroomHierarchy();
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [timeLeft, setTimeLeft] = useState(0);
  const [result, setResult] = useState<{ score: number; total: number } | null>(null);

  const myCourseIds = profile
    ? getStudentRecordsByProfile(profile.id).map((s) => s.courseId)
    : [];
  const available = quizzes.filter((q) => myCourseIds.includes(q.courseId));

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
      quizId: activeQuiz.id,
      quizTitle: activeQuiz.title,
      score,
      total,
    });
    setResult({ score, total });
  }

  if (activeQuiz && !result) {
    const question = activeQuiz.questions[questionIndex];
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;

    return (
      <div className="mx-auto max-w-xl">
        <div className="flex items-center justify-between border-b border-base pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">{activeQuiz.title}</p>
            <p className="mt-1 text-xs text-muted">
              Question {questionIndex + 1} of {activeQuiz.questions.length}
            </p>
          </div>
          <span className={`text-sm font-bold ${timeLeft <= 10 ? "text-warn" : "text-navy"}`}>
            {minutes}:{seconds.toString().padStart(2, "0")}
          </span>
        </div>

        <div className="mt-6">
          <p className="text-lg font-semibold text-navy">{question.question}</p>
          <div className="mt-5 divide-y divide-[var(--border)]">
            {question.options.map((opt, i) => (
              <button
                key={i}
                type="button"
                onClick={() => selectAnswer(i)}
                className="flex w-full items-center gap-3 py-3.5 text-left text-sm transition"
              >
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    answers[questionIndex] === i ? "bg-gold" : "border border-base"
                  }`}
                />
                <span className={answers[questionIndex] === i ? "font-semibold text-navy" : "text-navy"}>
                  {opt}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={nextQuestion}
            disabled={answers[questionIndex] === undefined}
            className="mt-6 w-full justify-center rounded-full bg-navy py-3 text-sm font-semibold text-white transition hover-bg-gold-token hover-text-on-accent disabled:opacity-40"
          >
            {questionIndex < activeQuiz.questions.length - 1 ? "Next question" : "Submit quiz"}
          </button>
        </div>
      </div>
    );
  }

  if (result) {
    const bonus = Math.round((result.score / result.total) * 3);
    return (
      <div className="mx-auto max-w-xl py-10 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Quiz complete</p>
        <p className="mt-3 text-5xl font-bold text-navy">{result.score} / {result.total}</p>
        <p className="mt-2 text-sm text-muted">+{bonus} pts added toward your rank</p>
        <button
          type="button"
          onClick={() => { setActiveQuiz(null); setResult(null); }}
          className="mt-6 rounded-full bg-gold px-5 py-3 text-sm font-semibold text-on-accent transition hover:opacity-90"
        >
          Back to quizzes
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted">Play anytime. Your score contributes to your Academic Excellence rank.</p>

      {available.length === 0 ? (
        <p className="text-sm text-muted">No quizzes available for your courses yet. Check back soon.</p>
      ) : (
        <div className="divide-y divide-[var(--border)]">
          {available.map((quiz) => (
            <div key={quiz.id} className="flex items-center justify-between gap-4 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted">{quiz.courseName}</p>
                <p className="mt-1 text-lg font-semibold text-navy">{quiz.title}</p>
                <p className="mt-1 text-sm text-muted">{quiz.questions.length} questions · {quiz.timeLimitSeconds}s timer</p>
              </div>
              <button
                type="button"
                onClick={() => startQuiz(quiz)}
                className="shrink-0 rounded-full bg-navy px-5 py-2.5 text-sm font-semibold text-white transition hover-bg-gold-token hover-text-on-accent"
              >
                Start quiz
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
