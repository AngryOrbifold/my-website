const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer_ovat";

const TOTAL_ITEMS = 33;

const scoreEl    = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const statusEl   = document.getElementById("status");
const submitBtn  = document.getElementById("submitBtn");

let email = localStorage.getItem("email");
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login_ovat.html";
}

let solved = [];
let attempts = 3;
let finished = false;

function collectAnswers() {
  const answers = [];
  for (let i = 1; i <= TOTAL_ITEMS; i++) {
    const input = document.getElementById("ans" + i);
    if (input) {
      answers.push({
        id: i,
        answer: input.value
      });
    }
  }
  return answers;
}

function showStatus(message, isError = false) {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = isError ? "red" : "green";
  statusEl.style.fontWeight = "bold";

  setTimeout(() => {
    statusEl.textContent = "";
  }, 3000);
}

function hideSolvedItems() {
  solved.forEach(id => {
    const row = document.getElementById("ans" + id)?.closest(".item-row");
    if (row) row.style.display = "none";
  });
}

function updateTopBar(standardScore = null) {
  scoreEl.textContent = `Score: ${solved.length}`;
  attemptsEl.textContent = `Attempts left: ${attempts}`;

  let ssEl = document.getElementById("standardScoreEl");

  if (!ssEl) {
    ssEl = document.createElement("span");
    ssEl.id = "standardScoreEl";
    ssEl.style.marginLeft = "15px";
    attemptsEl.parentNode.appendChild(ssEl);
  }

  if (standardScore !== null) {
    ssEl.textContent = `Standard score: ${standardScore}`;
  }
}

async function loadLeaderboardState() {
  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, load: true })
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.leaderboard === true;
  } catch {
    return false;
  }
}

async function initLeaderboardCheckbox() {
  const checkbox = document.getElementById("leaderboardCheckbox");
  const statusMsg = document.getElementById("leaderboardStatus");
  if (!checkbox) return;

  const isOnBoard = await loadLeaderboardState();
  checkbox.checked = isOnBoard;

  checkbox.addEventListener("change", async () => {
    const wantLeaderboard = checkbox.checked;
    try {
      const r = await fetch(GET_ANSWER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, update: { leaderboard: wantLeaderboard } })
      });
      if (r.ok) {
        statusMsg.innerText = wantLeaderboard
          ? "Added to leaderboard!"
          : "Removed from leaderboard.";
      } else {
        statusMsg.innerText = "Failed. Try again.";
      }
    } catch {
      statusMsg.innerText = "Network error";
    }
  });
}

function endQuiz(standardScore, rawScore) {
  finished = true;
  document.querySelector(".container").innerHTML = `
    <h2 style="text-align:center">OVAT33 Completed</h2>
    <p style="text-align:center"><strong>Raw score:</strong> ${rawScore} / ${TOTAL_ITEMS}</p>
    <p style="text-align:center"><strong>Standard score (Wechsler Scale):</strong> ${standardScore}</p>

    <label style="display:flex; align-items:center; gap:8px; margin-top:20px;">
      <input type="checkbox" id="leaderboardCheckbox">
      Be visible on the NOAIS leaderboard
    </label>
    <p id="leaderboardStatus" style="margin-top:10px; font-weight:bold;"></p>

    <div class="section"; margin-top:20px;">
      <p>You can see your NOAIS certificate by inputting your email adress in the field below:</p>
    </div>

    <form id="certForm" style="margin-top: 20px;">
      <label>Email:</label>
      <input type="email" id="email" required />
      <button type="submit" class="button">Show Certificate</button>
    </form>

    <div id="result" style="margin-top: 20px;"></div>
  `;

  initLeaderboardCheckbox();

  document.getElementById("certForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const container = document.getElementById("result");

    container.innerHTML = `<p style="font-weight:bold;">Certificate is being generated…</p>`;

    try {
      const res = await fetch(
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate_noais",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        }
      );

      if (!res.ok) {
        container.innerHTML = `<p style="color:red;">Certificate not available or wrong email.</p>`;
        return;
      }

      const { url } = await res.json();
      container.innerHTML = `
        <iframe src="${url}" style="width:100%;height:600px;border:1px solid #ccc;margin-top:10px;" allowfullscreen></iframe>
      `;
    } catch (err) {
      container.innerHTML = `<p style="color:red;">An error occurred. Please try again later.</p>`;
      console.error(err);
    }
  });
}

async function loadProgress() {
  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password,load: true })
    });

    if (!res.ok) return;

    const data = await res.json();

    solved   = data.solved_ids ?? [];
    attempts = data.attempts ?? 3;
    finished = data.finished ?? false;

    hideSolvedItems();
    updateTopBar(data.standard_score ?? null);

    if (finished || solved.length >= TOTAL_ITEMS) {
      endQuiz(data.standard_score ?? 0, data.score ?? solved.length);
    }

  } catch (err) {
    console.error("Load progress error:", err);
  }
}

async function submitAll() {
  if (finished) return;

  const payload = {
    email,
    password,
    answers: collectAnswers()
  };

  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error("Server error");
    }

    const data = await res.json();

    showStatus("Answers successfully sent.");

    solved = data.solved_ids ?? [];
    attempts = data.attempts ?? attempts;
    finished = data.finished ?? false;

    hideSolvedItems();
    updateTopBar(data.standard_score ?? null);

    if (finished || solved.length >= TOTAL_ITEMS) {
      endQuiz(data.standard_score ?? 0, data.score ?? solved.length);
      return;
    }

  } catch (err) {
    console.error("Submit error:", err);
    showStatus("Failed to send answers. Please try again.", true);
  }
}

if (submitBtn) {
  submitBtn.addEventListener("click", () => {
    const ok = confirm(
      "Submit all answers?\nPlease check for typos before continuing."
    );
    if (ok) submitAll();
  });
}

loadProgress();
updateTopBar();