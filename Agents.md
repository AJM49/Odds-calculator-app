# Project: Horse Odds Calculator

## Purpose
Web app to calculate horse racing bets and payouts.

## Core Features
- Win, Place, Show
- Exacta, Trifecta, Superfecta
- Multi-race bets (Pick 3–6)
- Firebase Auth + Firestore logging

## Rules
- Do not break existing bet calculations
- Keep functions modular
- Use async/await for Firebase
- No inline Firebase config in UI files
- Maintain mobile responsiveness

## Key Files
- index.html: UI layout
- app.js: bet logic
- dashboard.js: admin + analytics
- firebase.js: config + auth

## Testing
- Validate all bet outputs
- No NaN or undefined payouts
- Ensure login redirect works

## Style
- Clean, readable JS
- Descriptive variable names
- Avoid duplication
