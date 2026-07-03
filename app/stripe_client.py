"""Stripe service layer — owns all Stripe interaction.

Keeps the API wiring and Checkout-session business logic out of the route
handlers. Routes translate the exceptions below into HTTP responses.
"""

import json
import math

import stripe

from app import config


class InvalidAmount(ValueError):
    """Tip amount failed server-side validation — maps to HTTP 400."""


class CheckoutError(Exception):
    """Stripe rejected the session request — maps to HTTP 502."""


class InvalidSignature(Exception):
    """Webhook payload failed signature verification — maps to HTTP 400."""


def configure() -> None:
    """Wire up the Stripe SDK. Called once at app startup."""
    stripe.api_key = config.STRIPE_SECRET_KEY
    stripe.api_version = config.STRIPE_API_VERSION


def create_checkout_session(
    amount: float,
    creator: str | None,
    message: str | None,
    base_url: str,
) -> str:
    """Create a hosted Stripe Checkout session and return its redirect URL.

    Raises InvalidAmount if the amount is out of range, CheckoutError if Stripe
    rejects the request.
    """
    # Validate the amount server-side — never trust the client.
    if not math.isfinite(amount):  # rejects NaN, +inf, -inf
        raise InvalidAmount("Invalid amount.")
    if not (config.MIN_TIP <= amount <= config.MAX_TIP):
        raise InvalidAmount(f"Amount must be between {config.MIN_TIP} and {config.MAX_TIP}.")

    unit_amount = round(amount * 100)  # Stripe expects the smallest currency unit
    creator = (creator or "").strip()
    message = (message or "").strip()

    try:
        # No payment_method_types — omitting it enables dynamic payment methods.
        session = stripe.checkout.Session.create(
            mode="payment",
            line_items=[
                {
                    "quantity": 1,
                    "price_data": {
                        "currency": config.CURRENCY,
                        "unit_amount": unit_amount,
                        "product_data": {"name": f"Tip for {creator}" if creator else "Tip"},
                    },
                }
            ],
            success_url=f"{base_url}/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{base_url}/cancel",
            metadata={"creator": creator, "message": message},
        )
    except stripe.error.StripeError as exc:
        # Don't leak Stripe internals/keys to the caller.
        raise CheckoutError from exc

    return session.url


_SYMBOLS = {"gbp": "£", "usd": "$", "eur": "€"}


def _format_money(minor: int, currency: str) -> str:
    prefix = _SYMBOLS.get(currency, (currency or "").upper() + " ")
    return prefix + f"{minor / 100:,.2f}"


def get_checkout_summary(session_id: str | None) -> dict | None:
    """Return {amount_display, creator} for a paid Checkout Session, else None.

    Retrieves the session server-side (authoritative), so the displayed amount
    can't be spoofed via the URL. Never raises — returns None on a missing id,
    a Stripe error, or an unpaid session.
    """
    if not session_id:
        return None
    try:
        s = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError:
        return None
    if getattr(s, "payment_status", None) != "paid":
        return None
    meta = getattr(s, "metadata", None)
    return {
        "amount_display": _format_money(
            getattr(s, "amount_total", 0) or 0, getattr(s, "currency", "")
        ),
        "creator": (getattr(meta, "creator", "") if meta else "") or "",
    }


def construct_webhook_event(payload: bytes, sig_header: str) -> dict:
    """Verify a webhook's signature and return the event as a plain dict.

    Raises InvalidSignature if the payload is malformed or the signature doesn't
    match our signing secret — the strong guarantee that the request is really
    from Stripe and untampered. We return json.loads(payload) rather than the
    StripeObject so downstream code works with ordinary dict semantics.
    """
    try:
        stripe.Webhook.construct_event(payload, sig_header, config.STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError) as exc:
        raise InvalidSignature from exc
    return json.loads(payload)
