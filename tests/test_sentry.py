"""Sentry event scrubbing (privacy)."""

from app.main import _scrub_event


def test_scrub_removes_query_string_and_url_query():
    event = {
        "request": {
            "url": "https://tipjar.example/success?session_id=cs_test_123",
            "query_string": "session_id=cs_test_123",
            "method": "GET",
        }
    }
    out = _scrub_event(event, {})
    assert out["request"]["url"] == "https://tipjar.example/success"
    assert "query_string" not in out["request"]


def test_scrub_tolerates_missing_request():
    assert _scrub_event({}, {}) == {}
