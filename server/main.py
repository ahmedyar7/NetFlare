import os
import httpx
import geoip2.database
import geoip2.errors

from contextlib import asynccontextmanager
from fastapi import FastAPI

from apscheduler.schedulers.background import BackgroundScheduler
from dotenv import load_dotenv

load_dotenv()


ABUSEIPDB_KEY = os.environ["ABUSEIPDB_KEY"]
DB_PATH = "./data/GeoLite2-City.mmdb"


# Module level cache this is what the endpoint serves.
attack_cache: list[dict] = []


def refresh_attack():
    """
    Fetch the blacklisted IPs from the AbuseIPDB & geolocation each IP.
    runs every 10 minutes
    """

    url = "https://api.abuseipdb.com/api/v2/blacklist"
    headers = {"Accept": "application/json", "Key": ABUSEIPDB_KEY}

    params = {"confidenceMinimum": 75, "limit": 10}

    try:
        response = httpx.get(url, headers=headers, params=params, timeout=30)
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
                return

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

    attack_cache = results
    print(f"Cache Refreshed: {len(attack_cache)} plottable IP(s)")


