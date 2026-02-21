from supabase import create_client
import os
import json

# Load Supabase auth from environment
SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Fetch leaderboard entries (only sort by score in DB)
res = (
    supabase.table("data_neaito_")
    .select("name, score, attempts")
    .eq("leaderboard", True)
    .order("score", desc=True)  # primary sort
    .execute()
)

rows = res.data

# --- Compute attempts sum and sort locally ---
def attempts_sum(attempts):
    if isinstance(attempts, list):
        return sum(attempts)
    return 0

# Sort by:
# 1. score (descending)
# 2. sum(attempts) (descending)
rows = sorted(
    rows,
    key=lambda r: (
        r.get("score") or 0,
        attempts_sum(r.get("attempts"))
    ),
    reverse=True
)

# Load norm file
norm_file_bytes = supabase.storage.from_("public").download("neaito_questions/norm.json")
norm_data = json.loads(norm_file_bytes.decode("utf-8"))

def score_to_iq(score):
    if score is None or score == 0:
        return "N/A"
    return norm_data.get(str(score), "N/A")

# Build dynamic table rows
rows_html = ""
for idx, row in enumerate(rows):
    name = row.get("name", "Unknown")
    score = row.get("score")
    iq = score_to_iq(score)

    if score == 60 and iq != "N/A":
        iq = f"≥ {iq}"

    rows_html += (
        f"<tr>"
        f"<td>{idx + 1}</td>"
        f"<td>{name}</td>"
        f"<td>{score if score is not None else 'N/A'}</td>"
        f"<td>{iq}</td>"
        f"</tr>\n"
    )

html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NEAITO Leaderboard</title>
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
    <h2>NEAITO Leaderboard</h2>
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
    <p>The leaderboard is refreshed every 5 days, showcasing the scores of participants who opted to be listed.</p>
  </div>

  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

# Write final HTML to disk
with open("neaitoleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)
