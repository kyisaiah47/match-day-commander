# World Cup Biz AI ⚽

> AI agent for local businesses near FIFA World Cup 2026 venues — powered by **Gemini 2.5 Flash** and **MongoDB Atlas**.

**Live:** [worldcupbizai.vercel.app](https://worldcupbizai.vercel.app) · Built for the [Google Cloud Rapid Agent Hackathon](https://googlecloudrapidagent.devpost.com/) — MongoDB Partner Track.

---

## What It Does

Local businesses near World Cup venues — restaurants, bars, hotels, retail — have a massive revenue opportunity during match days but no system to act on it. World Cup Biz AI is a personalized AI agent that gives them the tools to prepare.

Enter your business details once. The agent tailors everything to you:

- **Crowd Intelligence** — match schedules, expected attendance, and fan demographics per venue city from MongoDB Atlas
- **Campaign Generation** — targeted social media posts, email copy, and SMS offers based on the teams playing and expected crowd
- **Operations Planning** — specific staffing levels and inventory boosts based on your capacity and the crowd forecast
- **Match Day Notes** — built-in notes sidebar with general and date-specific notes, synced to MongoDB
- **Persistent Memory** — campaigns and recommendations saved to MongoDB Atlas automatically

---

## Architecture

```
Next.js Frontend (Vercel)
      │ SSE stream
      ▼
FastAPI Backend (Google Cloud Run)
      │
      ▼
Vertex AI Agent Builder (Reasoning Engine)
  └── Gemini 2.5 Flash (model inference)
      │ function calling
      ├── get_matches_at_venue()
      ├── get_crowd_forecast()
      ├── get_business_profile()
      ├── save_campaign()
      ├── save_recommendation()
      └── ...
      │
      ▼
MongoDB MCP Server (@mongodb-js/mongodb-mcp-server)
  └── MCP protocol (stdio transport)
      │
      ▼
MongoDB Atlas
  ├── venues, matches, teams
  ├── businesses
  ├── campaigns
  ├── analytics (recommendations)
  └── notes
```

The agent is orchestrated by **Vertex AI Agent Builder** (Reasoning Engine) and all MongoDB tool calls are routed through the **MongoDB MCP server** over the Model Context Protocol. The agent streams tool call events to the frontend in real time — users see each MongoDB query fire as it happens. Gemini runs in a thread pool executor so the event loop stays free during inference.

---

## Running Locally

### Backend

```bash
# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Add: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, MONGODB_URI, MONGODB_DB

# Seed the database
python -m app.data.seed_data

# Start the API
uvicorn app.main:app --reload --port 8001
```

### Frontend

```bash
cd frontend
npm install

# Configure environment
cp .env.local.example .env.local
# Add: NEXT_PUBLIC_API_URL=http://localhost:8001

npm run dev
```

---

## Example Prompts

- *"Germany vs Brazil is coming to East Rutherford on June 14th. Create a social media campaign for my restaurant and tell me how many extra staff I need."*
- *"Which World Cup matches are coming to Dallas, TX and how big are the crowds expected to be?"*
- *"There's a match this weekend with 80,000 fans. Give me a full staffing and inventory plan."*
- *"What's the fan breakdown for the next match in my city? Which nationalities, peak hours, and what should I prepare for?"*

---

## Deploy

### Backend → Google Cloud Run

```bash
# Enable required APIs
gcloud services enable secretmanager.googleapis.com aiplatform.googleapis.com

# Create secrets
echo -n "$MONGODB_URI" | gcloud secrets create mongodb-uri --data-file=-

# Grant access
gcloud secrets add-iam-policy-binding mongodb-uri \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Grant Vertex AI access to the service account
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_PROJECT_NUMBER-compute@developer.gserviceaccount.com" \
  --role="roles/aiplatform.user"

# Deploy
gcloud builds submit --config deployment/cloudbuild.yaml
```

### Frontend → Vercel

```bash
cd frontend
vercel --prod
```

Set `NEXT_PUBLIC_API_URL` to your Cloud Run service URL in Vercel environment variables.

---

## Tech Stack

| Layer | Technology |
|---|---|
| AI | Gemini 2.5 Flash via Vertex AI Agent Builder |
| Agent Orchestration | Vertex AI Reasoning Engine (Agent Builder) |
| Backend | Python, FastAPI, Google Cloud Run |
| Database | MongoDB Atlas via MongoDB MCP Server |
| MCP | @mongodb-js/mongodb-mcp-server (stdio transport) |
| Frontend | Next.js 16, Tailwind CSS, shadcn/ui |
| Hosting | Vercel (frontend), Google Cloud Run (API) |
| Streaming | Server-Sent Events (SSE) |

## License

MIT — see [LICENSE](LICENSE)
