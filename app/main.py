"""FastAPI server — serves the chat UI and agent API."""
import json
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from app.agent import MatchDayAgent

load_dotenv()

app = FastAPI(title="Match Day Commander")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC = Path(__file__).parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC)), name="static")

# One agent per session (simple in-memory; extend with Redis for multi-user)
_agents: dict[str, MatchDayAgent] = {}


def _get_agent(session_id: str) -> MatchDayAgent:
    if session_id not in _agents:
        _agents[session_id] = MatchDayAgent()
    return _agents[session_id]


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"


class ResetRequest(BaseModel):
    session_id: str = "default"


class SetupRequest(BaseModel):
    session_id: str = "default"
    name: str
    type: str
    city: str
    capacity: str = ""


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (STATIC / "index.html").read_text()
    return HTMLResponse(html)


@app.post("/api/setup")
async def setup(req: SetupRequest):
    business = {"name": req.name, "type": req.type, "city": req.city, "capacity": req.capacity}
    agent = _get_agent(req.session_id)
    agent.set_business(business)
    return JSONResponse({"status": "ok", "business": business})


@app.post("/api/chat")
async def chat(req: ChatRequest):
    agent = _get_agent(req.session_id)
    reply = await agent.chat(req.message)
    return JSONResponse({"reply": reply})


@app.post("/api/reset")
async def reset(req: ResetRequest):
    agent = _get_agent(req.session_id)
    agent.reset()
    return JSONResponse({"status": "ok"})


@app.post("/api/chat/stream")
async def chat_stream(req: ChatRequest):
    agent = _get_agent(req.session_id)

    async def event_gen():
        async for event in agent.chat_stream(req.message):
            yield f"data: {json.dumps(event)}\n\n"
        yield 'data: {"type":"done"}\n\n'

    return StreamingResponse(
        event_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


class NotesRequest(BaseModel):
    user_id: str
    general: str | None = None
    date: str | None = None      # ISO date e.g. "2026-06-14"
    dated_content: str | None = None


@app.post("/api/notes")
async def save_notes(req: NotesRequest):
    from app.tools.mongodb_tools import _db
    db = _db()
    update: dict = {"updated_at": __import__("datetime").datetime.utcnow().isoformat()}
    if req.general is not None:
        update["general"] = req.general
    if req.date and req.dated_content is not None:
        update[f"dated.{req.date}"] = req.dated_content
    await db.notes.update_one({"user_id": req.user_id}, {"$set": update}, upsert=True)
    return JSONResponse({"status": "ok"})


@app.get("/api/notes")
async def get_notes(user_id: str):
    from app.tools.mongodb_tools import _db
    db = _db()
    doc = await db.notes.find_one({"user_id": user_id}, {"_id": 0})
    return JSONResponse({
        "general": doc.get("general", "") if doc else "",
        "dated": doc.get("dated", {}) if doc else {},
    })


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "gemini-2.5-flash"}
