// Virtual bankroll (paper betting) — shared helpers for the calculator and
// the dashboard.
//
// Every logged-in user gets a virtual bankroll: fake money for learning.
// A paper bet's stake is deducted when the bet is placed; winnings are
// credited when the bet settles as a win. Payouts stay ESTIMATED (from the
// odds entered at bet time). No real money anywhere.
//
// Firestore shape: bankrolls/{uid} ->
//   { balance, startingBalance, createdAtMs, resetCount, updatedAtMs }
// Bets placed after this feature carry:
//   stakedFromBankroll: true   (stake was deducted from the bankroll)
//   bankrollCredited: false->true (settlement processed the money exactly once)

(function () {
  "use strict";

  const STARTING_BALANCE = 1000;

  function ref(db, uid) {
    return db.collection("bankrolls").doc(uid);
  }

  function formatMoney(value) {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return "$" + safe.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  // --- Pure helpers (no Firestore; unit-testable) ---

  function canAfford(balance, stake) {
    const b = Number(balance);
    const s = Number(stake);
    return Number.isFinite(b) && Number.isFinite(s) && s > 0 && s <= b;
  }

  function applyDeduction(balance, stake) {
    const b = Number(balance) || 0;
    const s = Number(stake) || 0;
    return Math.max(0, b - s);
  }

  function applyCredit(balance, amount) {
    const b = Number(balance) || 0;
    const a = Number(amount) || 0;
    return b + a;
  }

  // --- Firestore helpers ---

  async function ensureBankroll(db, uid) {
    const r = ref(db, uid);
    const snap = await r.get();
    if (snap.exists) return { id: r.id, ...snap.data() };
    const fresh = {
      balance: STARTING_BALANCE,
      startingBalance: STARTING_BALANCE,
      createdAtMs: Date.now(),
      resetCount: 0,
      updatedAtMs: Date.now(),
    };
    await r.set(fresh);
    return { id: r.id, ...fresh };
  }

  // Atomically deduct the stake AND write the bet document, so a bet can
  // never exist without its stake leaving the bankroll (or vice versa).
  // Throws Error("INSUFFICIENT_BANKROLL") when the stake exceeds the balance.
  async function placeBet(db, uid, betData) {
    const betRef = db.collection("bets").doc();
    const result = await db.runTransaction(async (t) => {
      const bRef = ref(db, uid);
      const snap = await t.get(bRef);
      const data = snap.exists ? snap.data() : null;
      const rawBalance = Number(data && data.balance);
      const balance = Number.isFinite(rawBalance) ? rawBalance : STARTING_BALANCE;
      const stake = Number(betData.betAmount);
      if (!canAfford(balance, stake)) {
        throw new Error("INSUFFICIENT_BANKROLL");
      }
      const base = data || {
        startingBalance: STARTING_BALANCE,
        createdAtMs: Date.now(),
        resetCount: 0,
      };
      const newBalance = applyDeduction(balance, stake);
      t.set(
        bRef,
        { ...base, balance: newBalance, updatedAtMs: Date.now() },
        { merge: true }
      );
      t.set(betRef, {
        ...betData,
        stakedFromBankroll: true,
        bankrollCredited: false,
      });
      return { betId: betRef.id, newBalance };
    });
    return result;
  }

  // Credit winnings for a settled bet, exactly once. Safe to call repeatedly:
  // bets already marked bankrollCredited, and bets placed before this feature
  // (no stakedFromBankroll flag), are skipped without touching the balance.
  async function settleCredit(db, uid, betId, winnings) {
    const outcome = await db.runTransaction(async (t) => {
      const betRef = db.collection("bets").doc(betId);
      const betSnap = await t.get(betRef);
      const bet = betSnap.exists ? betSnap.data() : {};
      if (bet.bankrollCredited === true) return { credited: false, reason: "already" };
      if (bet.stakedFromBankroll !== true) return { credited: false, reason: "legacy" };
      const amount = Number(winnings) || 0;
      if (amount > 0) {
        const bRef = ref(db, uid);
        const bSnap = await t.get(bRef);
        const raw = Number(bSnap.exists ? bSnap.data().balance : STARTING_BALANCE);
        const bal = Number.isFinite(raw) ? raw : STARTING_BALANCE;
        t.set(bRef, { balance: bal + amount, updatedAtMs: Date.now() }, { merge: true });
      }
      t.set(betRef, { bankrollCredited: true }, { merge: true });
      return { credited: amount > 0, reason: "ok" };
    });
    return outcome;
  }

  async function resetBankroll(db, uid) {
    const bRef = ref(db, uid);
    await db.runTransaction(async (t) => {
      const snap = await t.get(bRef);
      const data = snap.exists ? snap.data() : {};
      t.set(
        bRef,
        {
          balance: STARTING_BALANCE,
          startingBalance: Number(data.startingBalance) || STARTING_BALANCE,
          createdAtMs: Number(data.createdAtMs) || Date.now(),
          resetCount: (Number(data.resetCount) || 0) + 1,
          updatedAtMs: Date.now(),
        },
        { merge: true }
      );
    });
    const snap = await bRef.get();
    return snap.data();
  }

  const api = {
    STARTING_BALANCE,
    ref,
    formatMoney,
    canAfford,
    applyDeduction,
    applyCredit,
    ensureBankroll,
    placeBet,
    settleCredit,
    resetBankroll,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  }
  if (typeof window !== "undefined") {
    window.Bankroll = api;
  }
})();
