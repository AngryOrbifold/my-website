from supabase import create_client
import os
from datetime import datetime
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
    return cat.startswith("L") or cat.startswith("N")

def contains_profanity(name):
    name = normalize(name)
    name = strip_noise(name)
    if profanity.contains_profanity(name):
        return True
    if profanity.contains_profanity(collapse_cjk(name)):
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

def format_date_short(dt):
    month = dt.strftime("%B")
    if len(month) > 4:
        month = month[:3] + "."
    return f"{dt.day:02d} {month} {dt.year}"

def safe_date(dt_str):
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

try:
    norm_file_bytes = supabase.storage.from_("assets").download("norm.json")
    norm_data = json.loads(norm_file_bytes.decode("utf-8"))
except Exception as e:
    print("Error fetching norm.json from Supabase storage:", e)
    norm_data = {}

def score_to_iq(score):
    if score is None or score == 0:
        return "N/A"
    iq_value = norm_data.get(str(score), "N/A")
    if isinstance(iq_value, (int, float)):
        return round(iq_value)
    return iq_value

all_rows_res = (
    supabase.table("data")
    .select("name, score, last_update, contest")
    .execute()
)
all_rows = all_rows_res.data if hasattr(all_rows_res, "data") else all_rows_res

contest_participants = []
for row in all_rows:
    name = row.get("name", "Unknown")
    if not valid_username(name):
        continue
    score = row.get("score") or 0
    last_update_raw = row.get("last_update")
    contest_raw = row.get("contest")
    last_update = safe_date(last_update_raw)
    contest_date = safe_date(contest_raw)
    if contest_date and last_update:
        duration = (last_update - contest_date).days
        contest_participants.append({
            "name": name,
            "score": score,
            "duration": duration,
            "identity": (name, score, contest_date.isoformat(), last_update.isoformat())
        })

contest_participants.sort(key=lambda r: (-r["score"], r["duration"]))

contest_rank_map_by_identity = {}
contest_rank_map_by_name = {}
rank = 1
for p in contest_participants:
    contest_rank_map_by_identity[p["identity"]] = rank
    contest_rank_map_by_name[p["name"]] = rank
    rank += 1

public_res = (
    supabase.table("data")
    .select("name, score, last_update, contest")
    .eq("leaderboard", True)
    .order("score", desc=True)
    .execute()
)
public_entries_raw = public_res.data if hasattr(public_res, "data") else public_res

entries = []
for row in public_entries_raw:
    name = row.get("name", "Unknown")
    if not valid_username(name):
        continue
    score = row.get("score") or 0
    iq = score_to_iq(score)
    if score == 120 and isinstance(iq, (int, float)):
        iq = f"≥ {iq}"
    last_update_raw = row.get("last_update")
    contest_raw = row.get("contest")
    last_update = safe_date(last_update_raw)
    contest_date = safe_date(contest_raw)
    if contest_date and last_update:
        duration = (last_update - contest_date).days
        c_val = f"{format_date_short(contest_date)} / {format_date_short(last_update)}"
        identity = (name, score, contest_date.isoformat(), last_update.isoformat())
        contest_rank_display = contest_rank_map_by_identity.get(
            identity, contest_rank_map_by_name.get(name, " ")
        )
    else:
        duration = float("inf")
        c_val = " "
        contest_rank_display = " "
    entries.append({
        "name": name,
        "score": score,
        "iq": iq,
        "c_val": c_val,
        "duration": duration,
        "in_contest": contest_date is not None and last_update is not None,
        "contest_rank": contest_rank_display
    })

entries.sort(key=lambda r: (-r["score"], r["duration"]))

# -------------------------
# Build HTML
# -------------------------

rows_html = ""
for idx, row in enumerate(entries, start=1):
    rows_html += (
        f"<tr><td>{idx}</td>"
        f"<td>{row['name']}</td>"
        f"<td>{row['score']}</td>"
        f"<td>{row['iq']}</td>"
        f"<td>{row['c_val']}</td>"
        f"<td>{row['contest_rank']}</td></tr>\n"
    )

# (rest of the HTML is unchanged from what you already have)
html_output = f"""
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NAIT Leaderboard</title>
  <link rel="icon" href="favicon.png">
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
    <p>Enhanced first preliminary norm data used.</p>
  </div>
  <div class="leaderboard-container">
    <h2>NAIT Leaderboard</h2>
    <table>
      <thead>
        <tr>
          <th>Rank</th>
          <th>Name</th>
          <th>Raw score</th>
          <th>IQ (Wechsler scale)</th>
          <th class="orange-header">Contest start / last update</th>
          <th class="orange-header">Contest rank</th>
        </tr>
      </thead>
      <tbody>
        {rows_html}
      </tbody>
    </table>
  </div>

  <div class="section">
    <p>The leaderboard is refreshed every 5 days, showcasing the current scores of participants who opted to be listed.</p>
  </div>
  
  <div class="section">
    <a class="button" href="https://nsl36.netlify.app/competition2025">Contest Information</a>
  </div>

  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

with open("naitleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)






