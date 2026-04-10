"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useFarm } from "@/lib/farm-context";

const LABOUR = "/labour";

function isLabourPath(pathname: string) {
  return pathname === LABOUR || pathname.startsWith(`${LABOUR}/`);
}

/** Workers may only use the labour / pay screen; all other app routes redirect here. */
export function WorkerRouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { farms, farmId, loading } = useFarm();
  const role = farms.find((f) => f.id === farmId)?.my_role;
  const isWorker = !loading && farmId != null && role === "worker";

  useEffect(() => {
    if (!isWorker) return;
    if (isLabourPath(pathname)) return;
    router.replace(LABOUR);
  }, [isWorker, pathname, router]);

  if (isWorker && !isLabourPath(pathname)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500 dark:text-zinc-400">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
