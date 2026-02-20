const UPDATE_USER_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user_neaito";
const GET_ANSWER_URL  = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer_neaito";
const TOTAL_ITEMS = 60;
const TOTAL_ATTEMPTS = 4; // attempts per item
const SPATIAL_ITEMS = [10, 20, 22, 29, 32, 33, 43, 47, 52, 53];
const TWO_ANSWERS = [1, 24, 25, 27, 44, 48, 55]; // items that must have two answers provided by the user

const scoreEl       = document.getElementById("scoreEl");
const attemptsEl    = document.getElementById("attemptsEl");
const questionImg   = document.getElementById("questionImg");
const submitBtn     = document.getElementById("submitBtn");
const prevBtn       = document.getElementById("prevBtn");
const nextBtn       = document.getElementById("nextBtn");
const finishBtn     = document.getElementById("finishBtn");

const spatialContainer = document.getElementById("spatialContainer");
const spatialCanvas = document.getElementById("spatialCanvas");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");
const resetCanvasBtn = document.getElementById("resetCanvasBtn");
const CELL_SIZE = 40;

let spatialGrid = [];

function initSpatialGrid(rows, cols) {
  spatialGrid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
  spatialCanvas.width  = cols * CELL_SIZE;
  spatialCanvas.height = rows * CELL_SIZE;
  drawSpatialGrid();
}

function drawSpatialGrid() {
  const ctx = spatialCanvas.getContext("2d");
  ctx.clearRect(0,0,spatialCanvas.width, spatialCanvas.height);
  for (let r = 0; r < spatialGrid.length; r++) {
    for (let c = 0; c < spatialGrid[0].length; c++) {
      ctx.fillStyle = spatialGrid[r][c] ? "#000" : "#fff";
      ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}

function updateSpatialGridFromInputs() {
  const rows = Math.min(6, Math.max(1, Number(rowsInput.value)));
  const cols = Math.min(12, Math.max(1, Number(colsInput.value)));
  initSpatialGrid(rows, cols);
}

rowsInput.addEventListener("change", updateSpatialGridFromInputs);
colsInput.addEventListener("change", updateSpatialGridFromInputs);
resetCanvasBtn.addEventListener("click", () => updateSpatialGridFromInputs());

function toggleCellFromEvent(x, y) {
  const rect = spatialCanvas.getBoundingClientRect();
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const c = Math.floor((x - rect.left) / (spatialCanvas.width / cols));
  const r = Math.floor((y - rect.top) / (spatialCanvas.height / rows));
  if (r >= 0 && r < rows && c >= 0 && c < cols) {
    spatialGrid[r][c] ^= 1;
    drawSpatialGrid();
  }
}

spatialCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  toggleCellFromEvent(touch.clientX, touch.clientY);
});

spatialCanvas.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  toggleCellFromEvent(e.clientX, e.clientY);
});

function serializeSpatialAnswer() {
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const flat = spatialGrid.map(row => row.join("")).join("");
  return `${cols}x${rows}:${flat}`;
}

function showStatusPopup(message, isCorrect) {
  const modal = document.getElementById("statusModal");
  const content = document.getElementById("statusContent");

  content.textContent = message;

  content.style.color = isCorrect ? "green" : "red";

  modal.classList.remove("hidden");

  setTimeout(() => {
    modal.classList.add("show");
  }, 10);

  setTimeout(() => {
    modal.classList.remove("show");
    setTimeout(() => {
      modal.classList.add("hidden");
    }, 200);
  }, 1000);
}

const changeUsernameModal = document.getElementById("changeUsernameModal");
const newUsernameInput = document.getElementById("newUsernameInput");
const usernameStatus = document.getElementById("usernameStatus");
const changeUsernameBtn = document.getElementById("changeUsernameBtn");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const cancelUsernameBtn = document.getElementById("cancelUsernameBtn");

