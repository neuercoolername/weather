import { prisma } from "@/lib/server/prisma";
import { formatDate } from "@/lib/domain/format-date";
import AdminNav from "@/app/admin/AdminNav";
import LocationForm from "./LocationForm";

export const dynamic = "force-dynamic";

export default async function LocationPage() {
  const current = await prisma.location.findFirst({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <AdminNav />

      <div className="mb-10 space-y-1 text-sm text-zinc-500">
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-3">
          Current location
        </p>
        {current ? (
          <>
            <p className="text-zinc-900">
              {current.lat.toFixed(5)}, {current.lon.toFixed(5)}
            </p>
            <p className="text-xs text-zinc-400">set {formatDate(current.createdAt)}</p>
          </>
        ) : (
          <p className="text-zinc-400">no location set yet</p>
        )}
      </div>

      <div>
        <p className="text-xs text-zinc-400 uppercase tracking-widest mb-4">Set location</p>
        <LocationForm />
      </div>
    </div>
  );
}
