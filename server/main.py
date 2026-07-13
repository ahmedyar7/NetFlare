"""main.py"""

import os
import random
import httpx
import geoip2.database
import geoip2.errors

from contextlib import asynccontextmanager
from fastapi import FastAPI
import uvicorn

import asyncio
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.schedulers.asyncio import AsyncIOScheduler


from dotenv import load_dotenv

load_dotenv()

import json
import time
from pathlib import Path

import sqlite3
from db import DB_FILE, init_db, upsert_attacks
from connection_manager import ConnectionManager

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
    Fetch the blacklisted IPs from the AbuseIPDB & geolocation each IP.
    runs every 10 minutes
    """

    global refresh_attack

    url = "https://api.abuseipdb.com/api/v2/blacklist"
    headers = {"Accept": "application/json", "Key": ABUSEIPDB_KEY}

    params = {"confidenceMinimum": 75, "limit": 50}

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(
                url=url,
                headers=headers,
                params=params,
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

    # --- STORE THE ABUSEIPDB IPS INTO THE JSON FORMAT ---- #

    # - REPLACED WITH THE SQLITE DB

    # attack_cache = results
    # CACHE_FILE.write_text(
    #     json.dumps(results)
    # )  # This would persist after the success...
    # print(f"Cache Refreshed: {len(attack_cache)} plottable IP(s)")


# --- Broadcaster: Drip feed queued event to all clients --- #
async def broadcaster():
    while True:
        event = await event_queue.get()
        await manager.broadcast(event)  # waiting till something is queued.
        await asyncio.sleep(random.uniform(2, 8))  # the live feel day.


def load_cache_or_fetch():
    """
    At Startup:
    1. Use the disk cache if it's fresh.
    2. Only hit the API if it's stale/missing
    """

    global attack_cache

    if CACHE_FILE.exists():
        age = time.time() - CACHE_FILE.stat().st_mtime

        if age < CACHE_MAX_AGE:
            attack_cache = json.loads(CACHE_FILE.read_text())

            print(
                f"Loaded {len(attack_cache)} IPs from disk cache ({age/60:.0f}) min old"
            )
            return

    refresh_attack()


# --- LifeSpan --- #


@asynccontextmanager
async def lifespan(app: FastAPI):

    init_db()

    # Only hit the API if the DB is empty (first ever run)
    with sqlite3.connect(DB_FILE) as conn:
        count = conn.execute("SELECT COUNT(*) FROM attacks").fetchone()[0]

    if count == 0:
        await refresh_attack()
    else:
        print(f"DB count {count} IPs, skipping startup fetch")

    scheduler = AsyncIOScheduler()
    scheduler.add_job(refresh_attack, "interval", hours=6)
    scheduler.start()

    broadcast_task = asyncio.create_task(broadcaster())
    yield

    broadcast_task.cancel()
    scheduler.shutdown()


    # --- NO NEED TO MANAULLY LOAD AND REFRESH THE CACHE --- #
    # load_cache_or_fetch()

    # scheduler = BackgroundScheduler()
    # scheduler.add_job(refresh_attack, "interval", hours=6)
    # scheduler.start()

    # yield
    # scheduler.shutdown()


app = FastAPI(title="NetFlare", lifespan=lifespan)


@app.get("/")
def home():
    return {"msg": "NetFlare Server side is running fine"}


@app.get("/attacks")
def get_attacks():
   
    with sqlite3.connect(DB_FILE) as conn:
        conn.row_factory = sqlite3.Row
        
        rows = conn.execute(
            "SELECT lat, lng, score, country FROM attacks"
            "ORDER BY last_seen DESC LIMIT 200"
        ).fetchall()
    
    return [dict(r) for r in rows]



if __name__ == "__main__":
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
