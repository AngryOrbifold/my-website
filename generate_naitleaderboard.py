from supabase import create_client
import os
from datetime import datetime
import json

# Load Supabase auth from environment
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def safe_date(dt_str):
    """Parse supabase date string into datetime, or None"""
    if not dt_str:
        return None
    try:
        return datetime.fromisoformat(dt_str)
    except Exception:
        return None

# Fetch norm.json from private 'assets' bucket
try:
    norm_file_bytes = supabase.storage.from_("assets").download("norm.json")
    norm_data = json.loads(norm_file_bytes.decode("utf-8"))
except Exception as e:
    print("Error fetching norm.json from Supabase storage:", e)
    norm_data = {}  # fallback to empty dict if file cannot be loaded

def score_to_iq(score):
    if score is None or score == 0:
        return "N/A"
    iq_value = norm_data.get(str(score), "N/A")
    # Round only if it's a number
    if isinstance(iq_value, (int, float)):
        return round(iq_value)
    return iq_value

# Fetch ALL rows (we'll filter in Python to avoid client-side filter issues)
all_rows_res = (
    supabase.table("data")
    .select("name, score, last_update, contest")
    .execute()
)
all_rows = all_rows_res.data if hasattr(all_rows_res, "data") else all_rows_res

# Build a list of contest participants that have both contest and last_update
contest_participants = []
for row in all_rows:
    name = row.get("name", "Unknown")
    score = row.get("score") or 0
    last_update_raw = row.get("last_update")
    contest_raw = row.get("contest")

    last_update = safe_date(last_update_raw)
    contest_date = safe_date(contest_raw)

    if contest_date and last_update:
        duration = (last_update - contest_date).days
        # Store enough info to sort and to identify the participant
        contest_participants.append({
            "name": name,
            "score": score,
            "duration": duration,
            # store identifying tuple to reduce chance of collision if needed later
            "identity": (name, score, contest_date.isoformat(), last_update.isoformat())
        })

# Sort contest participants by score desc, duration asc
contest_participants.sort(key=lambda r: (-r["score"], r["duration"]))

# Build contest rank map (identity -> rank) and also name->rank map (for convenience)
contest_rank_map_by_identity = {}
contest_rank_map_by_name = {}
rank = 1
for p in contest_participants:
    identity = p["identity"]
    contest_rank_map_by_identity[identity] = rank
    # Map name->rank if name unique; if duplicates exist this will map to the last one seen.
    # This is a convenience; we prefer identity map for exactness.
    contest_rank_map_by_name[p["name"]] = rank
    rank += 1

# -------------------------
# Build public leaderboard
# -------------------------

# Fetch public (opt-in) leaderboard participants
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
        c_val = f"{contest_date.strftime('%d %B %Y')} / {last_update.strftime('%d %B %Y')}"
        in_contest = True
        identity = (name, score, contest_date.isoformat(), last_update.isoformat())
        # Prefer the identity map (exact match). Fall back to name map if identity not found.
        contest_rank_display = contest_rank_map_by_identity.get(identity,
                                   contest_rank_map_by_name.get(name, " "))
    else:
        duration = float("inf")
        c_val = " "
        in_contest = False
        contest_rank_display = " "

    entries.append({
        "name": name,
        "score": score,
        "iq": iq,
        "c_val": c_val,
        "duration": duration,
        "in_contest": in_contest,
        "contest_rank": contest_rank_display
    })

# Sort entries for display by score desc, duration asc
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
    <p>The leaderboard is refreshed every 48 hours, showcasing the current scores of participants who opted to be listed.</p>
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

