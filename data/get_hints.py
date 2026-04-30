import requests
import random
import os
from pathlib import Path
from bs4 import BeautifulSoup
from google import genai
from google.genai.types import GenerateContentConfig

from scraped_problems import imop1

def load_env_local():
    env_path = Path(__file__).resolve().parents[1] / ".env.local"
    if not env_path.exists():
        return

    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


load_env_local()
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    raise ValueError("GEMINI_API_KEY is missing. Set it in .env.local or your shell environment.")

client = genai.Client(api_key=api_key)
model_id = "gemini-2.5-flash"

problem_text = "Determine all real numbers $\\alpha$ such that, for every positive integer $n,$ the integer $\\lfloor\\alpha\\rfloor +\\lfloor 2\\alpha\\rfloor +\\cdots +\\lfloor n\\alpha\\rfloor$$is a multiple of $n.$ (Note that $\\lfloor z\\rfloor$ denotes the greatest integer less than or equal to $z.$ For example, $\\lfloor -\\pi\\rfloor =-4$ and $\\lfloor 2\\rfloor= \\lfloor 2.9\\rfloor =2.$)"

prompt = f"""
You are given the following math olympiad problem:

{problem_text}

Return ONLY valid JSON in exactly this shape (use inline latex with single dollar signs. Also make sure
that you don't put colons around the json attributes on the left (like the names id, statement, etc. should be bare)). Also, 
all fractions and similar should have double backslash before them.:

{{
  id: 1,
  statement: "{problem_text}",
  topic: "<one-word topic>",
  hints: ["hint1", "hint2", "hint3"],
  difficulty: 5,
}}
"""
print(problem_text)
print("Now waiting on Gemini...")

response = client.models.generate_content(
    model=model_id,
    contents=prompt,
    config=GenerateContentConfig()
)

print(response.candidates[0].content.parts[0].text)

