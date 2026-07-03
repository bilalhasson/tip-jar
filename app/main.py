"""Tip Jar — an embeddable 'buy me a coffee' widget with Stripe.

Stage 0: barebones app to prove the Railway deploy pipeline. No Stripe or
database yet — those arrive in later stages.
"""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse

app = FastAPI(title="Tip Jar", docs_url=None, redoc_url=None)


@app.get("/healthz")
def healthz():
    """Liveness probe — used to confirm the deploy is up."""
    return {"status": "ok"}


@app.get("/", response_class=HTMLResponse)
def index():
    """Tiny landing page so opening the deployed URL shows something friendly."""
    return """<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tip Jar</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto;
           padding: 0 1rem; line-height: 1.5; color: #1a1a1a; }
    code { background: #f2f2f2; padding: 0.1rem 0.3rem; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>☕ Tip Jar</h1>
  <p>An embeddable "buy me a coffee" widget powered by Stripe.</p>
  <p>This is the Stage 0 barebones deploy. Health check lives at
     <code>/healthz</code>. The widget and payments arrive in later stages.</p>
</body>
</html>"""
