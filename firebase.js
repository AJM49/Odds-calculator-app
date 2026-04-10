// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };