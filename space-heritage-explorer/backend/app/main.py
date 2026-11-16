"""Run: uvicorn main:app --reload --port 8000
Install: pip install fastapi uvicorn httpx python-dotenv "psycopg[binary]" pgvector \
         beautifulsoup4 google-genai apscheduler pydantic pypdf
NASA Image and Video Library (images-api.nasa.gov) needs no API key.
Admin endpoints (sync, graph extract, eval) require the ADMIN_API_TOKEN env var.
"""
from dotenv import load_dotenv

load_dotenv()  # must run BEFORE importing app.* modules (they read env vars at import time)

import logging
import os
import threading
from contextlib import asynccontextmanager
from functools import lru_cache
from .chat_history import router as history_router
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.auth import init_auth_tables, router as auth_router
from app.nasa_rag import (
    init_database,
    router as nasa_rag_router,
    run_sync,
    shutdown_scheduler,
    start_scheduler,
)
from app.space_agents import router as agents_router
from app.space_eval import router as eval_router
from app.space_graph import init_graph, router as graph_router

logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
logger = logging.getLogger("moon_mars_api")

SYNC_ON_STARTUP = os.getenv("SYNC_ON_STARTUP", "false").lower() == "true"
CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]


def _safe_startup_sync() -> None:
    try:
        result = run_sync("startup")  # uses the DB lock, so it never overlaps another sync
        logger.info("Startup sync: %s - %s", result.status, result.message)
    except Exception:
        logger.exception("Startup sync failed")


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not os.getenv("ADMIN_API_TOKEN"):
        logger.warning("ADMIN_API_TOKEN is not set: /sync, /graph/extract and /eval endpoints are disabled")
    if CORS_ORIGINS == ["*"]:
        logger.warning("CORS_ORIGINS is '*'. Set it to your frontend origin(s) before deploying")
    try:
        init_auth_tables()     # users + per-user chat tables
        init_database()        # creates/upgrades RAG tables (safe to repeat)
        init_graph()           # knowledge-graph tables
        start_scheduler()      # cron job from SYNC_CRON (default: daily 03:00 UTC)
        if SYNC_ON_STARTUP:
            threading.Thread(target=_safe_startup_sync, daemon=True).start()
    except Exception:
        logger.exception("Space RAG startup failed; the Moon Relics API will still start")
    yield
    shutdown_scheduler()


app = FastAPI(title="Moon Relics API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],  # includes Authorization (Bearer token)
)
app.include_router(auth_router)
app.include_router(history_router)
app.include_router(nasa_rag_router)
app.include_router(graph_router)
app.include_router(agents_router)
app.include_router(eval_router)

