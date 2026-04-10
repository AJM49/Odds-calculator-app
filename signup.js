import { auth } from './firebase.js';

async function signUp() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!email) {
    alert("Please enter an email address.");
    return;
  }

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
    console.log("✅ Sign up successful:", result.user.email);
    alert("Account created! Please log in.");
    window.location.href = "login.html";
  } catch (err) {
    console.error("❌ Sign up error:", err);
    alert("Sign up failed: " + err.message);
  }
}

// Expose
window.signUp = signUp;