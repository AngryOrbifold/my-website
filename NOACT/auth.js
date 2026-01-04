const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";

const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const loginMsg = document.getElementById("loginMsg");

const emailInput = document.getElementById("email");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");

const loginBtn = document.getElementById("loginBtn");
const startTestBtn = document.getElementById("startTestBtn");

let email = "";
let username = "";

/* =========================
   UI HELPERS
========================= */

function showInstructions() {
  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");
}

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded, but user data is missing. Please reload.";
    loginBtn.disabled = false;
    return;
  }

  username = user.name;

  localStorage.setItem("email", email);
  localStorage.setItem("username", username);

  if (user.started) {
    location.replace("quiz.html");
  } else {
    showInstructions();
  }
}

/* =========================
   LOGIN
========================= */

async function login() {
  email = emailInput.value.trim().toLowerCase();
  const password = passwordInput.value;

  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  loginBtn.disabled = true;
  loginMsg.innerText = "Checking…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const payload = await res.json();

    if (!res.ok || payload.error) {
      loginMsg.innerText = payload.error || "Login failed.";
      loginBtn.disabled = false;
      return;
    }

    // ── User exists but has NO password yet
    if (payload.set_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.focus();
      loginMsg.innerText = "Create a password to continue.";
      loginBtn.onclick = setPassword;
      loginBtn.disabled = false;
      return;
    }

    // ── Password required
    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.focus();
      loginMsg.innerText = "Enter your password.";
      loginBtn.disabled = false;
      return;
    }

    // ── Fully authenticated
    finishLogin(payload.user);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

/* =========================
   SET PASSWORD (ONCE)
========================= */

async function setPassword() {
  const password = passwordInput.value;

  if (!password || password.length < 6) {
    loginMsg.innerText = "Password must be at least 6 characters.";
    return;
  }

  loginBtn.disabled = true;
  loginMsg.innerText = "Saving password…";

  try {
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        update: { pwd: password }
      })
    });

    const payload = await res.json();

    if (!res.ok || payload.error) {
      loginMsg.innerText = payload.error || "Failed to set password.";
      loginBtn.disabled = false;
      return;
    }

    // Restore login handler
    loginBtn.onclick = login;

    // Immediately log in after setting password
    finishLogin(payload.user);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

/* =========================
   START TEST
========================= */

startTestBtn?.addEventListener("click", async () => {
  startTestBtn.disabled = true;
  startTestBtn.innerText = "Starting…";

  try {
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        update: { started: true }
      })
    });

    const payload = await res.json();

    if (!res.ok || payload.error) {
      loginMsg.innerText = payload.error || "Failed to start test.";
      startTestBtn.disabled = false;
      startTestBtn.innerText = "Start Test";
      return;
    }

    location.replace("quiz.html");

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    startTestBtn.disabled = false;
    startTestBtn.innerText = "Start Test";
  }
});

/* =========================
   INIT
========================= */

loginBtn.onclick = login;

