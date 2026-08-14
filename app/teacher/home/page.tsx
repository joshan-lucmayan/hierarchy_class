"use client";

import { useEffect, useMemo, useState } from "react";
import { useMyProfile } from "@/lib/useMyProfile";
import { useTeacherWorkspace, TeacherNote, ScheduleItem, LessonPlanItem } from "@/lib/teacherWorkspaceStore";
import { useTeacherTasks } from "@/lib/teacherTasksStore";
import { useSchoolFeed } from "@/lib/schoolFeedStore";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { ActionButton, PlusIcon } from "@/components/ui/ActionButton";
import { FeedPost } from "@/components/feed/FeedPost";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function todayDayName(now: Date) {
  return now.toLocaleDateString("en-US", { weekday: "long" });
}

function todayDateInput(now: Date) {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nowHHMM(now: Date) {
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatTimeLabel(hhmm: string) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 === 0 ? 12 : h % 12;
  return `${displayHour}:${String(m).padStart(2, "0")} ${period}`;
}

/** Re-renders every 30s so "today" lists automatically drop items once their end time passes. */
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

type ModalKind = "note" | "schedule" | "lesson" | null;

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[10px] border border-base bg-surface p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">{title}</p>
          <button type="button" onClick={onClose} className="text-muted transition hover:text-navy">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-base text-muted transition hover:border-gold hover:text-gold"
    >
      <span className="text-base leading-none">+</span>
    </button>
  );
}

