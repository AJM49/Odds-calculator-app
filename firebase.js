// Firebase configuration
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { 
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDl7TW4J_yz8c-fJtE_trmcFRw1W0fcApA",
  authDomain: "horse-bet-calculator.firebaseapp.com",
  projectId: "horse-bet-calculator",
  appId: "1:258212871291:web:efcbb1d5715a9c9cd476de"
};

// Initialize Firebase
console.log('🔥 Initializing Firebase...');
console.log('Firebase config:', firebaseConfig);

let app, auth, db;
let initError = null;

try {
  console.log('Step 1: Initializing Firebase app...');
  app = initializeApp(firebaseConfig);
  console.log('✓ Firebase app initialized:', app.name);
  
  console.log('Step 2: Getting Auth instance...');
  auth = getAuth(app);
  console.log('✓ Firebase auth initialized:', auth);
  
  console.log('Step 3: Getting Firestore instance...');
  db = getFirestore(app);
  console.log('✓ Firebase Firestore initialized:', db);
  console.log('  - db type:', typeof db);
  console.log('  - db constructor:', db?.constructor?.name);
  
  // Validate db is an object
  if (!db || typeof db !== 'object') {
    throw new Error(`Firestore instance is not an object. Got type: ${typeof db}, value: ${db}`);
  }
  
  console.log('✓ Firebase initialization complete!');
  
} catch (error) {
  initError = error;
  console.error('❌ Firebase initialization error:', error);
  console.error('  Error name:', error.name);
  console.error('  Error message:', error.message);
  console.error('  Stack:', error.stack);
  
  // Don't throw - allow module to export with error flag
  console.warn('⚠️  Firebase module will export with error state');
}

// Create error-safe exports
export { 
  auth, 
  db, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  writeBatch,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  initError  // Export the error so dashboard.js can check it
};