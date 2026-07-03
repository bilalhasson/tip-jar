"""Tip Jar — an embeddable 'buy me a coffee' widget with Stripe.

App setup and route handlers only. Stripe/business logic lives in
`app.stripe_client`; request models in `app.schemas`; page markup in templates/.
"""

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse

from app import config, stripe_client
from app.schemas import CheckoutRequest

stripe_client.configure()

app = FastAPI(title="Tip Jar", docs_url=None, redoc_url=None)

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
def create_checkout_session(req: CheckoutRequest, request: Request):
    try:
        url = stripe_client.create_checkout_session(
            req.amount, req.creator, req.message, base_url(request)
        )
    except stripe_client.InvalidAmount as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except stripe_client.CheckoutError:
        raise HTTPException(status_code=502, detail="Could not create checkout session.")
    return {"url": url}


@app.get("/widget.js")
def widget_js():
    return FileResponse(config.STATIC_DIR / "widget.js", media_type="application/javascript")


@app.get("/demo.html", response_class=HTMLResponse)
def demo():
    return FileResponse(config.STATIC_DIR / "demo.html")


@app.get("/success", response_class=HTMLResponse)
def success():
    return FileResponse(config.TEMPLATES_DIR / "success.html")


@app.get("/cancel", response_class=HTMLResponse)
def cancel():
    return FileResponse(config.TEMPLATES_DIR / "cancel.html")


@app.get("/", response_class=HTMLResponse)
def index():
    return FileResponse(config.TEMPLATES_DIR / "index.html")