# lat/lon in degrees (east positive). `model` picks the 3D object in the frontend.
SITES = [
    {
        "id": "apollo11", "name": "Apollo 11 – Tranquility Base", "year": 1969,
        "lat": 0.674, "lon": 23.473, "model": "lm", "query": "Apollo 11 lunar module Eagle descent stage",
        "object": "Eagle descent stage",
        "story": [
            "On July 20, 1969, Neil Armstrong and Buzz Aldrin landed the lunar module Eagle in the Sea of Tranquility.",
            "When it was time to leave, only the top half, the ascent stage, lifted off. The gold-foil descent stage stayed behind and became the launch pad.",
            "It still stands there today, along with a flag, a plaque reading 'We came in peace for all mankind', and bags of discarded gear.",
        ],
    },
    {
        "id": "apollo12", "name": "Apollo 12 – Surveyor 3", "year": 1969,
        "lat": -3.01, "lon": -23.42, "model": "surveyor", "query": "Apollo 12 Surveyor 3 Conrad",
        "object": "Surveyor 3 probe",
        "story": [
            "Apollo 12 landed just 160 m from Surveyor 3, a robotic probe sent to the Moon in 1967.",
            "Pete Conrad and Alan Bean walked over and cut off its camera and parts of its tubing, bringing them home to study how materials aged in space.",
            "The rest of Surveyor 3 is still sitting in its crater.",
        ],
    },
    {
        "id": "apollo14", "name": "Apollo 14 – Fra Mauro", "year": 1971,
        "lat": -3.65, "lon": -17.47, "model": "cart", "query": "Apollo 14 Modular Equipment Transporter",
        "object": "Modular Equipment Transporter (MET)",
        "story": [
            "Alan Shepard and Edgar Mitchell used a two-wheeled cart, the MET, to haul tools and rock samples across Fra Mauro.",
            "Shepard also hit two golf balls with a makeshift club. They are still out there.",
            "The cart was left on the surface when the crew departed.",
        ],
    },
    {
        "id": "apollo15", "name": "Apollo 15 – Hadley Rille", "year": 1971,
        "lat": 26.13, "lon": 3.63, "model": "rover", "query": "Apollo 15 Lunar Roving Vehicle Scott",
        "object": "Lunar Roving Vehicle",
        "story": [
            "Apollo 15 was the first mission to drive on the Moon. David Scott and James Irwin covered about 28 km in the Lunar Roving Vehicle.",
            "The electric rover could carry two astronauts and a load of samples.",
            "At the end of the last drive, Scott parked it facing the TV camera so Earth could watch liftoff. It was never driven again.",
        ],
    },
    {
        "id": "apollo16", "name": "Apollo 16 – Descartes Highlands", "year": 1972,
        "lat": -8.97, "lon": 15.50, "model": "alsep", "query": "Apollo 16 Descartes Duke Young ALSEP",
        "object": "Science station (ALSEP)",
        "story": [
            "In April 1972 John Young and Charles Duke landed in the Descartes Highlands, the first mission to explore the Moon's rugged mountains.",
            "They set up a science station, the ALSEP, to measure moonquakes, heat flow and magnetic fields, and drove the rover for about 27 km.",
            "Duke left a photo of his family on the surface. The station kept sending data to Earth until 1977.",
        ],
    },
    {
        "id": "apollo17", "name": "Apollo 17 – Taurus-Littrow", "year": 1972,
        "lat": 20.19, "lon": 30.77, "model": "flag", "query": "Apollo 17 Taurus-Littrow flag Cernan Schmitt",
        "object": "Flag and rover",
        "story": [
            "Apollo 17 was the last crewed mission to the Moon. Gene Cernan and Harrison Schmitt spent three days in Taurus-Littrow valley.",
            "They left a plaque on the descent stage that says humans would return in peace.",
            "Their rover, flag and equipment remain where they were parked in December 1972.",
        ],
    },
    {"id": "chandrayaan3", "pin": "CH3", "kind": "other", "country": "India", "name": "Chandrayaan-3 – Shiv Shakti Point", "year": 2023, "lat": -69.373, "lon": 32.319, "model": "lander", "object": "Vikram lander and Pragyan rover", "query": "Chandrayaan-3 Vikram lander LRO", "story": ["On 23 August 2023, India's Vikram lander touched down about 600 km from the Moon's south pole. India became the fourth country to soft-land on the Moon and the first to land near the south polar region.", "The Pragyan rover rolled out and drove about 100 m, testing the soil with onboard instruments. Its results confirmed sulfur in the polar soil.", "On 3 September the lander made a small hop of 30–40 cm, then both machines were put to sleep. The site was named Statio Shiv Shakti by the IAU in 2024."], "left": ["Vikram lander", "Pragyan rover", "Tracks left by the rover"]},
    {"id": "lunokhod1", "pin": "L1", "kind": "other", "country": "Soviet Union", "name": "Luna 17 – Lunokhod 1", "year": 1970, "lat": 38.316, "lon": -35.005, "model": "lunokhod", "object": "Lunokhod 1 rover", "query": "Lunokhod 1 Luna 17 rover", "story": ["On 17 November 1970 the Soviet Luna 17 landed in northwest Mare Imbrium and released Lunokhod 1, the first robotic rover to drive on another world.", "Controlled from Earth, it worked for 322 days and covered about 10.5 km.", "It is still parked there, together with the Luna 17 landing stage."], "left": ["Lunokhod 1 rover", "Luna 17 landing stage", "Laser reflector"]},
    {"id": "lunokhod2", "pin": "L2", "kind": "other", "country": "Soviet Union", "name": "Luna 21 – Lunokhod 2", "year": 1973, "lat": 25.832, "lon": 30.92, "model": "lunokhod", "object": "Lunokhod 2 rover", "query": "Lunokhod 2 Luna 21 Le Monnier", "story": ["Luna 21 landed on 15 January 1973 inside Le Monnier crater, on the edge of Mare Serenitatis. This is about 180 km from where Apollo 17 had landed a month earlier.", "Lunokhod 2 worked for almost four months and drove roughly 37–39 km, the farthest any rover had gone on the Moon at the time.", "NASA's Lunar Reconnaissance Orbiter later photographed the rover still parked on the crater floor."], "left": ["Lunokhod 2 rover", "Luna 21 landing stage"]},
    {"id": "change3", "pin": "CE3", "kind": "other", "country": "China", "name": "Chang'e 3 – Mare Imbrium", "year": 2013, "lat": 44.122, "lon": -19.511, "model": "lander", "object": "Chang'e 3 lander and Yutu rover", "query": "Chang'e 3 lander Yutu rover LRO", "story": ["On 14 December 2013, Chang'e 3 made the first soft landing on the Moon since 1976, in northern Mare Imbrium.", "Its Yutu (Jade Rabbit) rover was immobilized in January 2014, but the lander kept working for years.", "NASA's Lunar Reconnaissance Orbiter has imaged both machines from orbit."], "left": ["Chang'e 3 lander", "Yutu rover"]},
    {"id": "change4", "pin": "CE4", "kind": "other", "country": "China", "name": "Chang'e 4 – Far side", "year": 2019, "lat": -45.457, "lon": 177.589, "model": "lander", "object": "Chang'e 4 lander and Yutu-2 rover", "query": "Chang'e 4 lander Von Karman", "story": ["On 3 January 2019, Chang'e 4 made humanity's first soft landing on the far side of the Moon, inside Von Kármán crater in the South Pole-Aitken Basin.", "Because the far side never faces Earth, the Queqiao relay satellite, parked beyond the Moon, passes the signals back and forth.", "The Yutu-2 rover has been exploring the crater floor ever since."], "left": ["Chang'e 4 lander", "Yutu-2 rover"]},
    {"id": "change5", "pin": "CE5", "kind": "other", "country": "China", "name": "Chang'e 5 – Mons Rümker", "year": 2020, "lat": 43.058, "lon": -51.916, "model": "lander", "object": "Chang'e 5 descent stage", "query": "Chang'e 5 lander Mons Rumker", "story": ["Chang'e 5 landed on 1 December 2020 near Mons Rümker in Oceanus Procellarum.", "It drilled and scooped 1,731 g of lunar soil, the first samples brought back to Earth since 1976. The ascender lifted off on 3 December and the samples returned to Earth in mid-December.", "The descent stage stayed behind on the surface."], "left": ["Chang'e 5 descent stage"]},
    {"id": "change6", "pin": "CE6", "kind": "other", "country": "China", "name": "Chang'e 6 – Apollo basin", "year": 2024, "lat": -41.639, "lon": -153.985, "model": "lander", "object": "Chang'e 6 descent stage", "query": "Chang'e 6 lander Apollo basin far side", "story": ["On 1 June 2024, Chang'e 6 landed in the Apollo basin on the far side of the Moon.", "It collected samples there and made the first return of material from the lunar far side later that month.", "NASA's Lunar Reconnaissance Orbiter photographed the lander a few days after it touched down."], "left": ["Chang'e 6 descent stage", "Chinese flag"]},
    {"id": "viking1", "pin": "V1", "kind": "us", "body": "mars", "country": "USA", "name": "Viking 1 – Chryse Planitia", "year": 1976, "lat": 22.48, "lon": -47.968, "model": "lander", "object": "Viking 1 lander", "query": "Viking 1 lander Chryse Planitia", "story": ["Viking 1 landed on 20 July 1976 and became the first US spacecraft to work on the surface of Mars.", "It took pictures and ran experiments that searched the soil for signs of life.", "It is a stationary lander, so it never moved. It stopped working in 1982 and is still there."], "left": ["Viking 1 lander", "Heat shield and parachute remains", "Ejected landing hardware"]},
    {"id": "viking2", "pin": "V2", "kind": "us", "body": "mars", "country": "USA", "name": "Viking 2 – Utopia Planitia", "year": 1976, "lat": 47.97, "lon": 134.26, "model": "lander", "object": "Viking 2 lander", "query": "Viking 2 lander Utopia Planitia", "story": ["Viking 2 landed on 3 September 1976, farther north than its twin.", "It studied Martian soil and the atmosphere, and photographed frost on the ground.", "It worked until 1980. A metal shroud it ejected during landing can still be seen in 1977 images."], "left": ["Viking 2 lander", "Ejected metal shroud", "Heat shield and parachute remains"]},
    {"id": "pathfinder", "pin": "PF", "kind": "us", "body": "mars", "country": "USA", "name": "Mars Pathfinder – Ares Vallis", "year": 1997, "lat": 19.33, "lon": -33.55, "model": "marsrover", "object": "Pathfinder lander and Sojourner rover", "query": "Mars Pathfinder Sojourner rover", "story": ["Mars Pathfinder landed on 4 July 1997 by bouncing to a stop inside giant airbags.", "It delivered Sojourner, the first successful wheeled rover on Mars, which explored nearby rocks and soil.", "The lander was later renamed the Carl Sagan Memorial Station."], "left": ["Pathfinder lander", "Sojourner rover", "Deflated landing airbags", "Parachute and backshell"]},
    {"id": "spirit", "pin": "SP", "kind": "us", "body": "mars", "country": "USA", "name": "Spirit – Gusev Crater", "year": 2004, "lat": -14.5719, "lon": 175.4785, "model": "marsrover", "object": "Spirit rover", "query": "Spirit rover Gusev Crater", "story": ["Spirit landed in January 2004 in Gusev Crater.", "It found evidence that water once altered the rocks of Mars.", "In 2009 it got stuck in soft sand. It sent its last signal in 2010 and is still parked there."], "left": ["Spirit rover", "Landing platform", "Heat shield, parachute and backshell", "Rover wheel tracks"]},
    {"id": "opportunity", "pin": "OP", "kind": "us", "body": "mars", "country": "USA", "name": "Opportunity – Meridiani Planum", "year": 2004, "lat": -1.9462, "lon": -5.5266, "model": "marsrover", "object": "Opportunity rover", "query": "Opportunity rover Meridiani Planum", "story": ["Opportunity landed in January 2004 on Meridiani Planum.", "It found strong evidence that liquid water once existed on ancient Mars, including small round mineral 'blueberries'.", "A huge dust storm silenced it in 2018. It had lasted about 15 years instead of the planned 90 days."], "left": ["Opportunity rover", "Landing platform in Eagle crater", "Discarded heat shield", "Rover wheel tracks"]},
    {"id": "phoenix", "pin": "PH", "kind": "us", "body": "mars", "country": "USA", "name": "Phoenix – Arctic plains", "year": 2008, "lat": 68.2188, "lon": -125.7492, "model": "lander", "object": "Phoenix lander", "query": "Phoenix Mars lander arctic", "story": ["Phoenix landed in 2008 near the north pole of Mars.", "It dug into the soil and found water ice just beneath the surface. It also found perchlorate salts.", "When winter darkness came the solar panels lost power, and the lander went silent in November 2008."], "left": ["Phoenix lander", "Heat shield", "Parachute and backshell"]},
    {"id": "curiosity", "pin": "CU", "kind": "us", "body": "mars", "country": "USA", "name": "Curiosity – Gale Crater", "year": 2012, "lat": -4.5895, "lon": 137.4417, "model": "marsrover", "object": "Curiosity rover", "query": "Curiosity rover Gale Crater", "story": ["Curiosity landed in August 2012 using a rocket-powered 'sky crane'.", "It studies ancient environments, rocks and chemistry, and whether Mars once supported microbial life. It found organic molecules and methane.", "It is still driving up Mount Sharp, leaving its wheel tracks and landing debris behind."], "left": ["Curiosity rover (active)", "Sky crane and landing wreckage", "Heat shield", "Rover wheel tracks", "Parachute and backshell"]},
    {"id": "insight", "pin": "IN", "kind": "us", "body": "mars", "country": "USA", "name": "InSight – Elysium Planitia", "year": 2018, "lat": 4.502, "lon": 135.623, "model": "lander", "object": "InSight lander", "query": "InSight lander Mars", "story": ["InSight landed in 2018 on a flat plain called Elysium Planitia.", "It measured marsquakes and investigated the planet's interior.", "Dust covered its solar panels. The mission ended in December 2022, and the lander stays where it landed."], "left": ["InSight lander", "Seismometer and heat probe", "Heat shield and backshell"]},
    {"id": "perseverance", "pin": "PE", "kind": "us", "body": "mars", "country": "USA", "name": "Perseverance and Ingenuity – Jezero Crater", "year": 2021, "lat": 18.4446, "lon": 77.4509, "model": "marsrover", "object": "Perseverance rover and Ingenuity helicopter", "query": "Perseverance rover Jezero Ingenuity helicopter", "story": ["Perseverance landed in Jezero Crater on 18 February 2021. The crater held a lake long ago.", "It searches for signs of ancient microbial life and collects rock samples in tubes. Some tubes were left on the ground in a sample depot.", "It carried Ingenuity, the first powered aircraft to fly on another planet. Ingenuity's flight mission ended in 2024, and the helicopter stays where it landed."], "left": ["Perseverance rover (active)", "Ingenuity helicopter", "Sample tubes in the depot", "Landing wreckage: parachute, backshell, heat shield"]},
    {"id": "zhurong", "pin": "ZH", "kind": "other", "body": "mars", "country": "China", "name": "Zhurong – Utopia Planitia", "year": 2021, "lat": 25.066, "lon": 109.925, "model": "marsrover", "object": "Zhurong rover", "query": "Zhurong rover Tianwen-1", "story": ["China's Tianwen-1 mission put a lander and the Zhurong rover on Utopia Planitia in May 2021.", "Zhurong studied soil, rocks and evidence of ancient water, and drove more than 1.9 km.", "Tianwen-1's orbiter is still studying Mars from above."], "left": ["Zhurong rover", "Tianwen-1 lander", "Rover wheel tracks"]},
    {"id": "mars3", "pin": "M3", "kind": "failed", "body": "mars", "country": "Soviet Union", "name": "Mars 3 – Soviet lander", "year": 1971, "lat": -45.0, "lon": -158.0, "model": "lander", "object": "Mars 3 lander", "query": "Mars 3 lander Soviet 1971", "story": ["Mars 3 landed on 2 December 1971 and was the first spacecraft to soft-land on Mars.", "It sent signals for only about 20 seconds before communication stopped. Possibly a dust storm was to blame.", "It also carried a small PrOP-M rover that never got to drive."], "left": ["Mars 3 lander", "PrOP-M mini-rover", "Soviet pennants"]},
    {"id": "mars2", "pin": "M2", "kind": "failed", "body": "mars", "country": "Soviet Union", "name": "Mars 2 – Soviet lander", "year": 1971, "lat": -44.2, "lon": 47.0, "model": "lander", "object": "Mars 2 lander", "query": "Mars 2 Soviet lander 1971", "story": ["Mars 2 was a Soviet lander launched in 1971.", "It crashed during landing, but became the first human-made object to reach the Martian surface.", "Its twin, Mars 3, landed a few days later."], "left": ["Wreckage of the Mars 2 lander", "Soviet pennants"]},
    {"id": "beagle2", "pin": "BG", "kind": "failed", "body": "mars", "country": "Europe", "name": "Beagle 2 – Isidis Planitia", "year": 2003, "lat": 11.5, "lon": 90.4, "model": "lander", "object": "Beagle 2 lander", "query": "Beagle 2 lander Mars HiRISE", "story": ["Beagle 2 was a small British lander carried to Mars by Europe's Mars Express in 2003.", "It reached the surface, but its solar panels did not fully open and it could not call home.", "Eleven years later, NASA's orbiter photographed it and showed that it had landed safely."], "left": ["Beagle 2 lander (partly opened)"]},
    {"id": "schiaparelli", "pin": "SC", "kind": "failed", "body": "mars", "country": "Europe", "name": "Schiaparelli – Meridiani Planum", "year": 2016, "lat": -2.05, "lon": -6.21, "model": "lander", "object": "Schiaparelli lander", "query": "Schiaparelli EDM lander crash Mars", "story": ["Schiaparelli was a European test lander that arrived at Mars in October 2016.", "It crashed during landing, but the data it sent helped engineers improve future landing technology.", "NASA's Mars Reconnaissance Orbiter photographed the impact site."], "left": ["Crash site and fragments", "Parachute and backshell"]},
]


