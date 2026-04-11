from __future__ import annotations

import json
from datetime import date, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.constants.expense_categories import FEED_FODDER_CATEGORY, LABOUR_WAGES_CATEGORY

PASSWORD = "Passw0rd!"


class FakePubSub:
    def __init__(self, messages: list[str]):
        self._messages = messages

    async def subscribe(self, _channel: str):
        return None

    async def listen(self):
        for payload in self._messages:
            yield {"type": "message", "data": payload}

    async def unsubscribe(self, _channel: str):
        return None

    async def close(self):
        return None


class FakeRedis:
    def __init__(self, messages: list[str]):
        self._messages = messages

    def pubsub(self):
        return FakePubSub(self._messages)

    async def aclose(self):
        return None


def register_user(client: TestClient, name: str, email: str, password: str = PASSWORD):
    response = client.post(
        "/auth/register",
        json={"name": name, "email": email, "password": password},
    )
    assert response.status_code == 200, response.text
    return response.json()


def login_user(client: TestClient, email: str, password: str = PASSWORD) -> str:
    response = client.post("/auth/login", json={"email": email, "password": password})
    assert response.status_code == 200, response.text
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_farm_context(client: TestClient) -> dict[str, object]:
    owner = register_user(client, "Owner", "owner@example.com")
    manager = register_user(client, "Manager", "manager@example.com")
    worker = register_user(client, "Worker", "worker@example.com")
    outsider = register_user(client, "Outsider", "outsider@example.com")

    owner_token = login_user(client, owner["email"])
    manager_token = login_user(client, manager["email"])
    worker_token = login_user(client, worker["email"])
    outsider_token = login_user(client, outsider["email"])

    farm_resp = client.post(
        "/farms",
        headers=auth_headers(owner_token),
        json={"name": "Alpha Farm", "location": "Phase 1"},
    )
    assert farm_resp.status_code == 200, farm_resp.text
    farm = farm_resp.json()
    farm_id = farm["id"]

    shed_resp = client.post(
        f"/farms/{farm_id}/sheds",
        headers=auth_headers(owner_token),
        json={"name": "Shed A", "bird_count": 120},
    )
    assert shed_resp.status_code == 200, shed_resp.text
    shed = shed_resp.json()

    add_manager_resp = client.post(
        f"/farms/{farm_id}/members",
        headers=auth_headers(owner_token),
        json={"email": manager["email"], "role": "manager"},
    )
    assert add_manager_resp.status_code == 200, add_manager_resp.text

    add_worker_resp = client.post(
        f"/farms/{farm_id}/members/by-user-id",
        headers=auth_headers(owner_token),
        json={"user_id": worker["id"], "role": "worker"},
    )
    assert add_worker_resp.status_code == 200, add_worker_resp.text

    return {
        "farm_id": farm_id,
        "shed_id": shed["id"],
        "owner": owner,
        "manager": manager,
        "worker": worker,
        "outsider": outsider,
        "owner_token": owner_token,
        "manager_token": manager_token,
        "worker_token": worker_token,
        "outsider_token": outsider_token,
    }


