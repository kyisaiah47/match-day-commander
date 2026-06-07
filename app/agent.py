"""
Match Day Commander — Gemini agent with MongoDB-backed tools.

Uses google-genai SDK with function calling to orchestrate multi-step tasks:
  1. Query match schedules & crowd forecasts from MongoDB
  2. Generate targeted marketing campaigns
  3. Produce inventory / staffing recommendations
  4. Persist everything back to MongoDB Atlas
"""
import json
import os
from typing import Any, Dict

from google import genai
from google.genai import types
from dotenv import load_dotenv

from app.tools.mongodb_tools import (
    get_matches_at_venue,
    get_crowd_forecast,
    get_business_profile,
    list_businesses_near_venue,
    save_campaign,
    list_campaigns,
    save_recommendation,
    get_recommendations,
)

load_dotenv()

SYSTEM_PROMPT = """You are Match Day Commander, an AI agent that helps local businesses near FIFA World Cup 2026 venues maximize their revenue during match days.

You have access to real-time crowd forecasts, match schedules, and business profiles stored in MongoDB Atlas. You can:
- Look up upcoming matches and expected crowd sizes for any host city
- Generate targeted marketing campaigns (social media posts, email blasts, SMS offers)
- Recommend optimal staffing levels and inventory increases
- Save all campaigns and recommendations to MongoDB for future reference

When a user asks about a city or business, proactively:
1. Check what matches are coming up at nearby venues
2. Get crowd forecasts for those dates
3. Generate specific, actionable recommendations
4. Save campaigns/recommendations to the database

Be specific, data-driven, and actionable. Always cite the expected attendance numbers and timing windows."""


# ── Tool definitions using google-genai types ────────────────────────────────

def _make_tools() -> list[types.Tool]:
    return [
        types.Tool(function_declarations=[
            types.FunctionDeclaration(
                name="get_matches_at_venue",
                description="Get upcoming World Cup matches scheduled at venues in a given city.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "venue_city": types.Schema(type=types.Type.STRING, description="City name, e.g. 'East Rutherford, NJ'")
                    },
                    required=["venue_city"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_crowd_forecast",
                description="Get crowd size estimate, fan demographics, and peak revenue window for a specific match day.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "venue_city": types.Schema(type=types.Type.STRING),
                        "match_date": types.Schema(type=types.Type.STRING, description="ISO date, e.g. '2026-06-14'"),
                    },
                    required=["venue_city", "match_date"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_business_profile",
                description="Fetch the profile (type, capacity, revenue) of a registered business.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "business_name": types.Schema(type=types.Type.STRING)
                    },
                    required=["business_name"],
                ),
            ),
            types.FunctionDeclaration(
                name="list_businesses_near_venue",
                description="List all registered businesses near a World Cup venue city.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "venue_city": types.Schema(type=types.Type.STRING)
                    },
                    required=["venue_city"],
                ),
            ),
            types.FunctionDeclaration(
                name="save_campaign",
                description="Save a generated marketing campaign to MongoDB for a business.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "business_name": types.Schema(type=types.Type.STRING),
                        "match_date": types.Schema(type=types.Type.STRING),
                        "campaign_type": types.Schema(type=types.Type.STRING),
                        "headline": types.Schema(type=types.Type.STRING),
                        "body": types.Schema(type=types.Type.STRING),
                        "channel": types.Schema(type=types.Type.STRING),
                        "discount_pct": types.Schema(type=types.Type.INTEGER, description="Discount percentage, 0 if none"),
                    },
                    required=["business_name", "match_date", "campaign_type", "headline", "body", "channel"],
                ),
            ),
            types.FunctionDeclaration(
                name="list_campaigns",
                description="List previously saved campaigns for a business.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "business_name": types.Schema(type=types.Type.STRING)
                    },
                    required=["business_name"],
                ),
            ),
            types.FunctionDeclaration(
                name="save_recommendation",
                description="Store an inventory or staffing recommendation for a business on a match day.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "business_name": types.Schema(type=types.Type.STRING),
                        "match_date": types.Schema(type=types.Type.STRING),
                        "recommendation_type": types.Schema(type=types.Type.STRING),
                        "details": types.Schema(type=types.Type.OBJECT, description="Structured details"),
                    },
                    required=["business_name", "match_date", "recommendation_type", "details"],
                ),
            ),
            types.FunctionDeclaration(
                name="get_recommendations",
                description="Retrieve saved recommendations for a business.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "business_name": types.Schema(type=types.Type.STRING)
                    },
                    required=["business_name"],
                ),
            ),
        ])
    ]


# ── Tool dispatcher ───────────────────────────────────────────────────────────

TOOL_MAP = {
    "get_matches_at_venue": get_matches_at_venue,
    "get_crowd_forecast": get_crowd_forecast,
    "get_business_profile": get_business_profile,
    "list_businesses_near_venue": list_businesses_near_venue,
    "save_campaign": save_campaign,
    "list_campaigns": list_campaigns,
    "save_recommendation": save_recommendation,
    "get_recommendations": get_recommendations,
}


async def _dispatch(tool_name: str, args: Dict[str, Any]) -> Any:
    fn = TOOL_MAP.get(tool_name)
    if fn is None:
        return {"error": f"Unknown tool: {tool_name}"}
    return await fn(**args)


# ── Agent ─────────────────────────────────────────────────────────────────────

class MatchDayAgent:
    def __init__(self):
        self._client = genai.Client(api_key=os.environ["GOOGLE_API_KEY"])
        self._tools = _make_tools()
        self._config = types.GenerateContentConfig(
            system_instruction=SYSTEM_PROMPT,
            tools=self._tools,
        )
        self.history: list[types.Content] = []

    async def chat(self, user_message: str) -> str:
        self.history.append(types.Content(
            role="user",
            parts=[types.Part(text=user_message)],
        ))

        while True:
            response = self._client.models.generate_content(
                model="gemini-2.0-flash",
                contents=self.history,
                config=self._config,
            )

            candidate = response.candidates[0]
            content = candidate.content
            self.history.append(content)

            function_calls = [
                p.function_call
                for p in content.parts
                if p.function_call is not None
            ]

            if not function_calls:
                texts = [p.text for p in content.parts if p.text]
                return "\n".join(texts) if texts else "(no response)"

            # Execute tools and feed results back
            tool_parts = []
            for fc in function_calls:
                args = dict(fc.args) if fc.args else {}
                result = await _dispatch(fc.name, args)
                tool_parts.append(types.Part(
                    function_response=types.FunctionResponse(
                        name=fc.name,
                        response={"result": json.dumps(result, default=str)},
                    )
                ))

            self.history.append(types.Content(role="user", parts=tool_parts))

    def reset(self):
        self.history = []
