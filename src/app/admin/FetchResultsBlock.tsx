"use client";

import { useState } from "react";

export default function FetchResultsBlock() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/fetch-results", { method: "POST" });
      const data = await res.json();
      setMessage(res.ok ? (data.message ?? "Done.") : (data.error ?? "Failed"));
    } catch {
      setMessage("Request failed.");
    }
    setLoading(false);
  }

  return (
    <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <h2 className="mb-2 font-semibold text-amber-800">
        Fetch real results
      </h2>
      <p className="mb-3 text-sm text-amber-700">
        Use the button below to sync real scores from an external API. Connect
        your API in <code className="rounded bg-amber-100 px-1">src/lib/fetchMatchResults.ts</code>.
      </p>
      <button
        type="button"
        onClick={handleFetch}
        disabled={loading}
        className="rounded bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
      >
        {loading ? "Fetching..." : "Fetch results (placeholder)"}
      </button>
      {message && (
        <p className="mt-3 text-sm text-amber-800">{message}</p>
      )}
    </div>
  );
}