def test_public_and_auth_endpoints(client: TestClient):
    health = client.get("/health")
    assert health.status_code == 200
    assert health.json() == {"status": "ok"}

    categories = client.get("/expense-categories")
    assert categories.status_code == 200
    assert LABOUR_WAGES_CATEGORY in categories.json()
    assert FEED_FODDER_CATEGORY in categories.json()

    user = register_user(client, "Alice", "alice@example.com")

    duplicate = client.post(
        "/auth/register",
        json={"name": "Alice 2", "email": user["email"], "password": PASSWORD},
    )
    assert duplicate.status_code == 400

    bad_login = client.post(
        "/auth/login",
        json={"email": user["email"], "password": "wrong-pass"},
    )
    assert bad_login.status_code == 401

    token = login_user(client, user["email"])
    me = client.get("/auth/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == user["email"]


def test_farm_and_member_endpoints(client: TestClient):
    owner = register_user(client, "Owner", "owner@example.com")
    manager = register_user(client, "Manager", "manager@example.com")
    worker = register_user(client, "Worker", "worker@example.com")
    outsider = register_user(client, "Outsider", "outsider@example.com")
    owner_token = login_user(client, owner["email"])
    manager_token = login_user(client, manager["email"])

    create_farm = client.post(
        "/farms",
        headers=auth_headers(owner_token),
        json={"name": "North Farm", "location": "Block A"},
    )
    assert create_farm.status_code == 200, create_farm.text
    farm_id = create_farm.json()["id"]

    list_before = client.get("/farms", headers=auth_headers(owner_token))
    assert list_before.status_code == 200
    assert list_before.json()["total"] == 1
    assert list_before.json()["items"][0]["my_role"] == "owner"

    get_farm = client.get(f"/farms/{farm_id}", headers=auth_headers(owner_token))
    assert get_farm.status_code == 200

    patch_farm = client.patch(
        f"/farms/{farm_id}",
        headers=auth_headers(owner_token),
        json={"name": "North Farm Updated", "location": "Block B"},
    )
    assert patch_farm.status_code == 200
    assert patch_farm.json()["name"] == "North Farm Updated"

    search_users = client.get(
        f"/farms/{farm_id}/users/search?q=er",
        headers=auth_headers(owner_token),
    )
    assert search_users.status_code == 200
    found_emails = {row["email"] for row in search_users.json()["items"]}
    assert manager["email"] in found_emails
    assert worker["email"] in found_emails

    add_manager = client.post(
        f"/farms/{farm_id}/members",
        headers=auth_headers(owner_token),
        json={"email": manager["email"], "role": "manager"},
    )
    assert add_manager.status_code == 200

    add_worker = client.post(
        f"/farms/{farm_id}/members/by-user-id",
        headers=auth_headers(owner_token),
        json={"user_id": worker["id"], "role": "worker"},
    )
    assert add_worker.status_code == 200

    members = client.get(f"/farms/{farm_id}/members", headers=auth_headers(owner_token))
    assert members.status_code == 200
    assert members.json()["total"] == 3

    demote_manager = client.patch(
        f"/farms/{farm_id}/members/{manager['id']}",
        headers=auth_headers(owner_token),
        json={"role": "worker"},
    )
    assert demote_manager.status_code == 200
    assert demote_manager.json()["role"] == "worker"

    promote_manager = client.patch(
        f"/farms/{farm_id}/members/{manager['id']}",
        headers=auth_headers(owner_token),
        json={"role": "manager"},
    )
    assert promote_manager.status_code == 200
    assert promote_manager.json()["role"] == "manager"

    create_shed_a = client.post(
        f"/farms/{farm_id}/sheds",
        headers=auth_headers(owner_token),
        json={"name": "Layer Shed", "bird_count": 100},
    )
    assert create_shed_a.status_code == 200
    shed_a_id = create_shed_a.json()["id"]

    create_shed_b = client.post(
        f"/farms/{farm_id}/sheds",
        headers=auth_headers(owner_token),
        json={"name": "Grower Shed", "bird_count": 80},
    )
    assert create_shed_b.status_code == 200
    shed_b_id = create_shed_b.json()["id"]

    list_sheds = client.get(f"/farms/{farm_id}/sheds", headers=auth_headers(owner_token))
    assert list_sheds.status_code == 200
    assert list_sheds.json()["total"] == 2

    patch_shed = client.patch(
        f"/farms/{farm_id}/sheds/{shed_a_id}",
        headers=auth_headers(owner_token),
        json={"name": "Layer Shed Prime", "bird_count": 125},
    )
    assert patch_shed.status_code == 200
    assert patch_shed.json()["bird_count"] == 125

    delete_shed = client.delete(
        f"/farms/{farm_id}/sheds/{shed_b_id}",
        headers=auth_headers(owner_token),
    )
    assert delete_shed.status_code == 204

    manager_farms = client.get("/farms", headers=auth_headers(manager_token))
    assert manager_farms.status_code == 200
    assert manager_farms.json()["items"][0]["my_role"] == "manager"

    outsider_farm = client.get(f"/farms/{farm_id}", headers=auth_headers(login_user(client, outsider['email'])) )
    assert outsider_farm.status_code == 403


def test_production_sales_analytics_and_ml_endpoints(client: TestClient):
    ctx = create_farm_context(client)
    farm_id = ctx["farm_id"]
    shed_id = ctx["shed_id"]
    headers = auth_headers(ctx["owner_token"])
    today = date.today()
    prod_date = (today - timedelta(days=3)).isoformat()
    sale_date = (today - timedelta(days=2)).isoformat()
    feed_date = (today - timedelta(days=4)).isoformat()

    create_eggs = client.post(
        f"/farms/{farm_id}/production/eggs",
        headers=headers,
        json={
            "shed_id": shed_id,
            "date": prod_date,
            "eggs_produced": 300,
            "broken_eggs": 10,
        },
    )
    assert create_eggs.status_code == 200, create_eggs.text
    record_id = create_eggs.json()["id"]
    assert create_eggs.json()["usable_eggs"] == 290

    put_eggs = client.put(
        f"/farms/{farm_id}/production/eggs/{record_id}",
        headers=headers,
        json={
            "shed_id": shed_id,
            "date": prod_date,
            "eggs_produced": 330,
            "broken_eggs": 9,
        },
    )
    assert put_eggs.status_code == 200
    assert put_eggs.json()["usable_eggs"] == 321

    patch_eggs = client.patch(
        f"/farms/{farm_id}/production/eggs/{record_id}",
        headers=headers,
        json={"broken_eggs": 12},
    )
    assert patch_eggs.status_code == 200
    assert patch_eggs.json()["usable_eggs"] == 318

    list_eggs = client.get(f"/farms/{farm_id}/production/eggs", headers=headers)
    assert list_eggs.status_code == 200
    assert list_eggs.json()["total"] == 1

    create_feed = client.post(
        f"/farms/{farm_id}/feed",
        headers=headers,
        json={
            "date": feed_date,
            "feed_received": 100,
            "feed_used": 40,
            "purchase_cost_inr": 2500,
        },
    )
    assert create_feed.status_code == 200, create_feed.text

    create_sale = client.post(
        f"/farms/{farm_id}/sales",
        headers=headers,
        json={
            "buyer_name": "Retailer",
            "trays_sold": 8,
            "rate_per_tray": 220,
            "total_amount": 1760,
            "date": sale_date,
        },
    )
    assert create_sale.status_code == 200, create_sale.text
    sale_id = create_sale.json()["id"]

    patch_sale = client.patch(
        f"/farms/{farm_id}/sales/{sale_id}",
        headers=headers,
        json={"rate_per_egg": 7.5, "total_amount": 1800},
    )
    assert patch_sale.status_code == 200, patch_sale.text
    assert patch_sale.json()["rate_per_tray"] == 225.0

    list_sales = client.get(f"/farms/{farm_id}/sales", headers=headers)
    assert list_sales.status_code == 200
    assert list_sales.json()["total"] == 1

    dashboard = client.get(f"/farms/{farm_id}/analytics/dashboard?days=30", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    assert dashboard.json()["total_birds"] == 120
    assert dashboard.json()["period_usable_eggs"] == 318

    eggs_daily = client.get(
        f"/farms/{farm_id}/analytics/eggs/daily?days=30&granularity=day",
        headers=headers,
    )
    assert eggs_daily.status_code == 200
    assert eggs_daily.json()["total"] >= 1

    feed_daily = client.get(
        f"/farms/{farm_id}/analytics/feed/daily?days=30&granularity=day",
        headers=headers,
    )
    assert feed_daily.status_code == 200
    assert feed_daily.json()["items"][-1]["feed_remaining"] == 60.0

    profit = client.get(f"/farms/{farm_id}/analytics/profit?days=30", headers=headers)
    assert profit.status_code == 200
    assert profit.json()["revenue"] == 1800.0
    assert profit.json()["expenses"] >= 2500.0

    profit_daily = client.get(
        f"/farms/{farm_id}/analytics/profit/daily?days=30&granularity=day",
        headers=headers,
    )
    assert profit_daily.status_code == 200
    assert profit_daily.json()["total"] >= 1

    tray_stock = client.get(f"/farms/{farm_id}/analytics/tray-stock", headers=headers)
    assert tray_stock.status_code == 200
    assert tray_stock.json()["trays_sold"] == 8

    ml_eggs = client.get(f"/farms/{farm_id}/ml/predict/eggs-next-week", headers=headers)
    assert ml_eggs.status_code == 200
    assert ml_eggs.json()["model_loaded"] is False

    ml_feed = client.get(
        f"/farms/{farm_id}/ml/predict/feed-next-days?days=14",
        headers=headers,
    )
    assert ml_feed.status_code == 200
    assert ml_feed.json()["model_loaded"] is False

    delete_sale = client.delete(f"/farms/{farm_id}/sales/{sale_id}", headers=headers)
    assert delete_sale.status_code == 204


def test_feed_and_expense_endpoints(client: TestClient):
    ctx = create_farm_context(client)
    farm_id = ctx["farm_id"]
    headers = auth_headers(ctx["owner_token"])
    today = date.today()
    older = (today - timedelta(days=5)).isoformat()
    newer = (today - timedelta(days=4)).isoformat()
    expense_date = (today - timedelta(days=3)).isoformat()

    preview = client.get(
        f"/farms/{farm_id}/feed/preview-opening?date={older}",
        headers=headers,
    )
    assert preview.status_code == 200
    assert preview.json()["opening_balance_kg"] == 0.0

    feed_auto = client.post(
        f"/farms/{farm_id}/feed",
        headers=headers,
        json={
            "date": older,
            "feed_received": 90,
            "feed_used": 30,
            "purchase_cost_inr": 1800,
        },
    )
    assert feed_auto.status_code == 200, feed_auto.text
    feed_auto_id = feed_auto.json()["id"]
    assert feed_auto.json()["feed_remaining"] == 60.0

    feed_manual = client.post(
        f"/farms/{farm_id}/feed",
        headers=headers,
        json={
            "date": newer,
            "feed_received": 20,
            "feed_used": 10,
        },
    )
    assert feed_manual.status_code == 200, feed_manual.text
    feed_manual_id = feed_manual.json()["id"]
    assert feed_manual.json()["opening_balance_kg"] == 60.0

    list_feed = client.get(f"/farms/{farm_id}/feed", headers=headers)
    assert list_feed.status_code == 200
    assert list_feed.json()["total"] == 2

    patch_feed = client.patch(
        f"/farms/{farm_id}/feed/{feed_auto_id}",
        headers=headers,
        json={"feed_used": 35, "purchase_cost_inr": 1900},
    )
    assert patch_feed.status_code == 200
    assert patch_feed.json()["feed_remaining"] == 55.0

    manual_expense = client.post(
        f"/farms/{farm_id}/expenses",
        headers=headers,
        json={
            "category": "Miscellaneous",
            "amount": 450,
            "description": "Water pipe repair",
            "date": expense_date,
        },
    )
    assert manual_expense.status_code == 200, manual_expense.text
    manual_expense_id = manual_expense.json()["id"]

    patch_expense = client.patch(
        f"/farms/{farm_id}/expenses/{manual_expense_id}",
        headers=headers,
        json={"amount": 500, "description": "Water pipe repair and fittings"},
    )
    assert patch_expense.status_code == 200
    assert patch_expense.json()["amount"] == 500.0

    linked_feed_expense = client.post(
        f"/farms/{farm_id}/expenses",
        headers=headers,
        json={
            "category": FEED_FODDER_CATEGORY,
            "amount": 900,
            "description": "Linked feed purchase",
            "date": newer,
            "feed_inventory_id": feed_manual_id,
        },
    )
    assert linked_feed_expense.status_code == 200, linked_feed_expense.text
    linked_feed_expense_id = linked_feed_expense.json()["id"]

    labour_row = client.post(
        f"/farms/{farm_id}/labour",
        headers=headers,
        json={
            "full_name": "Helper One",
            "personnel_kind": "labour",
            "compensation_type": "daily",
            "default_rate": 600,
            "hired_at": older,
        },
    )
    assert labour_row.status_code == 200, labour_row.text
    labour_id = labour_row.json()["id"]

    labour_expense = client.post(
        f"/farms/{farm_id}/expenses",
        headers=headers,
        json={
            "category": LABOUR_WAGES_CATEGORY,
            "amount": 600,
            "date": expense_date,
            "labour_id": labour_id,
        },
    )
    assert labour_expense.status_code == 200, labour_expense.text
    assert labour_expense.json()["labour_ledger_line_id"] is not None

    expenses = client.get(
        f"/farms/{farm_id}/expenses",
        headers=auth_headers(ctx["worker_token"]),
    )
    assert expenses.status_code == 200
    assert expenses.json()["total"] >= 4

    delete_linked_expense = client.delete(
        f"/farms/{farm_id}/expenses/{linked_feed_expense_id}",
        headers=headers,
    )
    assert delete_linked_expense.status_code == 400

    delete_manual_expense = client.delete(
        f"/farms/{farm_id}/expenses/{manual_expense_id}",
        headers=headers,
    )
    assert delete_manual_expense.status_code == 204

    delete_feed_linked = client.delete(f"/farms/{farm_id}/feed/{feed_manual_id}", headers=headers)
    assert delete_feed_linked.status_code == 204

    delete_feed_auto = client.delete(f"/farms/{farm_id}/feed/{feed_auto_id}", headers=headers)
    assert delete_feed_auto.status_code == 204


def test_labour_and_payroll_endpoints(client: TestClient):
    ctx = create_farm_context(client)
    farm_id = ctx["farm_id"]
    owner_headers = auth_headers(ctx["owner_token"])
    worker_headers = auth_headers(ctx["worker_token"])
    today = date.today()
    hire_date = (today - timedelta(days=20)).isoformat()
    line_date = (today - timedelta(days=2)).isoformat()
    month = f"{today.year:04d}-{today.month:02d}"

    owner_list = client.get(f"/farms/{farm_id}/labour", headers=owner_headers)
    assert owner_list.status_code == 200
    assert owner_list.json()["total"] == 1
    worker_labour_id = owner_list.json()["items"][0]["id"]

    active_only = client.get(f"/farms/{farm_id}/labour?active_only=true", headers=owner_headers)
    assert active_only.status_code == 200
    assert active_only.json()["total"] == 1

    worker_me = client.get(f"/farms/{farm_id}/labour/me", headers=worker_headers)
    assert worker_me.status_code == 200
    assert worker_me.json()["linked_user_id"] == ctx["worker"]["id"]

    worker_summary = client.get(f"/farms/{farm_id}/labour/summary", headers=worker_headers)
    assert worker_summary.status_code == 200
    assert len(worker_summary.json()) == 1

    manual_labour = client.post(
        f"/farms/{farm_id}/labour",
        headers=owner_headers,
        json={
            "full_name": "Payroll Person",
            "personnel_kind": "labour",
            "compensation_type": "monthly",
            "default_rate": 12000,
            "notes": "Seasonal",
            "hired_at": hire_date,
        },
    )
    assert manual_labour.status_code == 200, manual_labour.text
    manual_labour_id = manual_labour.json()["id"]

    patch_labour = client.patch(
        f"/farms/{farm_id}/labour/{manual_labour_id}",
        headers=owner_headers,
        json={"phone": "99999", "notes": "Updated note", "is_active": True},
    )
    assert patch_labour.status_code == 200
    assert patch_labour.json()["phone"] == "99999"

    add_adjustment = client.post(
        f"/farms/{farm_id}/labour/{manual_labour_id}/ledger",
        headers=owner_headers,
        json={
            "line_type": "adjustment",
            "amount": 250,
            "line_date": line_date,
            "description": "Tool allowance",
        },
    )
    assert add_adjustment.status_code == 200, add_adjustment.text
    adjustment_line_id = add_adjustment.json()["id"]

    list_ledger = client.get(
        f"/farms/{farm_id}/labour/{manual_labour_id}/ledger",
        headers=owner_headers,
    )
    assert list_ledger.status_code == 200
    assert list_ledger.json()["total"] == 1

    payroll_before = client.get(
        f"/farms/{farm_id}/labour/payroll?month={month}",
        headers=owner_headers,
    )
    assert payroll_before.status_code == 200
    assert len(payroll_before.json()["workers"]) == 2

    accrue = client.post(
        f"/farms/{farm_id}/labour/payroll/accrue",
        headers=owner_headers,
        json={"labour_id": manual_labour_id, "month": month},
    )
    assert accrue.status_code == 200, accrue.text
    assert accrue.json()["line_type"] == "earning"

    payout = client.post(
        f"/farms/{farm_id}/labour/payroll/payout",
        headers=owner_headers,
        json={
            "labour_id": manual_labour_id,
            "month": month,
            "amount": "3000",
            "line_date": line_date,
            "description": "Advance",
        },
    )
    assert payout.status_code == 200, payout.text
    assert payout.json()["linked_expense_id"] is not None

    delete_adjustment = client.delete(
        f"/farms/{farm_id}/labour/{manual_labour_id}/ledger/{adjustment_line_id}",
        headers=owner_headers,
    )
    assert delete_adjustment.status_code == 204

    delete_labour = client.delete(
        f"/farms/{farm_id}/labour/{manual_labour_id}",
        headers=owner_headers,
    )
    assert delete_labour.status_code == 204


def test_flock_audit_and_websocket_endpoints(client: TestClient, monkeypatch: pytest.MonkeyPatch):
    ctx = create_farm_context(client)
    farm_id = ctx["farm_id"]
    shed_id = ctx["shed_id"]
    owner_headers = auth_headers(ctx["owner_token"])
    worker_token = ctx["worker_token"]
    today = date.today().isoformat()

    flock_summary = client.get(f"/farms/{farm_id}/flock/summary", headers=owner_headers)
    assert flock_summary.status_code == 200
    assert flock_summary.json()["birds_alive_total"] == 120

    create_event = client.post(
        f"/farms/{farm_id}/flock/events",
        headers=owner_headers,
        json={
            "shed_id": shed_id,
            "event_date": today,
            "event_kind": "purchase",
            "quantity": 15,
            "note": "New birds",
        },
    )
    assert create_event.status_code == 200, create_event.text
    event_id = create_event.json()["id"]
    assert create_event.json()["birds_delta"] == 15

    list_events = client.get(f"/farms/{farm_id}/flock/events", headers=owner_headers)
    assert list_events.status_code == 200
    assert list_events.json()["total"] == 1

    delete_event = client.delete(
        f"/farms/{farm_id}/flock/events/{event_id}",
        headers=owner_headers,
    )
    assert delete_event.status_code == 204

    audit = client.get(f"/farms/{farm_id}/audit-logs", headers=owner_headers)
    assert audit.status_code == 200
    assert audit.json()["total"] >= 1

    with pytest.raises(WebSocketDisconnect) as unauth_exc:
        with client.websocket_connect(f"/ws/farms/{farm_id}?token=bad-token"):
            pass
    assert unauth_exc.value.code == 4401

    with pytest.raises(WebSocketDisconnect) as worker_exc:
        with client.websocket_connect(f"/ws/farms/{farm_id}?token={worker_token}"):
            pass
    assert worker_exc.value.code == 4403

    fake_message = json.dumps({"type": "farm_updated", "farm_id": farm_id, "ok": True})

    from app.api.routes import websocket as websocket_routes

    monkeypatch.setattr(
        websocket_routes.aioredis,
        "from_url",
        lambda *args, **kwargs: FakeRedis([fake_message]),
    )

    with client.websocket_connect(f"/ws/farms/{farm_id}?token={ctx['owner_token']}") as ws:
        received = ws.receive_text()
        assert json.loads(received) == {"type": "farm_updated", "farm_id": farm_id, "ok": True}
