"""Read-only CLI to list recorded tips. Not a dashboard — just a way to confirm
the webhook is persisting tips.

Usage (from the project root):
    python scripts/show_tips.py          # local SQLite
    railway run python scripts/show_tips.py   # against Railway Postgres
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # make `app` importable

from sqlmodel import Session, select

from app.db import create_db_and_tables, engine
from app.models import Tip


def main() -> None:
    create_db_and_tables()  # no-op if the table already exists; lets this run standalone
    with Session(engine) as db:
        tips = db.exec(select(Tip).order_by(Tip.created_at.desc())).all()

    if not tips:
        print("No tips recorded yet.")
        return

    total = sum(t.amount for t in tips)
    print(f"{len(tips)} tip(s), total {total / 100:.2f} {tips[0].currency.upper()}\n")
    for t in tips:
        when = t.created_at.strftime("%Y-%m-%d %H:%M")
        line = f"  {when}  {t.amount / 100:>8.2f} {t.currency.upper()}"
        if t.creator:
            line += f"  → {t.creator}"
        if t.message:
            line += f'  "{t.message}"'
        print(line)


if __name__ == "__main__":
    main()
