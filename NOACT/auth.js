const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";
const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const loginMsg = document.getElementById("loginMsg");
const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const startTestBtn = document.getElementById("startTestBtn");

let email = "";
let username = "";

// --- LOGIN ---
async function login() {
  email = document.getElementById("email").value.trim();
  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    loginMsg.innerText = "Invalid email format.";
    return;
  }

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || payload?.reason || "Login failed.";
      console.error("Login failed:", res.status, payload);
      return;
    }

    if (!payload.user) {
      usernameInput.classList.remove("hidden");
      loginMsg.innerText = "Authenticated. Please pick a username to continue.";
      loginBtn.onclick = register; 
      return;
    }

    // Existing user
    username = payload.user.name;
    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    if (payload.user.started) {
      // User already started, go directly to quiz
      window.location.href = "quiz.html";
    } else {
      // Show instructions page
      showInstructions(payload.user.started);
    }

  } catch (err) {
    console.error("Network error during login:", err);
    loginMsg.innerText = "Network error. Try again.";
  }
}

// --- SHOW INSTRUCTIONS ---
function showInstructions(started) {
  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");

  if (started) {
    startTestBtn.disabled = true;
    loginMsg.innerText = "You have already started the test.";
  } else {
    startTestBtn.disabled = false;
    loginMsg.innerText = "";
  }
}

// --- REGISTER NEW USER ---
async function register() {
  username = usernameInput.value.trim();
  if (!username) {
    loginMsg.innerText = "Username required.";
    return;
  }

  try {
    const payload = {
      email,
      update: { name: username, solved_ids: [], attempts: 30, score: 0, started: false }
    };

    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Registration failed:", res.status, text);
      loginMsg.innerText = text || "Failed to register user";
      return;
    }

    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    showInstructions(false);

  } catch (err) {
    console.error("Registration error:", err);
    loginMsg.innerText = "Failed to register. Try again later.";
  }
}

// --- START TEST BUTTON ---
startTestBtn.onclick = async () => {
  try {
    // Fetch current user data to check if already started
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });
    const payload = await res.json().catch(() => ({}));
    const user = payload.user ?? payload;

    if (user.started) {
      loginMsg.innerText = "Test already started.";
      return;
    }

    // Update DB: set start timestamp and mark started = true
    const start = new Date().toISOString();
    await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, update: { start, started: true } })
    });

    window.location.href = "quiz.html";

  } catch (err) {
    console.error("Error starting test:", err);
    loginMsg.innerText = "Could not start test. Try again.";
  }
};

loginBtn.onclick = login;
