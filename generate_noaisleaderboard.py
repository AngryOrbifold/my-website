from supabase import create_client
import os
import json

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# ────────────────────────────────────────────────
# 1. Get eligible OVAT entries (leaderboard = true)
# ────────────────────────────────────────────────
ovat_res = (
    supabase.table("data_ovat")
    .select("email, score, attempts")
    .eq("leaderboard", True)
    .execute()
)

ovat_by_email = {}
for row in ovat_res.data:
    email = row["email"]
    if email:
        ovat_by_email[email] = {
            "score": row.get("score", 0),
            "attempts": row.get("attempts", 0)
        }

# ────────────────────────────────────────────────
# 2. Get finished NOFRAT entries
# ────────────────────────────────────────────────
nofrat_res = (
    supabase.table("online_data2")
    .select("email, name, score, attempts, finished")
    .eq("finished", True)
    .execute()
)

# ────────────────────────────────────────────────
# 3. Combine only people present in BOTH
# ────────────────────────────────────────────────
combined = []

for row in nofrat_res.data:
    email = row.get("email")
    if not email:
        continue

    if email not in ovat_by_email:
        continue  # must exist in both

    ovat = ovat_by_email[email]

    total_score = (row.get("score") or 0) + (ovat["score"] or 0)
    total_attempts = (row.get("attempts") or 0) + (ovat["attempts"] or 0)

    # Prefer name from NOFRAT if available, otherwise OVAT
    name = row.get("name")

    combined.append({
        "email": email,
        "name": name,
        "total_score": total_score,
        "total_attempts": total_attempts
    })

# ────────────────────────────────────────────────
# 4. Sort: highest score first, then lowest attempts
# ────────────────────────────────────────────────
combined.sort(
    key=lambda x: (-x["total_score"], x["total_attempts"])
)

# ────────────────────────────────────────────────
# 5. Load norm data (for converting total score → IQ)
# ────────────────────────────────────────────────
norm_file_bytes = supabase.storage.from_("public").download("questions2/normnoais.json")
norm_data = json.loads(norm_file_bytes.decode("utf-8"))

def score_to_iq(score):
    if score is None or score <= 0:
        return "N/A"
    iq = norm_data.get(str(score), "N/A")
    if score == 88 and iq != "N/A":
        return f"≥ {iq}"
    return iq

# ────────────────────────────────────────────────
# 6. Build HTML rows
# ────────────────────────────────────────────────
rows_html = ""
for idx, entry in enumerate(combined):
    iq = score_to_iq(entry["total_score"])
    rows_html += (
        f"<tr>"
        f"<td>{idx + 1}</td>"
        f"<td>{entry['name']}</td>"
        f"<td>{entry['total_score']}</td>"
        f"<td>{iq}</td>"
        f"</tr>\n"
    )

# Full HTML output
html_output = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>NOAIS Leaderboard</title>
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
    <h2>NOAIS Leaderboard</h2>
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
    <p>The leaderboard is refreshed every 72 hours, showcasing the current scores of participants who opted to be listed.</p>
  </div>

  <div class="section">
    <a class="button" href="index.html">Back to main page</a>
  </div>
</body>
</html>
"""

# Write final HTML to disk
with open("noaisleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)