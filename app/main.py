"""FastAPI server — serves the chat UI and agent API."""
import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv

from app.agent import MatchDayAgent

load_dotenv()

app = FastAPI(title="Match Day Commander")
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


@app.get("/", response_class=HTMLResponse)
async def index():
    html = (STATIC / "index.html").read_text()
    return HTMLResponse(html)


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


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": "gemini-2.0-flash"}
