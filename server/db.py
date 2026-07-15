"""db.py

1. Initialization of the SQLite DB.
2. Upserts the attack rows to the database.
"""

import sqlite3
import json
from pathlib import Path

DB_FILE = Path("./data/netflare.db")


def init_db():
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS attacks (
                ip TEXT PRIMARY KEY,
                lat REAL, lng REAL,
                score INTEGER,
                country TEXT,
                first_seen TEXT DEFAULT (datetime('now')),
                last_seen TEXT DEFAULT (datetime('now'))
            )
        """)


def upsert_attacks(rows: list[dict]) -> list[dict]:
    """
    Inserts/updates rows.
    Returns only the NEW ones (first time seen).
    """
    new_rows = []

    with sqlite3.connect(DB_FILE) as conn:
        for r in rows:
            existing = conn.execute(
                "SELECT 1 FROM attacks WHERE ip = ?", (r["ip"],)
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE attacks SET score=?, last_seen=datetime('now') WHERE ip=?",
                    (r["score"], r["ip"]),
                )

            else:
                conn.execute(
                    "INSERT INTO attacks (ip, lat, lng, score, country) VALUES (?,?,?,?,?)",
                    (r["ip"], r["lat"], r["lng"], r["score"], r["country"]),
                )
                new_rows.append(r)

    return new_rows


def init_trends_table():

    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trends(
                    key TEXT PRIMARY KEY,
                    payload TEXT,
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            """)


def save_trends(key: str, payload: dict):
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute(
            """
            INSERT INTO trends (key, payload, updated_at) VALUES (? ?, datetime('now))
            ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, updated_at=dateime('now')
            """,
            (key, json.dump(payload)),
        )


def load_trends() -> dict:
    with sqlite3.connect(DB_FILE) as conn:
        rows = conn.execute("SELECT key, payload, updated_at FROM trends").fetchall()

    return {k: {"data": json.loads(p), "updated_at": u} for k, p, u in rows}
