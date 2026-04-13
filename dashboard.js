// Firebase imports
import { 
  db, 
  auth, 
  onAuthStateChanged, 
  signOut, 
  initError,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from './firebase.js';

console.log('📊 Dashboard module loaded');
console.log('Firebase db object:', db);
console.log('Firebase init error:', initError);
console.log('🔍 DEBUG: Page ready, DOM elements available');

// HTML escaping function to prevent XSS (defined early for error messages)
function escapeHtml(text) {
  if (!text) return '';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Check for Firebase initialization errors FIRST
if (initError) {
  console.error('❌ CRITICAL: Firebase initialization failed');
  const errorMsg = `
    <div style="
      background-color: #fee;
      border: 2px solid #c33;
      border-radius: 8px;
      padding: 20px;
      margin: 20px;
      font-weight: bold;
      color: #c00;
      font-family: monospace;
      max-width: 800px;
      margin: 50px auto;
    ">
      <h2 style="margin-top: 0; color: #c00;">❌ Firebase Initialization Failed</h2>
      <p><strong>Error:</strong> ${escapeHtml(initError.message)}</p>
      <p><strong>Details:</strong></p>
      <pre style="background: #fff; border: 1px solid #c33; padding: 10px; overflow-x: auto;">
${escapeHtml(initError.stack || 'No stack trace available')}
      </pre>
      <p style="color: #666; font-size: 12px;">
        Check the browser console (F12) for more details.
        <br/>This usually means:
        <br/>• Firebase CDN is not accessible
        <br/>• Network is down
        <br/>• Configuration is incorrect
      </p>
    </div>
  `;
  document.body.innerHTML = errorMsg;
  throw new Error('Firebase initialization failed: ' + initError.message);
}

// Validate Firebase is ready
if (!db || typeof db !== 'object') {
  console.error('❌ CRITICAL: Firebase Firestore not initialized correctly');
  console.error('db value:', db);
  console.error('db type:', typeof db);
  document.body.innerHTML = '<div style="color: red; padding: 20px; font-weight: bold;">Firebase Firestore object not available. Your browser may not support it. Try refreshing the page or using a different browser.</div>';
  throw new Error('Firestore db is not an object');
}
console.log('✓ Firebase Firestore object validated successfully');

// Store current user ID for refresh functionality
let currentUserId = null;

// Wait for user authentication before loading bets
onAuthStateChanged(auth, user => {
  console.log('🔐 onAuthStateChanged callback fired');
  const statusEl = document.getElementById('dashboardStatus');
  console.log('statusEl element found:', !!statusEl);
  console.log('Auth state changed:', user ? `User ${user.uid}` : 'No user');
  
  if (user) {
    currentUserId = user.uid;
    console.log('✅ User authenticated, currentUserId set to:', currentUserId);
    if (statusEl) {
      statusEl.textContent = `Loading your bets... (User ID: ${user.uid})`;
      console.log('Status element updated');
    }
    console.log('✓ User authenticated:', user.email);
    console.log('  User UID:', user.uid);
    console.log('  Make sure security rules allow reading bets with userId:', user.uid);
    console.log('Calling loadBets with userId:', user.uid);
    loadBets(user.uid);
  } else {
    console.log('❌ No user logged in');
    if (statusEl) {
      statusEl.textContent = 'Redirecting to login...';
    }
    console.log('No user logged in, redirecting to login...');
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1000);
  }
});

// Logout functionality
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    try {
      console.log('Signing out...');
      await signOut(auth);
      console.log('Sign out successful, redirecting...');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      alert('Error signing out: ' + error.message);
    }
  });
}

// Back to betting page functionality
const backBtn = document.getElementById('backBtn');
if (backBtn) {
  backBtn.addEventListener('click', () => {
    console.log('Going back to betting page...');
    window.location.href = 'index.html';
  });
}

// Refresh functionality
const refreshBtn = document.getElementById('refreshBtn');
if (refreshBtn) {
  refreshBtn.addEventListener('click', () => {
    if (currentUserId) {
      console.log('Refreshing bets...');
      loadBets(currentUserId);
    } else {
      console.warn('No current user ID, cannot refresh');
      alert('Error: User session not found. Please refresh the page.');
    }
  });
}

/**
 * Loads and listens for changes to bets
 */
function loadBets(userId) {
  console.log('📋 loadBets() called with userId:', userId);
  // Show loading state
  const tableBody = document.getElementById('betsTableBody');
  console.log('Table body element found:', !!tableBody);
  if (tableBody) {
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">Loading bets...</td></tr>';
    console.log('Loading message displayed in table');
  } else {
    console.error('❌ ERROR: betsTableBody element not found in DOM!');
  }
  // Fetch bets and display them
  console.log('Calling fetchAndRenderBets...');
  fetchAndRenderBets(userId);
}

