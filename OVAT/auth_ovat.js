const LOGIN_URL = "https://qlmlvtohtkiycwtohqwk.supabase.co/functions/v1/login_ovat";

const loginMsg     = document.getElementById("loginMsg");
const emailInput   = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginBtn      = document.getElementById("loginBtn");

let email = "";

function finishLogin(user) {
  if (!user) {
    loginMsg.innerText = "Login succeeded but user data missing.";
    loginBtn.disabled = false;
    return;
  }

  localStorage.setItem("email", email);
  sessionStorage.setItem("password", password);

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

    if (payload.need_password) {
      passwordInput.classList.remove("hidden");
      passwordInput.value = "";

      loginMsg.innerText =
        payload.emailed
          ? "A password was sent to your email. Enter it below."
          : "Enter your password.";

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

loginBtn.onclick = login;