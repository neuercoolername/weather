export default function AdminNav() {
  return (
    <div className="flex items-baseline justify-between mb-10">
      <h1 className="text-sm font-medium">intersections</h1>
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
