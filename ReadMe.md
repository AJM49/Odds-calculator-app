# 🎲 Odds Calculator App

A lightweight web application for calculating horse racing bet payouts, managing user access, and tracking wagering activity.

## ✨ What this app does

- Calculates payouts for common horse racing bets
- Supports classic and exotic bet types:
  - Win / Place / Show
  - Exacta / Trifecta / Superfecta
  - Multi-race bets (Pick 3 through Pick 6)
- Provides account screens (login/signup)
- Includes admin and dashboard views
- Uses Firebase Authentication + Firestore logging

## 📁 Project structure

- `index.html` — Main calculator UI with dynamic form for all bet types
- `app.js` — Core bet and payout logic, Firebase integration
- `firebase.js` — Firebase configuration and initialization
- `dashboard.html` / `dashboard.js` — User dashboard for bet history
- `login.html` / `login.js` — Authentication views
- `signup` / `signup.js` — Sign up page
- `admin.html` / `admin.js` — Admin dashboard for user and bet management
- `service-worker.js`, `manifest.json` — PWA support
- `style.css`, `dashboard.css` — Styling

## 🚀 Getting started

1. Clone or download this repository.
2. Open `index.html` in your browser.
3. Enter your wager details and calculate payouts.

## ✅ Development guidelines

When updating the app, keep these standards in mind:

- Do **not** break existing bet calculations.
- Keep functions modular and readable.
- Use `async/await` with Firebase operations.
- Keep Firebase configuration out of UI files.
- Maintain responsive behavior across mobile and desktop.

## 🧪 Testing checklist

Before shipping changes:

- Verify all supported bet types return expected payouts.
- Confirm no `NaN` or `undefined` payout values appear.
- Test login flow and redirects.

## 🌐 Deployment (GitHub Pages)

After pushing to GitHub and enabling GitHub Pages, the app can be hosted at:

`https://ajm49.github.io/odds-calculator-app`

---
Built with ❤️ by AJM49
