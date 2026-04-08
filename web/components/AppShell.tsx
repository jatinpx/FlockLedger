"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FarmPicker } from "@/components/FarmPicker";
import { useFarm } from "@/lib/farm-context";
import { setToken } from "@/lib/api";

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

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { farms, farmId, setFarmId, loading, membersCacheEpoch } = useFarm();
  const currentFarm = farms.find((f) => f.id === farmId);
  const canSeeAudit =
    currentFarm?.my_role === "owner" || currentFarm?.my_role === "manager";
  const links = canSeeAudit
    ? [...mainLinks, { href: "/audit", label: "Audit log" }]
    : mainLinks;

  function logout() {
    setToken(null);
    router.replace("/login");
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      <aside className="fixed left-0 top-0 z-20 flex h-full w-56 flex-col border-r border-zinc-200 bg-white">
        <div className="border-b border-zinc-100 px-4 py-4">
          <div className="text-lg font-semibold tracking-tight text-emerald-800">
            FlockLedger
          </div>
          <p className="text-xs text-zinc-500">Poultry farm management</p>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded-md px-3 py-2 text-sm font-medium ${
                pathname === l.href
                  ? "bg-emerald-50 text-emerald-900"
                  : "text-zinc-600 hover:bg-zinc-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-zinc-100 p-3">
          <button
            type="button"
            onClick={logout}
            className="w-full rounded-md border border-zinc-200 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50"
          >
            Log out
          </button>
        </div>
      </aside>
      <div className="pl-56">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-200 bg-white/90 px-8 py-4 backdrop-blur">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              {links.find((l) => l.href === pathname)?.label ?? "FlockLedger"}
            </h1>
          </div>
          <FarmPicker
            farms={farms}
            farmId={farmId}
            setFarmId={setFarmId}
            loading={loading}
            membersCacheEpoch={membersCacheEpoch}
          />
        </header>
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
