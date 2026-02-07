const QUIZ_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/quiz_saito";
const TOTAL_ITEMS = 30;
const TOTAL_ATTEMPTS = 15;
const SPATIAL_ITEMS = [4, 7, 15, 24, 27, 30];

const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const questionImg = document.getElementById("questionImg");
const statusEl = document.getElementById("status");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const finishBtn = document.getElementById("finishBtn");

const spatialContainer = document.getElementById("spatialContainer");
const spatialCanvas = document.getElementById("spatialCanvas");
const rowsInput = document.getElementById("rowsInput");
const colsInput = document.getElementById("colsInput");

let spatialGrid = [];
let CELL_SIZE = 40;

function initSpatialGrid(rows, cols) {
  spatialGrid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 0)
  );
  updateCanvasSize();
}

function drawSpatialGrid() {
  const ctx = spatialCanvas.getContext("2d");
  ctx.clearRect(0, 0, spatialCanvas.width, spatialCanvas.height);
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const cellW = spatialCanvas.width / cols;
  const cellH = spatialCanvas.height / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = spatialGrid[r][c] ? "#000" : "#fff";
      ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
    }
  }
}

function updateCanvasSize() {
  if (!spatialGrid.length) return;
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const maxWidth = Math.min(window.innerWidth - 40, 400);
  const maxHeight = Math.min(window.innerHeight / 2, 400);
  CELL_SIZE = Math.floor(Math.min(maxWidth / cols, maxHeight / rows));
  spatialCanvas.width = cols * CELL_SIZE;
  spatialCanvas.height = rows * CELL_SIZE;
  drawSpatialGrid();
}

function updateSpatialGridFromInputs() {
  const rows = Math.min(6, Math.max(1, Number(rowsInput.value)));
  const cols = Math.min(12, Math.max(1, Number(colsInput.value)));
  initSpatialGrid(rows, cols);
}

rowsInput.addEventListener("change", updateSpatialGridFromInputs);
colsInput.addEventListener("change", updateSpatialGridFromInputs);
resetCanvasBtn.addEventListener("click", updateSpatialGridFromInputs);
window.addEventListener("resize", updateCanvasSize);

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

spatialCanvas.addEventListener("click", (e) => toggleCellFromEvent(e.clientX, e.clientY));
spatialCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  const touch = e.touches[0];
  toggleCellFromEvent(touch.clientX, touch.clientY);
});

function serializeSpatialAnswer() {
  const rows = spatialGrid.length;
  const cols = spatialGrid[0].length;
  const flat = spatialGrid.map(row => row.join("")).join("");
  return `${cols}x${rows}:${flat}`;
}

let email = localStorage.getItem("email");
if (!email) window.location.href = "login.html";

let solved = [];
let attempts = TOTAL_ATTEMPTS;
let currentIndex = 0;
let normoCache = null;

const APP_CHANNEL = "SAITO_channel";
const channel = new BroadcastChannel(APP_CHANNEL);
const TAB_ID = Math.random().toString(36).slice(2);

channel.onmessage = (msg) => {
  if (msg.data?.type === "HELLO" && msg.data.id !== TAB_ID) blockUI();
};
channel.postMessage({ type: "HELLO", id: TAB_ID });

function blockUI() {
  document.body.innerHTML = `<div style="display:flex; align-items:center; justify-content:center; height:100vh; text-align:center; background:#000; color:#fff; font-size:22px; padding:30px;">The test is already open in another tab.<br><br>Please close the other tab and refresh this one.</div>`;
}

async function loadNormSaito() {
  try {
    const r = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions3/normsaito.json');
    if (r.ok) normoCache = await r.json();
  } catch {}
}
loadNormSaito();

