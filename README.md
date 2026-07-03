# ☕ Tip Jar

An embeddable "buy me a coffee" widget powered by **Stripe Checkout**. Drop a
single `<script>` tag onto any website and let visitors send a one-off tip — no
framework required on the host page.

- **Hosted Stripe Checkout** — the browser is redirected to Stripe's own payment
  page; raw card data never touches this backend (minimal PCI scope).
- **Webhook as source of truth** — a tip is only recorded once Stripe's
  signed `checkout.session.completed` event is verified, not on the redirect.
- **Stripe test mode** throughout.

## Status

🚧 **Stage 0 — barebones deploy.** FastAPI app with a landing page and
`/healthz`, deployed to Railway to prove the pipeline. Widget, checkout, and
webhook land in later stages (see `../plans/tip-jar.md`).

## Run locally

```bash
cd tip-jar
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Then open http://localhost:8000 and http://localhost:8000/healthz

## Deploy (Railway)

Push to GitHub, then in Railway: **New Project → Deploy from GitHub repo**.
Nixpacks auto-detects Python and runs the `Procfile`. Generate a domain under
**Settings → Networking**.

## Tech

FastAPI · uvicorn · Stripe Checkout · Railway (Nixpacks). Python 3.12.
