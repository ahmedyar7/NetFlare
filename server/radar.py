"""radar.py
Fetches CloudFlare radar attack trends attack data.
"""

import os
import httpx
from db import save_trends

CLOUDFLARE_TOKEN = os.environ["CLOUDFLARE_TOKEN"]
BASE = "https://api.cloudflare.com/client/v4/radar"

ENDPOINTS = {
    "l7_timeseries": f"{BASE}/attacks/layer7/timeseries?dateRange=1d&aggInterval=1h",
    "l7_top_origin": f"{BASE}/attacks/layer7/top/locations/origin?dateRange=1d&limit=10",
    "l7_top_target": f"{BASE}/attacks/layer7/top/locations/target?dateRange=1d&limit=10",
}


async def refresh_trends():
    """
    This function asynchronolsly fetches trends from the Cloudflare.com
    and the store them into local SQLite Database
    """

    headers = {"Authorization": f"Bearer {CLOUDFLARE_TOKEN}"}

    async with httpx.AsyncClient(timeout=30, headers=headers) as client:

        for key, url in ENDPOINTS.items():

            try:
                res = await client.get(url)
                res.raise_for_status()
                body = res.json()

                if not body.get("success"):
                    print(f"Radar: {key} returned success=false: {body.get('errors')}")
                    continue

                save_trends(key, body["result"])
                print(f"Radar {key} refreshed...")

            except Exception as e:
                print(f"Radar {key} failed: ", e)
