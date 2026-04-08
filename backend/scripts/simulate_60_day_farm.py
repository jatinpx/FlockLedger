#!/usr/bin/env python3
"""
End-to-end simulation: 60 calendar days of farm activity against the live FlockLedger API.

Creates test users (2 owners, 2 worker accounts), one farm, two sheds (≤19k birds),
multiple labour records (hire/leave mid-cycle), daily production/sales/feed/flock,
and assorted expenses (electricity, diesel, feed bills, misc). Dates are anchored so the
last simulated day is *today*, so web dashboard “last 7 days” widgets include real data.

Usage (from repo root or backend/, with API running):
  cd backend && python scripts/simulate_60_day_farm.py
  python scripts/simulate_60_day_farm.py --base-url http://127.0.0.1:8000

Env:
  SIM_API_PASSWORD  default password for all seeded users (default: Simulate60Day!)

Requires: httpx (already in backend requirements).
"""

from __future__ import annotations

import argparse
import os
import random
import sys
import time
from datetime import date, timedelta
from decimal import Decimal
from typing import Any

import httpx

EGGS_PER_TRAY = 30


def _today() -> date:
    return date.today()


def _register_or_login(client: httpx.Client, base: str, email: str, password: str, name: str) -> str:
    r = client.post(f"{base}/auth/register", json={"email": email, "password": password, "name": name})
    if r.status_code not in (200, 201):
        try:
            body = r.json()
            det = str(body.get("detail", "")).lower()
        except Exception:
            det = (r.text or "").lower()
        if r.status_code != 400 or "already" not in det:
            r.raise_for_status()
    r2 = client.post(f"{base}/auth/login", json={"email": email, "password": password})
    r2.raise_for_status()
    return r2.json()["access_token"]


def _headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def _req(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    token: str,
    json: dict | None = None,
    params: dict | None = None,
) -> Any:
    r = client.request(method, url, headers=_headers(token), json=json, params=params, timeout=60.0)
    if r.status_code >= 400:
        detail = ""
        try:
            detail = r.json().get("detail", r.text)
        except Exception:
            detail = r.text
        raise RuntimeError(f"{method} {url} -> {r.status_code}: {detail}")
    if r.status_code == 204:
        return None
    if not r.content:
        return None
    return r.json()


def _layer_rate(day_index: int) -> float:
    """Eggs per bird per day — rises into peak lay then tapers slightly."""
    if day_index < 15:
        t = day_index / 14.0
        return 0.72 + 0.14 * t
    if day_index < 45:
        t = (day_index - 15) / 29.0
        return 0.86 + 0.06 * t
    t = min(1.0, (day_index - 45) / 14.0)
    return 0.92 - 0.05 * t


def _feed_kg_per_1000_birds(day_index: int) -> float:
    """Daily feed use scales up as flock matures."""
    return 38.0 + day_index * 0.35 + 4.0 * (day_index / 60.0) ** 1.2


