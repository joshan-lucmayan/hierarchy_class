"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMaterials } from "@/lib/materialsStore";
import { useMyProfile } from "@/lib/useMyProfile";
import { useClassroomHierarchy } from "@/lib/classroomHierarchyStore";
import { CornerFrame } from "@/components/ui/CornerFrame";

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

  return (
    <div className="space-y-6">
      <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Teaching materials</p>
            <h1 className="mt-2 text-3xl font-bold text-navy">Upload new lessons</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
              Upload a file (PDF, image) that your students can open directly from their Materials page. You can manage your own uploads here.
            </p>
          </div>
          <div className="rounded-[10px] border border-base bg-[var(--surface-strong)] px-5 py-4 text-sm">
            <p className="font-semibold text-gold">Upload status</p>
            <p className="mt-2 text-muted">{myMaterials.length} of your materials visible school-wide</p>
          </div>
        </div>
      </CornerFrame>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <form onSubmit={handleAddMaterial} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-muted">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lesson title"
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-muted">
                Subject
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
                >
                  {subjectOptions.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-2 text-sm font-semibold text-muted">
                Level
                <input
                  value={levelLabel}
                  onChange={(e) => setLevelLabel(e.target.value)}
                  placeholder="e.g. Grade 10 or All Levels"
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
                />
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <label className="space-y-2 text-sm font-semibold text-muted">
                Type
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
                >
                  {["Document", "Worksheet", "Article", "Video", "Guide", "Slides"].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </label>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted">File</p>
                <div className="flex items-center gap-3 rounded-[10px] border border-dashed border-base bg-[var(--surface-strong)] px-4 py-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="shrink-0 rounded-full bg-navy px-4 py-2 text-xs font-semibold text-white transition hover:bg-gold hover:text-on-accent"
                  >
                    Choose file
                  </button>
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
            <label className="space-y-2 text-sm font-semibold text-muted">
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What should students know about this resource?"
                rows={2}
                className="w-full rounded-[10px] border border-base bg-surface px-4 py-3 text-sm text-navy outline-none focus:border-gold"
              />
            </label>
            {message && (
              <p className={`text-sm ${message.kind === "ok" ? "text-emerald-600" : "text-red-500"}`}>{message.text}</p>
            )}
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:opacity-60"
            >
              {submitting ? "Uploading..." : "Add material"}
            </button>
          </form>
        </CornerFrame>

        <CornerFrame className="rounded-[10px] border border-base bg-surface p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Manage uploads</p>
          {loading ? (
            <p className="mt-4 text-sm text-muted">Loading materials...</p>
          ) : error ? (
            <p className="mt-4 text-sm text-red-500">{error}</p>
          ) : (
            <div className="mt-6 space-y-4">
              {myMaterials.length === 0 && (
                <p className="text-sm text-muted">You haven&apos;t uploaded any materials yet.</p>
              )}
              {myMaterials.map((material) => (
                <div key={material.id} className="rounded-[10px] border border-base bg-[var(--surface-strong)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-navy">{material.title}</p>
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
                          className="rounded-full border border-base bg-surface px-3 py-2 text-xs font-semibold text-navy transition hover:border-gold"
                        >
                          Open
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDelete(material.id)}
                        className="rounded-full border border-base bg-surface px-3 py-2 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-600"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  {material.description && <p className="mt-3 text-sm text-muted">{material.description}</p>}
                  <p className="mt-2 text-[11px] text-muted">
                    Uploaded {new Date(material.uploadDate).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
        </CornerFrame>
      </section>
    </div>
  );
}
