import { redirect } from "next/navigation";
import { getSession } from "@/lib/server/auth/session";
import { safeNextPath } from "@/lib/server/auth/redirect";

export default async function ViewerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  const session = await getSession();
  if (session.isLoggedIn || session.isViewer) {
    redirect(safeNextPath(next ?? null, "/"));
  }

  const action = `/api/viewer-login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form action={action} method="POST" className="flex flex-col gap-4 w-full max-w-xs px-6">
        {error && (
          <p className="text-sm text-red-600">incorrect password</p>
        )}
        <input
          type="password"
          name="password"
          placeholder="password"
          autoFocus
          autoComplete="current-password"
          className="border-b border-zinc-300 bg-transparent py-1 outline-none text-sm"
        />
        <button type="submit" className="text-md text-left text-zinc-500 hover:text-zinc-900">
          enter →
        </button>
      </form>
    </div>
  );
}
