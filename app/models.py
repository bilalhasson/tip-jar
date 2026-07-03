"""Database models."""

from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


class Tip(SQLModel, table=True):
    """A recorded tip — written only from a verified Stripe webhook event."""

    id: int | None = Field(default=None, primary_key=True)
    # Stripe Checkout Session id — unique so retried webhook deliveries can't
    # create duplicate rows.
    stripe_session_id: str = Field(unique=True, index=True)
    amount: int  # smallest currency unit (e.g. pence), from session.amount_total
    currency: str
    creator: str | None = None
    message: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
