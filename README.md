# Airport Tower

Airport Tower is a browser-based air traffic control game about keeping two runways moving without causing a runway conflict.

## Problem / Use Case

This repo is a playable operations-game prototype. It asks the player to select aircraft, assign runways, clear arrivals and departures, and balance safety, efficiency, and satisfaction during a short tower shift.

It is an arcade game, not an aviation training simulator.

## Key Features

- Arrivals and departures with selectable aircraft
- Two-runway assignment and command flow
- Commands for landing, takeoff, hold, line up and wait, and go-around
- Easy, medium, and expert traffic profiles
- Five-minute and ten-minute round lengths
- Safety, efficiency, satisfaction, score, and delay tracking
- Safety-incident summaries when a serious runway conflict occurs
- Local high scores stored in the browser

## Tech Stack

- Static HTML
- CSS
- Vanilla JavaScript loaded through script tags
- Canvas 2D rendering
- Browser `localStorage`

There is no package manager, build step, backend, or database in the current repo.

## Run Locally

Open `index.html` directly in a browser, or serve the folder with a simple static server:

```bash
python3 -m http.server 8000
```

Then open `http://127.0.0.1:8000`.

## Current Status

This is a standalone MVP. Traffic behavior, scoring, and difficulty values are hard-coded under `src/`, and there are no automated tests or deployment scripts in the repo.