async function fetchAndRenderBets(userId) {
  try {
    console.log('🚀 fetchAndRenderBets() started for userId:', userId);
    console.log('Fetching bets from Firestore using Firebase v9+ API...');
    
    // Validate db exists
    if (!db) {
      console.error('❌ db is null or undefined!');
      throw new Error('Firestore database instance (db) is null or undefined');
    }
    console.log('✓ db object is valid');
    
    // Build the query using Firebase v9+ functional API
    console.log('Building Firestore query...');
    const betsRef = collection(db, "bets");
    console.log('✓ betsRef created:', betsRef);
    
    const q = query(
      betsRef,
      where("userId", "==", userId),
      orderBy("timestamp", "desc"),
      limit(100)
    );
    console.log('✓ Query object built successfully');
    
    console.log('✓ Query built, executing...');
    const snapshot = await getDocs(q);
    console.log('✓ getDocs() returned successfully');

    console.log(`✓ Query executed successfully`);
    console.log(`Found ${snapshot.docs.length} bets`);

    const bets = snapshot.docs.map((doc, idx) => {
      const data = doc.data();
      if (idx < 3) {
        console.log(`Processing bet ${idx}:`, data);
      }
      return {
        horseName: data.horseName || "—",
        trackName: data.trackName || "—",
        betType: data.betType || "—",
        amount: Number(data.betAmount ?? data.amount ?? 0),
        outcome: data.outcome ?? data.result ?? "pending",
        winnings: Number(data.winnings ?? 0)
      };
    });

    console.log('✓ Data transformation complete');
    console.log('Rendering bets...');
    renderBetsTable(bets);
    console.log('✓ renderBetsTable() completed');
    
    updateStats(bets);
    console.log('✓ updateStats() completed');
    
    console.log('✓ Bets loaded successfully');
  } catch (error) {
    console.error("❌ ERROR loading bets:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Full error:", error);
    
    const tableBody = document.getElementById('betsTableBody');
    if (tableBody) {
      let errorMsg = error.message;
      
      // Provide helpful error messages for common Firebase errors
      if (error.code === 'permission-denied') {
        errorMsg = 'Permission Denied: Firestore security rules do not allow reading bets. Check that security rules are configured correctly.';
        console.error('🔐 FIRESTORE SECURITY ERROR');
        console.error('This means Firestore security rules are blocking the read operation.');
        console.error('Required security rules in Firestore Console:');
        console.error(`
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bets/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
    }
  }
}
        `);
      }
      
      tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: red; padding: 20px; white-space: pre-wrap;">Error: ${escapeHtml(errorMsg)}</td></tr>`;
    }
  }
}

/**
 * Renders bets into the dashboard table with proper escaping
 */
function renderBetsTable(bets) {
  const tableBody = document.getElementById("betsTableBody");
  if (!tableBody) {
    console.error('Table body element not found!');
    return;
  }

  console.log('Clearing table body...');
  tableBody.innerHTML = "";

  if (bets.length === 0) {
    console.log('No bets to display');
    tableBody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px;">No bets recorded yet.</td></tr>';
    return;
  }

  console.log(`Rendering ${bets.length} bets...`);
  bets.forEach((bet, idx) => {
    const tr = document.createElement("tr");
    const outcomeClass = getOutcomeClass(bet.outcome);

    // Create cells with text content to prevent XSS
    const cells = [
      escapeHtml(bet.horseName),
      escapeHtml(bet.trackName),
      escapeHtml(bet.betType),
      `$${Number(bet.amount).toFixed(2)}`,
      escapeHtml(bet.outcome),
      `$${Number(bet.winnings).toFixed(2)}`
    ];

    tr.innerHTML = cells.map((cell, cidx) => {
      // Add color coding only to result column (index 4)
      return cidx === 4 ? `<td class="${outcomeClass}">${cell}</td>` : `<td>${cell}</td>`;
    }).join('');

    tableBody.appendChild(tr);
    if (idx < 3) {
      console.log(`  Row ${idx}:`, tr.innerHTML);
    }
  });
  console.log(`✓ Rendered ${bets.length} rows`);
}

/**
 * Gets CSS class for bet outcome color coding
 */
function getOutcomeClass(outcome) {
  const normalized = outcome.toLowerCase();
  if (normalized === 'win') return 'result-win';
  if (normalized === 'loss') return 'result-loss';
  if (normalized === 'pending') return 'result-pending';
  return '';
}

/**
 * Updates dashboard statistics
 */
function updateStats(bets) {
  console.log('Updating statistics...');
  const totalBetsEl = document.getElementById('totalBets');
  const totalWinningsEl = document.getElementById('totalWinnings');
  const winRateEl = document.getElementById('winRate');

  if (!totalBetsEl || !totalWinningsEl || !winRateEl) {
    console.error('One or more stat elements not found!');
    return;
  }

  const totalBets = bets.length;
  const totalWinnings = bets.reduce((sum, bet) => {
    const winAmount = Number(bet.winnings) || 0;
    return sum + winAmount;
  }, 0);
  const winCount = bets.filter(bet => String(bet.outcome).toLowerCase() === 'win').length;
  const winRate = totalBets > 0 ? Number(((winCount / totalBets) * 100).toFixed(1)) : 0;

  console.log(`Stats: ${totalBets} bets, $${totalWinnings.toFixed(2)} winnings, ${winRate}% win rate`);

  totalBetsEl.textContent = String(totalBets);
  totalWinningsEl.textContent = `$${Number(totalWinnings).toFixed(2)}`;
  winRateEl.textContent = `${Number(winRate).toFixed(1)}%`;
  
  console.log('✓ Statistics updated');
}
