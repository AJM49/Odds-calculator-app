import { auth } from './firebase.js';

async function signUp() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

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