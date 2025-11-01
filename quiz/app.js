const SUPABASE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/rest/v1/online_data";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFsbWx2dG9odGtpeWN3dG9ocXdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg4NzQyNzksImV4cCI6MjA2NDQ1MDI3OX0.HKvnspHl__TBAoAJ1NJOy4fCVug_el7TpNNVlDbrilE";

const TOTAL_ITEMS = 50;
const TOTAL_ATTEMPTS = 30;
const TOTAL_TIME_SECONDS = 360*3600; // 360 hours

// DOM
const loginSection = document.getElementById("loginSection");
const gameSection = document.getElementById("gameSection");
const usernameInput = document.getElementById("username");
const loginMsg = document.getElementById("loginMsg");
const scoreEl = document.getElementById("scoreEl");
const attemptsEl = document.getElementById("attemptsEl");
const timerEl = document.getElementById("timerEl");
const questionImg = document.getElementById("questionImg");
const statusEl = document.getElementById("status");
const answerInput = document.getElementById("answerInput");
const submitBtn = document.getElementById("submitBtn");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");

let email = "";
let username = "";
let solved = [];
let attempts = TOTAL_ATTEMPTS;
let currentIndex = 1;
let startTimeUTC = null;
let timerInterval;
let normoCache = null;

// ---------------- LOGIN ----------------
async function login() {
  email = document.getElementById("email").value.trim();
  if (!email) { loginMsg.innerText="Enter email."; return; }

  const res = await fetch(`${SUPABASE_URL}?email=eq.${encodeURIComponent(email)}`, {
    headers: { 
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Accept": "application/json"
    }
  });
  const dataArr = await res.json();
  const data = dataArr[0];

  if (!data) {
    // New user
    usernameInput.classList.remove("hidden");
    loginMsg.innerText = "New user — pick a username.";
    document.getElementById("loginBtn").onclick = createNewUser;
  } else {
    // Existing user
    username = data.name || email;
    solved = data.solved_ids || [];
    attempts = data.attempts || TOTAL_ATTEMPTS;

    if (data.start) {
      startTimeUTC = new Date(data.start).getTime();
    } else {
      startTimeUTC = Date.now(); // fallback
    }
    startGame();
  }
}

// Load normo.json once at startup
async function loadNormo() {
  try {
    const res = await fetch('https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions/normo.json');
    if (!res.ok) throw new Error("Failed to fetch normo.json");
    normoCache = await res.json();
  } catch (err) {
    console.error(err);
    statusEl.innerText = "❌ Could not load normo data!";
  }
}

// Call at startup
loadNormo();

// ---------------- CREATE NEW USER ----------------
async function createNewUser() {
  const name = usernameInput.value.trim();
  if (!name) {
    loginMsg.innerText = "Username required.";
    return;
  }

  startTimeUTC = Date.now();

  const res = await fetch(SUPABASE_URL, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_KEY,
      "Authorization": "Bearer " + SUPABASE_KEY,
      "Content-Type": "application/json",
      "Accept": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify([{
      email,
      name,
      solved_ids: [],
      attempts: TOTAL_ATTEMPTS,
      score: 0,
      start: new Date(startTimeUTC).toISOString()
    }])
  });

  const data = await res.json();

  if (res.ok && data.length) {
    console.log("User created:", data[0]);
    startGame();
  } else {
    console.error("Failed to create user:", data);
    loginMsg.innerText = "Failed to create user. Check console.";
  }
}

// Navigate to previous item
prevBtn.onclick = () => {
  let i = currentIndex;
  do {
    i = i - 1 < 1 ? TOTAL_ITEMS : i - 1;
  } while (solved.includes(i) && i !== currentIndex);

  currentIndex = i;
  loadQuestionByIndex(i);
};

// Navigate to next item
nextBtn.onclick = () => {
  let i = currentIndex;
  do {
    i = i + 1 > TOTAL_ITEMS ? 1 : i + 1;
  } while (solved.includes(i) && i !== currentIndex);

  currentIndex = i;
  loadQuestionByIndex(i);
};

// Load a specific item by index
async function loadQuestionByIndex(index) {
  if (solved.includes(index)) {
    return loadNextQuestion(); 
  }

  statusEl.innerText = "";

  const url = `https://qlmlvtohtkiycwtohqwk.supabase.co/storage/v1/object/public/questions/Base-${index}.jpg`;
  questionImg.src = url;
}

// ---------------- START GAME ----------------
function startGame() {
  loginSection.classList.add("hidden");
  gameSection.classList.remove("hidden");
  updateTopBar();
  startTimer();
  loadNextQuestion();
}

// ---------------- TIMER ----------------
function startTimer() {
  timerInterval = setInterval(()=>{
    const elapsed = Math.floor((Date.now() - startTimeUTC)/1000);
    const remaining = TOTAL_TIME_SECONDS - elapsed;
    if (remaining <=0) return endGame();
    const h = Math.floor(remaining/3600);
    const m = Math.floor((remaining%3600)/60);
    const s = remaining%60;
    timerEl.innerText = `Time left: ${h} h ${m} m ${s} s`;
  },1000);
}

// ---------------- LOAD QUESTION ----------------
async function loadNextQuestion() {
  for (let i = currentIndex + 1; i <= TOTAL_ITEMS; i++) {
    if (!solved.includes(i)) {
      currentIndex = i;
      return loadQuestionByIndex(i);
    }
  }
  for (let i = 1; i < currentIndex; i++) {
    if (!solved.includes(i)) {
      currentIndex = i;
      return loadQuestionByIndex(i);
    }
  }

  return endGame();
}

