import { auth } from './firebase.js';

// Check if user is logged in
auth.onAuthStateChanged((user) => {
  if (user) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("logoutSection").style.display = "block";
    document.getElementById("userEmail").textContent = user.email;
  } else {
    document.getElementById("authSection").style.display = "block";
    document.getElementById("logoutSection").style.display = "none";
  }
});

async function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    const result = await auth.signInWithEmailAndPassword(email, password);
    console.log("✅ Logged in as:", result.user.email);
    window.location.href = "index.html";
  } catch (err) {
    console.error("❌ Login error:", err);
    alert("Login failed: " + err.message);
  }
}

async function signup() {
  const email = document.getElementById("signupEmail").value;
  const password = document.getElementById("signupPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (password !== confirmPassword) {
    alert("Passwords do not match!");
    return;
  }

  if (password.length < 6) {
    alert("Password must be at least 6 characters long!");
    return;
  }

  try {
    const result = await auth.createUserWithEmailAndPassword(email, password);
    console.log("✅ Account created:", result.user.email);
    alert("Account created successfully! You can now log in.");
    toggleSignup();
    document.getElementById("email").value = email;
  } catch (err) {
    console.error("❌ Signup error:", err);
    alert("Signup failed: " + err.message);
  }
}

async function logout() {
  try {
    await auth.signOut();
    console.log("✅ Logged out");
    window.location.href = "login.html";
  } catch (err) {
    console.error("❌ Logout error:", err);
  }
}

function toggleSignup() {
  const loginForm = document.getElementById("loginForm");
  const signupForm = document.getElementById("signupForm");
  const toggleText = document.getElementById("toggleText");

  if (loginForm.style.display === "none") {
    loginForm.style.display = "block";
    signupForm.style.display = "none";
    toggleText.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleSignup()">Sign up</a>';
  } else {
    loginForm.style.display = "none";
    signupForm.style.display = "block";
    toggleText.innerHTML = 'Already have an account? <a href="#" onclick="toggleSignup()">Log in</a>';
  }
}

// Expose functions to global scope for onclick
window.login = login;
window.signup = signup;
window.logout = logout;
window.toggleSignup = toggleSignup;