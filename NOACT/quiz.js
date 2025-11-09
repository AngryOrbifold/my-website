const UPDATE_USER_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";
const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer";
const TOTAL_ITEMS = 50;
const TOTAL_ATTEMPTS = 30;
const FALLBACK_TOTAL_TIME_SECONDS = 360 * 3600; // only used as fallback if server doesn't provide timing

/* ----------------- DOM ----------------- */
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

/* ----------------- APP STATE ----------------- */
let email = localStorage.getItem("email");
let username = localStorage.getItem("username") || "";
if (!email) {
  window.location.href = "login.html";
}

let solved = [];
let attempts = TOTAL_ATTEMPTS;
let currentIndex = 1;
let normoCache = null;

/* ----------------- SERVER-AUTHORIZED TIMER ----------------- */
let serverReceivedAt = null;       
let serverRemainingSeconds = null;  
let timerInterval = null;

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

function applyServerTiming(server_time_iso, remaining_seconds_from_server) {
  serverReceivedAt = Date.now();
  serverRemainingSeconds = Number.isFinite(Number(remaining_seconds_from_server))
    ? Math.max(0, Math.trunc(Number(remaining_seconds_from_server)))
    : FALLBACK_TOTAL_TIME_SECONDS;
  console.log("applyServerTiming:", { serverReceivedAt, serverRemainingSeconds, server_time_iso });
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(()=> {
    if (serverRemainingSeconds === null || serverReceivedAt === null) {
      timerEl.innerText = "Time left: --";
      return;
    }
    const elapsedSinceReceive = Math.floor((Date.now() - serverReceivedAt) / 1000);
    const remaining = serverRemainingSeconds - elapsedSinceReceive;
    if (remaining <= 0) {
      if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
      return endGame();
    }
    const h = Math.floor(remaining/3600);
    const m = Math.floor((remaining%3600)/60);
    const s = remaining%60;
    timerEl.innerText = `Time left: ${h} h ${m} m ${s} s`;
  }, 1000);
}

/* ----------------- Load user progress (authoritative) ----------------- */
async function loadUserProgress() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      console.error("loadUserProgress: failed", await res.text().catch(()=> ""));
      statusEl.innerText = "Failed to load user data.";
      return;
    }

    const payload = await res.json().catch(()=>({}));
    const user = payload.user ?? payload;

    // sync state
    solved = Array.isArray(user?.solved_ids) ? user.solved_ids : (user?.solved_ids ?? []);
    attempts = (user?.attempts ?? TOTAL_ATTEMPTS);
    username = localStorage.getItem("username") || user?.name || username;
    if (username) localStorage.setItem("username", username);
    updateTopBar();

    // authoritative server timing if present
    if (typeof payload.remaining_seconds !== "undefined") {
      applyServerTiming(payload.server_time, payload.remaining_seconds);
    } else if (user?.start) {
      const startMs = new Date(user.start).getTime();
      serverReceivedAt = Date.now();
      serverRemainingSeconds = Math.max(0, FALLBACK_TOTAL_TIME_SECONDS - Math.floor((Date.now() - startMs) / 1000));
      console.warn("Using fallback timing computed from user.start.");
    } else {
      serverReceivedAt = Date.now();
      serverRemainingSeconds = FALLBACK_TOTAL_TIME_SECONDS;
      console.warn("No timing info from server; defaulting to full time.");
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

/* navigation */
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

async function updateDB({ extraUpdate = {}, decrementAttempt = false } = {}) {
  let iq = null;
  if (normoCache && solved.length > 0) {
    const maybe = normoCache[solved.length];
    if (!isNaN(maybe)) iq = Number(maybe);
  }

  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return;

  const solvedNums = Array.isArray(solved)
    ? solved.map(x => Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : x)
    : [];

  const updateObj = {
    solved_ids: solvedNums,
    score: solvedNums.length,
    iq: iq !== null ? Number(iq) : null,
    ...extraUpdate
  };

  const payload = { email: cleanEmail, update: updateObj };
  if (decrementAttempt) payload.decrement_attempt = true;

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("update_user failed:", res.status, body);
      statusEl && (statusEl.innerText = "Could not save progress (server).");
      return;
    }

    if (body?.user) {
      const u = body.user;
      solved = Array.isArray(u.solved_ids)
        ? u.solved_ids.map(x => Number.isFinite(Number(x)) ? Number(x) : x)
        : solved;
      attempts = u.attempts ?? attempts;
      updateTopBar();
    }
  } catch (err) {
    console.error("updateDB network error:", err);
    statusEl && (statusEl.innerText = "Network error saving progress.");
  }
}

