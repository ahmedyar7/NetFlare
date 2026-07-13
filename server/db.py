"""db.py

This file contain the code regarding:
1. Initialization of the SQLite DB.
2. Upserts the attack rows to the database.

"""

import sqlite3
from pathlib import Path

DB_FILE = Path("./data/netflare.db")


def init_db():

    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("""

            CREATE TABLE IF NOT EXIST attacks(
                ip TEXT PRIMARY_KEY,
                lat REAL, lng REAL,
                score INTEGER,
                country TEXT,
                first_seen TEXT DEFAULT (datetime('now')),
                last_seen TEXT DEFAULT (datetime('now')),   
            )

        """)


def upsert_attacks(rows: list[dict]) -> list[dict]:
    """
    Inserts/updates rows.
    Return only the NEWS ones (first time seen)
    """

    new_rows = []

    with sqlite3.connect(DB_FILE) as conn:
        for r in rows:
            existing = conn.execute(
                "SELECT 1 FROM attacks WHERE ip = ?", (r["ip"])
            ).fetchone()

            if existing:
                conn.execute(
                    "UPDATE attacks SET score=?, last_seen=datatime('now') WHERE ip=?",
                    (r["score"], r["ip"]),
                )

            else:
                conn.execute(
                    "INSERT INTO attacks (ip, lat, lng, score, country)",
                    (r["ip"], r["lat"], r["lng"], r["score"], r["country"]),
                )

                new_rows.append(r)

    return new_rows
