# Atomic Line Spectra Visualizer

A small static web app that visualizes approximate absorption and emission line spectra for simple atoms (H, He, Na). It also shows an animated Bohr-style atom with electrons jumping between shells while emitting or absorbing colorful EM wavefronts.

## Tech Stack

- Plain HTML, CSS, and JavaScript (no build step)
- Canvas for the atom + electron animation

## Running the app

Because this is a static site, you can open it directly or use any simple static server.

### Option 1: Open directly

Just open `index.html` in your browser.

### Option 2: Run a lightweight local server (recommended)

From the `linespectra` folder:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000` in your browser.

## Features

- Choose between Hydrogen, Helium, and Sodium.
- Toggle between emission and absorption modes.
- Animated electrons jumping between energy levels.
- Colorful EM wavefronts corresponding to photon emission/absorption.
- Bright, modern styling with glassmorphism and neon-like spectra lines.

Note: Wavelengths and colors are approximate and for educational visualization only, not precise spectroscopy.
