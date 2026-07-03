"""Success page: shows the real amount, with safe fallbacks."""

from types import SimpleNamespace

import stripe


def _paid_session(**kw):
    d = {
        "payment_status": "paid",
        "amount_total": 500,
        "currency": "gbp",
        "metadata": SimpleNamespace(creator="Bilal"),
    }
    d.update(kw)
    return SimpleNamespace(**d)


def test_shows_amount_for_paid_session(client, monkeypatch):
    monkeypatch.setattr("stripe.checkout.Session.retrieve", lambda sid, **k: _paid_session())
    r = client.get("/success?session_id=cs_test_123")
    assert r.status_code == 200
    assert "£5.00" in r.text and "Bilal" in r.text


def test_generic_when_no_session_id(client):
    r = client.get("/success")
    assert r.status_code == 200 and "£" not in r.text


def test_generic_on_stripe_error(client, monkeypatch):
    def boom(sid, **k):
        raise stripe.error.InvalidRequestError("bad", None)

    monkeypatch.setattr("stripe.checkout.Session.retrieve", boom)
    r = client.get("/success?session_id=nope")
    assert r.status_code == 200 and "£" not in r.text


def test_generic_when_unpaid(client, monkeypatch):
    monkeypatch.setattr(
        "stripe.checkout.Session.retrieve",
        lambda sid, **k: _paid_session(payment_status="unpaid"),
    )
    r = client.get("/success?session_id=cs_unpaid")
    assert r.status_code == 200 and "£" not in r.text