LEFT = {
    "apollo11": ["Eagle descent stage", "US flag", "Plaque: 'We came in peace for all mankind'", "Seismometer and laser reflector", "Medals honoring cosmonauts Gagarin and Komarov", "Silicon disc of goodwill messages", "Bags of discarded gear and boots"],
    "apollo12": ["Surveyor 3 probe (camera and parts taken home)", "Apollo 12 descent stage", "ALSEP science station", "US flag"],
    "apollo14": ["Modular Equipment Transporter cart", "ALSEP science station", "Two golf balls", "Apollo 14 descent stage", "US flag"],
    "apollo15": ["Lunar Roving Vehicle", "'Fallen Astronaut' figurine and plaque", "ALSEP science station", "Apollo 15 descent stage", "US flag"],
    "apollo16": ["ALSEP science station", "Lunar Roving Vehicle", "Far-ultraviolet camera", "Duke's family photo", "Apollo 16 descent stage", "US flag"],
    "apollo17": ["Lunar Roving Vehicle", "Descent stage with commemorative plaque", "ALSEP science station", "US flag"],
}


@lru_cache(maxsize=64)
def fetch_media(query: str):
    r = httpx.get(
        "https://images-api.nasa.gov/search",
        params={"q": query, "media_type": "image", "page_size": 8},
        timeout=15,
    )
    r.raise_for_status()
    out = []
    for item in r.json()["collection"]["items"]:
        data, links = item["data"][0], item.get("links", [])
        if not links:
            continue
        out.append({
            "title": data.get("title"),
            "description": (data.get("description") or "")[:400],
            "date": (data.get("date_created") or "")[:10],
            "image": links[0]["href"],
            "nasa_id": data.get("nasa_id"),
        })
    return out


@app.get("/api/sites")
def sites():
    return [{**{k: v for k, v in s.items() if k != "query"}, "left": LEFT.get(s["id"], s.get("left", []))} for s in SITES]


@app.get("/api/sites/{site_id}/media")
def site_media(site_id: str):
    site = next((s for s in SITES if s["id"] == site_id), None)
    if not site:
        raise HTTPException(404, "Unknown site")
    try:
        return fetch_media(site["query"])
    except httpx.HTTPError:
        raise HTTPException(502, "NASA API unavailable")