function openUsernameModal() {
  newUsernameInput.value = localStorage.getItem("username") || "";
  usernameStatus.textContent = "";
  changeUsernameModal.classList.remove("hidden");
  changeUsernameModal.setAttribute("aria-hidden", "false");

  setTimeout(() => {
    changeUsernameModal.classList.add("show");
    newUsernameInput.focus();
  }, 50);
}

function closeUsernameModal() {
  changeUsernameModal.classList.remove("show");

  setTimeout(() => {
    changeUsernameModal.classList.add("hidden");
    changeUsernameModal.setAttribute("aria-hidden", "true");
    usernameStatus.textContent = "";
  }, 200);
}

changeUsernameBtn.addEventListener("click", () => {
  openUsernameModal();
});

cancelUsernameBtn.addEventListener("click", () => {
  closeUsernameModal();
});

changeUsernameModal.addEventListener("click", (e) => {
  if (e.target === changeUsernameModal) {
    closeUsernameModal();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !changeUsernameModal.classList.contains("hidden")) {
    closeUsernameModal();
  }
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
      body: JSON.stringify({     email,     password,        update: { name: newName }   })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("Username update failed:", txt);
      usernameStatus.style.color = "crimson";
      usernameStatus.textContent = "Update failed";
      return;
    }

    const payload = await res.json();

    if (payload?.error) {
      usernameStatus.style.color = "crimson";
      usernameStatus.textContent = payload.error || "Update failed";
      return;
    }

    // Update locally
    localStorage.setItem("username", newName);
    usernameStatus.style.color = "#2a7a2a";
    usernameStatus.textContent = "Updated!";

    // Close modal shortly after
    setTimeout(() => closeUsernameModal(), 900);

  } catch (err) {
    console.error("Username update error:", err);
    usernameStatus.style.color = "crimson";
    usernameStatus.textContent = "Network error";
  }
});

let email = localStorage.getItem("email");
let username = localStorage.getItem("username") || "";
let password = sessionStorage.getItem("password");

if (!email || !password) {
  window.location.href = "login.html";
}

let solved = []; 
let attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS); // per-item attempts array
let currentIndex = 0; // 1...60
let normoCache = null;

async function loadNorm() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/neaito_questions/norm.json');
    if (r.ok) normoCache = await r.json();
  } catch (e) {
    console.error("Could not load norm", e);
  }
}
loadNorm();

function normalizeClient(s) {
  if (s === undefined || s === null) return "";
  let t = String(s);
  t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
  t = t.replace(/^[\s"']+|[\s"']+$/g, "");
  return t.toLowerCase().replace(/\s+/g, "");
}

// find next unsolved AND not-exhausted item
function findNextUnsolved(start, forward = true) {
  let i = start;
  for (let step = 0; step < TOTAL_ITEMS; step++) {
    i = forward ? (i % TOTAL_ITEMS) + 1 : (i - 2 + TOTAL_ITEMS) % TOTAL_ITEMS + 1;
    const isSolved = solved.includes(i);
    const remaining = attempts[i - 1] ?? TOTAL_ATTEMPTS;
    if (!isSolved && remaining > 0) return i;
  }
  return null;
}

async function loadUserProgress() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      console.error("loadUserProgress: failed", await res.text().catch(()=> ""));
      return;
    }
    const payload = await res.json().catch(()=>({}));
    const user = payload.user ?? payload;

    // solved items from DB
    solved = Array.isArray(user?.solved_ids) ? user.solved_ids.map(x => Number(x)) : [];

    // attempts: if valid array of length TOTAL_ITEMS, use it; otherwise initialize default array
    if (Array.isArray(user?.attempts) && user.attempts.length === TOTAL_ITEMS) {
      attempts = user.attempts.map(n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : TOTAL_ATTEMPTS);
    } else {
      attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
    }

    username = localStorage.getItem("username") || user?.name || username;
    if (username) localStorage.setItem("username", username);

    updateTopBar();

    // If user finished in DB -> show results
    if (user?.finished === true) {
      return showFinalResults();
    }

    // If there are no available (unsolved & not exhausted) items -> finish
    const firstAvailable = findNextUnsolved(0, true);
    if (!firstAvailable) {
      // mark finished server-side and show results
      await updateDB({ extraUpdate: { finished: true } });
      return showFinalResults();
    }

    // start at first available
    loadQuestionByIndex(firstAvailable);
  } catch (err) {
    console.error("loadUserProgress error:", err);
  }
}

