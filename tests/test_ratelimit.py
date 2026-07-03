"""Rate limiting on the public checkout endpoint."""

from app import config


def test_checkout_is_rate_limited(client, monkeypatch):
    monkeypatch.setattr(config, "RATE_LIMIT", "3/minute")
    # A distinct forwarded IP → a fresh limiter bucket, isolated from other tests.
    headers = {"X-Forwarded-For": "203.0.113.7"}
    codes = [
        client.post("/create-checkout-session", json={"amount": 0}, headers=headers).status_code
        for _ in range(4)
    ]
    # First 3 pass the limiter (then 400 on validation); the 4th is blocked.
    assert codes[:3] == [400, 400, 400]
    assert codes[3] == 429