// ---------------- SUBMIT ANSWER ----------------
submitBtn.onclick = async () => {
  const rawAns = answerInput.value;
  if (!rawAns || !rawAns.trim()) return;

  // Normalize helpers:
  // - keep punctuation
  // - lower-case, remove diacritics
  // - collapsed = single spaces (useful for token comparisons)
  // - nospace = remove ALL whitespace (user said "spaces are not important")
  const stripDiacritics = s => s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const collapsed = s => stripDiacritics(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const nospace = s => stripDiacritics(s).toLowerCase().replace(/\s+/g, '').trim();
  const digitsOnly = s => (s || '').replace(/\D+/g, '');

  const userCollapsed = collapsed(rawAns);
  const userNoSpace = nospace(rawAns);
  const userDigits = digitsOnly(rawAns);

  try {
    const res = await fetch(
      "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/get_answer",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "apikey": SUPABASE_KEY
        },
        body: JSON.stringify({ question: currentIndex }),
      }
    );

    if (!res.ok) {
      console.error("Edge function error:", await res.text());
      statusEl.innerText = "❌ Error checking answer!";
      return;
    }

    const { answer } = await res.json();
    if (!answer) {
      statusEl.innerText = "⚠️ No answer returned!";
      return;
    }

    // Split alternatives on '%' and normalize each alternative
    const altsRaw = String(answer).split('%').map(a => a.trim()).filter(Boolean);

    let correct = false;

    for (let altRaw of altsRaw) {
      const altCollapsed = collapsed(altRaw);
      const altNoSpace = nospace(altRaw);
      const altDigits = digitsOnly(altRaw);
      // 1) Exact no-space match (preferred for symbol-heavy answers)
      if (userNoSpace && altNoSpace && userNoSpace === altNoSpace) {
        correct = true;
        break;
      }
      // 2) Collapsed-space exact match (handles normal word answers, punctuation kept)
      if (userCollapsed && altCollapsed && userCollapsed === altCollapsed) {
        correct = true;
        break;
      }
      // 3) Numeric match (both have digits and equal)
      if (altDigits && userDigits && altDigits === userDigits) {
        correct = true;
        break;
      }
      // 4) Fallback: alt contains user or user contains alt on collapsed-no-space form
      //    This helps cases like "beach" vs "the beach" while still respecting punctuation.
      if (userNoSpace && altNoSpace) {
        if (userNoSpace.includes(altNoSpace) || altNoSpace.includes(userNoSpace)) {
          correct = true;
          break;
        }
      }
    }

    if (correct) {
      if (!solved.includes(currentIndex)) solved.push(currentIndex);
      await updateDB(); // DB will now also save IQ
      statusEl.innerText = "✅ Correct!";
      setTimeout(() => statusEl.innerText = "", 5000); // clear after 2s
      setTimeout(loadNextQuestion, 800);
    } else {
      attempts--;
      await updateDB(); // persist attempts and IQ
      statusEl.innerText = "❌ Incorrect!";
      setTimeout(() => statusEl.innerText = "", 5000); // clear after 2s
      if (attempts <= 0) return endGame();
    }

    updateTopBar();
    answerInput.value = "";

  } catch (err) {
    console.error("Submit error:", err);
    statusEl.innerText = "❌ Network or server error!";
  }
};

// ---------------- UPDATE DATABASE ----------------
async function updateDB() {
  let iq = "N/A";
  if (normoCache && solved.length > 0) {
    iq = normoCache[solved.length] || "N/A";
  }

  await fetch(`${SUPABASE_URL}?email=eq.${encodeURIComponent(email)}`,{
    method:"PATCH",
    headers:{
      "apikey": SUPABASE_KEY,
      "Authorization":"Bearer "+SUPABASE_KEY,
      "Content-Type":"application/json",
      "Prefer":"return=representation"
    },
    body: JSON.stringify({
      solved_ids: solved,
      score: solved.length,
      attempts: attempts,
      iq: iq
    })
  });
}

async function getIQScore(rawScore) {
  const normo = await fetchNormo();
  if (!normo) return "N/A";

  const iq = normo[rawScore] || "N/A";
  return iq;
}

// ---------------- UI UPDATE ----------------
function updateTopBar() {
  scoreEl.innerText = `Score: ${solved.length}`;
  attemptsEl.innerText = `Attempts left: ${attempts}`;

  let iqText = "N/A";
  if (normoCache && solved.length > 0) {
    iqText = normoCache[solved.length] || "N/A";
  }

  const iqEl = document.getElementById("iqEl");
  if (iqEl) {
    iqEl.innerText = `IQ: ${iqText} (Wechsler Scale)`;
  } else {
    const span = document.createElement("span");
    span.id = "iqEl";
    span.innerText = `IQ: ${iqText}  (Wechsler Scale)`;
    scoreEl.parentNode.appendChild(span);
  }
}

const darkModeBtn = document.getElementById("darkModeBtn");

darkModeBtn.onclick = () => {
  document.body.classList.toggle("dark-mode");

  // Optional: change button icon/text
  if (document.body.classList.contains("dark-mode")) {
    darkModeBtn.textContent = "Light Mode";
  } else {
    darkModeBtn.textContent = "Dark Mode";
  }
};

// ---------------- END GAME ----------------
function endGame(){
  clearInterval(timerInterval);
  gameSection.innerHTML = `<h2>Test Complete</h2><p>Final Score: ${solved.length} / ${TOTAL_ITEMS}</p>`;
}

// ---------------- INITIALIZE ----------------
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("loginBtn").onclick = login;
});