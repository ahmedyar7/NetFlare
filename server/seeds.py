"""seed.py — one-time fake data so development doesn't depend on API quota."""

import random
from db import init_db, upsert_attacks

CITIES = [
    (52.52, 13.40, "DE"),
    (35.68, 139.69, "JP"),
    (40.71, -74.00, "US"),
    (51.50, -0.12, "GB"),
    (55.75, 37.61, "RU"),
    (39.90, 116.40, "CN"),
    (-23.55, -46.63, "BR"),
    (28.61, 77.20, "IN"),
    (48.85, 2.35, "FR"),
    (1.35, 103.81, "SG"),
    (52.37, 4.89, "NL"),
    (41.00, 28.97, "TR"),
]

rows = []
for i in range(40):
    lat, lng, country = random.choice(CITIES)
    rows.append(
        {
            "ip": f"203.0.113.{i}",  # TEST-NET range, guaranteed fake
            "lat": lat + random.uniform(-1, 1),
            "lng": lng + random.uniform(-1, 1),
            "score": random.randint(75, 100),
            "country": country,
        }
    )

init_db()
new = upsert_attacks(rows)
print(f"Seeded {len(new)} fake attacks")
