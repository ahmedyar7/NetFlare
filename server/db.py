"""db.py

1. Initialization of the SQLite DB.
2. Upserts the attack rows to the database.
"""

import sqlite3
import json
from contextlib import closing
from pathlib import Path

DB_FILE = Path("./data/netflare.db")

# `with sqlite3.connect(...)` commits the transaction but leaves the connection
# open, so every call leaked a handle. closing() closes it; the inner `conn`
# keeps the commit-on-success behaviour for writes.


def init_db():
    with closing(sqlite3.connect(DB_FILE)) as conn, conn:
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

    with closing(sqlite3.connect(DB_FILE)) as conn, conn:
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

    with closing(sqlite3.connect(DB_FILE)) as conn, conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS trends(
                    key TEXT PRIMARY KEY,
                    payload TEXT,
                    updated_at TEXT DEFAULT (datetime('now'))
                )
            """)


def save_trends(key: str, payload: dict):
    """
    This function takes the clan JSON from the radar.py -> refresh_trends
    and the stores them into SQLite Local Database into sync from.

    UPSERTS into the Trends Tables
    - key
    - payload (json data)
    - datenow (current date)
    """

    with closing(sqlite3.connect(DB_FILE)) as conn, conn:
        conn.execute(
            """
            INSERT INTO trends (key, payload, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET payload=excluded.payload, updated_at=datetime('now')
            """,
            (key, json.dumps(payload)),
        )


def load_trends() -> dict:
    """
    This function fetches the trends from the sqlite database
    the trends are from refresh_trends in radar.py
    """
    
    with closing(sqlite3.connect(DB_FILE)) as conn:
        rows = conn.execute("SELECT key, payload, updated_at FROM trends").fetchall()

    return {k: {"data": json.loads(p), "updated_at": u} for k, p, u in rows}
