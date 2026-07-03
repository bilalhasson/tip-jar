"""Environment-driven config. Values come from Railway env vars in prod and a
gitignored .env locally. Never hardcode secrets here.
"""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()  # loads .env in local dev; a no-op in prod where Railway sets vars

# --- Paths (single source of truth for static/template locations) ---
BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"
TEMPLATES_DIR = BASE_DIR / "templates"

# --- Stripe ---
STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
# Pin the API version so Stripe's behaviour stays stable across their releases.
STRIPE_API_VERSION = "2026-06-24.dahlia"

# --- Database ---
# Railway injects DATABASE_URL for its Postgres plugin; locally we fall back to
# a SQLite file (see app.db).
DATABASE_URL = os.environ.get("DATABASE_URL", "")

# --- Tips ---
CURRENCY = os.environ.get("CURRENCY", "gbp").lower()
# Guardrails, in whole currency units (e.g. pounds). Server-enforced.
MIN_TIP = int(os.environ.get("MIN_TIP", "1"))
MAX_TIP = int(os.environ.get("MAX_TIP", "500"))

# --- URLs ---
# Absolute base used to build success/cancel URLs. Prefer an explicit override,
# then Railway's injected public domain, else fall back to the request's own
# base URL at call time (see app.main.base_url).
_railway_domain = os.environ.get("RAILWAY_PUBLIC_DOMAIN")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL") or (
    f"https://{_railway_domain}" if _railway_domain else ""
)