function clearInputs() {
  const input1 = document.getElementById("answerInput1");
  const input2 = document.getElementById("answerInput2");

  if (input1) input1.value = "";
  if (input2) input2.value = "";
}

function loadQuestionByIndex(index) {
  currentIndex = index;

  questionImg.src =
    `https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/neaito_questions/Base-${index}.jpg`;

  const answerInput1 = document.getElementById("answerInput1");
  const answerInput2 = document.getElementById("answerInput2");

  if (SPATIAL_ITEMS.includes(index)) {
    spatialContainer.classList.remove("hidden");  // show container
    answerInput1.style.display = "none";
    if (answerInput2) answerInput2.style.display = "none";
    updateSpatialGridFromInputs();
  } else {
    spatialContainer.classList.add("hidden");  // hide container
    answerInput1.style.display = "block";

    if (TWO_ANSWERS.includes(index)) {
      answerInput2.style.display = "block";
      answerInput1.placeholder = "Answer 1";
      answerInput2.placeholder = "Answer 2";
    } else {
      answerInput2.style.display = "none";
      answerInput1.placeholder = "Your answer…";
    }

    answerInput1.focus();
  }

  updateTopBar();
}

function loadNextQuestion() {
  const next = findNextUnsolved(currentIndex, true);
  if (!next) return endGame();
  loadQuestionByIndex(next);
}

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
  const cleanEmail = String(email || "").trim();
  if (!cleanEmail) return;

  const solvedNums = Array.isArray(solved)
    ? solved.map(x => Number.isFinite(Number(x)) ? Math.trunc(Number(x)) : x)
    : [];

  const updateObj = {
    solved_ids: solvedNums,
    score: solvedNums.length,
    ...extraUpdate
  };

  const payload = { email: cleanEmail, password, update: updateObj };

  if (decrementAttempt) {
    payload.decrement_attempt = true;
    // send 0-based index to backend
    payload.question_index = Math.max(0, (currentIndex - 1));
  }

  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error("update_user failed:", res.status, body);
      return body;
    }

    if (body?.user) {
      const u = body.user;
      // sync solved (server authoritative)
      solved = Array.isArray(u.solved_ids)
        ? u.solved_ids.map(x => Number.isFinite(Number(x)) ? Number(x) : x)
        : solved;

      // sync attempts array (server authoritative) with safety fallback
      if (Array.isArray(u.attempts) && u.attempts.length === TOTAL_ITEMS) {
        attempts = u.attempts.map(n => Number.isFinite(Number(n)) ? Math.max(0, Number(n)) : 0);
      } else {
        // keep the local attempts if server didn't return them correctly
        attempts = Array(TOTAL_ITEMS).fill(TOTAL_ATTEMPTS);
      }

      updateTopBar();
    }

    return body;
  } catch (err) {
    console.error("updateDB network error:", err);
    throw err;
  }
}

