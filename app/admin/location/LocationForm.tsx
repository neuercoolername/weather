"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Status = "idle" | "saving" | "saved" | "error";

export default function LocationForm() {
  const router = useRouter();
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [geoError, setGeoError] = useState<string | null>(null);

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError("geolocation not supported by this browser");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
      },
      (err) => setGeoError(err.message)
    );
  }

  async function handleSave() {
    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    const res = await fetch("/api/admin/location", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lat: latNum, lon: lonNum }),
    });
    if (res.ok) {
      setStatus("saved");
      router.refresh();
    } else {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={useMyLocation}
          className="text-sm px-3 py-1 border border-zinc-300 rounded hover:border-zinc-500 hover:text-zinc-900 text-zinc-600"
        >
          use my location
        </button>
        {geoError && <p className="text-xs text-red-600 mt-2">{geoError}</p>}
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <label className="flex-1 space-y-1">
          <span className="text-xs text-zinc-400 uppercase tracking-widest">lat</span>
          <input
            type="number"
            step="any"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </label>
        <label className="flex-1 space-y-1">
          <span className="text-xs text-zinc-400 uppercase tracking-widest">lon</span>
          <input
            type="number"
            step="any"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            className="w-full border border-zinc-200 rounded px-3 py-2 text-sm outline-none focus:border-zinc-400"
          />
        </label>
      </div>

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="text-sm px-3 py-1 border border-zinc-300 rounded hover:border-zinc-500 hover:text-zinc-900 disabled:opacity-40 text-zinc-600"
        >
          {status === "saving" ? "saving…" : "save"}
        </button>
        {status === "saved" && <span className="text-xs text-zinc-400">saved</span>}
        {status === "error" && <span className="text-xs text-red-600">failed to save</span>}
      </div>
    </div>
  );
}
