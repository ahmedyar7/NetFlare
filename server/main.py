"""main.py"""

import os
import random
import httpx
import geoip2.database
import geoip2.errors

from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler


from dotenv import load_dotenv

load_dotenv()

import json
import time
from pathlib import Path

import sqlite3

from db import DB_FILE, init_db, upsert_attacks, load_trends, init_trends_table
from connection_manager import ConnectionManager

from radar import refresh_trends

# Queueing the new events waiting to be drip fed to the new client.
event_queue: asyncio.Queue = asyncio.Queue()


manager = ConnectionManager()


# --- Saving the Cache --- #

CACHE_FILE = Path("./data/attack_cache.json")
CACHE_MAX_AGE = 6 * 60 * 60  # 6 hrs in sec format

# --- Environment Variables --- #

ABUSEIPDB_KEY = os.environ["ABUSEIPDB_KEY"]
DB_PATH = "./data/GeoLite2-City.mmdb"


# Module level cache this is what the endpoint serves.
attack_cache: list[dict] = []


async def refresh_attack():
    """
    This function is responsible for two things
    1. Getting the IPs from the AbuseIPDB Client
       - Getting the
       + ip
       + lat
       + lng
       + score
       + country_code

       - These information is then upserted into the upsert_attack
       Sqlite local database

    2. Then the geospatial features like
    - lat
    - lng
    are then used for the mapping them to the react.globe.js
    """

    URL = "https://api.abuseipdb.com/api/v2/blacklist"
    HEADERS = {"Accept": "application/json", "Key": ABUSEIPDB_KEY}

    PARAMS = {"confidenceMinimum": 75, "limit": 50}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url=URL,
                headers=HEADERS,
                params=PARAMS,
            )

            response.raise_for_status()
            ip_list = response.json()["data"]

    except Exception as e:
        print(f"Fetch failed keeping the old cache {e}")
        return

    results = []

    with geoip2.database.Reader(DB_PATH) as reader:
        for item in ip_list:
            try:
                geo = reader.city(item["ipAddress"])
            except geoip2.errors.AddressNotFoundError:
                continue

            if geo.location.latitude is None:
                continue  # This means that you can't plot it on a globe

            results.append(
                {
                    "ip": item["ipAddress"],
                    "lat": geo.location.latitude,
                    "lng": geo.location.longitude,
                    "score": item["abuseConfidenceScore"],
                    "country": geo.country.iso_code or "??",
                }
            )

    new_rows = upsert_attacks(results)
    print(f"Refresh Done: {len(results)} IPs processed, {len(new_rows)} news")

    for row in new_rows:
        await event_queue.put(row)


# --- Broadcaster: Drip feed queued event to all clients --- #
async def broadcaster():
    try:
        while True:
            event = await event_queue.get()
            await manager.broadcast(event)
            await asyncio.sleep(random.uniform(2, 8))

    except asyncio.CancelledError:
        print(f"[Broadcaster] Shutdown signal received. Cleaning up gracefully...")

    finally:
        print(f"[BROADCASTER] offline...")


async def replay_random_attack():

    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()

        # getting the max and min row_ids
        cursor.execute("SELECT MIN(rowid), MAX(rowid) from attacks")
        min_id, max_id = cursor.fetchone()

        # if table empty then exit
        if min_id is None or max_id is None:
            return

        # picking a random number
        target_id = random.randint(min_id, max_id)

        # using >= to return intermidate rows rather than exact rows
        row = cursor.execute(
            """
            SELECT ip, lat, lng, score, country FROM attacks
            WHERE rowid >= ?
            LIMIT 1
        """,
            (target_id,),
        ).fetchone()

        if not row:
            row = cursor.execute(
                "SELECT ip, lat, lng, score, country FROM attacks LIMIT 1"
            ).fetchone()

        if row:
            await event_queue.put(dict(row))


# --- LifeSpan --- #


@asynccontextmanager
async def lifespan(app: FastAPI):

    init_db()

    init_trends_table()

    # fetch trends at startup if we've never fetched (or data is stale)
    if not load_trends():
        await refresh_trends()

    # Calling the along side the job

    # Only hit the API if the DB is empty (first ever run)
    with sqlite3.connect(DB_FILE) as conn:
        count = conn.execute("SELECT COUNT(*) FROM attacks").fetchone()[0]

    if count == 0:
        await refresh_attack()
    else:
        print(f"DB count {count} IPs, skipping startup fetch")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_trends, "interval", hours=1)
    scheduler.add_job(refresh_attack, "interval", hours=6)
    scheduler.add_job(replay_random_attack, "interval", seconds=3)
    scheduler.start()

    broadcast_task = asyncio.create_task(broadcaster())
    yield

    broadcast_task.cancel()
    scheduler.shutdown()


app = FastAPI(title="NetFlare", lifespan=lifespan)

# Comma-separated list of allowed origins, e.g.
# "http://localhost:5173,https://your-app.vercel.app"
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS],
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- API ENDPONTS --- #


@app.get("/")
def home():
    return {"msg": "NetFlare Server side is running fine"}


@app.get("/debug/fake")
async def fake_event():

    await event_queue.put(
        {
            "ip": "1.2.3.4",
            "lat": random.uniform(-60, 70),
            "lng": random.uniform(-180, 180),
            "score": random.uniform(75, 100),
            "country": "XX",
        }
    )

    return {"queued": True}


@app.get("/attacks")
def get_attacks():

    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row

        rows = conn.execute("""
            SELECT lat, lng, score, country
            FROM attacks
            ORDER BY last_seen DESC
            LIMIT 200
        """).fetchall()

    return [dict(r) for r in rows]


@app.get("/trends")
def get_trends():
    return load_trends()


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)

    try:
        while True:
            await ws.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(ws)


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    reload = os.environ.get("RELOAD", "true").lower() == "true"
    uvicorn.run("main:app", host=host, port=port, reload=reload)
