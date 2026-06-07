"""Agent tools backed by MongoDB Atlas — called by Gemini via function calling."""
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv()

_client: Optional[AsyncIOMotorClient] = None


def _db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    return _client[os.environ.get("MONGODB_DB", "matchday")]


# ── Match & venue queries ────────────────────────────────────────────────────

async def get_matches_at_venue(venue_city: str) -> List[dict]:
    """Return upcoming matches at venues in a given city."""
    db = _db()
    venues = await db.venues.find(
        {"city": {"$regex": venue_city, "$options": "i"}},
        {"_id": 0}
    ).to_list(None)
    if not venues:
        return []
    venue_ids = [v["id"] for v in venues]
    matches = await db.matches.find(
        {"venue_id": {"$in": venue_ids}},
        {"_id": 0}
    ).sort("date", 1).to_list(None)
    # Attach venue name
    venue_map = {v["id"]: v for v in venues}
    for m in matches:
        m["venue"] = venue_map.get(m["venue_id"], {}).get("name", "Unknown")
    return matches


async def get_crowd_forecast(venue_city: str, match_date: str) -> dict:
    """Estimate crowd size and fan demographics for a match day."""
    db = _db()
    venue = await db.venues.find_one(
        {"city": {"$regex": venue_city, "$options": "i"}},
        {"_id": 0}
    )
    if not venue:
        return {"error": f"No venue found in {venue_city}"}

    match = await db.matches.find_one(
        {"venue_id": venue["id"], "date": match_date},
        {"_id": 0}
    )
    if not match:
        return {"error": f"No match on {match_date} at {venue['name']}"}

    home_team = await db.teams.find_one({"name": match.get("home")}, {"_id": 0})
    away_team = await db.teams.find_one({"name": match.get("away")}, {"_id": 0})

    home_fans = (home_team or {}).get("expected_travel", 10000)
    away_fans = (away_team or {}).get("expected_travel", 10000)
    total = match.get("expected_attendance", 60000)
    surge_radius_km = 3

    return {
        "venue": venue["name"],
        "city": venue_city,
        "match_date": match_date,
        "match": f"{match['home']} vs {match['away']}",
        "stage": match.get("stage", "Group Stage"),
        "expected_attendance": total,
        "home_team_fans": home_fans,
        "away_team_fans": away_fans,
        "pre_match_crowd_surge": f"{surge_radius_km}km radius, ~{int(total * 0.4)} people 3 hrs before kickoff",
        "post_match_crowd": f"~{int(total * 0.6)} dispersing over 2 hrs",
        "peak_revenue_window": "2 hours before kickoff to 1 hour after",
    }


# ── Business queries ─────────────────────────────────────────────────────────

async def get_business_profile(business_name: str) -> dict:
    """Fetch a registered business profile."""
    db = _db()
    biz = await db.businesses.find_one(
        {"name": {"$regex": business_name, "$options": "i"}},
        {"_id": 0}
    )
    return biz or {"error": f"Business '{business_name}' not found"}


async def list_businesses_near_venue(venue_city: str) -> List[dict]:
    """List all registered businesses near a venue city."""
    db = _db()
    venue = await db.venues.find_one(
        {"city": {"$regex": venue_city, "$options": "i"}},
        {"_id": 0}
    )
    if not venue:
        return []
    return await db.businesses.find(
        {"venue_id": venue["id"]},
        {"_id": 0}
    ).to_list(None)


# ── Campaign management ───────────────────────────────────────────────────────

async def save_campaign(
    business_name: str,
    match_date: str,
    campaign_type: str,
    headline: str,
    body: str,
    channel: str,
    discount_pct: int = 0,
) -> dict:
    """Persist a generated marketing campaign to MongoDB."""
    db = _db()
    doc = {
        "business_name": business_name,
        "match_date": match_date,
        "campaign_type": campaign_type,
        "headline": headline,
        "body": body,
        "channel": channel,
        "discount_pct": discount_pct,
        "status": "draft",
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.campaigns.insert_one(doc)
    doc["campaign_id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


async def list_campaigns(business_name: str) -> List[dict]:
    """List all campaigns saved for a business."""
    db = _db()
    docs = await db.campaigns.find(
        {"business_name": {"$regex": business_name, "$options": "i"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
    return docs


# ── Inventory & staffing recommendations ────────────────────────────────────

async def save_recommendation(
    business_name: str,
    match_date: str,
    recommendation_type: str,
    details: Dict[str, Any],
) -> dict:
    """Store an inventory or staffing recommendation."""
    db = _db()
    doc = {
        "business_name": business_name,
        "match_date": match_date,
        "recommendation_type": recommendation_type,
        "details": details,
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.analytics.insert_one(doc)
    doc["recommendation_id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


async def get_recommendations(business_name: str) -> List[dict]:
    """Retrieve stored recommendations for a business."""
    db = _db()
    return await db.analytics.find(
        {"business_name": {"$regex": business_name, "$options": "i"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(20)
