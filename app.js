<script>
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    appId: "YOUR_APP_ID"
  };

  firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // ✅ Admin-only Access Restriction
  firebase.auth().onAuthStateChanged(user => {
    if (!user || user.email !== "your-admin@email.com") {
      alert("⛔ Unauthorized access. Redirecting...");
      window.location.href = "/";
    } else {
      loadBets(); // only runs if admin is authenticated
    }
  });

  // ✅ Load bet logs
  async function loadBets() {
    const betLogs = document.getElementById("betLogs");
    betLogs.innerHTML = "Loading...";

    try {
      const snapshot = await db.collection("bets").orderBy("timestamp", "desc").get();
      if (snapshot.empty) {
        betLogs.innerHTML = "No bets found.";
        return;
      }

      const html = snapshot.docs.map(doc => {
        const bet = doc.data();
        return `
          <div style="border-bottom:1px solid #ccc; padding:10px 0;">
            🧑 User: <strong>${bet.user}</strong><br>
            🏇 Type: <strong>${bet.betType}</strong> | 💵 Amount: $${bet.betAmount} | 🎯 Odds: ${bet.odds}<br>
            💰 Profit: $${bet.profit} | Total Return: $${bet.total}<br>
            🕒 Date: ${bet.timestamp?.toDate().toLocaleString() || '—'}
          </div>
        `;
      }).join("");

      betLogs.innerHTML = html;
    } catch (err) {
      betLogs.innerHTML = "❌ Failed to load bets: " + err.message;
    }
  }
</script>
