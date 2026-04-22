"use client";

import { useEffect, useRef, useState } from "react";

type SaveStatus = "idle" | "saving" | "saved";

export default function TextEditor({
  intersectionId,
  initialText,
}: {
  intersectionId: number;
  initialText: string | null;
}) {
  const [text, setText] = useState(initialText ?? "");
  const [status, setStatus] = useState<SaveStatus>("idle");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }

  useEffect(() => {
    autoResize();
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    autoResize();
    setStatus("idle");
  }

  async function handleSave() {
    setStatus("saving");
    await fetch(`/api/admin/intersections/${intersectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text || null }),
    });
    setStatus("saved");
  }

  return (
    <div className="space-y-3">
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        placeholder="write something…"
        className="w-full resize-none bg-transparent text-sm outline-none leading-relaxed placeholder:text-zinc-400 border border-zinc-200 rounded px-3 py-2 focus:border-zinc-400"
        rows={6}
      />
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="text-sm px-3 py-1 border border-zinc-300 rounded hover:border-zinc-500 hover:text-zinc-900 disabled:opacity-40 text-zinc-600"
        >
          {status === "saving" ? "saving…" : "save"}
        </button>
        {status === "saved" && (
          <span className="text-xs text-zinc-400">saved</span>
        )}
      </div>
    </div>
  );
}
