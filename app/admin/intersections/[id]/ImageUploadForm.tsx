"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function ImageUploadForm({
  intersectionId,
}: {
  intersectionId: number;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;

    if (!fileInputRef.current?.files?.length) {
      setError("No file selected");
      return;
    }

    setError(null);
    setUploading(true);

    try {
      const res = await fetch(`/api/admin/intersections/${intersectionId}/images`, {
        method: "POST",
        body: new FormData(form),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Upload failed");
        return;
      }

      form.reset();
      setSelectedFile(null);
      router.refresh();
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="pt-4 border-t border-zinc-200 space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        name="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={(e) => setSelectedFile(e.target.files?.[0]?.name ?? null)}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="text-sm px-3 py-1 border border-zinc-300 rounded hover:border-zinc-500 hover:text-zinc-900 text-zinc-600"
        >
          choose file
        </button>
        <span className="text-sm text-zinc-400">
          {selectedFile ?? "no file chosen"}
        </span>
      </div>
      {selectedFile && (
        <button
          type="submit"
          disabled={uploading}
          className="text-sm px-3 py-1 border border-zinc-300 rounded hover:border-zinc-500 hover:text-zinc-900 disabled:opacity-40 text-zinc-600"
        >
          {uploading ? "uploading…" : "upload"}
        </button>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
