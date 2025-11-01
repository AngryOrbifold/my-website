const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";

const loginSection = document.getElementById("loginSection");
const instructionsSection = document.getElementById("instructionsSection");
const loginMsg = document.getElementById("loginMsg");
const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");

let email = "";     
let username = "";

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

    username = payload.user.name;
    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    if (payload.user.start) {
      window.location.href = "quiz.html";
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

async function register() {
  username = usernameInput.value.trim();
  if (!username) {
    loginMsg.innerText = "Username required.";
    return;
  }

  const start = new Date().toISOString();

  try {
    const payload = {
      email,
      update: { name: username, solved_ids: [], attempts: 30, score: 0, start }
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

    const result = await res.json().catch(() => ({}));
    localStorage.setItem("email", email);
    localStorage.setItem("username", username);

    showInstructions();
  } catch (err) {
    console.error("Registration error:", err);
    loginMsg.innerText = "Failed to register. Try again later.";
  }
}

document.getElementById("startTestBtn").onclick = () => {
  window.location.href = "quiz.html";
};

document.getElementById("loginBtn").onclick = login;
