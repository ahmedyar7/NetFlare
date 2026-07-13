"""fetch.py
This file is created only for testing and not related to the project itself
"""

import requests
import geoip2.database
import geoip2.errors

import os
from dotenv import load_dotenv

load_dotenv()


ABUSEIPDB_KEY = os.environ["ABUSEIPDB_KEY"]
DB_PATH = "./data/GeoLite2-City.mmdb"


def fetch_malicious_ips():
    """Fetchs heavily reported IPs from AbuseIPDB"""

    url = "https://api.abuseipdb.com/api/v2/blacklist"
    headers = {"Accept": "application/json", "Key": ABUSEIPDB_KEY}
    params = {"confidenceMinimum": 75, "limit": 50}

    response = requests.get(url, headers=headers, params=params)
    response.raise_for_status()

    return response.json()["data"]


def main():

    print("Fetching the blacklisted IPS...")

    blacklisted_ips = fetch_malicious_ips()

    print(
        f"Loaded: {len(blacklisted_ips)} IPs, that are running over offline geolocations"
    )

    # Open the local maxmind database
    with geoip2.database.Reader(DB_PATH) as reader:
        for item in blacklisted_ips:
            ip = item["ipAddress"]
            score = item["abuseConfidenceScore"]

            try:
                # Performing the offline reader lookup
                geo_data = reader.city(ip)

                country = geo_data.country.iso_code or "unknown"
                lat = geo_data.location.latitude
                lon = geo_data.location.longitude

                print(f"{ip} -> {country} | Score: {score} | Coords: ({lat},{lon})")

            except geoip2.errors.AddressNotFoundError:
                print(f"{ip}-> Location not found in local database")


if __name__ == "__main__":
    main()
