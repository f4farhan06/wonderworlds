# 🌟 Wonder Worlds — Kids Learning Adventure

A fullstack kids quiz platform with 6 subject worlds, 8 difficulty levels, 1 & 2-player modes, leaderboard, and an admin custom world editor.

## Project Structure

```
wonder-worlds/
├── frontend/
│   └── index.html        ← Complete game (open directly in browser)
├── backend/
│   ├── server.js         ← Express API
│   ├── schema.sql        ← PostgreSQL database setup
│   ├── package.json
│   ├── Procfile          ← For Railway deployment
│   └── .env.example      ← Copy to .env and fill in
└── README.md
```

## Quick Start (Local)

1. **Install Node.js** (v20+) and **PostgreSQL** (v16+)
2. `cd backend && npm install`
3. `cp .env.example .env` — fill in your values
4. `psql -U postgres -c "CREATE DATABASE wonderworlds;"`
5. `psql -U postgres -d wonderworlds -f schema.sql`
6. `npm run dev`
7. Open `frontend/index.html` in your browser

## Admin Access

Tap the 🌟 logo **5 times** on the splash screen, then enter PIN **1234** (change `ADMIN_PIN` in `frontend/index.html`).

## Deployment

- **Backend**: Railway (connect GitHub repo → backend folder)
- **Frontend**: Netlify (drag & drop the `frontend` folder)

See the Developer Guide for full step-by-step instructions.
