"use client";

import { useTheme, type ThemePreference } from "@/lib/theme-context";

const titles: Record<ThemePreference, string> = {
  light: "Theme: light (click for dark)",
  dark: "Theme: dark (click for system)",
  system: "Theme: match system (click for light)",
};

function Icon({ mode }: { mode: ThemePreference }) {
  const cls = "h-4 w-4";
  if (mode === "light") {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    );
  }
  if (mode === "dark") {
    return (
      <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
        />
      </svg>
    );
  }
  return (
    <svg className={cls} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}

type Props = {
  className?: string;
  /** Compact icon-only vs labeled */
  variant?: "icon" | "labeled";
};

export function ThemeToggle({ className = "", variant = "icon" }: Props) {
  const { preference, cyclePreference } = useTheme();

  return (
    <button
      type="button"
      onClick={cyclePreference}
      title={titles[preference]}
      aria-label={titles[preference]}
      className={
        variant === "labeled"
          ? `inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 ${className}`
          : `inline-flex items-center justify-center rounded-md border border-zinc-200 bg-white p-2 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 ${className}`
      }
    >
      <Icon mode={preference} />
      {variant === "labeled" && (
        <span className="hidden sm:inline">
          {preference === "light" ? "Light" : preference === "dark" ? "Dark" : "System"}
        </span>
      )}
    </button>
  );
}
