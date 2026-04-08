"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { TopLoadingBar } from "@/components/TopLoadingBar";
import { getToken } from "@/lib/api";
import { FarmProvider } from "@/lib/farm-context";
import { LoadingProvider } from "@/lib/loading-context";
export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 text-zinc-500">
        Loading…
      </div>
    );
  }

  return (
    <LoadingProvider>
      <TopLoadingBar />
      <FarmProvider>
        <AppShell>{children}</AppShell>
      </FarmProvider>
    </LoadingProvider>
  );
}
