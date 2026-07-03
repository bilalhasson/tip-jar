"""Database engine + schema bootstrap (infrastructure only).

Postgres in production (Railway's DATABASE_URL), SQLite locally.
"""

from sqlmodel import SQLModel, create_engine

from app import config

# Import models so their tables register on SQLModel.metadata before create_all.
from app import models  # noqa: F401

_url = config.DATABASE_URL or f"sqlite:///{config.BASE_DIR / 'db.sqlite3'}"

# SQLAlchemy 2 requires the postgresql:// scheme; Railway usually provides it,
# but older-style postgres:// URLs need normalising.
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

_connect_args = {"check_same_thread": False} if _url.startswith("sqlite") else {}

engine = create_engine(_url, connect_args=_connect_args)


def create_db_and_tables() -> None:
    """Create the single Tip table if it doesn't exist. Called on app startup."""
    SQLModel.metadata.create_all(engine)
