# Match Day Commander ⚽

> AI agent for local businesses near FIFA World Cup 2026 venues — powered by **Gemini** and **MongoDB Atlas**.

Built for the [Google Cloud Rapid Agent Hackathon](https://googlecloudrapidagent.devpost.com/) — **MongoDB Partner Track**.

## What It Does

Match Day Commander is a multi-step AI agent that helps brick-and-mortar businesses maximize revenue on World Cup match days. Instead of just answering questions, it executes tasks:

1. **Crowd Intelligence** — queries MongoDB Atlas for match schedules, expected attendance, and fan demographic breakdowns per venue city
2. **Campaign Generation** — creates targeted social media posts, email copy, and SMS offers tailored to the teams playing and expected crowd size
3. **Operations Planning** — recommends specific staffing levels and inventory increases based on crowd forecast data
4. **Persistent Memory** — saves all campaigns and recommendations to MongoDB Atlas for retrieval and tracking

## Architecture

```
Browser UI (HTML/JS)
      │ POST /api/chat
      ▼
FastAPI Server (app/main.py)
      │
      ▼
MatchDayAgent (app/agent.py)
  ├── Gemini 2.0 Flash (function calling)
  └── MongoDB Tools (app/tools/mongodb_tools.py)
        └── MongoDB Atlas (venues, matches, teams, businesses, campaigns)
```

**Partner Integration:** MongoDB Atlas is used as the agent's persistent memory layer. The agent reads match and venue data, writes campaigns and recommendations, and retrieves history — all via async Motor (MongoDB async Python driver) calls wired as Gemini function-calling tools.

## Quick Start

### 1. Clone & install
```bash
git clone https://github.com/your-username/match-day-commander
cd match-day-commander
pip install -r requirements.txt
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your API keys
```

You need:
- `GOOGLE_API_KEY` — [Google AI Studio](https://aistudio.google.com/app/apikey)
- `MONGODB_URI` — [MongoDB Atlas](https://cloud.mongodb.com) free tier (M0) connection string

### 3. Seed the database
```bash
python -m app.data.seed_data
```

### 4. Run
```bash
uvicorn app.main:app --reload
```

Open `http://localhost:8000`

## Example Prompts

- *"What matches are coming to East Rutherford, NJ?"*
- *"Create a social media campaign for Touchdown Tacos on June 14th"*
- *"How should The Pitch Bar staff up for the Germany vs Spain match?"*
- *"What's the crowd forecast for Inglewood on June 20th?"*
- *"List all campaigns I've saved for Touchdown Tacos"*

## Deploy to Google Cloud Run

```bash
# Set secrets in Secret Manager first
gcloud secrets create google-api-key --data-file=- <<< "$GOOGLE_API_KEY"
gcloud secrets create mongodb-uri --data-file=- <<< "$MONGODB_URI"

# Deploy
gcloud builds submit --config deployment/cloudbuild.yaml
```

## License

MIT — see [LICENSE](LICENSE)
