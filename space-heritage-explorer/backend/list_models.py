import os

from dotenv import load_dotenv

load_dotenv()

from google import genai

client = genai.Client(api_key=os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY"))
for m in client.models.list():
    if "generateContent" in (getattr(m, "supported_actions", None) or []):
        print(m.name)
        