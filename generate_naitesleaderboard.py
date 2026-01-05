from supabase import create_client
import os
import json
import unicodedata
from better_profanity import profanity

# -----------------------------
# Supabase setup
# -----------------------------

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# -----------------------------
# Profanity configuration
# -----------------------------

# Extend English profanity (Romanian / Spanish etc.)
profanity.load_censor_words(custom_words=[
    "puta", "puto", "mierda", "muie", "cacat", "pula",
    "curve", "curva", "retard", "idiot"
])

# CJK → English intent collapsing
CJK_INTENT_MAP = {
    "操": "fuck",
    "肏": "fuck",
    "屄": "fuck",
    "逼": "fuck",
    "屎": "shit",
    "傻逼": "idiot",
    "死ね": "die",
    "くそ": "shit",
    "クソ": "shit",
    "ばか": "idiot",
    "バカ": "idiot",
    "アホ": "idiot",
    "妈的": "fuck",
    "他妈的": "fuck",
}

# -----------------------------
# Normalization helpers
# -----------------------------

def normalize(text: str) -> str:
    return unicodedata.normalize("NFKC", text)

def strip_noise(text: str) -> str:
    # Remove zero-width & control chars
    return "".join(
        ch for ch in text
        if unicodedata.category(ch)[0] != "C"
    )

def collapse_cjk_intent(text: str) -> str:
    for k, v in CJK_INTENT_MAP.items():
        text = text.replace(k, v)
    return text.lower()

# -----------------------------
# Character classification
# -----------------------------

def is_letter(ch: str) -> bool:
    cat = unicodedata.category(ch)
    if not cat.startswith("L"):
        return False

    code = ord(ch)

    # CJK Unified Ideographs
    if 0x4E00 <= code <= 0x9FFF:
        return True
    # Hiragana / Katakana
    if 0x3040 <= code <= 0x30FF:
        return True
    # Latin (incl. Romanian diacritics)
    return True

# -----------------------------
# Username validation
# -----------------------------

def contains_profanity(name: str) -> bool:
    name = normalize(name)
    name = strip_noise(name)

    # Direct English profanity
    if profanity.contains_profanity(name):
        return True

    # Collapsed intent profanity
    collapsed = collapse_cjk_intent(name)
    if profanity.contains_profanity(collapsed):
        return True

    return False

def valid_username(name: str) -> bool:
    if not name or len(name) < 2:
        return False

    letters = sum(1 for ch in name if is_letter(ch))
    if letters / len(name) < 0.8:
        return False

    if contains_profanity(name):
        return False

    return True

# -----------------------------
# IQ mapping
# -----------------------------

def score_to_iq(score):
    if score is None or score == 0:
        return "N/A"
    return norm_data.get(str(score), "N/A")

# -----------------------------
# Fetch leaderboard data
# -----------------------------

res = (
    supabase.table("data_es")
    .select("name, score, iq")
    .eq("leaderboard", True)
    .order("score", desc=True)
    .execute()
)

rows = res.data

try:
    norm_file_bytes = supabase.storage.from_("assetses").download("norm_es.json")
    norm_data = json.loads(norm_file_bytes.decode("utf-8"))
except Exception as e:
    print("Error fetching norm.json:", e)
    norm_data = {}

# -----------------------------
# Build leaderboard rows (FILTERED)
# -----------------------------

rows_html = ""
rank = 1

for row in rows:
    name = row.get("name", "Unknown")

    if not valid_username(name):
        continue

    score = row.get("score") if row.get("score") is not None else "N/A"
    iq = score_to_iq(score)

    if score == 50 and isinstance(iq, (int, float)):
        iq = f"≥ {iq}"

    rows_html += (
        f"<tr>"
        f"<td>{rank}</td>"
        f"<td>{name}</td>"
        f"<td>{score}</td>"
        f"<td>{iq}</td>"
        f"</tr>\n"
    )
    rank += 1

# -----------------------------
# HTML output (unchanged)
# -----------------------------

html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NAIT-ES Leaderboard</title>
  <link rel="icon" href="favicon.png">
</head>
<body>
  <div class="leaderboard-container">
    <h2>NAIT-ES Leaderboard</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Raw score</th>
          <th>IQ (Wechsler scale)</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>
</body>
</html>
"""

with open("naitesleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)
