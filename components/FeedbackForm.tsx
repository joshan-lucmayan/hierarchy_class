"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

export function FeedbackForm() {
  const pathname = usePathname();
  const [feedback, setFeedback] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [errorText, setErrorText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!feedback.trim()) return;
    setState("sending");
    setErrorText("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback, page: pathname }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setState("error");
        setErrorText(data?.error ?? "Couldn't send your feedback. Please try again.");
        return;
      }
      setState("done");
      setFeedback("");
    } catch {
      setState("error");
      setErrorText("Network error - please try again.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <textarea
        value={feedback}
        onChange={(e) => {
          setFeedback(e.target.value);
          if (state === "done") setState("idle");
        }}
        rows={4}
        maxLength={5000}
        placeholder="Tell us what would make the app better, or report a problem..."
        className="w-full border-b border-base bg-transparent px-1 py-2 text-sm text-navy outline-none focus:border-gold"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state === "sending" || !feedback.trim()}
          className="inline-flex items-center justify-center rounded-full bg-navy px-5 py-3 text-sm font-semibold text-white transition hover:bg-gold hover:text-on-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {state === "sending" ? "Sending..." : "Send feedback"}
        </button>
        {state === "done" && (
          <p className="text-sm font-semibold text-emerald-600">Thanks! Your feedback has been sent.</p>
        )}
        {state === "error" && <p className="text-sm text-red-500">{errorText}</p>}
      </div>
    </form>
  );
}
