"""Seed MongoDB Atlas with World Cup data and sample business profiles."""
import asyncio
import json
import os
from pathlib import Path
from datetime import datetime

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

DATA_FILE = Path(__file__).parent / "world_cup_data.json"


async def seed():
    client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    db = client[os.environ.get("MONGODB_DB", "matchday")]

    with open(DATA_FILE) as f:
        data = json.load(f)

    # Drop and re-seed collections
    for col in ["venues", "teams", "matches", "businesses", "campaigns", "analytics"]:
        await db[col].drop()

    await db.venues.insert_many(data["venues"])
    await db.teams.insert_many(data["teams"])
    await db.matches.insert_many(data["sample_matches"])

    # Sample businesses near venues
    businesses = [
        {
            "name": "Touchdown Tacos",
            "type": "restaurant",
            "cuisine": "Mexican",
            "venue_id": "v1",
            "city": "East Rutherford, NJ",
            "capacity": 120,
            "avg_daily_revenue": 4500,
            "owner_email": "demo@touchdowntacos.com",
            "created_at": datetime.utcnow(),
        },
        {
            "name": "The Pitch Bar & Grill",
            "type": "bar",
            "cuisine": "American",
            "venue_id": "v2",
            "city": "Inglewood, CA",
            "capacity": 200,
            "avg_daily_revenue": 8000,
            "owner_email": "demo@thepitch.com",
            "created_at": datetime.utcnow(),
        },
        {
            "name": "Azteca Souvenir Shop",
            "type": "retail",
            "cuisine": None,
            "venue_id": "v12",
            "city": "Mexico City, MX",
            "capacity": 50,
            "avg_daily_revenue": 3200,
            "owner_email": "demo@aztecashop.com",
            "created_at": datetime.utcnow(),
        },
    ]
    await db.businesses.insert_many(businesses)

    # Create vector search index on campaigns collection (Atlas Search)
    try:
        await db.command({
            "createSearchIndexes": "campaigns",
            "indexes": [{
                "name": "default",
                "definition": {
                    "mappings": {"dynamic": True}
                }
            }]
        })
    except Exception:
        pass  # Index may already exist

    print(f"Seeded: {len(data['venues'])} venues, {len(data['teams'])} teams, "
          f"{len(data['sample_matches'])} matches, {len(businesses)} businesses")
    client.close()


if __name__ == "__main__":
    asyncio.run(seed())
