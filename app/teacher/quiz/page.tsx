"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { useQuizStore, QuizQuestion } from "@/lib/quizStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

function emptyQuestion(): QuizQuestion {
  return { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, question: "", options: ["", "", "", ""], correctIndex: 0 };
}

export default function TeacherQuizPage() {
  const { profile } = useMyProfile();
  const { getCoursesByTeacher } = useClassroomHierarchy();
  const { quizzes, addQuiz } = useQuizStore();

  const myCourses = profile ? getCoursesByTeacher(profile.id) : [];

  const [title, setTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [timeLimit, setTimeLimit] = useState(90);
  const [questions, setQuestions] = useState<QuizQuestion[]>([emptyQuestion()]);
  const [message, setMessage] = useState("");

  function updateQuestion(id: string, text: string) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, question: text } : q)));
  }

  function updateOption(id: string, index: number, value: string) {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, options: q.options.map((o, i) => (i === index ? value : o)) } : q))
    );
  }

  function setCorrect(id: string, index: number) {
    setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, correctIndex: index } : q)));
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, emptyQuestion()]);
  }

  function removeQuestion(id: string) {
    setQuestions((prev) => (prev.length > 1 ? prev.filter((q) => q.id !== id) : prev));
  }

  async function handleSubmit() {
    const validQuestions = questions.filter((q) => q.question.trim() && q.options.every((o) => o.trim()));
    const course = myCourses.find((c) => c.id === courseId);
    if (!title.trim() || !course || validQuestions.length === 0) {
      setMessage("Add a title, pick a course, and at least one complete question.");
      return;
    }
    await addQuiz({
      title: title.trim(),
      courseId: course.id,
      courseName: course.name,
      timeLimitSeconds: timeLimit,
      questions: validQuestions,
    });
    setTitle("");
    setQuestions([emptyQuestion()]);
    setMessage(`Quiz published - students enrolled in ${course.name} can now play it.`);
  }

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-3xl border-2 border-gold bg-surface p-6 shadow-card">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Quiz builder</p>
        <h1 className="mt-2 text-3xl font-bold text-navy">Create a timed quiz</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
          Scores from these quizzes count toward each student&apos;s rank progress. Only students enrolled in the course you pick will see it.
        </p>
      </CornerFrame>

      {myCourses.length === 0 ? (
        <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
          <p className="text-sm text-muted">
            You don&apos;t have any courses assigned to you yet. Ask your admin to assign you to a course first.
          </p>
        </CornerFrame>
      ) : (
        <CornerFrame className="space-y-5 rounded-3xl border border-base bg-surface p-6 shadow-card">
          <div className="grid gap-4 lg:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-muted">
              Quiz title
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Chapter 4 Review"
                className="w-full rounded-2xl border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2 text-sm font-semibold text-muted">
                Course
                <select
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="w-full rounded-2xl border border-base bg-surface px-3 py-3 text-sm text-navy outline-none focus:border-gold"
                >
                  <option value="">Select a course</option>
                  {myCourses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-muted">
                Time (sec)
                <input
                  type="number"
                  min={30}
                  value={timeLimit}
                  onChange={(e) => setTimeLimit(Number(e.target.value))}
                  className="w-full rounded-2xl border border-base bg-surface px-3 py-3 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
            </div>
          </div>

          <div className="space-y-4">
            {questions.map((q, qIndex) => (
              <div key={q.id} className="rounded-2xl border border-base p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted">Question {qIndex + 1}</p>
                  {questions.length > 1 && (
                    <button type="button" onClick={() => removeQuestion(q.id)} className="text-xs font-semibold text-red-500">
                      Remove
                    </button>
                  )}
                </div>
                <input
                  value={q.question}
                  onChange={(e) => updateQuestion(q.id, e.target.value)}
                  placeholder="Type the question..."
                  className="mt-3 w-full rounded-xl border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {q.options.map((opt, oIndex) => (
                    <label
                      key={oIndex}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                        q.correctIndex === oIndex ? "border-gold bg-[var(--surface-strong)]" : "border-base bg-surface"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`correct-${q.id}`}
                        checked={q.correctIndex === oIndex}
                        onChange={() => setCorrect(q.id, oIndex)}
                      />
                      <input
                        value={opt}
                        onChange={(e) => updateOption(q.id, oIndex, e.target.value)}
                        placeholder={`Option ${oIndex + 1}`}
                        className="flex-1 bg-transparent text-navy outline-none"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-muted">Select the radio button next to the correct answer.</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={addQuestion}
              className="rounded-full border border-base bg-surface px-4 py-2 text-xs font-semibold text-navy transition hover:border-gold"
            >
              + Add question
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-navy"
            >
              Publish quiz
            </button>
            {message && <p className="text-sm text-muted">{message}</p>}
          </div>
        </CornerFrame>
      )}

      <CornerFrame className="rounded-3xl border border-base bg-surface p-6 shadow-card">
        <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-navy">Published quizzes</h2>
        <div className="mt-4 space-y-3">
          {quizzes.filter((q) => myCourses.some((c) => c.id === q.courseId)).length === 0 ? (
            <p className="text-sm text-muted">No quizzes published yet.</p>
          ) : (
            quizzes
              .filter((q) => myCourses.some((c) => c.id === q.courseId))
              .map((q) => (
                <div key={q.id} className="rounded-2xl border border-base p-4">
                  <p className="text-sm font-semibold text-navy">{q.title}</p>
                  <p className="mt-1 text-xs text-muted">
                    {q.courseName} · {q.questions.length} questions · {q.timeLimitSeconds}s
                  </p>
                </div>
              ))
          )}
        </div>
      </CornerFrame>
    </div>
  );
}
