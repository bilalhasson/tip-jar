"""Shared test fixtures. Env is configured BEFORE the app is imported."""

import hashlib
import hmac
import json
import os
import tempfile
import time

os.environ.setdefault("DATABASE_URL", f"sqlite:///{tempfile.mktemp(suffix='.sqlite3')}")
os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_testsecret")

import pytest  # noqa: E402
from sqlmodel import Session, delete  # noqa: E402
from starlette.testclient import TestClient  # noqa: E402

WEBHOOK_SECRET = os.environ["STRIPE_WEBHOOK_SECRET"]


@pytest.fixture(autouse=True)
def clean_db():
    """Start every test with an empty Tip table so row counts are deterministic."""
    from app.db import create_db_and_tables, engine
    from app.models import Tip

    create_db_and_tables()
    with Session(engine) as s:
        s.exec(delete(Tip))
        s.commit()
    yield


@pytest.fixture
def client():
    from app.main import app

    with TestClient(app) as c:  # context manager fires the lifespan (create tables)
        yield c


@pytest.fixture
def sign():
    """Return a helper that signs an event dict like Stripe does."""

    def _sign(event: dict):
        payload = json.dumps(event)
        t = int(time.time())
        digest = hmac.new(
            WEBHOOK_SECRET.encode(), f"{t}.{payload}".encode(), hashlib.sha256
        ).hexdigest()
        return payload, f"t={t},v1={digest}"

    return _sign


@pytest.fixture
def make_event():
    """Return the checkout-event builder (avoids importing conftest directly)."""
    return checkout_event


def checkout_event(
    session_id="cs_test_1",
    event_type="checkout.session.completed",
    paid=True,
    amount=500,
    currency="gbp",
    creator="Bilal",
    message="",
):
    return {
        "id": "evt_test",
        "object": "event",
        "type": event_type,
        "data": {
            "object": {
                "id": session_id,
                "object": "checkout.session",
                "payment_status": "paid" if paid else "unpaid",
                "amount_total": amount,
                "currency": currency,
                "metadata": {"creator": creator, "message": message},
            }
        },
    }
