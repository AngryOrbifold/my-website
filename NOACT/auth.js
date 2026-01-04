const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const usernameInput = document.getElementById("username");
const loginBtn = document.getElementById("loginBtn");
const loginMsg = document.getElementById("loginMsg");
const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login";
const UPDATE_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/update_user";
let email = "";
let username = "";

/* ---------------- LOGIN ---------------- */
async function login() {
  email = emailInput.value.trim().toLowerCase();
  if (!email) {
    loginMsg.innerText = "Enter your email.";
    return;
  }

  loginMsg.innerText = "Checking…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const payload = await res.json();

    if (!res.ok) {
      loginMsg.innerText = payload.error || "Login failed.";
      return;
    }
    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      loginMsg.innerText = "Enter your password.";
      loginBtn.onclick = submitPassword;
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
      loginMsg.innerText = "Pick a username to continue.";
      loginBtn.onclick = register;
      return;
    }
    finishLogin(payload.user);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
  }
}

async function register() {
  username = usernameInput.value.trim();
  if (!username) {
    loginMsg.innerText = "Enter a username.";
    return;
  }

  loginMsg.innerText = "Creating account…";

  const res = await fetch(UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      update: { name: username }
    })
  });

  const payload = await res.json();

  if (!res.ok) {
    loginMsg.innerText = payload.error || "Registration failed.";
    return;
  }

  localStorage.setItem("email", email);
  localStorage.setItem("username", username);

  passwordInput.classList.remove("hidden");
  loginMsg.innerText = "Create a password to continue.";
  loginBtn.onclick = setPassword;
}

async function setPassword() {
  const pwd = passwordInput.value;
  if (!pwd || pwd.length < 4) {
    loginMsg.innerText = "Password too short.";
    return;
  }

  loginMsg.innerText = "Saving password…";

  const res = await fetch(UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      update: { pwd }
    })
  });

  const payload = await res.json();

  if (!res.ok) {
    loginMsg.innerText = payload.error || "Password update failed.";
    return;
  }

  finishLogin(payload.user);
}

async function submitPassword() {
  const pwd = passwordInput.value;
  if (!pwd) {
    loginMsg.innerText = "Enter your password.";
    return;
  }

  loginMsg.innerText = "Verifying…";

  const res = await fetch(LOGIN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, pwd })
  });

  const payload = await res.json();

  if (!res.ok) {
    loginMsg.innerText = payload.error || "Wrong password.";
    return;
  }

  finishLogin(payload.user);
}

function finishLogin(user) {
  localStorage.setItem("email", email);
  localStorage.setItem("username", user.name);

  if (user.started) {
    location.replace("quiz.html");
  } else {
    showInstructions();
  }
}

loginBtn.onclick = login;