if (submitBtn) submitBtn.onclick = async () => {
  let rawAns;

  if (SPATIAL_ITEMS.includes(currentIndex)) {
    rawAns = serializeSpatialAnswer();
  } else {
    const input1 = document.getElementById("answerInput1").value.trim();
    const input2El = document.getElementById("answerInput2");

    if (TWO_ANSWERS.includes(currentIndex)) {
      const input2 = input2El.value.trim();
      if (!input1 || !input2) return;

      // Order-independent submission
      const sorted = [input1, input2]
        .map(v => normalizeClient(v))
        .sort();

      rawAns = sorted.join(",");
    } else {
      if (!input1) return;
      rawAns = input1;
    }
  }

  try {
    const res = await fetch(GET_ANSWER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        question: currentIndex,
        answer: rawAns
      })
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("get_answer failed:", txt);
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const correct = payload?.correct === true;

    if (correct) {
      if (!solved.includes(currentIndex)) solved.push(currentIndex);

      await updateDB({ extraUpdate: {} });

      updateTopBar();
      showStatusPopup("Correct!", true);

      clearInputs();

      setTimeout(() => {
        loadNextQuestion();
      }, 1000);

      return;
    }

    showStatusPopup("Incorrect!", false);

    await updateDB({ extraUpdate: {}, decrementAttempt: true });

    const remaining = attempts[currentIndex - 1] ?? 0;

    if (remaining <= 0) {
      await updateDB({ extraUpdate: {} });

      const next = findNextUnsolved(currentIndex, true);
      if (!next) return endGame();
      loadQuestionByIndex(next);
      return;
    }
    clearInputs();
    updateTopBar();

  } catch (err) {
    console.error("Submit error:", err);
  }
};

function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;

  // show attempts for current item (if any)
  let remaining = "";
  if (currentIndex > 0) {
    remaining = attempts[currentIndex - 1] ?? 0;
    attemptsEl.innerText = `Attempts left: ${remaining}`;
  } else {
    attemptsEl.innerText = `Attempts left: -`;
  }

  const iqVal = (normoCache && normoCache[solved.length]) ? normoCache[solved.length] : "N/A";
  let iqEl = document.getElementById("iqEl");
  if (!iqEl) {
    iqEl = document.createElement("span");
    iqEl.id = "iqEl";
    scoreEl.parentNode.appendChild(iqEl);
  }
  if (solved.length==0){
    iqEl.innerText = `IQ: N/A`;
  }else{
    iqEl.innerText = `IQ: ${iqVal} (Wechsler Scale)`;
  }
}

async function loadLeaderboardState() {
  try {
    const res = await fetch(UPDATE_USER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
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
  const toggleVideoLink = document.getElementById("toggleVideoLink");
  toggleVideoLink?.parentElement?.remove();

  const rawScore = solved.length;
  let iq = normoCache?.[rawScore] ?? "N/A";
  
  if (rawScore === 0) {
    iq = `${iq} or lower`;
  } else if (rawScore === TOTAL_ITEMS) {
    iq = `${iq} or higher`;
  }

  document.querySelector(".container").innerHTML = `
    <h2>Test Completed</h2>
    <p><strong>Raw score:</strong> ${rawScore} / ${TOTAL_ITEMS}</p>
    <p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p>

    <label style="display:flex; align-items:center; gap:8px; margin-top:20px;">
      <input type="checkbox" id="leaderboardCheckbox">
      Be visible on the NEAITO leaderboard
    </label>

    <p id="leaderboardStatus" style="margin-top:10px; font-weight:bold;"></p>
    
    <div style="text-align:center; margin-top:20px;">
      <button id="changeUsernameBtn">Change Username</button>
    </div>

    <form id="certForm" style="margin-top: 20px;">
      <label>Email:</label>
      <input type="email" id="email" value="${email}" readonly />
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
        "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/generate_naites_cert",
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
      container.innerHTML = `<iframe src="${url}" style="width:100%;height:600px;border:1px solid #ccc;margin-top:10px;" allowfullscreen></iframe>`;
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
        body: JSON.stringify({        email,        password,                       update: { leaderboard: wantLeaderboard }      })
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

async function endGame() {
  // mark finished and show final results
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
}

finishBtn?.addEventListener("click", async () => {
  const ok = window.confirm("Are you sure you want to finish the test?");
  if (!ok) return;
  await updateDB({ extraUpdate: { finished: true } });
  showFinalResults();
});


loadUserProgress();

