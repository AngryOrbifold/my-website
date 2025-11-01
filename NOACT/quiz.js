const UPDATE_USER_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";
const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer";
const TOTAL_ITEMS = 50;
const TOTAL_ATTEMPTS = 30;
const TOTAL_TIME_SECONDS = 360 * 3600; 
// DOM
const scoreEl       = document.getElementById("scoreEl");
const attemptsEl    = document.getElementById("attemptsEl");
const timerEl       = document.getElementById("timerEl");
const questionImg   = document.getElementById("questionImg");
const statusEl      = document.getElementById("status");
const answerInput   = document.getElementById("answerInput");
const submitBtn     = document.getElementById("submitBtn");
const prevBtn       = document.getElementById("prevBtn");
const nextBtn       = document.getElementById("nextBtn");
const darkModeBtn   = document.getElementById("darkModeBtn");

const changeUsernameBtn = document.getElementById("changeUsernameBtn");
const changeUsernameModal = document.getElementById("changeUsernameModal");
const newUsernameInput = document.getElementById("newUsernameInput");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const cancelUsernameBtn = document.getElementById("cancelUsernameBtn");
const usernameStatus = document.getElementById("usernameStatus");

let email = localStorage.getItem("email");
let username = localStorage.getItem("username") || "";
if (!email) {
  window.location.href = "login.html";
}

let solved = [];
let attempts = TOTAL_ATTEMPTS;
let currentIndex = 1;
let startTimeUTC = Date.now();
let timerInterval = null;
let normoCache = null;

let serverReceivedAt = null;
let serverRemainingSeconds = null;

const savedTheme = localStorage.getItem("darkMode");
if (savedTheme === "enabled") {
  document.body.classList.add("dark-mode");
  if (darkModeBtn) darkModeBtn.textContent = "Light Mode";
} else if (darkModeBtn) {
  darkModeBtn.textContent = "Dark Mode";
}

const APP_CHANNEL = "NOACT_channel";
const channel = new BroadcastChannel(APP_CHANNEL);
const TAB_ID = Math.random().toString(36).slice(2);

let activeTab = localStorage.getItem("activeTab");

function lockTab() {
  localStorage.setItem("activeTab", TAB_ID);
  channel.postMessage({ type: "ACTIVE", id: TAB_ID });
}

function blockUI() {
  document.body.innerHTML = `
    <div style="
      display:flex; align-items:center; justify-content:center;
      height:100vh; text-align:center; background:#000; color:#fff;
      font-size:22px; padding:30px;">
      The test is already open in another tab.<br><br>
      Please close the other tab and refresh this one.
    </div>
  `;
}

if (activeTab && activeTab !== TAB_ID) {
  blockUI();
} else {
  lockTab();
}

channel.onmessage = (msg) => {
  if (msg.data?.type === "ACTIVE" && msg.data?.id !== TAB_ID) {
    blockUI();
  }
};

window.addEventListener("beforeunload", () => {
  if (localStorage.getItem("activeTab") === TAB_ID) {
    localStorage.removeItem("activeTab");
    channel.postMessage({ type: "CLOSED", id: TAB_ID });
  }
});

async function loadNormo() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions/normo.json');
    if (r.ok) normoCache = await r.json();
  } catch (e) {
    console.error("Could not load normo.json", e);
  }
}
loadNormo();

function normalizeClient(s) {
  if (s === undefined || s === null) return "";
  let t = String(s);
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");     
  t = t.replace(/^[\s"']+|[\s"']+$/g, "");        
  return t.toLowerCase().replace(/\s+/g, "");      
}

function findNextUnsolved(start, forward = true) {
  let i = start;
  for (let step = 0; step < TOTAL_ITEMS; step++) {
    i = forward ? (i % TOTAL_ITEMS) + 1 : (i - 2 + TOTAL_ITEMS) % TOTAL_ITEMS + 1;
    if (!solved.includes(i)) return i;
  }
  return null;
}

async function loadUserProgress() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!res.ok) {
      console.error("loadUserProgress: failed", await res.text().catch(()=>""));
      statusEl.innerText = "Failed to load user data.";
      return;
    }

    const payload = await res.json().catch(()=>({}));
    const user = payload.user ?? payload;

    // existing state sync...
    solved = Array.isArray(user?.solved_ids) ? user.solved_ids : (user?.solved_ids ?? []);
    attempts = (user?.attempts ?? TOTAL_ATTEMPTS);
    username = localStorage.getItem("username") || user?.name || username;
    if (username) localStorage.setItem("username", username);
    updateTopBar();

    // --- server timing ---
    // payload.server_time is ISO string from server, payload.remaining_seconds is authoritative seconds left
    if (payload.server_time) {
      serverReceivedAt = Date.now();
      // store authoritative remaining seconds (fallback to full time if server didn't return)
      serverRemainingSeconds = Number.isFinite(Number(payload.remaining_seconds)) ? Number(payload.remaining_seconds) : TOTAL_TIME_SECONDS;
    } else {
      // fallback: if server didn't return timing, use client-side start as before
      const startTimeUTC = user?.start ? new Date(user.start).getTime() : Date.now();
      serverReceivedAt = Date.now();
      serverRemainingSeconds = Math.max(0, TOTAL_TIME_SECONDS - Math.floor((Date.now() - startTimeUTC) / 1000));
    }

    if (solved.length >= TOTAL_ITEMS || attempts <= 0) {
      return showFinalResults();
    }

    if (serverRemainingSeconds <= 0) {
      return endGame();
    }

    startTimer();
    loadNextQuestion();
  } catch (err) {
    console.error("loadUserProgress error:", err);
    statusEl.innerText = "Network error loading user.";
  }
}

