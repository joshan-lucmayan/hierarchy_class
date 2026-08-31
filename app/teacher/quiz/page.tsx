"use client";

import { useState } from "react";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconPlus, IconCheck, IconTrash, IconTask, IconPost } from "@/components/ui/icons";
import { useQuizStore, QuizQuestion } from "@/lib/quizStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";

function emptyQuestion(): QuizQuestion {
  return { id: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, question: "", options: ["", "", "", ""], correctIndex: 0 };
}

export default function TeacherQuizPage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const { getCoursesByTeacher } = useClassroomHierarchy();
  const { quizzes, addQuiz, loading: quizLoading, error: quizError } = useQuizStore();

  const myCourses = profile ? getCoursesByTeacher(profile.id) : [];
  const myQuizzes = quizzes.filter((q) => myCourses.some((c) => c.id === q.courseId));
  const loading = profileLoading || quizLoading;

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
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Quiz builder</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Create timed quizzes · published to your courses
          </h2>
        </div>
        <Stat label="My quizzes" value={loading ? "-" : myQuizzes.length} tone="gold" hint="Published" />
      </div>

      {loading ? (
        /* Skeleton: mirror the builder form geometry. */
        <CornerFrame className="p-5">
          <div className="h-8 w-56 animate-pulse rounded-[8px] bg-tile" />
          <div className="mt-3 h-3 w-96 max-w-full animate-pulse rounded-full bg-tile" />
          <div className="mt-5 grid animate-pulse gap-4 lg:grid-cols-2">
            <div className="h-12 rounded-[10px] bg-tile" />
            <div className="grid grid-cols-2 gap-3">
              <div className="h-12 rounded-[10px] bg-tile" />
              <div className="h-12 rounded-[10px] bg-tile" />
            </div>
          </div>
          <div className="mt-5 h-28 animate-pulse rounded-[10px] bg-tile" />
        </CornerFrame>
      ) : quizError ? (
        <p className="rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">
          Couldn&apos;t load your quizzes. Please refresh and try again.
        </p>
      ) : myCourses.length === 0 ? (
        <CornerFrame className="p-8">
          <EmptyState
            icon={<IconTask size={16} />}
            title="No courses assigned"
            desc="You don't have any courses assigned to you yet. Ask your admin to assign you to a course first."
          />
        </CornerFrame>
      ) : (
        <>
          {/* ========================================================== */}
          {/* QUIZ BUILDER                                              */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <h3 className="section-label">Quiz details</h3>
            <p className="mt-1.5 text-xs leading-5 text-muted">
              Scores from these quizzes count toward each student&apos;s rank progress. Only students
              enrolled in the course you pick will see it.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Quiz title
                </span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Chapter 4 Review"
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1.5">
                  <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                    Course
                  </span>
                  <select
                    value={courseId}
                    onChange={(e) => setCourseId(e.target.value)}
                    className="w-full rounded-[10px] border border-base bg-surface px-3 py-3 text-sm text-navy outline-none focus:border-gold"
                  >
                    <option value="">Select a course</option>
                    {myCourses.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5">
                  <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                    Time (sec)
                  </span>
                  <input
                    type="number"
                    min={30}
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                    className="w-full rounded-[10px] border border-base bg-surface px-3 py-3 text-sm text-navy outline-none focus:border-gold"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <h3 className="section-label">Questions</h3>
              <Chip variant="neutral">{questions.length} added</Chip>
            </div>
            <div className="mt-3 space-y-4">
              {questions.map((q, qIndex) => (
                <div key={q.id} className="rounded-[10px] border border-base p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.15em] text-faint">
                      Question {qIndex + 1}
                    </p>
                    {questions.length > 1 && (
                      <Button variant="danger" size="sm" icon={<IconTrash size={12} />} onClick={() => removeQuestion(q.id)}>
                        Remove
                      </Button>
                    )}
                  </div>
                  <input
                    value={q.question}
                    onChange={(e) => updateQuestion(q.id, e.target.value)}
                    placeholder="Type the question..."
                    className="mt-3 w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                  />
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {q.options.map((opt, oIndex) => (
                      <label
                        key={oIndex}
                        className={`flex items-center gap-2 rounded-[10px] border px-3 py-2 text-sm ${
                          q.correctIndex === oIndex ? "border-gold-token bg-[var(--surface-strong)]" : "border-base bg-surface"
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

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button variant="outline" size="sm" icon={<IconPlus size={13} />} onClick={addQuestion}>
                Add question
              </Button>
              <Button variant="gold" size="md" icon={<IconCheck size={13} />} onClick={handleSubmit}>
                Publish quiz
              </Button>
              {message && <p className="text-sm text-muted">{message}</p>}
            </div>
          </CornerFrame>

          {/* ========================================================== */}
          {/* PUBLISHED QUIZZES                                          */}
          {/* ========================================================== */}
          <CornerFrame className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="section-label">Published quizzes</h3>
              {myQuizzes.length > 0 && <Chip variant="gold">{myQuizzes.length} total</Chip>}
            </div>
            <div className="mt-4">
              {myQuizzes.length === 0 ? (
                <EmptyState
                  icon={<IconPost size={16} />}
                  title="No quizzes published"
                  desc="Quizzes you publish appear here with their course, question count, and time limit."
                />
              ) : (
                <div className="space-y-2">
                  {myQuizzes.map((q) => (
                    <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-base bg-surface px-4 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-navy">{q.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted">{q.courseName}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Chip variant="gold">{q.questions.length} questions</Chip>
                        <span className="font-mono-ui text-[10px] uppercase tracking-[0.15em] text-faint">
                          {q.timeLimitSeconds}s
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CornerFrame>
        </>
      )}
    </div>
  );
}
