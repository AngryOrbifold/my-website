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

async function login() {
  email = document.getElementById("email").value.trim();
  if (!email) return loginMsg.innerText = "Enter email.";

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
      // authenticated (present in auth table) but no online_data row yet
      usernameInput.classList.remove("hidden");
      loginMsg.innerText = "Authenticated. Please pick a username to continue.";
      loginBtn.onclick = register; 
      return;
    }

    // existing user
    username = payload.user.name;
    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    // If user already started, go directly to quiz — use replace so back button won't return
    if (payload.user.started) {
      location.replace("quiz.html");
    } else {
      showInstructions();
    }
  } catch (err) {
    console.error("Network error during login:", err);
    loginMsg.innerText = "Network error. Try again.";
  }
}

function showInstructions() {
  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");
}

// register: create row but DO NOT set start.
// we pass only the fields we want to initialize.
async function register() {
  username = usernameInput.value.trim();
  if (!username) {
    loginMsg.innerText = "Username required.";
    return;
  }

  try {
    const payload = {
      email,
      update: {
        name: username,
        solved_ids: [],
        attempts: 30,
        score: 0,
        iq: null,
        leaderboard: false,
        // do NOT include start or started here
      }
    };

    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text().catch(()=>"");
      console.error("Registration failed:", res.status, text);
      loginMsg.innerText = text || "Failed to register user";
      return;
    }

    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    showInstructions();
  } catch (err) {
    console.error("Registration error:", err);
    loginMsg.innerText = "Failed to register. Try again later.";
  }
}

startTestBtn?.addEventListener("click", async () => {
  startTestBtn.disabled = true;
  startTestBtn.innerText = "Starting…";

  try {
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, update: { started: true } })
    });

    const payload = await res.json().catch(()=>({}));

    if (!res.ok || payload?.error) {
      console.error("Start failed:", res.status, payload);
      loginMsg.innerText = payload?.error || "Failed to start test.";
      startTestBtn.disabled = false;
      startTestBtn.innerText = "Start the Test";
      return;
    }

    // navigate using replace so Back doesn't allow double-start
    location.replace("quiz.html");
  } catch (err) {
    console.error("Network error starting test:", err);
    loginMsg.innerText = "Network error. Try again.";
    startTestBtn.disabled = false;
    startTestBtn.innerText = "Start the Test";
  }
});

document.getElementById("loginBtn").onclick = login;

