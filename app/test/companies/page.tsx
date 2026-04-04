"use client";

import { FormEvent, useMemo, useState } from "react";

type CompaniesApiResponse = {
  success: boolean;
  data?: Array<{
    id: string;
    name: string;
    slug: string;
    city: string | null;
    sector: string | null;
    open_jobs_count?: number;
  }>;
  meta?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
  };
};

export default function TestCompaniesPage() {
  const [q, setQ] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [sort, setSort] = useState("newest");
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState<CompaniesApiResponse | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", "1");
    params.set("limit", "12");
    params.set("sort", sort);

    if (q.trim()) {
      params.set("q", q.trim());
    }

    if (city.trim()) {
      params.set("city", city.trim());
    }

    if (category.trim()) {
      params.set("category", category.trim());
    }

    return params.toString();
  }, [q, city, category, sort]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/companies?${queryString}`);
      const data = (await res.json()) as CompaniesApiResponse;
      setResponse(data);
    } catch {
      setResponse({
        success: false,
        error: {
          code: "NETWORK_ERROR",
          message: "Failed to call /api/companies.",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-[var(--page-gutter)] py-10">
      <h1 className="text-2xl font-semibold">Test Companies API</h1>

      <form onSubmit={onSubmit} className="grid gap-3 rounded border p-4 sm:grid-cols-2">
        <input
          value={q}
          onChange={(event) => setQ(event.target.value)}
          placeholder="Search keyword"
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          value={city}
          onChange={(event) => setCity(event.target.value)}
          placeholder="City"
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category slug (example: technologie)"
          className="rounded border px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="rounded border px-3 py-2 text-sm"
        >
          <option value="newest">newest</option>
          <option value="oldest">oldest</option>
          <option value="name_asc">name_asc</option>
          <option value="name_desc">name_desc</option>
        </select>

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-60"
        >
          {loading ? "Loading..." : "Call /api/companies"}
        </button>
      </form>

      <section className="rounded border p-4">
        <h2 className="mb-3 text-lg font-medium">Result</h2>
        {!response ? (
          <p className="text-sm text-zinc-500">No request sent yet.</p>
        ) : (
          <pre className="overflow-auto rounded bg-zinc-950 p-4 text-xs text-zinc-100">
            {JSON.stringify(response, null, 2)}
          </pre>
        )}
      </section>
    </main>
  );
}
