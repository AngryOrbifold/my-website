const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_ovat";

const loginSection = document.getElementById("loginSection");
const loginMsg     = document.getElementById("loginMsg");

const emailInput    = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn      = document.getElementById("loginBtn");

const UPDATE_URL = LOGIN_URL;

let email = "";

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing. Try again.";
    loginBtn.disabled = false;
    return;
  }

  localStorage.setItem("email", email);

  location.replace("quiz_ovat.html");
}
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

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Login failed.";
      loginBtn.disabled = false;
      return;
    }

    if (payload.user === null) {
      passwordInput.classList.remove("hidden");
      loginMsg.innerText = "New user detected. Set a password to continue.";
      loginBtn.onclick = setPassword;
      loginBtn.disabled = false;
      return;
    }

    if (payload.set_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";
      loginMsg.innerText = "Create a password to continue.";
      loginBtn.onclick = setPassword;
      loginBtn.disabled = false;
      return;
    }

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";
      loginMsg.innerText = "Enter your password.";
      loginBtn.disabled = false;
      return;
    }

    finishLogin(payload.user);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

async function setPassword() {
  const password = passwordInput.value.trim();

  if (!password) {
    loginMsg.innerText = "Password required.";
    return;
  }

  loginBtn.disabled = true;
  loginMsg.innerText = "Saving password…";

  try {
    const res = await fetch(LOGIN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },

      body: JSON.stringify({
        email,
        update: { pwd: password }
      })

    });

    const payload = await res.json();

    if (!res.ok || payload?.error) {
      loginMsg.innerText = payload?.error || "Failed to set password.";
      loginBtn.disabled = false;
      return;
    }

    loginBtn.onclick = login;
    finishLogin(payload.user);

  } catch (err) {
    console.error(err);
    loginMsg.innerText = "Network error.";
    loginBtn.disabled = false;
  }
}

loginBtn.onclick = login;
