import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await getSession();
  if (session.isLoggedIn) {
    redirect("/admin/intersections");
  }

  const { next, error } = await searchParams;
  const action = `/api/admin/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

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
        <button type="submit" className="text-sm text-left text-zinc-500 hover:text-zinc-900">
          enter →
        </button>
      </form>
    </div>
  );
}
