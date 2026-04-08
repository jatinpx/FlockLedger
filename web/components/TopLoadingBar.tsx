"use client";

import { usePageLoading } from "@/lib/loading-context";

export function TopLoadingBar() {
  const { loading } = usePageLoading();
  if (!loading) return null;
  return (
    <div
      className="pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1 animate-pulse bg-emerald-600 shadow-sm shadow-emerald-600/50"
      role="progressbar"
      aria-label="Loading"
    />
  );
}