/* ----------------- Submit flow ----------------- */
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
      // Correct answer: add to solved locally and persist
      if (!solved.includes(currentIndex)) solved.push(currentIndex);
      await updateDB({ extraUpdate: {} }); // server does not decrement attempts
      updateTopBar();
      statusEl.style.color = "#2a7a2a";
      statusEl.innerText = "Correct";
      answerInput.value = "";
      setTimeout(() => {
        statusEl.innerText = "";
        loadNextQuestion();
      }, 1000);
      return;
    }

    // Incorrect answer: decrement attempts in server
    statusEl.style.color = "crimson";
    statusEl.innerText = "Incorrect";
    setTimeout(() => statusEl.innerText = "", 2000);

    await updateDB({ extraUpdate: {}, decrementAttempt: true });

    if (attempts <= 0) return endGame();

    answerInput.value = "";
  } catch (err) {
    console.error("Submit error:", err);
    statusEl.innerText = "Network/server error";
  }
};

/* ----------------- Top bar update ----------------- */
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

/* ----------------- Leaderboard toggle in results ----------------- */
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
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
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
    
    <div style="text-align:center; margin-top:20px;">
      <button id="changeUsernameBtn">Change Username</button>
    </div>

    <div class="section"; margin-top:20px;">
      <p>You can see your certificate by inputing your email adress in the field below:</p>
    </div>

    <form id="certForm" style="margin-top: 20px;">
      <label>Email:</label>
      <input type="email" id="email" required />
      <button type="submit" class="button">Show Certificate</button>
    </form>

    <div id="result" style="margin-top: 20px;"></div>

  `;

  const checkbox = document.getElementById("leaderboardCheckbox");
  const statusMsg = document.getElementById("leaderboardStatus");

  loadLeaderboardState().then(isOnBoard => { if (checkbox) checkbox.checked = isOnBoard; });

  document.getElementById("certForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value;
    const container = document.getElementById("result");

    container.innerHTML = `<p style="font-weight:bold;">Certificate is being generated…</p>`;

    try {
      const res = await fetch(
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_certificate",
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

  checkbox?.addEventListener("change", async () => {
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
  document.getElementById("changeUsernameBtn")
    ?.addEventListener("click", (e) => {
      e.preventDefault();
      openUsernameModal();
    });
}

/* ----------------- End / finish ----------------- */
function endGame() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  attempts = 0;
  // persist final state; note: we do not request answerSubmitted here
  updateDB({ answerSubmitted: false });
  showFinalResults();
}

/* ----------------- Change username modal (UX) ----------------- */
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

/* ----------------- Dark mode toggle ----------------- */
darkModeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  localStorage.setItem("darkMode", isDark ? "enabled" : "disabled");
  darkModeBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
});

function resyncFromServer() {
  if (!email) return;
  fetch(UPDATE_USER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email })
  }).then(r => r.ok ? r.json() : null).then(p => {
    if (p?.remaining_seconds !== undefined) applyServerTiming(p.server_time, p.remaining_seconds);
    if (p?.user) {
      const u = p.user;
      if (Array.isArray(u.solved_ids)) solved = u.solved_ids;
      attempts = u.attempts ?? attempts;
      updateTopBar();
    }
  }).catch(e => console.warn("Resync failed:", e));
}
window.addEventListener("focus", () => setTimeout(resyncFromServer, 200));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") setTimeout(resyncFromServer, 200);
});
// periodic resync every 60s
setInterval(resyncFromServer, 60_000);

/* ----------------- INIT ----------------- */
loadUserProgress();