export default function TeacherHomePage() {
  const { profile, loading: profileLoading } = useMyProfile();
  const {
    notes,
    addNote,
    removeNote,
    togglePinNote,
    scheduleItems,
    addScheduleItem,
    removeScheduleItem,
    lessonPlans,
    addLessonPlan,
    removeLessonPlan,
  } = useTeacherWorkspace();

  const { getTasksByTeacher, acceptTask, declineTask, markTaskDone, reopenTask, deleteTask } = useTeacherTasks();
  const { posts: announcements, loading: feedLoading, error: feedError } = useSchoolFeed();
  const assignedTasks = profile ? getTasksByTeacher(profile.id) : [];

  // Task accept/decline/done now generate real notifications to admins
  // inside teacherTasksStore, so no manual message hack is needed here.
  function handleAccept(taskId: string) {
    acceptTask(taskId);
  }
  const [decliningTaskId, setDecliningTaskId] = useState<string | null>(null);
  const [declineReasonDraft, setDeclineReasonDraft] = useState("");

  function handleDeclineSubmit(taskId: string) {
    if (!declineReasonDraft.trim()) return;
    declineTask(taskId, declineReasonDraft);
    setDecliningTaskId(null);
    setDeclineReasonDraft("");
  }

  const now = useNow();
  const [activeModal, setActiveModal] = useState<ModalKind>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState({ day: DAYS[0], startTime: "", endTime: "", subject: "" });
  const [lessonDraft, setLessonDraft] = useState({ title: "", description: "", date: "", startTime: "", endTime: "" });
  const [scheduleFormError, setScheduleFormError] = useState("");

  const today = todayDayName(now);
  const todayStr = todayDateInput(now);
  const currentHHMM = nowHHMM(now);

  const pinnedNotes: TeacherNote[] = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  // Only shows entries for today that haven't ended yet - once the clock passes
  // endTime, the item drops off here automatically (useNow re-renders every 30s).
  const todaySchedule: ScheduleItem[] = useMemo(
    () =>
      scheduleItems
        .filter((s) => s.day === today && s.endTime >= currentHHMM)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [scheduleItems, today, currentHHMM]
  );

  const todayLessonPlans: LessonPlanItem[] = useMemo(
    () =>
      lessonPlans
        .filter((l) => l.date === todayStr && (!l.endTime || l.endTime >= currentHHMM))
        .sort((a, b) => (a.startTime || "").localeCompare(b.startTime || "")),
    [lessonPlans, todayStr, currentHHMM]
  );

  function handleAddNote(e: React.FormEvent) {
    e.preventDefault();
    addNote(noteDraft);
    setNoteDraft("");
  }

  function handleAddSchedule(e: React.FormEvent) {
    e.preventDefault();
    if (!scheduleDraft.subject.trim() || !scheduleDraft.startTime || !scheduleDraft.endTime) return;
    if (scheduleDraft.endTime <= scheduleDraft.startTime) {
      setScheduleFormError("End time must be after start time.");
      return;
    }
    setScheduleFormError("");
    addScheduleItem(scheduleDraft);
    setScheduleDraft({ day: DAYS[0], startTime: "", endTime: "", subject: "" });
  }

  function handleAddLessonPlan(e: React.FormEvent) {
    e.preventDefault();
    if (!lessonDraft.title.trim()) return;
    addLessonPlan(lessonDraft);
    setLessonDraft({ title: "", description: "", date: "", startTime: "", endTime: "" });
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold text-navy">
        {getGreeting(now.getHours())}{profileLoading ? "" : profile ? `, ${profile.full_name}` : ""}
      </h1>

      <div className="grid items-start gap-5 xl:grid-cols-[1.6fr_1fr]">
        {/* Left column: latest school feed (same as student home). */}
        <section className="space-y-4">
          <h1 className="text-[11px] font-semibold uppercase tracking-[0.11em] text-faint">
            Latest School Feed
          </h1>
          {feedLoading ? (
            <p className="text-sm text-muted">Loading announcements...</p>
          ) : feedError ? (
            <p className="text-sm text-red-500">{feedError}</p>
          ) : announcements.length === 0 ? (
            <p className="text-sm text-muted">No announcements yet.</p>
          ) : (
            <div className="space-y-4">
              {announcements.map((post) => (
                <FeedPost key={post.id} post={post} />
              ))}
            </div>
          )}
        </section>

        {/* Right column: teacher workspace cards, stacked. */}
        <aside className="space-y-4">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Assigned by admin</p>
            {assignedTasks.filter((t) => t.status === "pending").length > 0 && (
              <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold">
                {assignedTasks.filter((t) => t.status === "pending").length} pending
              </span>
            )}
          </div>
          <div className="mt-4 space-y-2">
            {assignedTasks.length === 0 && <p className="text-sm text-muted">No tasks assigned yet.</p>}
            {assignedTasks.map((task) => (
              <div key={task.id} className="rounded-[10px] border border-base p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`text-sm font-semibold ${task.status === "done" ? "text-muted line-through" : "text-navy"}`}>
                      {task.title}
                    </p>
                    {task.description && <p className="mt-0.5 text-xs text-muted">{task.description}</p>}
                    {task.dueDate && <p className="mt-0.5 text-xs text-gold">Due {task.dueDate}</p>}
                    {task.status === "declined" && task.declineReason && (
                      <p className="mt-1 text-xs text-red-500">Declined: {task.declineReason}</p>
                    )}
                  </div>

                  {task.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(task.id)}
                        className="rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDecliningTaskId(task.id); setDeclineReasonDraft(""); }}
                        className="rounded-full border border-base px-3 py-1 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                      >
                        Decline
                      </button>
                    </div>
                  )}

                  {task.status === "accepted" && (
                    <button
                      type="button"
                      onClick={() => markTaskDone(task.id)}
                      className="shrink-0 rounded-full bg-navy px-3 py-1 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
                    >
                      Mark done
                    </button>
                  )}

                  {task.status === "done" && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => reopenTask(task.id)}
                        className="rounded-full border border-base px-3 py-1 text-xs font-semibold text-muted transition hover:border-gold hover:text-gold"
                      >
                        Reopen
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-full border border-base px-3 py-1 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}

                  {task.status === "declined" && (
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600">
                        Declined
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteTask(task.id)}
                        className="rounded-full border border-base px-3 py-1 text-xs font-semibold text-muted transition hover:border-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {decliningTaskId === task.id && (
                  <div className="mt-3 space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
                    <p className="text-xs text-muted">Why are you declining this task?</p>
                    <textarea
                      value={declineReasonDraft}
                      onChange={(e) => setDeclineReasonDraft(e.target.value)}
                      placeholder="e.g. Conflicts with my class schedule"
                      rows={2}
                      className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-gold"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleDeclineSubmit(task.id)}
                        disabled={!declineReasonDraft.trim()}
                        className="rounded-full bg-red-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-600 disabled:opacity-40"
                      >
                        Submit decline
                      </button>
                      <button
                        type="button"
                        onClick={() => setDecliningTaskId(null)}
                        className="rounded-full border border-base px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-gold hover:text-gold"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Pinned notes</p>
              <AddButton label="Add a note" onClick={() => setActiveModal("note")} />
            </div>
            <div className="mt-4 space-y-2">
              {pinnedNotes.length === 0 && <p className="text-sm text-muted">No pinned notes.</p>}
              {pinnedNotes.map((note) => (
                <div key={note.id} className="rounded-[10px] border border-gold/50 bg-[var(--surface-strong)] p-3">
                  <p className="text-sm text-navy">{note.text}</p>
                </div>
              ))}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Today&apos;s schedule</p>
              <AddButton label="Add to schedule" onClick={() => setActiveModal("schedule")} />
            </div>
            <div className="mt-4 space-y-2">
              {todaySchedule.length === 0 && <p className="text-sm text-muted">Nothing left on today&apos;s schedule.</p>}
              {todaySchedule.map((item) => (
                <div key={item.id} className="rounded-[10px] border border-base p-3">
                  <p className="text-sm font-semibold text-navy">{item.subject}</p>
                  <p className="text-xs text-muted">{formatTimeLabel(item.startTime)} - {formatTimeLabel(item.endTime)}</p>
                </div>
              ))}
            </div>
          </CornerFrame>

          <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Today&apos;s lesson plan</p>
              <AddButton label="Add lesson plan" onClick={() => setActiveModal("lesson")} />
            </div>
            <div className="mt-4 space-y-2">
              {todayLessonPlans.length === 0 && <p className="text-sm text-muted">Nothing left in today&apos;s lesson plan.</p>}
              {todayLessonPlans.map((plan) => (
                <div key={plan.id} className="rounded-[10px] border border-base p-3">
                  <p className="text-sm font-semibold text-navy">{plan.title}</p>
                  {plan.startTime && plan.endTime && (
                    <p className="text-xs text-gold">{formatTimeLabel(plan.startTime)} - {formatTimeLabel(plan.endTime)}</p>
                  )}
                  {plan.description && <p className="mt-1 text-xs text-muted">{plan.description}</p>}
                </div>
              ))}
            </div>
          </CornerFrame>
        </aside>
      </div>

      {activeModal === "note" && (
        <Modal title="Notes" onClose={() => setActiveModal(null)}>
          <form onSubmit={handleAddNote} className="space-y-2">
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Jot down a quick note..."
              rows={3}
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            />
            <ActionButton type="submit" icon={<PlusIcon size={12} />} className="w-full justify-center">
              Add note
            </ActionButton>
          </form>
          <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
            {notes.length === 0 && <p className="text-xs text-muted">No notes yet.</p>}
            {notes.map((note) => (
              <div key={note.id} className="flex items-start justify-between gap-2 rounded-[10px] border border-base p-3">
                <p className="text-sm text-navy">{note.text}</p>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => togglePinNote(note.id)}
                    className={`text-xs font-semibold ${note.pinned ? "text-gold" : "text-muted hover:text-gold"}`}
                  >
                    {note.pinned ? "Pinned" : "Pin"}
                  </button>
                  <button type="button" onClick={() => removeNote(note.id)} className="text-xs text-muted hover:text-red-500">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {activeModal === "schedule" && (
        <Modal title="Schedule tracker" onClose={() => setActiveModal(null)}>
          <form onSubmit={handleAddSchedule} className="space-y-2">
            <select
              value={scheduleDraft.day}
              onChange={(e) => setScheduleDraft((d) => ({ ...d, day: e.target.value }))}
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>{day}</option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Start</span>
                <input
                  type="time"
                  value={scheduleDraft.startTime}
                  onChange={(e) => setScheduleDraft((d) => ({ ...d, startTime: e.target.value }))}
                  className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">End</span>
                <input
                  type="time"
                  value={scheduleDraft.endTime}
                  onChange={(e) => setScheduleDraft((d) => ({ ...d, endTime: e.target.value }))}
                  className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
            </div>
            <input
              value={scheduleDraft.subject}
              onChange={(e) => setScheduleDraft((d) => ({ ...d, subject: e.target.value }))}
              placeholder="Subject or activity"
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            />
            {scheduleFormError && <p className="text-xs text-red-500">{scheduleFormError}</p>}
            <ActionButton type="submit" icon={<PlusIcon size={12} />} className="w-full justify-center">
              Add to schedule
            </ActionButton>
          </form>
          <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
            {scheduleItems.length === 0 && <p className="text-xs text-muted">Nothing scheduled yet.</p>}
            {scheduleItems.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-2 rounded-[10px] border border-base p-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gold">{item.day}</p>
                  <p className="text-sm font-semibold text-navy">{item.subject}</p>
                  <p className="text-xs text-muted">{formatTimeLabel(item.startTime)} - {formatTimeLabel(item.endTime)}</p>
                </div>
                <button type="button" onClick={() => removeScheduleItem(item.id)} className="shrink-0 text-xs text-muted hover:text-red-500">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {activeModal === "lesson" && (
        <Modal title="Lesson plan" onClose={() => setActiveModal(null)}>
          <form onSubmit={handleAddLessonPlan} className="space-y-2">
            <input
              value={lessonDraft.title}
              onChange={(e) => setLessonDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="Lesson title"
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            />
            <input
              type="date"
              value={lessonDraft.date}
              onChange={(e) => setLessonDraft((d) => ({ ...d, date: e.target.value }))}
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            />
            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1">
                <span className="text-xs text-muted">Start (optional)</span>
                <input
                  type="time"
                  value={lessonDraft.startTime}
                  onChange={(e) => setLessonDraft((d) => ({ ...d, startTime: e.target.value }))}
                  className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs text-muted">End (optional)</span>
                <input
                  type="time"
                  value={lessonDraft.endTime}
                  onChange={(e) => setLessonDraft((d) => ({ ...d, endTime: e.target.value }))}
                  className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
            </div>
            <textarea
              value={lessonDraft.description}
              onChange={(e) => setLessonDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="What will you cover?"
              rows={2}
              className="w-full rounded-[10px] border border-base bg-surface px-3 py-2.5 text-sm text-navy outline-none focus:border-gold"
            />
            <ActionButton type="submit" icon={<PlusIcon size={12} />} className="w-full justify-center">
              Add lesson plan
            </ActionButton>
          </form>
          <div className="mt-5 max-h-72 space-y-2 overflow-y-auto pr-1">
            {lessonPlans.length === 0 && <p className="text-xs text-muted">No lesson plans yet.</p>}
            {lessonPlans.map((plan) => (
              <div key={plan.id} className="flex items-start justify-between gap-2 rounded-[10px] border border-base p-3">
                <div>
                  <p className="text-sm font-semibold text-navy">{plan.title}</p>
                  {plan.date && <p className="text-xs text-gold">{plan.date}{plan.startTime ? ` · ${formatTimeLabel(plan.startTime)} - ${formatTimeLabel(plan.endTime)}` : ""}</p>}
                  {plan.description && <p className="mt-1 text-xs text-muted">{plan.description}</p>}
                </div>
                <button type="button" onClick={() => removeLessonPlan(plan.id)} className="shrink-0 text-xs text-muted hover:text-red-500">
                  ✕
                </button>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
