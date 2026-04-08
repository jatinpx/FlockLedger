"use client";

import { PAGE_SIZE_OPTIONS, pageQuery, totalPages } from "@/lib/pagination";

type Props = {
  total: number;
  limit: number;
  offset: number;
  onLimitChange: (n: number) => void;
  onOffsetChange: (n: number) => void;
  className?: string;
};

export function PaginationFooter({
  total,
  limit,
  offset,
  onLimitChange,
  onOffsetChange,
  className = "",
}: Props) {
  const pages = totalPages(total, limit);
  const currentPage = Math.floor(offset / limit) + 1;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 bg-zinc-50/80 px-3 py-2 text-sm text-zinc-600 ${className}`}
    >
      <span>
        {total === 0 ? (
          "No rows"
        ) : (
          <>
            <span className="font-medium text-zinc-800">
              {from}–{to}
            </span>{" "}
            of {total}
          </>
        )}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1 text-xs text-zinc-500">
          Per page
          <select
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-sm text-zinc-800"
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={offset <= 0}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs disabled:opacity-40"
            onClick={() => onOffsetChange(Math.max(0, offset - limit))}
          >
            Previous
          </button>
          <span className="px-1 text-xs text-zinc-500">
            Page {currentPage} / {pages}
          </span>
          <button
            type="button"
            disabled={offset + limit >= total}
            className="rounded border border-zinc-200 bg-white px-2 py-1 text-xs disabled:opacity-40"
            onClick={() => onOffsetChange(offset + limit)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

/** Append limit & offset to a path that may already have query params. */
export function withPagination(path: string, limit: number, offset: number): string {
  const q = pageQuery(limit, offset);
  return path.includes("?") ? `${path}&${q}` : `${path}?${q}`;
}
