"""Checkout endpoint: validation, CORS, and (mocked) session creation."""

from types import SimpleNamespace


def test_amount_out_of_range_rejected(client):
    assert client.post("/create-checkout-session", json={"amount": 0}).status_code == 400
    assert client.post("/create-checkout-session", json={"amount": 100000}).status_code == 400


def test_malformed_body_422(client):
    assert client.post("/create-checkout-session", json={}).status_code == 422
    assert client.post("/create-checkout-session", json={"amount": "abc"}).status_code == 422


def test_cors_preflight_allows_any_origin(client):
    r = client.options(
        "/create-checkout-session",
        headers={"Origin": "https://someones-blog.com", "Access-Control-Request-Method": "POST"},
    )
    assert r.status_code == 200
    assert r.headers.get("access-control-allow-origin") == "*"


def test_valid_amount_returns_checkout_url(client, monkeypatch):
    monkeypatch.setattr(
        "stripe.checkout.Session.create",
        lambda **kwargs: SimpleNamespace(url="https://checkout.stripe.com/c/pay/cs_test_x"),
    )
    r = client.post(
        "/create-checkout-session", json={"amount": 5, "creator": "Bilal", "message": "ta"}
    )
    assert r.status_code == 200
    assert r.json()["url"].startswith("https://checkout.stripe.com/")
