"""Tip recording — turns a verified Stripe event into a persisted Tip row."""

from sqlalchemy.exc import IntegrityError
from sqlmodel import Session

from app.db import engine
from app.models import Tip


def handle_event(event: dict) -> bool:
    """Record a tip if the event is a completed, paid Checkout session.

    Returns True if a new tip row was written, False otherwise (wrong event
    type, unpaid session, or a duplicate delivery).
    """
    if event.get("type") != "checkout.session.completed":
        return False

    session = event.get("data", {}).get("object", {})
    # Guard against unpaid/async-pending sessions — only a paid session is a tip.
    if session.get("payment_status") != "paid":
        return False

    metadata = session.get("metadata") or {}
    return record_tip(
        stripe_session_id=session["id"],
        amount=session["amount_total"],
        currency=session["currency"],
        creator=metadata.get("creator") or None,
        message=metadata.get("message") or None,
    )


def record_tip(
    stripe_session_id: str,
    amount: int,
    currency: str,
    creator: str | None,
    message: str | None,
) -> bool:
    """Insert a Tip. Idempotent: a duplicate session id (Stripe retries events)
    is silently ignored. Returns True only when a new row is written."""
    with Session(engine) as db:
        db.add(
            Tip(
                stripe_session_id=stripe_session_id,
                amount=amount,
                currency=currency,
                creator=creator,
                message=message,
            )
        )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # already recorded from an earlier delivery
            return False
    return True
