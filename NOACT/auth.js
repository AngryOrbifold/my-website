const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";

const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const loginMsg = document.getElementById("loginMsg");
const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const startTestBtn = document.getElementById("startTestBtn");
const passwordInput = document.getElementById("password");

let email = "";
let username = "";

async function login() {
  email = document.getElementById("email").value.trim();
  const password = passwordInput.value;

  if (!email) {
    loginMsg.innerText = "Enter email.";
    return;
  }

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const payload = await res.json().catch(() => ({}));

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Login failed.";
      return;
    }

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      loginMsg.innerText = "Enter your password.";
      return;
    }

    if (payload.set_password) {
      passwordInput.classList.remove("hidden");
      loginMsg.innerText = "Create a password to continue.";
      loginBtn.onclick = setPassword;
      return;
    }
    if (payload.user === null) {
      usernameInput.classList.remove("hidden");
      loginMsg.innerText = "Authenticated. Please pick a username to continue.";
      loginBtn.onclick = register;
      return;
    }
    username = payload.user.name;
    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    if (payload.user.started) {
      location.replace("quiz.html");
    } else {
      showInstructions();
    }

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
  }
}

function showInstructions() {
  loginSection.classList.add("hidden");
  instructionsSection.classList.remove("hidden");
}

async function setPassword() {
  const password = passwordInput.value;

  if (password.length < 6) {
    loginMsg.innerText = "Password must be at least 6 characters.";
    return;
  }

  try {
    const res = await fetch(UPDATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        update: { pwd: password }
      })
    });

    if (!res.ok) {
      loginMsg.innerText = "Failed to set password.";
      return;
    }

    loginBtn.onclick = login;
    login();
  } catch (err) {
    loginMsg.innerText = "Network error.";
  }
}

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

    location.replace("quiz.html");
  } catch (err) {
    console.error("Network error starting test:", err);
    loginMsg.innerText = "Network error. Try again.";
    startTestBtn.disabled = false;
    startTestBtn.innerText = "Start the Test";
  }
});

document.getElementById("loginBtn").onclick = login;




