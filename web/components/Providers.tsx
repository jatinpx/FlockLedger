"use client";

import type { ReactNode } from "react";
import { ToasterHost } from "@/components/ToasterHost";
import { ThemeProvider } from "@/lib/theme-context";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      {children}
      <ToasterHost />
    </ThemeProvider>
  );
}
