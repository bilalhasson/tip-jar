"""Tip Jar — an embeddable 'buy me a coffee' widget with Stripe.

App setup and route handlers only. Stripe/business logic lives in
`app.stripe_client`; request models in `app.schemas`; page markup in templates/.
"""

from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app import config, db, stripe_client, tips
from app.schemas import CheckoutRequest


def _scrub_event(event, hint):
    """Strict scrubbing before an event leaves the process: drop the query string
    (e.g. ?session_id=...) from the request context. Combined with
    send_default_pii=False + include_local_variables=False, this keeps request
    bodies, IPs, cookies, frame locals, and the tip message out of Sentry."""
    req = event.get("request")
    if isinstance(req, dict):
        req.pop("query_string", None)
        url = req.get("url")
        if isinstance(url, str):
            req["url"] = url.split("?", 1)[0]
    return event


# Optional error monitoring — no-op unless SENTRY_DSN is set. Strict privacy:
# no PII, no local variables, no request body, and query strings scrubbed.
if config.SENTRY_DSN:
    sentry_sdk.init(
        dsn=config.SENTRY_DSN,
        environment=config.ENVIRONMENT,
        release=config.RELEASE or None,
        traces_sample_rate=0.0,
        send_default_pii=False,
        include_local_variables=False,
        max_request_body_size="never",
        before_send=_scrub_event,
    )

stripe_client.configure()
templates = Jinja2Templates(directory=config.TEMPLATES_DIR)


def client_ip(request: Request) -> str:
    """Real client IP — Railway sits behind a proxy, so prefer X-Forwarded-For."""
    xff = request.headers.get("x-forwarded-for")
    return xff.split(",")[0].strip() if xff else get_remote_address(request)


limiter = Limiter(key_func=client_ip)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.create_db_and_tables()
    yield


app = FastAPI(title="Tip Jar", docs_url=None, redoc_url=None, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# The widget is embedded on arbitrary third-party sites, so the browser makes a
# cross-origin POST to /create-checkout-session. No cookies/credentials are used,
# so a wildcard origin is safe here.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


def base_url(request: Request) -> str:
    """Absolute origin used for success/cancel URLs — configured value wins,
    otherwise fall back to the incoming request's base URL."""
    return config.PUBLIC_BASE_URL or str(request.base_url).rstrip("/")


@app.get("/healthz")
def healthz():
    return {"status": "ok"}


@app.post("/create-checkout-session")
@limiter.limit(
    lambda: config.RATE_LIMIT
)  # callable → re-read per request (and overridable in tests)
def create_checkout_session(req: CheckoutRequest, request: Request):
    try:
        url = stripe_client.create_checkout_session(
            req.amount, req.creator, req.message, base_url(request)
        )
    except stripe_client.InvalidAmount as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except stripe_client.CheckoutError as exc:
        raise HTTPException(status_code=502, detail="Could not create checkout session.") from exc
    return {"url": url}


@app.post("/stripe-webhook")
async def stripe_webhook(request: Request):
    payload = await request.body()  # raw body is required for signature verification
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe_client.construct_webhook_event(payload, sig)
    except stripe_client.InvalidSignature as exc:
        raise HTTPException(status_code=400, detail="Invalid signature") from exc
    tips.handle_event(event)
    return {"received": True}  # ack promptly; the webhook is the source of truth


@app.get("/widget.js")
def widget_js():
    return FileResponse(config.STATIC_DIR / "widget.js", media_type="application/javascript")


@app.get("/favicon.ico")
def favicon():
    return FileResponse(config.STATIC_DIR / "favicon.ico", media_type="image/x-icon")


@app.get("/favicon.png")
def favicon_png():
    return FileResponse(config.STATIC_DIR / "favicon.png", media_type="image/png")


@app.get("/apple-touch-icon.png")
def apple_touch_icon():
    return FileResponse(config.STATIC_DIR / "apple-touch-icon.png", media_type="image/png")


@app.get("/og-image.png")
def og_image():
    return FileResponse(config.STATIC_DIR / "og-image.png", media_type="image/png")


@app.get("/success", response_class=HTMLResponse)
def success(request: Request, session_id: str | None = None):
    summary = stripe_client.get_checkout_summary(session_id)
    return templates.TemplateResponse(request, "success.html", {"summary": summary})


@app.get("/cancel", response_class=HTMLResponse)
def cancel():
    return FileResponse(config.TEMPLATES_DIR / "cancel.html")


@app.get("/", response_class=HTMLResponse)
def index():
    return FileResponse(config.TEMPLATES_DIR / "index.html")


# Demo pages (placement + API showcases). html=True serves index.html for /demos/.
app.mount("/demos", StaticFiles(directory=config.STATIC_DIR / "demos", html=True), name="demos")
