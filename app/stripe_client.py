"""Stripe service layer — owns all Stripe interaction.

Keeps the API wiring and Checkout-session business logic out of the route
handlers. Routes translate the exceptions below into HTTP responses.
"""

import math

import stripe

from app import config


class InvalidAmount(ValueError):
    """Tip amount failed server-side validation — maps to HTTP 400."""


class CheckoutError(Exception):
    """Stripe rejected the session request — maps to HTTP 502."""


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
