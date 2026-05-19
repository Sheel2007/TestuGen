# Registerp

Registerp helps University of Maryland students build the best possible class schedule. You pick your courses and preferences, and it finds schedules that balance professor ratings, time gaps, and your availability.

It uses a quantum-inspired optimization algorithm (QAOA) alongside a classical solver to explore many possible combinations and return the top results.

Registerp was heavily inspired by [Jupiterp](https://jupiterp.com) and also draws some inspiration from [PlanetTerp](https://planetterp.com).

> **Note:** Registerp is not affiliated with the University of Maryland.

## Features

- **Course search** — Search for UMD courses by name or ID and see all available sections
- **Professor ratings** — The optimizer prioritizes sections taught by higher-rated professors so you get the best instructors available
- **Professor preferences** — Request a specific professor for any course, and the optimizer will try to match your picks
- **Time blocking** — Block off times you're unavailable on a weekly grid, and the optimizer will avoid scheduling classes during those slots
- **Gap control** — Set a minimum and/or maximum time gap between classes to avoid long waits or back-to-back rushes
- **Priority weights** — Adjust how much the optimizer cares about professor ratings vs. time preferences vs. gaps between classes
- **Schedule optimization** — Runs both a quantum (QAOA) and classical solver to find the best schedules
- **Score breakdown** — See professor rating, time score, and gap score for each result so you can compare schedules at a glance
- **Calendar export** — Download any schedule as an `.ics` file to import into Google Calendar, Apple Calendar, or Outlook

## Data Sources

- [umd.io](https://umd.io) — Course sections, meeting times, rooms, and buildings
- [PlanetTerp](https://planetterp.com) — Professor ratings and grade distributions
- [Jupiterp](https://jupiterp.com) — Professor names and seat availability

## Tech Stack

**Frontend:** React, TypeScript, Tailwind CSS, Vite

**Backend:** Python, FastAPI, NumPy, Qiskit

## Setup

### Prerequisites

- [Node.js](https://nodejs.org) (v18 or later)
- [Python](https://python.org) (3.10 or later)

### Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

The API runs at `http://localhost:8000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The app runs at `http://localhost:5173`.

## How It Works

1. You select courses and set your preferences (blocked times, professor requests, priority weights).
2. The app builds a mathematical model (QUBO matrix) where each possible section is a variable.
3. Two solvers run on that model — a quantum-inspired QAOA solver and a classical brute-force solver.
4. The top schedules are ranked by a combined score of professor rating, time preference, and gap preference.
5. Results show up on a weekly calendar view where you can compare and export them.

## Author

Built by [Sheel Shah](https://github.com/Sheel2007) with the help of [Claude](https://claude.ai).
