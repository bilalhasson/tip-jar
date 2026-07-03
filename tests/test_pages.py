"""Static pages, assets, and meta tags."""

import pytest


@pytest.mark.parametrize(
    "path,ctype",
    [
        ("/healthz", "application/json"),
        ("/", "text/html"),
        ("/widget.js", "application/javascript"),
        ("/demos/", "text/html"),
        ("/favicon.ico", "image/x-icon"),
        ("/og-image.png", "image/png"),
    ],
)
def test_routes_ok(client, path, ctype):
    r = client.get(path)
    assert r.status_code == 200
    assert r.headers["content-type"].split(";")[0] == ctype


def test_og_and_favicon_meta_on_landing(client):
    html = client.get("/").text
    assert 'property="og:image"' in html
    assert "tipjar.bilalhasson.com/og-image.png" in html
    assert 'name="twitter:card"' in html
    assert 'rel="icon"' in html