// --- Timer ---
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=> {
    if (serverRemainingSeconds === null || serverReceivedAt === null) {
      // fallback: show something or stop
      timerEl.innerText = "Time left: --";
      return;
    }
    const elapsedSinceReceive = Math.floor((Date.now() - serverReceivedAt) / 1000);
    const remaining = serverRemainingSeconds - elapsedSinceReceive;
    if (remaining <= 0) return endGame();
    const h = Math.floor(remaining/3600);
    const m = Math.floor((remaining%3600)/60);
    const s = remaining%60;
    timerEl.innerText = `Time left: ${h} h ${m} m ${s} s`;
  }, 1000);
}

// --- Question loading ---
function loadQuestionByIndex(index) {
  statusEl.innerText = "";
  currentIndex = index;
  questionImg.src = `https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions/Base-${index}.jpg`;
  answerInput.focus();
}

function loadNextQuestion() {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  loadQuestionByIndex(next);
}

// navigation buttons
if (prevBtn) prevBtn.onclick = () => {
  const prev = findNextUnsolved(currentIndex, false);
  if (!prev) return endGame();
  loadQuestionByIndex(prev);
};
if (nextBtn) nextBtn.onclick = () => {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  loadQuestionByIndex(next);
};

if (submitBtn) submitBtn.onclick = async () => {
  const rawAns = answerInput.value;
  if (!rawAns || !rawAns.trim()) return;

  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: currentIndex, answer: rawAns })
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      console.error("get_answer failed:", txt);
      statusEl.innerText = "Error checking answer";
      return;
    }

    const payload = await res.json().catch(()=>({}));
    const correct = payload?.correct === true;

    if (correct) {
      if (!solved.includes(currentIndex)) solved.push(currentIndex);
      await updateDB();
      updateTopBar();
      statusEl.style.color = "#2a7a2a";
      statusEl.innerText = "Correct";
      answerInput.value = "";
      setTimeout(()=> {
        statusEl.innerText = "";
        loadNextQuestion();
      }, 2000);
      return;
    }

    attempts--;
    statusEl.style.color = "crimson";
    statusEl.innerText = "Incorrect";
    setTimeout(()=> statusEl.innerText = "", 4000);
    if (attempts <= 0) return endGame();

    await updateDB();
    updateTopBar();
    answerInput.value = "";
  } catch (err) {
    console.error("Submit error:", err);
    statusEl.innerText = "Network/server error";
  }
};
async function updateDB() {
  let iq = null;
  if (normoCache && solved.length > 0) {
    const maybe = normoCache[solved.length];
    if (!isNaN(maybe)) iq = Number(maybe);
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) {
    console.error("updateDB: missing email (localStorage/email is empty)");
    return;
  }
  const solvedNums = Array.isArray(solved)
    ? solved.map(x => {
        const n = Number(x);
        return Number.isFinite(n) ? Math.trunc(n) : x;
      })
    : [];

  const payload = {
    email: cleanEmail,
    update: {
      solved_ids: solvedNums,
      score: solvedNums.length,
      attempts,
      iq
    }
  };
  console.log("updateDB payload ->", payload);
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const txt = await res.text().catch(() => "");
    let body;
    try { body = txt ? JSON.parse(txt) : null; } catch (e) { body = txt; }

    if (!res.ok) {
      console.error("update_user failed:", res.status, body);
      statusEl && (statusEl.innerText = "Could not save progress (server).");
      return;
    }

    console.log("update_user success:", body);

    if (body?.server_time && typeof body?.remaining_seconds !== "undefined") {
      serverReceivedAt = Date.now();
      serverRemainingSeconds = Number(body.remaining_seconds);
      console.log("Time sync:", {
        serverRemainingSeconds,
        serverReceivedAt
      });
    }
    if (body?.user) {
      const u = body.user;
      if (Array.isArray(u.solved_ids)) {
        solved = u.solved_ids.map(x => Number.isFinite(Number(x)) ? Number(x) : x);
      } else if (typeof u.solved_ids === "string") {
        try {
          const parsed = JSON.parse(u.solved_ids);
          if (Array.isArray(parsed)) solved = parsed;
        } catch {}
      }

      attempts = u.attempts ?? attempts;
      updateTopBar();
    }

  } catch (err) {
    console.error("updateDB network error:", err);
    statusEl && (statusEl.innerText = "Network error saving progress.");
  }
}

