"""
Agent tools backed by MongoDB Atlas.

All tool calls are routed through the MongoDB MCP server
(@mongodb-js/mongodb-mcp-server) via the MCP protocol.  If the MCP server is
unavailable (Node.js / npx not present, or mcp package not installed), calls
fall back to the direct Motor async driver so the application still works in
all environments.
"""
import os
import re
from datetime import datetime
from typing import Any, Dict, List, Optional

from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

from app.tools.mcp_mongodb import (
    mcp_find,
    mcp_find_one,
    mcp_insert_one,
    mcp_update_one,
)

load_dotenv()

_client: Optional[AsyncIOMotorClient] = None


def _db():
    """Return the Motor database (used as fallback when MCP is unavailable)."""
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(os.environ["MONGODB_URI"])
    return _client[os.environ.get("MONGODB_DB", "matchday")]


# ── Helpers ───────────────────────────────────────────────────────────────────

def _regex_filter(field: str, value: str) -> dict:
    """Build a case-insensitive regex filter dict."""
    return {field: {"$regex": value, "$options": "i"}}


# ── Match & venue queries ────────────────────────────────────────────────────

async def get_matches_at_venue(venue_city: str) -> List[dict]:
    """Return upcoming matches at venues in a given city."""
    # --- MCP path ---
    venues = await mcp_find(
        "venues",
        _regex_filter("city", venue_city),
        projection={"_id": 0},
    )
    if venues is None:
        # MCP unavailable — fall back to Motor
        db = _db()
        venues = await db.venues.find(
            {"city": {"$regex": venue_city, "$options": "i"}},
            {"_id": 0},
        ).to_list(None)

    if not venues:
        return []

    venue_ids = [v["id"] for v in venues]
    venue_map = {v["id"]: v for v in venues}

    # --- MCP path ---
    matches = await mcp_find(
        "matches",
        {"venue_id": {"$in": venue_ids}},
        projection={"_id": 0},
        sort={"date": 1},
    )
    if matches is None:
        db = _db()
        matches = await db.matches.find(
            {"venue_id": {"$in": venue_ids}},
            {"_id": 0},
        ).sort("date", 1).to_list(None)

    for m in matches:
        m["venue"] = venue_map.get(m["venue_id"], {}).get("name", "Unknown")
    return matches


async def get_crowd_forecast(venue_city: str, match_date: str) -> dict:
    """Estimate crowd size and fan demographics for a match day."""
    # --- MCP path ---
    venue = await mcp_find_one(
        "venues",
        _regex_filter("city", venue_city),
        projection={"_id": 0},
    )
    if venue is None:
        db = _db()
        venue = await db.venues.find_one(
            {"city": {"$regex": venue_city, "$options": "i"}},
            {"_id": 0},
        )

    if not venue:
        return {"error": f"No venue found in {venue_city}"}

    match = await mcp_find_one(
        "matches",
        {"venue_id": venue["id"], "date": match_date},
        projection={"_id": 0},
    )
    if match is None:
        db = _db()
        match = await db.matches.find_one(
            {"venue_id": venue["id"], "date": match_date},
            {"_id": 0},
        )

    if not match:
        return {"error": f"No match on {match_date} at {venue['name']}"}

    home_team = await mcp_find_one("teams", {"name": match.get("home")}, projection={"_id": 0})
    if home_team is None:
        db = _db()
        home_team = await db.teams.find_one({"name": match.get("home")}, {"_id": 0})

    away_team = await mcp_find_one("teams", {"name": match.get("away")}, projection={"_id": 0})
    if away_team is None:
        db = _db()
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
    biz = await mcp_find_one(
        "businesses",
        _regex_filter("name", business_name),
        projection={"_id": 0},
    )
    if biz is None:
        db = _db()
        biz = await db.businesses.find_one(
            {"name": {"$regex": business_name, "$options": "i"}},
            {"_id": 0},
        )
    return biz or {"error": f"Business '{business_name}' not found"}


async def list_businesses_near_venue(venue_city: str) -> List[dict]:
    """List all registered businesses near a venue city."""
    venue = await mcp_find_one(
        "venues",
        _regex_filter("city", venue_city),
        projection={"_id": 0},
    )
    if venue is None:
        db = _db()
        venue = await db.venues.find_one(
            {"city": {"$regex": venue_city, "$options": "i"}},
            {"_id": 0},
        )
    if not venue:
        return []

    businesses = await mcp_find(
        "businesses",
        {"venue_id": venue["id"]},
        projection={"_id": 0},
    )
    if businesses is None:
        db = _db()
        businesses = await db.businesses.find(
            {"venue_id": venue["id"]},
            {"_id": 0},
        ).to_list(None)
    return businesses or []


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

    result = await mcp_insert_one("campaigns", doc)
    if result is None:
        db = _db()
        inserted = await db.campaigns.insert_one(dict(doc))
        doc["campaign_id"] = str(inserted.inserted_id)
        doc.pop("_id", None)
        return doc

    doc["campaign_id"] = result.get("insertedId", "")
    doc.pop("_id", None)
    return doc


async def list_campaigns(business_name: str) -> List[dict]:
    """List all campaigns saved for a business."""
    docs = await mcp_find(
        "campaigns",
        _regex_filter("business_name", business_name),
        projection={"_id": 0},
        sort={"created_at": -1},
        limit=20,
    )
    if docs is None:
        db = _db()
        docs = await db.campaigns.find(
            {"business_name": {"$regex": business_name, "$options": "i"}},
            {"_id": 0},
        ).sort("created_at", -1).to_list(20)
    return docs or []


# ── Inventory & staffing recommendations ────────────────────────────────────

async def save_recommendation(
    business_name: str,
    match_date: str,
    recommendation_type: str,
    details: Dict[str, Any],
) -> dict:
    """Store an inventory or staffing recommendation."""
    doc = {
        "business_name": business_name,
        "match_date": match_date,
        "recommendation_type": recommendation_type,
        "details": details,
        "created_at": datetime.utcnow().isoformat(),
    }

    result = await mcp_insert_one("analytics", doc)
    if result is None:
        db = _db()
        inserted = await db.analytics.insert_one(dict(doc))
        doc["recommendation_id"] = str(inserted.inserted_id)
        doc.pop("_id", None)
        return doc

    doc["recommendation_id"] = result.get("insertedId", "")
    doc.pop("_id", None)
    return doc


async def get_recommendations(business_name: str) -> List[dict]:
    """Retrieve stored recommendations for a business."""
    docs = await mcp_find(
        "analytics",
        _regex_filter("business_name", business_name),
        projection={"_id": 0},
        sort={"created_at": -1},
        limit=20,
    )
    if docs is None:
        db = _db()
        docs = await db.analytics.find(
            {"business_name": {"$regex": business_name, "$options": "i"}},
            {"_id": 0},
        ).sort("created_at", -1).to_list(20)
    return docs or []
