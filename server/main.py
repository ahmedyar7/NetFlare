"""main.py"""

import os
import random
import httpx
import geoip2.database
import geoip2.errors

from contextlib import asynccontextmanager, closing

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

import asyncio
from apscheduler.schedulers.asyncio import AsyncIOScheduler


from dotenv import load_dotenv

load_dotenv()

from pathlib import Path

import sqlite3

from db import DB_FILE, init_db, upsert_attacks, load_trends, init_trends_table
from connection_manager import ConnectionManager

from radar import refresh_trends

# Queueing the new events waiting to be drip fed to the new client.
# Bounded: the broadcaster drains slowly by design, so an unbounded queue would
# grow without limit. A refresh burst (50 rows) fits comfortably under the cap.
event_queue: asyncio.Queue = asyncio.Queue(maxsize=100)


def queue_event(event: dict) -> bool:
    """
    Non-blocking enqueue. Returns False if the queue is saturated.

    These events are ambient visuals, so shedding one beats blocking a
    scheduler job or letting the backlog grow unbounded.
    """
    try:
        event_queue.put_nowait(event)
        return True

    except asyncio.QueueFull:
        return False


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

    dropped = sum(1 for row in new_rows if not queue_event(row))

    if dropped:
        print(f"Refresh: queue saturated, dropped {dropped} of {len(new_rows)} new rows")


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

    with closing(sqlite3.connect(DB_FILE)) as conn:
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
            queue_event(dict(row))


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
    with closing(sqlite3.connect(DB_FILE)) as conn:
        count = conn.execute("SELECT COUNT(*) FROM attacks").fetchone()[0]

    if count == 0:
        await refresh_attack()
    else:
        print(f"DB count {count} IPs, skipping startup fetch")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_trends, "interval", hours=1)
    scheduler.add_job(refresh_attack, "interval", hours=6)
    # 6s stays just below the broadcaster's ~5s mean drain rate, so replays
    # top the queue up without ever outrunning it.
    scheduler.add_job(replay_random_attack, "interval", seconds=6)
    scheduler.start()

    broadcast_task = asyncio.create_task(broadcaster())
    yield

    broadcast_task.cancel()
    scheduler.shutdown()


app = FastAPI(title="NetFlare", lifespan=lifespan)

# Comma-separated list of allowed origins, e.g.
# "http://localhost:5173,https://your-app.vercel.app"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

# Debug helpers inject events into every connected client, so they stay off
# unless explicitly switched on.
ENABLE_DEBUG_ROUTES = os.environ.get("ENABLE_DEBUG_ROUTES", "false").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- API ENDPONTS --- #


@app.get("/")
def home():
    return {"msg": "NetFlare Server side is running fine"}


if ENABLE_DEBUG_ROUTES:

    @app.get("/debug/fake")
    async def fake_event():

        queued = queue_event(
            {
                "ip": "1.2.3.4",
                "lat": random.uniform(-60, 70),
                "lng": random.uniform(-180, 180),
                "score": random.uniform(75, 100),
                "country": "XX",
            }
        )

        return {"queued": queued}


@app.get("/attacks")
def get_attacks():

    with closing(sqlite3.connect(DB_FILE)) as conn:
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

    # CORSMiddleware only covers HTTP, so the same origin allowlist has to be
    # enforced here by hand. Non-browser clients send no Origin header.
    origin = ws.headers.get("origin")

    if origin is not None and "*" not in ALLOWED_ORIGINS and origin not in ALLOWED_ORIGINS:
        await ws.close(code=1008)
        return

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
