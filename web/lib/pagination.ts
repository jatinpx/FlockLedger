/** Matches backend `app.api.pagination` (max 500). */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500] as const;

export function pageQuery(limit: number, offset: number): string {
  const p = new URLSearchParams();
  p.set("limit", String(limit));
  p.set("offset", String(offset));
  return p.toString();
}

export function totalPages(total: number, limit: number): number {
  if (total === 0) return 1;
  return Math.ceil(total / limit);
}