def main() -> int:
    parser = argparse.ArgumentParser(description="Simulate 60 days of FlockLedger activity via HTTP API.")
    parser.add_argument("--base-url", default=os.environ.get("SIM_API_BASE", "http://127.0.0.1:8000"))
    parser.add_argument("--password", default=os.environ.get("SIM_API_PASSWORD", "Simulate60Day!"))
    parser.add_argument("--seed", type=int, default=42, help="RNG seed for reproducible scenarios.")
    parser.add_argument("--slow-ms", type=int, default=0, help="Pause this many ms after each day (visual pacing).")
    parser.add_argument(
        "--email-tag",
        default="e2e60",
        help="Short tag in emails, e.g. owner1-{tag}@sim.flockledger.example",
    )
    args = parser.parse_args()
    base = args.base_url.rstrip("/")
    password = args.password
    tag = args.email_tag
    rng = random.Random(args.seed)

    end = _today()
    start = end - timedelta(days=59)
    print(f"Simulating {start} .. {end} (60 days, ending today) against {base}", flush=True)

    owner1_email = f"owner1-{tag}@sim.flockledger.example"
    owner2_email = f"owner2-{tag}@sim.flockledger.example"
    worker_a_email = f"worker-a-{tag}@sim.flockledger.example"
    worker_b_email = f"worker-b-{tag}@sim.flockledger.example"

    with httpx.Client() as client:
        r0 = client.get(f"{base}/health", timeout=10.0)
        if r0.status_code != 200:
            print("API /health failed. Start the backend (e.g. uvicorn) and retry.", file=sys.stderr)
            return 1

        tok_o1 = _register_or_login(client, base, owner1_email, password, "Sim Owner One")
        tok_o2 = _register_or_login(client, base, owner2_email, password, "Sim Owner Two")
        tok_wa = _register_or_login(client, base, worker_a_email, password, "Sim Worker Maya")
        tok_wb = _register_or_login(client, base, worker_b_email, password, "Sim Worker Ravi")

        farm_name = f"E2E 60d Layer Farm ({tag})"
        farm = _req(client, "POST", f"{base}/farms", token=tok_o1, json={"name": farm_name, "location": "Simulated, North belt"})
        farm_id = farm["id"]
        print(f"Farm id={farm_id} name={farm_name!r}", flush=True)

        _req(client, "POST", f"{base}/farms/{farm_id}/members", token=tok_o1, json={"email": owner2_email, "role": "owner"})
        _req(client, "POST", f"{base}/farms/{farm_id}/members", token=tok_o1, json={"email": worker_a_email, "role": "worker"})
        _req(client, "POST", f"{base}/farms/{farm_id}/members", token=tok_o1, json={"email": worker_b_email, "role": "worker"})

        shed_a = _req(
            client,
            "POST",
            f"{base}/farms/{farm_id}/sheds",
            token=tok_o1,
            json={"name": "Shed A (East)", "bird_count": 9200},
        )
        shed_b = _req(
            client,
            "POST",
            f"{base}/farms/{farm_id}/sheds",
            token=tok_o1,
            json={"name": "Shed B (West)", "bird_count": 8800},
        )
        shed_ids = (shed_a["id"], shed_b["id"])
        birds = [9200, 8800]

        def total_birds() -> int:
            return sum(birds)

        # Labour roster (FarmLabour — not the same as user accounts; workers above enter mobile/web data)
        L_PRIYA = _req(
            client,
            "POST",
            f"{base}/farms/{farm_id}/labour",
            token=tok_o1,
            json={
                "full_name": "Priya Sharma",
                "phone": "9800011111",
                "personnel_kind": "labour",
                "compensation_type": "daily",
                "default_rate": 420.0,
                "hired_at": start.isoformat(),
                "notes": "Morning collection + grading",
            },
        )["id"]
        L_VIKRAM = _req(
            client,
            "POST",
            f"{base}/farms/{farm_id}/labour",
            token=tok_o1,
            json={
                "full_name": "Vikram Yadav",
                "phone": "9800022222",
                "personnel_kind": "labour",
                "compensation_type": "daily",
                "default_rate": 450.0,
                "hired_at": start.isoformat(),
                "notes": "Shed B focus; leaves mid-cycle",
            },
        )["id"]
        L_ANIL = None  # hired later

        # Optional owner-draw style line (inactive labour used only for ledger semantics testing)
        L_OWNER_LINE = _req(
            client,
            "POST",
            f"{base}/farms/{farm_id}/labour",
            token=tok_o1,
            json={
                "full_name": "Partner draw (bookkeeping)",
                "personnel_kind": "owner_pay",
                "compensation_type": "monthly",
                "default_rate": None,
                "hired_at": start.isoformat(),
                "notes": "Tagged owner compensation",
            },
        )["id"]

        for i in range(60):
            d = start + timedelta(days=i)
            day_tok = tok_wa if i % 2 == 0 else tok_wb
            mgr_tok = tok_o2 if (i % 9 == 0) else tok_o1  # second owner acts some days

            # --- Flock: mortality, purchases, rare transfer between sheds
            if i == 3 and total_birds() + 450 <= 19000:
                q = 450
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/flock/events",
                    token=day_tok,
                    json={
                        "shed_id": shed_ids[0],
                        "event_date": d.isoformat(),
                        "event_kind": "purchase",
                        "quantity": q,
                        "note": "Mid-batch placement (simulated)",
                    },
                )
                birds[0] += q
            elif i == 18 and birds[0] > 200:
                mv = min(120, birds[0] // 40)
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/flock/events",
                    token=day_tok,
                    json={
                        "shed_id": shed_ids[0],
                        "event_date": d.isoformat(),
                        "event_kind": "transfer_out",
                        "quantity": mv,
                        "note": "Internal rebalance to Shed B",
                    },
                )
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/flock/events",
                    token=day_tok,
                    json={
                        "shed_id": shed_ids[1],
                        "event_date": d.isoformat(),
                        "event_kind": "transfer_in",
                        "quantity": mv,
                        "note": "Received from Shed A",
                    },
                )
                birds[0] -= mv
                birds[1] += mv
            else:
                # Most days: light mortality; occasional bad spell
                stress = rng.random() < 0.14
                for si, sid in enumerate(shed_ids):
                    if birds[si] <= 0:
                        continue
                    base_m = 2 if not stress else rng.randint(8, 28)
                    m = min(birds[si] - 1, rng.randint(base_m, base_m + 7))
                    if m <= 0:
                        continue
                    _req(
                        client,
                        "POST",
                        f"{base}/farms/{farm_id}/flock/events",
                        token=day_tok,
                        json={
                            "shed_id": sid,
                            "event_date": d.isoformat(),
                            "event_kind": "mortality",
                            "quantity": m,
                            "note": "Routine / heat-stress (sim)" if stress else "Routine (sim)",
                        },
                    )
                    birds[si] -= m

            # --- Egg production (per shed, one row per day each)
            day_usable_trays = 0
            bad_day = rng.random() < 0.11
            stress_m = 0.62 + 0.18 * rng.random() if bad_day else 1.0
            rate = _layer_rate(i) * stress_m
            for si, sid in enumerate(shed_ids):
                if birds[si] <= 0:
                    continue
                noise = 0.94 + 0.12 * rng.random()
                eggs = int(birds[si] * rate * noise)
                broken = min(eggs, int(eggs * (0.008 + 0.01 * rng.random())))
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/production/eggs",
                    token=day_tok,
                    json={"shed_id": sid, "date": d.isoformat(), "eggs_produced": eggs, "broken_eggs": broken},
                )
                usable = max(0, eggs - broken)
                day_usable_trays += usable // EGGS_PER_TRAY
            # --- Feed (farm-level chain; strict chronological posting)
            tb = max(1, total_birds())
            used = round(_feed_kg_per_1000_birds(i) * (tb / 1000.0), 2)
            recv = 0.0
            if i % 7 == 0:
                recv = float(rng.randint(8500, 11500))
                bill = round(recv * float(rng.randint(34, 41)), 2)
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/expenses",
                    token=mgr_tok,
                    json={
                        "category": "Feed & fodder",
                        "amount": bill,
                        "description": f"Bulk feed delivery ~{recv:.0f} kg (sim)",
                        "date": d.isoformat(),
                    },
                )
            _req(
                client,
                "POST",
                f"{base}/farms/{farm_id}/feed",
                token=day_tok,
                json={"date": d.isoformat(), "feed_received": recv, "feed_used": used},
            )

            # --- Sales (not every day; clip to plausible tray stock)
            if day_usable_trays > 0 and rng.random() < 0.72:
                sell_trays = min(
                    day_usable_trays,
                    max(1, int(day_usable_trays * (0.35 + 0.55 * rng.random()))),
                )
                rate_tray = float(rng.choice([260, 270, 275, 280, 285, 290, 295]))
                total_amt = round(sell_trays * rate_tray, 2)
                buyer = rng.choice(["Wholesale Mart", "City Distributor", "Retail chain", "Local shop", "Hotel bulk"])
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/sales",
                    token=day_tok,
                    json={
                        "buyer_name": buyer,
                        "trays_sold": sell_trays,
                        "rate_per_tray": rate_tray,
                        "total_amount": total_amt,
                        "date": d.isoformat(),
                    },
                )

            # --- Operating expenses
            if d.weekday() == 0 and i > 0:  # Mondays: electricity rough weekly accrual
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/expenses",
                    token=mgr_tok,
                    json={
                        "category": "Utilities",
                        "amount": float(rng.randint(4200, 7800)),
                        "description": "Cooling + lighting + pumps (sim week)",
                        "date": d.isoformat(),
                    },
                )
            if rng.random() < 0.28:
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/expenses",
                    token=mgr_tok,
                    json={
                        "category": "Fuel & transport",
                        "amount": float(rng.randint(1800, 6500)),
                        "description": "Genset / transport fuel (sim)",
                        "date": d.isoformat(),
                    },
                )
            if rng.random() < 0.12:
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/expenses",
                    token=mgr_tok,
                    json={
                        "category": "Miscellaneous",
                        "amount": float(rng.randint(400, 3200)),
                        "description": rng.choice(
                            ["Medicine / vitamins", "Repairs", "Water testing", "Litter / supplies", "Bank charges"]
                        ),
                        "date": d.isoformat(),
                    },
                )

            # --- Labour ledger: accrue a few days per week; payments occasionally
            if d.weekday() in (1, 3, 5):  # Tue, Thu, Sat
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/labour/{L_PRIYA}/ledger",
                    token=mgr_tok,
                    json={
                        "line_type": "earning",
                        "amount": str(Decimal("420.00")),
                        "line_date": d.isoformat(),
                        "description": "Daily wage accrual (sim)",
                    },
                )
                if i < 22:
                    _req(
                        client,
                        "POST",
                        f"{base}/farms/{farm_id}/labour/{L_VIKRAM}/ledger",
                        token=mgr_tok,
                        json={
                            "line_type": "earning",
                            "amount": str(Decimal("450.00")),
                            "line_date": d.isoformat(),
                            "description": "Daily wage accrual (sim)",
                        },
                    )
                if L_ANIL is not None:
                    _req(
                        client,
                        "POST",
                        f"{base}/farms/{farm_id}/labour/{L_ANIL}/ledger",
                        token=mgr_tok,
                        json={
                            "line_type": "earning",
                            "amount": str(Decimal("380.00")),
                            "line_date": d.isoformat(),
                            "description": "Daily wage accrual (sim)",
                        },
                    )

            if i == 15:
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/labour/{L_PRIYA}/ledger",
                    token=tok_o1,
                    json={
                        "line_type": "payment",
                        "amount": str(Decimal("5000.00")),
                        "line_date": d.isoformat(),
                        "description": "Partial advance (sim)",
                    },
                )

            if i == 24 and L_ANIL is None:
                row = _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/labour",
                    token=tok_o1,
                    json={
                        "full_name": "Anil Kumar",
                        "phone": "9800033333",
                        "personnel_kind": "labour",
                        "compensation_type": "daily",
                        "default_rate": 380.0,
                        "hired_at": d.isoformat(),
                        "notes": "Replacement after Vikram exit",
                    },
                )
                L_ANIL = row["id"]

            if i == 22:
                _req(
                    client,
                    "PATCH",
                    f"{base}/farms/{farm_id}/labour/{L_VIKRAM}",
                    token=tok_o1,
                    json={"is_active": False, "notes": "Left for hometown harvest season (sim)"},
                )

            if i == 10:
                _req(
                    client,
                    "POST",
                    f"{base}/farms/{farm_id}/labour/{L_OWNER_LINE}/ledger",
                    token=tok_o1,
                    json={
                        "line_type": "earning",
                        "amount": str(Decimal("35000.00")),
                        "line_date": d.isoformat(),
                        "description": "Owner partner monthly draw (sim)",
                    },
                )

            print(
                f"  day {i+1:2}/60 {d}  birds={total_birds()}  trays~{day_usable_trays}  "
                f"actor={'WA' if day_tok == tok_wa else 'WB'}",
                flush=True,
            )
            if args.slow_ms > 0:
                time.sleep(args.slow_ms / 1000.0)

        dash = _req(client, "GET", f"{base}/farms/{farm_id}/analytics/dashboard", token=tok_o1)
        print("\n=== Dashboard (owner1) ===", flush=True)
        print(
            f"total_birds={dash['total_birds']}  tray_stock={dash['tray_stock']}  "
            f"period={dash['period_start']}..{dash['period_end']}  "
            f"period_eggs={dash['period_usable_eggs']}  period_trays={dash['period_trays']}  "
            f"labour_due={dash['labour_due_total']}",
            flush=True,
        )

        print("\n=== Seeded logins (password from SIM_API_PASSWORD or --password) ===", flush=True)
        print(f"  Owners:  {owner1_email}  {owner2_email}", flush=True)
        print(f"  Workers: {worker_a_email}  {worker_b_email}", flush=True)
        print(f"  Farm id: {farm_id}", flush=True)
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
