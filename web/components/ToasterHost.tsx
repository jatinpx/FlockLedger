"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/lib/theme-context";

export function ToasterHost() {
  const { resolved } = useTheme();
  return (
    <Toaster
      richColors
      position="top-center"
      closeButton
      theme={resolved}
      toastOptions={{
        classNames: {
          toast:
            "dark:bg-zinc-900 dark:border-zinc-700 dark:text-zinc-100",
          description: "dark:text-zinc-400",
        },
      }}
    />
  );
}
