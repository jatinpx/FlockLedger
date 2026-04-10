"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FarmPicker } from "@/components/FarmPicker";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WorkerRouteGuard } from "@/components/WorkerRouteGuard";
import { setToken } from "@/lib/api";
import { useFarm } from "@/lib/farm-context";

const mainLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/production", label: "Production" },
  { href: "/feed", label: "Feed" },
  { href: "/labour", label: "Labour" },
  { href: "/flock", label: "Flock" },
  { href: "/sales", label: "Sales" },
  { href: "/expenses", label: "Expenses" },
  { href: "/analytics", label: "Analytics" },
  { href: "/settings", label: "Settings" },
];

const workerLinks = [{ href: "/labour", label: "My pay & ledger" }];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { farms, farmId, setFarmId, loading, membersCacheEpoch } = useFarm();
  const currentFarm = farms.find((f) => f.id === farmId);
  const isWorker = !loading && currentFarm?.my_role === "worker";
  const canSeeAudit =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";
  const links = isWorker
    ? workerLinks
    : canSeeAudit
      ? [...mainLinks, { href: "/audit", label: "Audit log" }]
      : mainLinks;

  function logout() {
    setToken(null);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <aside className="fixed left-0 top-0 z-20 flex h-full w-56 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800">
          <div className="text-lg font-semibold tracking-tight text-emerald-800 dark:text-emerald-400">
            FlockLedger
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Poultry farm management</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                pathname === l.href
                  ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3 dark:border-zinc-800">
          <div className="mb-2 flex justify-center">
            <ThemeToggle />
          </div>
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="pl-56">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-zinc-200 bg-white/90 px-8 py-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/90">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
              {links.find((l) => l.href === pathname)?.label ?? "FlockLedger"}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />
            <FarmPicker
              farms={farms}
              farmId={farmId}
              setFarmId={setFarmId}
              loading={loading}
              membersCacheEpoch={membersCacheEpoch}
            />
          </div>
        </header>
        <main className="p-8">
          <WorkerRouteGuard>{children}</WorkerRouteGuard>
        </main>
      </div>
    </div>
  );
}
