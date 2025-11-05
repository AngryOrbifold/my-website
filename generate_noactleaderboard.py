from supabase import create_client
import os

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Fetch leaderboard data
res = supabase.table("online_data").select(
    "name, score, iq"
).eq("leaderboard", True).order("score", desc=True).execute()

rows = res.data

# Build table rows HTML
rows_html = ""
for idx, row in enumerate(rows):
    name = row.get("name", "Unknown")
    raw_score = row.get("score") if row.get("score") is not None else "N/A"
    iq = row.get("iq") if row.get("iq") is not None else "N/A"

    rows_html += (
        f"<tr><td>{idx + 1}</td><td>{name}</td>"
        f"<td>{raw_score}</td><td>{iq}</td></tr>\n"
    )

# Read your template HTML
with open("noactleaderboard.html", "r", encoding="utf-8") as f:
    html_template = f.read()

# Replace <tbody> placeholder with real rows
html_output = html_template.replace(
    "<tbody>", f"<tbody>\n{rows_html}"
)

# Write updated leaderboard
with open("noactleaderboard.html", "w", encoding="utf-8") as f:
    f.write(html_output)
