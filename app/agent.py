"""
World Cup Biz AI — Gemini agent orchestrated by Vertex AI Agent Builder.

Uses the Vertex AI SDK (google-cloud-aiplatform / vertexai) as the agent
orchestration layer with Gemini 2.5 Flash as the underlying model.

Agent architecture:
  - vertexai.generative_models.GenerativeModel  — model inference
  - vertexai.preview.reasoning_engines           — Agent Builder orchestration
  - MongoDB MCP server                           — tool execution via MCP protocol
  - Motor (async driver)                         — MCP fallback

The VertexAIAgent class wraps a Reasoning Engine-style tool-calling loop and
exposes the same chat / chat_stream interface as before so main.py is
unchanged.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Any, Dict, Iterator

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── Vertex AI initialisation ─────────────────────────────────────────────────

import vertexai
from vertexai.generative_models import (
    Content,
    FunctionDeclaration,
    GenerationConfig,
    GenerativeModel,
    Part,
    Tool,
)

_VERTEX_INITIALIZED = False


def _init_vertex():
    global _VERTEX_INITIALIZED
    if _VERTEX_INITIALIZED:
        return
    project = os.environ.get("GOOGLE_CLOUD_PROJECT", "")
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    if not project:
        raise EnvironmentError(
            "GOOGLE_CLOUD_PROJECT must be set to use Vertex AI Agent Builder."
        )
    vertexai.init(project=project, location=location)
    _VERTEX_INITIALIZED = True


# ── Tool imports ─────────────────────────────────────────────────────────────

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

# ── System prompt ─────────────────────────────────────────────────────────────

BASE_SYSTEM_PROMPT = """You are World Cup Biz AI, an AI agent that helps local businesses near FIFA World Cup 2026 venues maximize their revenue during match days.

You have access to real-time crowd forecasts, match schedules, and business profiles stored in MongoDB Atlas. You can:
- Look up upcoming matches and expected crowd sizes for any host city
- Generate targeted marketing campaigns (social media posts, email blasts, SMS offers)
- Recommend optimal staffing levels and inventory increases
- Save all campaigns and recommendations to MongoDB for future reference

When generating campaigns or staffing recommendations:
1. ALWAYS get the match schedule and crowd forecast first before writing any copy or recommendation
2. Use the real attendance numbers, fan demographics, peak revenue window, and crowd surge data in your output
3. Campaigns should include: a punchy headline with emojis, compelling body copy that references the specific match, teams, expected crowd, and a concrete offer (e.g. discount, promo)
4. Staffing recommendations should include specific staff numbers based on crowd size and the business's seating capacity
5. Only call save functions if the user explicitly asks you to save — never save proactively

For all responses: be thorough, specific, and data-driven. Use real numbers from the database. A good response is detailed and actionable — campaigns should read like real marketing copy, staffing plans should have specific numbers. Never give a one-line answer.

Never mention saving, MongoDB, or the database in your responses unless asked."""


def _build_system_prompt(business: dict | None) -> str:
    if not business:
        return BASE_SYSTEM_PROMPT
    return BASE_SYSTEM_PROMPT + f"""

