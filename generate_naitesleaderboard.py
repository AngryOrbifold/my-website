from supabase import create_client
import os
import json
import unicodedata
from better_profanity import profanity

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

profanity.load_censor_words(custom_words=[
    "puta", "puto", "mierda", "muie", "cacat", "pula",
    "curva", "retard", "idiot"
])

CJK_INTENT_MAP = {
    "操": "fuck",
    "肏": "fuck",
    "屄": "fuck",
    "逼": "fuck",
    "屎": "shit",
    "傻逼": "idiot",
    "妈的": "fuck",
    "他妈的": "fuck",
    "くそ": "shit",
    "クソ": "shit",
    "ばか": "idiot",
    "バカ": "idiot",
    "アホ": "idiot",
}

def normalize(text):
    return unicodedata.normalize("NFKC", text)

def strip_noise(text):
    return "".join(ch for ch in text if unicodedata.category(ch)[0] != "C")

def collapse_cjk(text):
    for k, v in CJK_INTENT_MAP.items():
        text = text.replace(k, v)
    return text.lower()

def is_letter_or_digit(ch):
    cat = unicodedata.category(ch)
    if cat.startswith("L") or cat.startswith("N"):
        return True
    return False

def contains_profanity(name):
    name = normalize(name)
    name = strip_noise(name)
    if profanity.contains_profanity(name):
        return True
    collapsed = collapse_cjk(name)
    if profanity.contains_profanity(collapsed):
        return True
    return False

def valid_username(name):
    if not name or len(name) < 2:
        return False
    allowed = sum(1 for ch in name if is_letter_or_digit(ch))
    if allowed / len(name) < 0.8:
        return False
    if contains_profanity(name):
        return False
    return True

def score_to_iq(score):
    if score is None or score == 0:
        return "N/A"
    return norm_data.get(str(score), "N/A")

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
    print("Error fetching norm.json from Supabase storage:", e)
    norm_data = {}

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
    rows_html += f"<tr><td>{rank}</td><td>{name}</td><td>{score}</td><td>{iq}</td></tr>\n"
    rank += 1

html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NAIT-ES Leaderboard</title>
  <link rel="icon" href="favicon.png">
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-3XHMB3NM73"></script>
  <script>
    window.dataLayer = window.dataLayer || [];
    function gtag(){{dataLayer.push(arguments);}}
    gtag('js', new Date());
    gtag('config', 'G-3XHMB3NM73');
  </script>

  <style>
    body {{
      font-family: Arial, sans-serif;
      background: #f9f9f9;
      margin: 30px;
      text-align: center;
      line-height: 1.6;
    }}

    h2 {{
      font-size: 28px;
      margin-bottom: 20px;
    }}

    p {{
      max-width: 1000px;
      margin: 10px auto;
      font-size: 18px;
      text-align: justify;
    }}

    a {{
      text-decoration: none;
      font-size: 18px;
    }}

    .section {{
      margin: 25px auto;
    }}

    .button {{
      display: inline-block;
      padding: 12px 28px;
      font-size: 20px;
      border-radius: 8px;
      color: white;
      background-color: #0070ba;
      transition: background-color 0.3s ease;
      margin: 5px;
    }}

    .button:hover {{
      background-color: #005c99;
    }}

    .leaderboard-container {{
      max-width: 1000px;
      margin: 0 auto;
      padding: 20px;
      border: 2px solid #000;
      border-radius: 10px;
      background-color: #f9f9f9;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }}
    .leaderboard-container::-webkit-scrollbar {{
      height: 6px;
    }}
    .leaderboard-container::-webkit-scrollbar-thumb {{
      background: rgba(0,0,0,0.2);
      border-radius: 3px;
    }}

    table {{
      border-collapse: collapse;
      width: 100%;
      font-family: sans-serif;
    }}

    th, td {{
      border: 1px solid #ddd;
      padding: 10px 16px;
      text-align: center;
    }}

    thead {{
      background-color: #007acc;
      color: white;
    }}

    tbody tr:nth-child(even) {{
      background-color: #eef6fb;
    }}

    tbody tr:hover {{
      background-color: #d8ecf7;
    }}

    .orange-header {{
      background-color: rgb(243, 174, 45) !important;
      color: white;
    }}
  </style>
</head>
<body>
  <div class="section">
    <p>Estimated norm data used.</p>
  </div>

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

  <div class="section">
    <p>The leaderboard is refreshed every 48 hours, showcasing the current scores of participants who opted to be listed.</p>
  </div>
  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

with open("naitesleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)
