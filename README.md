# Space Heritage Explorer

Space Heritage Explorer is an interactive digital platform that discovers and preserves human-made objects left behind on the Moon and Mars. Using NASA's open data, interactive 3D maps, historical timelines, a gamified learning section, and an AI-powered Space Historian, users can explore abandoned spacecraft, rovers, scientific instruments, and the stories behind humanity's space exploration missions.

**Goal:** preserve space heritage and inspire future explorers.

Built for the NASA Space Apps Challenge 2026.

---

## Features

### Website
- **Home page** with sign-up and sign-in
- **Two roles:** normal users and admins (admins manage sync, knowledge graph, and evaluation tools)
- **Moon page:** interactive 3D Moon showing objects left by astronauts and missions, plus key events
- **Mars page:** interactive 3D Mars showing landers, rovers, and mission events
- **Explorer page:** users read mission information, then play quizzes across multiple levels and earn scores
- **Space Historian:** AI chatbot with per-user saved chat history
- **Moon Mission:** Experience the virtual Journey towards Moon
### Space Historian (RAG chatbot)
- **Multi-agency sources:** indexes NASA, ISRO, and ESA web pages, PDFs, the NASA Image Library, and APOD
- **Hybrid search:** pgvector semantic search combined with full-text keyword search on Neon, merged by rank fusion
- **Metadata filtering:** filter by organisation, mission (Apollo 11, Chandrayaan-3, and others), and publication date
- **Comparison handling:** "X vs Y" questions are split into one retrieval per mission or agency
- **Trusted citations:** only cites HTTPS pages on nasa.gov, isro.gov.in, and esa.int
- **Citation checking:** uses `[SOURCE n]` markers, strips invalid ones, and reports uncited sentences
- **Optional reranking:** Gemini can score and reorder passages (currently off for speed)
- **Multi-agent research:** a planner, NASA/ISRO/ESA specialist agents, a reviewer that finds agreements and contradictions, and a synthesizer
- **Knowledge graph and timeline:** extracts facts and dates from text, with grounding checks against hallucination
- **Version tracking:** old chunks are marked superseded, not deleted, and changes are logged
- **Scheduled sync:** a daily cron job, protected by a database lock so syncs never overlap
- **Resilient Gemini calls:** retries, model fallback, cooldowns, and a busy-state reply that still lists sources
- **Evaluation harness:** measures retrieval hit rate, citation coverage, fact recall, and hallucination rate
- **Security basics:** admin-token protection on sync, graph, and eval endpoints, plus per-IP rate limits

---

## Tech Stack

| Layer | Technology |
|---|---|
| Front end | React |
| 3D rendering | [Add your 3D library, e.g. Three.js / react-three-fiber] |
| Back end | FastAPI (Python) |
| Database | PostgreSQL on Neon with pgvector |
| AI | Google Gemini API |
| Hosting | [Add your hosting platform] |

---

## Data Sources

**NASA**
- NASA web pages: https://www.nasa.gov/
- NASA Image and Video Library: https://images.nasa.gov/
- Astronomy Picture of the Day (APOD): https://apod.nasa.gov/apod/
- NASA Open APIs: https://api.nasa.gov/

**Other space agencies**
- ISRO: https://www.isro.gov.in/
- ESA: https://www.esa.int/

---

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.10+
- A Neon PostgreSQL database with the `pgvector` extension enabled
- A Google Gemini API key

### Back end
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # then fill in the values below
uvicorn main:app --reload
```

### Front end
```bash
cd frontend
npm install
npm run dev
```

### Environment variables
```
use .env.example available in both frontend and backend
```


---

## Security
- Admin-token protection on sync, graph, and evaluation endpoints
- Per-IP rate limits
- Citations restricted to trusted HTTPS domains

---


## 🧠 Use of Super Intelligence (SI)

This project was built with the assistance of AI tools, including **OpenAI ChatGPT** and **Anthropic Claude**.

- **Code:** Generated with AI assistance using ChatGPT and Claude.
- **Text and Content:** Generated with AI assistance using ChatGPT and Claude.
- **Images / 3D Assets:** Website Logo is generated using ChatGPT
- **In-app AI:** The Space Historian uses the Google Gemini API to generate answers from retrieved, cited sources.

> ⚠️ No NASA logos, flags, or mission identifiers were generated or modified using AI.

---

## Acknowledgments
- NASA, ISRO, and ESA for their open data and public resources
- NASA Space Apps Challenge

## License
- MIT