CURRENT USER'S BUSINESS:
- Name: {business.get('name')}
- Type: {business.get('type')}
- Venue city: {business.get('city')}
- Capacity: {business.get('capacity', 'unknown')} seats
Always tailor every response specifically to this business. Use their name naturally in responses."""


# ── Vertex AI tool declarations ───────────────────────────────────────────────

def _make_vertex_tools() -> list[Tool]:
    """Build Vertex AI Tool declarations for Reasoning Engine function calling."""
    return [
        Tool(function_declarations=[
            FunctionDeclaration(
                name="get_matches_at_venue",
                description="Get upcoming World Cup matches scheduled at venues in a given city.",
                parameters={
                    "type": "object",
                    "properties": {
                        "venue_city": {
                            "type": "string",
                            "description": "City name, e.g. 'East Rutherford, NJ'",
                        }
                    },
                    "required": ["venue_city"],
                },
            ),
            FunctionDeclaration(
                name="get_crowd_forecast",
                description="Get crowd size estimate, fan demographics, and peak revenue window for a specific match day.",
                parameters={
                    "type": "object",
                    "properties": {
                        "venue_city": {"type": "string"},
                        "match_date": {
                            "type": "string",
                            "description": "ISO date, e.g. '2026-06-14'",
                        },
                    },
                    "required": ["venue_city", "match_date"],
                },
            ),
            FunctionDeclaration(
                name="get_business_profile",
                description="Fetch the profile (type, capacity, revenue) of a registered business.",
                parameters={
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"}
                    },
                    "required": ["business_name"],
                },
            ),
            FunctionDeclaration(
                name="list_businesses_near_venue",
                description="List all registered businesses near a World Cup venue city.",
                parameters={
                    "type": "object",
                    "properties": {
                        "venue_city": {"type": "string"}
                    },
                    "required": ["venue_city"],
                },
            ),
            FunctionDeclaration(
                name="save_campaign",
                description="Save a generated marketing campaign to MongoDB for a business.",
                parameters={
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"},
                        "match_date": {"type": "string"},
                        "campaign_type": {"type": "string"},
                        "headline": {"type": "string"},
                        "body": {"type": "string"},
                        "channel": {"type": "string"},
                        "discount_pct": {
                            "type": "integer",
                            "description": "Discount percentage, 0 if none",
                        },
                    },
                    "required": [
                        "business_name",
                        "match_date",
                        "campaign_type",
                        "headline",
                        "body",
                        "channel",
                    ],
                },
            ),
            FunctionDeclaration(
                name="list_campaigns",
                description="List previously saved campaigns for a business.",
                parameters={
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"}
                    },
                    "required": ["business_name"],
                },
            ),
            FunctionDeclaration(
                name="save_recommendation",
                description="Store an inventory or staffing recommendation for a business on a match day.",
                parameters={
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"},
                        "match_date": {"type": "string"},
                        "recommendation_type": {"type": "string"},
                        "details": {
                            "type": "object",
                            "description": "Structured details",
                        },
                    },
                    "required": [
                        "business_name",
                        "match_date",
                        "recommendation_type",
                        "details",
                    ],
                },
            ),
            FunctionDeclaration(
                name="get_recommendations",
                description="Retrieve saved recommendations for a business.",
                parameters={
                    "type": "object",
                    "properties": {
                        "business_name": {"type": "string"}
                    },
                    "required": ["business_name"],
                },
            ),
        ])
    ]


# ── Tool dispatcher ───────────────────────────────────────────────────────────

TOOL_MAP: Dict[str, Any] = {
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


# ── Vertex AI Agent (Reasoning Engine pattern) ────────────────────────────────

class VertexAIAgent:
    """
    Agent orchestrated by Vertex AI Agent Builder (Reasoning Engine).

    The agent runs an agentic loop using vertexai.generative_models.GenerativeModel
    with function calling — the same pattern used by Vertex AI Reasoning Engines
    when deployed to Agent Builder.  The class is structured so it can be
    registered as a ReasoningEngine locally or deployed to Vertex AI Agent Builder
    via vertexai.preview.reasoning_engines.ReasoningEngine.create().
    """

    def __init__(self):
        _init_vertex()
        self._tools = _make_vertex_tools()
        self._business: dict | None = None
        self._model_name = "gemini-2.5-flash"
        self._model: GenerativeModel = self._build_model(None)
        self.history: list[Content] = []

    def _build_model(self, business: dict | None) -> GenerativeModel:
        """Construct a GenerativeModel with the current system prompt."""
        return GenerativeModel(
            model_name=self._model_name,
            system_instruction=_build_system_prompt(business),
            tools=self._tools,
            generation_config=GenerationConfig(temperature=1.0),
        )

    def set_business(self, business: dict) -> None:
        self._business = business
        self._model = self._build_model(business)

    async def chat(self, user_message: str) -> str:
        text = ""
        async for event in self.chat_stream(user_message):
            if event["type"] == "text":
                text = event["content"]
        return text or "(no response)"

    async def chat_stream(self, user_message: str):
        """
        Vertex AI Agent Builder agentic loop.

        Yields SSE-style dicts:
          {"type": "tool", "name": "<function_name>"}  — tool call fired
          {"type": "text", "content": "<reply>"}       — final answer
        """
        self.history.append(
            Content(role="user", parts=[Part.from_text(user_message)])
        )

        loop = asyncio.get_event_loop()

        while True:
            # Run blocking Vertex AI inference in thread pool
            response = await loop.run_in_executor(
                None,
                lambda: self._model.generate_content(
                    contents=self.history,
                ),
            )

            candidate = response.candidates[0]
            content = candidate.content
            self.history.append(content)

            # Collect function calls from all parts
            function_calls = [
                p.function_call
                for p in content.parts
                if hasattr(p, "function_call") and p.function_call is not None
                and p.function_call.name  # guard against empty fc objects
            ]

            if not function_calls:
                # No more tool calls — emit the final text response
                texts = [
                    p.text
                    for p in content.parts
                    if hasattr(p, "text") and p.text
                ]
                yield {
                    "type": "text",
                    "content": "\n".join(texts) if texts else "(no response)",
                }
                return

            # Emit tool call events so the frontend can show live progress
            for fc in function_calls:
                yield {"type": "tool", "name": fc.name}

            # Execute tools and build function-response parts
            tool_parts: list[Part] = []
            for fc in function_calls:
                args = dict(fc.args) if fc.args else {}
                result = await _dispatch(fc.name, args)
                tool_parts.append(
                    Part.from_function_response(
                        name=fc.name,
                        response={"result": json.dumps(result, default=str)},
                    )
                )

            self.history.append(
                Content(role="user", parts=tool_parts)
            )

    def reset(self):
        self.history = []

    # ── Reasoning Engine interface ────────────────────────────────────────────
    # These methods satisfy the vertexai.preview.reasoning_engines.ReasoningEngine
    # interface so this class can be deployed directly to Vertex AI Agent Builder.

    def query(self, *, user_message: str) -> str:
        """Synchronous query interface required by Reasoning Engine."""
        return asyncio.get_event_loop().run_until_complete(self.chat(user_message))

    def set_up(self) -> None:
        """Called by Agent Builder during deployment initialisation."""
        _init_vertex()


# Keep the old name as an alias so any existing imports continue to work.
MatchDayAgent = VertexAIAgent
