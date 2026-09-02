"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMaterials } from "@/lib/materialsStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Stat } from "@/components/ui/Stat";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { IconPlus, IconTrash, IconPost, IconChevronRight } from "@/components/ui/icons";

export default function TeacherLearningMaterialsPage() {
  const { materials, loading, error, createMaterial, deleteMaterial } = useMaterials();
  const { profile } = useMyProfile();
  const { getCoursesByTeacher } = useClassroomHierarchy();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [levelLabel, setLevelLabel] = useState("");
  const [type, setType] = useState("Document");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const myMaterials = useMemo(() => materials.filter((m) => m.mine), [materials]);
  const subjects = useMemo(() => Array.from(new Set(materials.map((m) => m.subject))).sort(), [materials]);
  // Real subjects the teacher actually teaches, straight from the course roster.
  // These take priority over subjects seen on old materials so the dropdown
  // always reflects what this teacher is really assigned to.
  const courseNames = useMemo(() => {
    if (!profile) return [];
    return Array.from(new Set(getCoursesByTeacher(profile.id).map((c) => c.name))).sort();
  }, [profile, getCoursesByTeacher]);

  const subjectOptions = useMemo(() => {
    const merged = Array.from(new Set([...courseNames, ...subjects]));
    return merged.length > 0 ? merged : ["Mathematics", "English", "Science", "PE"];
  }, [courseNames, subjects]);

  // Default the subject to the first real assigned course once it loads, and
  // keep it valid: a hardcoded default that isn't in the option list makes
  // React show one course while silently submitting another.
  useEffect(() => {
    if (subjectOptions.length === 0) return;
    if (!subject || !subjectOptions.includes(subject)) {
      setSubject(subjectOptions[0]);
    }
  }, [subject, subjectOptions]);

  async function handleAddMaterial(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setMessage({ kind: "error", text: "Please enter a title." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const result = await createMaterial({
        title,
        subject,
        levelLabel: levelLabel || "All Levels",
        type,
        description,
        file,
      });
      if (result.ok) {
        setTitle("");
        setDescription("");
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
        setMessage({ kind: "ok", text: "Material added - your students can now see it." });
      } else {
        setMessage({
          kind: "error",
          text: result.error ?? "Couldn't add the material. Please try again.",
        });
      }
    } catch (err) {
      setMessage({
        kind: "error",
        text: error ?? "Couldn't add the material - an unexpected error occurred.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    await deleteMaterial(id);
  }

  const deleting = confirmDelete ? myMaterials.find((m) => m.id === confirmDelete) : null;

  return (
    <div className="space-y-4">
      {/* ============================================================ */}
      {/* BAND 0 - HEADER                                             */}
      {/* ============================================================ */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-navy">Teaching materials</h1>
          <h2 className="font-mono-ui mt-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-navy">
            Upload lessons · manage your materials
          </h2>
        </div>
        <Stat
          label="My materials"
          value={loading ? "-" : myMaterials.length}
          tone="accent"
          hint="Visible to your students"
        />
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        {/* Upload form */}
        <CornerFrame className="p-5">
          <h3 className="section-label">Add material</h3>
          <p className="mt-1.5 text-xs leading-5 text-muted">
            Upload a file (PDF, image) that your students can open directly from their Materials
            page. You can manage your own uploads here.
          </p>
          <form onSubmit={handleAddMaterial} className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="material-title" className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                Title
              </label>
              <input
                id="material-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson title"
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-accent"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Subject
                </span>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-accent"
                >
                  {subjectOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Level
                </span>
                <input
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                  placeholder="e.g. Grade 10 or All Levels"
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-accent"
                />
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-1.5">
                <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                  Type
                </span>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-accent"
                >
                  {["Document", "Worksheet", "Article", "Video", "Guide", "Slides"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-1.5">
                <p className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">File</p>
                <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-base bg-[var(--surface-strong)] px-4 py-3">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0"
                  >
                    Choose file
                  </Button>
                  <span className="min-w-0 truncate text-xs text-muted">
                    {file ? file.name : "No file selected (PDF or image)"}
                  </span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    className="hidden"
                  />
                </div>
              </div>
            </div>
            <label className="space-y-1.5">
              <span className="font-mono-ui text-[10px] font-semibold uppercase tracking-[0.14em] text-faint">
                Description
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should students know about this resource?"
                rows={2}
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-accent"
              />
            </label>
            {message && (
              <p className={`text-sm ${message.kind === "ok" ? "text-accent-token" : "text-warn"}`}>{message.text}</p>
            )}
            <Button type="submit" variant="primary" size="md" icon={<IconPlus size={13} />} disabled={submitting}>
              {submitting ? "Uploading..." : "Add material"}
            </Button>
          </form>
        </CornerFrame>

        {/* Manage uploads */}
        <CornerFrame className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="section-label">Manage uploads</h3>
            {!loading && myMaterials.length > 0 && <Chip variant="accent">{myMaterials.length} total</Chip>}
          </div>

          {loading ? (
            /* Skeleton: mirror the material-row geometry. */
            <div className="mt-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex animate-pulse items-start gap-3 rounded-[10px] border border-base p-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-44 rounded-full bg-tile" />
                    <div className="h-2.5 w-28 rounded-full bg-tile" />
                  </div>
                  <div className="h-7 w-16 rounded-full bg-tile" />
                  <div className="h-7 w-16 rounded-full bg-tile" />
                </div>
              ))}
            </div>
          ) : error ? (
            <p className="mt-4 rounded-[10px] border border-warn-soft bg-warn-soft px-4 py-3 text-sm text-warn">{error}</p>
          ) : myMaterials.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                icon={<IconPost size={16} />}
                title="No materials uploaded"
                desc="Upload your first lesson and your students can open it from their Materials page."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {myMaterials.map((material) => (
                <div key={material.id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-navy">{material.title}</p>
                      <p className="mt-1 text-xs text-muted">
                        {material.levelLabel ?? "All levels"} · {material.subject} · {material.type}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {material.url && (
                        <a
                          href={material.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center rounded-full border border-base bg-surface px-3 py-2 text-xs font-semibold text-navy transition hover-border-accent-soft hover-text-accent-token"
                        >
                          Open
                        </a>
                      )}
                      <Button
                        variant="danger"
                        size="sm"
                        icon={<IconTrash size={12} />}
                        onClick={() => setConfirmDelete(material.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {material.description && <p className="mt-3 text-sm text-muted">{material.description}</p>}
                  <p className="mt-2 font-mono-ui text-[10px] uppercase tracking-[0.12em] text-faint">
                    Uploaded {new Date(material.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CornerFrame>
      </section>

      {/* Confirm delete */}
      {deleting && (
        <Modal
          onClose={() => setConfirmDelete(null)}
          eyebrow="Delete material"
          description={`Delete "${deleting.title}"?`}
          maxWidth="max-w-sm"
        >
          <p className="text-sm leading-6 text-muted">
            This removes the material from your list and from your students&apos; Materials page. This cannot be undone.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="danger"
              icon={<IconTrash size={13} />}
              onClick={() => {
                setConfirmDelete(null);
                handleDelete(deleting.id);
              }}
            >
              Delete material
            </Button>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-faint">
            <IconChevronRight size={12} />
            <span className="text-[10px] uppercase tracking-[0.15em]">Destructive action</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
