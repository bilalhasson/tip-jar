"""Webhook: signature verification, recording, idempotency, async payments."""

from sqlmodel import Session, select


def _count(session_id):
    from app.db import engine
    from app.models import Tip

    with Session(engine) as s:
        return len(s.exec(select(Tip).where(Tip.stripe_session_id == session_id)).all())


def _tip(session_id):
    from app.db import engine
    from app.models import Tip

    with Session(engine) as s:
        return s.exec(select(Tip).where(Tip.stripe_session_id == session_id)).first()


def _post(client, sign, event):
    payload, header = sign(event)
    return client.post("/stripe-webhook", content=payload, headers={"Stripe-Signature": header})


def test_valid_signed_event_records_tip(client, sign, make_event):
    assert _post(client, sign, make_event("cs_ok", message="thanks!")).status_code == 200
    t = _tip("cs_ok")
    assert t is not None and t.amount == 500 and t.currency == "gbp"
    assert t.creator == "Bilal" and t.message == "thanks!"


def test_duplicate_delivery_is_idempotent(client, sign, make_event):
    for _ in range(2):
        assert _post(client, sign, make_event("cs_dup")).status_code == 200
    assert _count("cs_dup") == 1


def test_bad_signature_rejected(client):
    r = client.post(
        "/stripe-webhook", content="{}", headers={"Stripe-Signature": "t=1,v1=deadbeef"}
    )
    assert r.status_code == 400


def test_missing_signature_rejected(client):
    assert client.post("/stripe-webhook", content="{}").status_code == 400


def test_unpaid_completed_not_recorded(client, sign, make_event):
    assert _post(client, sign, make_event("cs_unpaid", paid=False)).status_code == 200
    assert _count("cs_unpaid") == 0


def test_async_payment_succeeded_records(client, sign, make_event):
    ev = make_event("cs_async", event_type="checkout.session.async_payment_succeeded", paid=True)
    assert _post(client, sign, ev).status_code == 200
    assert _count("cs_async") == 1
