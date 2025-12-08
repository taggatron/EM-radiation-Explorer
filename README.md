# Electromagnetic Radiation Explorer

A small static web app for exploring simple visualizations of electromagnetic radiation. It includes:

- An atomic line spectra simulator for visible light (H, He, Na)
- A radio antenna simulator showing electrons vibrating in a transmitting antenna and waves being picked up by a receiver

## Tech Stack

- Plain HTML, CSS, and JavaScript (no build step)
- Canvas for the atom + electron and radio antenna animations

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

### Overview screen

- Card-based menu for different EM regions (Radio, Microwave, Visible, X-ray)
- Each card opens a dedicated simulation or conceptual view

### Visible: Atomic Line Spectra

- Choose between Hydrogen, Helium, and Sodium
- Toggle between emission and absorption modes
- Animated Bohr-style atom with electrons jumping between shells
- Colored line spectrum showing approximate visible wavelengths for each element

### Gamma: Nuclear De‑excitation (new)

- Simplified nucleus model for large nuclei where protons and neutrons vibrate.
- Visualises short, bright gamma pulses (not to scale). Use the nucleon slider to change nucleus size and Pause/Play to stop the animation.

### Radio: Antenna Transmission

- Transmitting antenna with a column of electrons oscillating up and down
- Travelling sinusoidal radio waves launched from the transmitter
- Receiving antenna with a visible wire and electron that vibrates with the incoming waves

### Notes

- Wavelengths, frequencies, and colors are approximate and purely for educational visualization
- None of the animations are to physical scale
