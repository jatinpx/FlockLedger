"use client";

import { usePageLoading } from "@/lib/loading-context";

export function TopLoadingBar() {
  const { loading } = usePageLoading();

  return (
    <div
      className={`pointer-events-none fixed left-0 right-0 top-0 z-[100] h-1 overflow-hidden bg-transparent transition-opacity duration-200 ${
        loading ? "opacity-100" : "opacity-0"
      }`}
      role="progressbar"
      aria-label="Loading"
      aria-hidden={!loading}
    >
      <div className="h-full w-1/2 animate-[loading-slide_1.1s_ease-in-out_infinite] rounded-r-full bg-emerald-600 shadow-sm shadow-emerald-600/50 dark:bg-emerald-500 dark:shadow-emerald-500/50" />
    </div>
  );
}