// --- Top bar update (IQ + score) ---
function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;
  attemptsEl.innerText = `Attempts left: ${attempts}`;

  const iqVal = (normoCache && normoCache[solved.length]) ? normoCache[solved.length] : "N/A";
  let iqEl = document.getElementById("iqEl");
  if (!iqEl) {
    iqEl = document.createElement("span");
    iqEl.id = "iqEl";
    scoreEl.parentNode.appendChild(iqEl);
  }
  iqEl.innerText = `IQ: ${iqVal} (Wechsler Scale)`;
}

// --- Leaderboard toggle in results (uses update_user) ---
async function loadLeaderboardState() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    if (!res.ok) return false;
    const payload = await res.json().catch(()=>({}));
    const user = payload.user ?? payload;
    return user?.leaderboard === true;
  } catch {
    return false;
  }
}

function showFinalResults() {
  clearInterval(timerInterval);
  const iq = normoCache?.[solved.length] ?? "N/A";

  document.querySelector(".container").innerHTML = `
    <h2>Test Completed</h2>
    <p><strong>Raw score:</strong> ${solved.length} / ${TOTAL_ITEMS}</p>
    <p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p>

    <label style="display:flex; align-items:center; gap:8px; margin-top:20px;">
      <input type="checkbox" id="leaderboardCheckbox">
      Be visible on the leaderboard
    </label>

    <p id="leaderboardStatus" style="margin-top:10px; font-weight:bold;"></p>
  `;

  const checkbox = document.getElementById("leaderboardCheckbox");
  const statusMsg = document.getElementById("leaderboardStatus");

  loadLeaderboardState().then(isOnBoard => { checkbox.checked = isOnBoard; });

  checkbox.addEventListener("change", async () => {
    const wantLeaderboard = checkbox.checked;
    try {
      const r = await fetch(UPDATE_USER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, update: { leaderboard: wantLeaderboard } })
      });
      if (r.ok) {
        statusMsg.innerText = wantLeaderboard ? "Added to leaderboard!" : "Removed from leaderboard.";
      } else {
        statusMsg.innerText = "Failed. Try again.";
      }
    } catch {
      statusMsg.innerText = "Network error";
    }
  });
}

function endGame() {
  clearInterval(timerInterval);
  attempts = 0;
  updateDB();
  showFinalResults();
}

// --- Change username modal logic (keeps original UX) ---
function openUsernameModal() {
  newUsernameInput.value = localStorage.getItem("username") || "";
  usernameStatus.textContent = "";
  changeUsernameModal.classList.remove("hidden");
  changeUsernameModal.setAttribute("aria-hidden", "false");
  setTimeout(() => newUsernameInput.focus(), 50);
}
function closeUsernameModal() {
  changeUsernameModal.classList.add("hidden");
  changeUsernameModal.setAttribute("aria-hidden", "true");
  usernameStatus.textContent = "";
}
changeUsernameBtn?.addEventListener("click", (e) => { e.preventDefault(); openUsernameModal(); });
cancelUsernameBtn?.addEventListener("click", (e) => { e.preventDefault(); closeUsernameModal(); });
changeUsernameModal?.addEventListener("click", (e) => {
  if (e.target === changeUsernameModal) closeUsernameModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !changeUsernameModal.classList.contains("hidden")) closeUsernameModal();
});

saveUsernameBtn?.addEventListener("click", async (e) => {
  e.preventDefault();
  const newName = newUsernameInput.value.trim();
  if (!newName) {
    usernameStatus.style.color = "crimson";
    usernameStatus.textContent = "Username cannot be empty";
    return;
  }

  usernameStatus.style.color = "#2a7a2a";
  usernameStatus.textContent = "Updating…";

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, update: { name: newName } })
    });

    if (!res.ok) {
      const txt = await res.text().catch(()=>"");
      console.error("Username update failed:", txt);
      usernameStatus.style.color = "crimson";
      usernameStatus.textContent = "Update failed";
      return;
    }

    localStorage.setItem("username", newName);
    usernameStatus.style.color = "#2a7a2a";
    usernameStatus.textContent = "Updated!";
    setTimeout(() => closeUsernameModal(), 900);

  } catch (err) {
    console.error("Username update error:", err);
    usernameStatus.style.color = "crimson";
    usernameStatus.textContent = "Network error";
  }
});

// --- Dark mode toggle persist ---
darkModeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  darkModeBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
});

// --- INIT ---
loadUserProgress();


