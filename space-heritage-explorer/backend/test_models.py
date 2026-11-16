import os
import time

from dotenv import load_dotenv

load_dotenv()

from google import genai
from google.genai import types

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"),
    http_options=types.HttpOptions(timeout=30000),  # 30 s, in milliseconds
)

MODELS = [
    "gemini-3.8-flash",
    "gemini-3.7-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.5-flash-lite",
]

for m in MODELS:
    t = time.perf_counter()
    try:
        r = client.models.generate_content(
            model=m,
            contents='Return JSON: {"ok": true, "word": "Mars"}',
            config=types.GenerateContentConfig(
                temperature=0.0, max_output_tokens=1000, response_mime_type="application/json"
            ),
        )
        print(f"{m:<24} OK   {time.perf_counter() - t:5.1f}s  {(r.text or '').strip()[:60]}")
    except Exception as e:
        print(f"{m:<24} FAIL {time.perf_counter() - t:5.1f}s  {str(e)[:100]}")