function normalizeClient(s) {
  if (s === undefined || s === null) return "";
  return String(s).replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/^[\s"']+|[\s"']+$/g, "").toLowerCase().replace(/\s+/g, "");
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
    const res = await fetch(QUIZ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    if (!res.ok) {
      statusEl.innerText = "Failed to load user data.";
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const user = payload.user ?? payload;

    solved = Array.isArray(user?.solved_ids) ? user.solved_ids : [];
    attempts = user?.attempts ?? TOTAL_ATTEMPTS;
    updateTopBar();

    if (user?.finished === true || solved.length >= TOTAL_ITEMS || attempts <= 0) {
      showFinalResults();
      return;
    }

    loadQuestionByIndex(findNextUnsolved(currentIndex, true));
  } catch {
    statusEl.innerText = "Network error loading user.";
  }
}

function loadQuestionByIndex(index) {
  currentIndex = index;
  statusEl.innerText = "";
  questionImg.src = `https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions3/Base-${index}.jpg`;
  if (SPATIAL_ITEMS.includes(index)) {
    spatialContainer.style.display = "flex";
    answerInput.style.display = "none";
    updateSpatialGridFromInputs();
  } else {
    spatialContainer.style.display = "none";
    answerInput.style.display = "block";
    answerInput.focus();
  }
}

if (prevBtn) prevBtn.onclick = () => { const prev = findNextUnsolved(currentIndex, false); if (prev) loadQuestionByIndex(prev); };
if (nextBtn) nextBtn.onclick = () => { const next = findNextUnsolved(currentIndex, true); if (next) loadQuestionByIndex(next); };

async function updateDB({ extraUpdate = {}, decrementAttempt = false } = {}) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!cleanEmail) return;

  const solvedNums = Array.isArray(solved)
    ? solved.map(x => Number.isFinite(Number(x)) ? Number(x) : x)
    : [];

  const updateObj = { solved_ids: solvedNums, score: solvedNums.length, ...extraUpdate };

  const payload = { email: cleanEmail, update: updateObj };
  if (decrementAttempt) payload.decrement_attempt = true;

  try {
    const res = await fetch(QUIZ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      statusEl.innerText = "Could not save progress";
      console.error("Supabase error:", body);
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
    statusEl.innerText = "Network error saving progress";
    console.error("UpdateDB error:", err);
  }
}

if (submitBtn) submitBtn.onclick = async () => {
  let rawAns = SPATIAL_ITEMS.includes(currentIndex)
    ? serializeSpatialAnswer()
    : answerInput.value;

  if (!rawAns?.trim()) return;

  try {
    const res = await fetch(QUIZ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: currentIndex, answer: rawAns }) // only question & answer
    });

    if (!res.ok) {
      statusEl.innerText = "Error checking answer";
      return;
    }

    const payload = await res.json().catch(() => ({}));
    const correct = payload?.correct === true;

    if (correct) {
      if (!solved.includes(currentIndex)) solved.push(currentIndex);
      await updateDB({});
      statusEl.style.color = "#2a7a2a";
      statusEl.innerText = "Correct";
      answerInput.value = "";
      setTimeout(() => {
        statusEl.innerText = "";
        loadQuestionByIndex(findNextUnsolved(currentIndex, true));
      }, 1000);
      return;
    }

    statusEl.style.color = "crimson";
    statusEl.innerText = "Incorrect";
    setTimeout(() => (statusEl.innerText = ""), 2000);

    await updateDB({ decrementAttempt: true });
    if (attempts <= 0) endGame();
    answerInput.value = "";
  } catch {
    statusEl.innerText = "Network/server error";
  }
};

function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;
  attemptsEl.innerText = `Attempts left: ${attempts}`;
  const iqVal = (normoCache && normoCache[solved.length]) ? normoCache[solved.length] : "N/A";
  let iqEl = document.getElementById("iqEl");
  if (!iqEl) { iqEl = document.createElement("span"); iqEl.id="iqEl"; scoreEl.parentNode.appendChild(iqEl); }
  if (solved.length==0){iqEl.innerText = `IQ: N/A (Wechsler Scale);`}
  else{iqEl.innerText = `IQ: ${iqVal} (Wechsler Scale)`;}
}

function showFinalResults() {
  const iq = normoCache?.[solved.length] ?? "N/A";
  document.querySelector(".container").innerHTML = `<h2>Test Completed</h2><p><strong>Raw score:</strong> ${solved.length} / ${TOTAL_ITEMS}</p><p><strong>Estimated IQ (Wechsler Scale):</strong> ${iq}</p><p>Thank you for your participation in the project.</p><p>M.-A. Nydegger</p>`;
}

async function endGame() {
  attempts=0;
  await updateDB({extraUpdate:{finished:true}});
  showFinalResults();
}

finishBtn?.addEventListener("click", async () => {
  if(!window.confirm("Are you sure you want to finish the test?")) return;
  await updateDB({extraUpdate:{finished:true}});
  showFinalResults();
});

let touchStartX=0;
spatialCanvas.addEventListener("touchstart", e=>{touchStartX=e.touches[0].clientX;});
spatialCanvas.addEventListener("touchend", e=>{
  const dx=e.changedTouches[0].clientX-touchStartX;
  if(dx>50) prevBtn?.click();
  if(dx<-50) nextBtn?.click();
});

loadUserProgress();
