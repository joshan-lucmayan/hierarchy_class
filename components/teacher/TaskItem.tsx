"use client";

import { useState } from "react";
import type { TeacherTask } from "@/lib/teacherTasksStore";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";

export interface TaskItemProps {
  task: TeacherTask;
  onAccept: (id: string) => void;
  onDecline: (id: string, reason: string) => void;
  onMarkDone: (id: string) => void;
  onReopen: (id: string) => void;
  onDelete: (id: string) => void;
}

/**
 * Single assigned-task card with the full status workflow: pending
 * (accept / decline + reason), accepted (mark done), done (reopen / delete),
 * declined (chip + delete). The same component powers Teacher Home's
 * "Assigned by admin" band and the Workspace Tasks tool, so both surfaces
 * share one task interaction - and the same teacherTasksStore underneath.
 */
export function TaskItem({ task, onAccept, onDecline, onMarkDone, onReopen, onDelete }: TaskItemProps) {
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div className="rounded-[10px] border border-base p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-sm font-semibold ${task.status === "done" ? "text-muted line-through" : "text-navy"}`}>
            {task.title}
          </p>
          {task.description && <p className="mt-0.5 text-xs text-muted">{task.description}</p>}
          {task.dueDate && <p className="mt-0.5 text-xs text-accent-token">Due {task.dueDate}</p>}
          {task.status === "declined" && task.declineReason && (
            <p className="mt-1 text-xs text-warn">Declined: {task.declineReason}</p>
          )}
        </div>

        {task.status === "pending" && (
          <div className="flex shrink-0 gap-2">
            <Button variant="primary" size="sm" onClick={() => onAccept(task.id)}>
              Accept
            </Button>
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                setDeclining(true);
                setReason("");
              }}
            >
              Decline
            </Button>
          </div>
        )}

        {task.status === "accepted" && (
          <Button variant="primary" size="sm" onClick={() => onMarkDone(task.id)}>
            Mark done
          </Button>
        )}

        {task.status === "done" && (
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" onClick={() => onReopen(task.id)}>
              Reopen
            </Button>
            <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>
              Delete
            </Button>
          </div>
        )}

        {task.status === "declined" && (
          <div className="flex shrink-0 items-center gap-2">
            <Chip variant="danger">Declined</Chip>
            <Button variant="danger" size="sm" onClick={() => onDelete(task.id)}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {declining && (
        <div className="mt-3 space-y-2 rounded-[10px] border border-base bg-[var(--surface-strong)] p-3">
          <p className="text-xs text-muted">Why are you declining this task?</p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Conflicts with my class schedule"
            rows={2}
            className="w-full rounded-lg border border-base bg-surface px-3 py-2 text-sm text-navy outline-none focus:border-accent"
          />
          <div className="flex gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                if (!reason.trim()) return;
                onDecline(task.id, reason);
                setDeclining(false);
                setReason("");
              }}
              disabled={!reason.trim()}
            >
              Submit decline
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeclining(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
