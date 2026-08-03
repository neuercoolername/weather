import Link from "next/link";

export default function AdminNav() {
  return (
    <div className="flex items-baseline justify-between mb-10">
      <nav className="flex items-baseline gap-4 text-sm font-medium">
        <Link href="/admin/intersections" className="hover:text-zinc-900">
          intersections
        </Link>
        <Link href="/admin/location" className="text-zinc-400 hover:text-zinc-900">
          location
        </Link>
      </nav>
      <form action="/api/admin/logout" method="POST">
        <button
          type="submit"
          className="text-sm text-zinc-500 hover:text-zinc-900"
        >
          log out
        </button>
      </form>
    </div>
  );
}
