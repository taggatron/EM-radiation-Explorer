// Simple data model with approximate visible line wavelengths (nm)
// Colors are tuned to look vivid, not physically perfect.
const ELEMENT_DATA = {
  H: {
    name: "Hydrogen",
    shells: [1, 2, 3, 4],
    lines: [
      { nm: 656, color: "#ff4b6b", series: "Balmer" }, // red
      { nm: 486, color: "#4fd4ff", series: "Balmer" }, // cyan
      { nm: 434, color: "#7a7bff", series: "Balmer" }, // violet
      { nm: 410, color: "#c184ff", series: "Balmer" }, // deep violet
    ],
  },
  He: {
    name: "Helium",
    shells: [1, 2, 3, 4],
    lines: [
      { nm: 588, color: "#ffc857", series: "Yellow" },
      { nm: 501, color: "#4ade80", series: "Green" },
      { nm: 447, color: "#38bdf8", series: "Blue" },
    ],
  },
  Na: {
    name: "Sodium",
    shells: [1, 2, 3, 4],
    lines: [
      { nm: 589, color: "#ffd54f", series: "D-line" },
    ],
  },
};

// Top-level UI elements
const menuView = document.getElementById("menuView");
const simView = document.getElementById("simView");
const mainControls = document.getElementById("mainControls");
const simControls = document.getElementById("simControls");
const backToMenuBtn = document.getElementById("backToMenu");
const simTitleEl = document.getElementById("simTitle");
const simSubtitleEl = document.getElementById("simSubtitle");
const simExtraEl = document.getElementById("simExtra");

// Visible light (atomic spectra) controls
const elementSelect = document.getElementById("elementSelect");
const modeSelect = document.getElementById("modeSelect");
const spectrumEl = document.getElementById("spectrum");
const legendEl = document.getElementById("legend");

// Panels
const visibleSimPanel = document.getElementById("visibleSimPanel");
const visibleSpectrumPanel = document.getElementById("visibleSpectrumPanel");
const radioSimPanel = document.getElementById("radioSimPanel");
const receiverElectronEl = document.getElementById("receiverElectron");

// Spectrum rendering --------------------------------------------------------

function wavelengthToPosition(nm) {
  // Map rough visible range 380–700 nm to [0, 1]
  const min = 380;
  const max = 700;
  const clamped = Math.min(max, Math.max(min, nm));
  return (clamped - min) / (max - min);
}

function renderSpectrum(elementKey, mode) {
  const data = ELEMENT_DATA[elementKey];
  if (!data) return;

  spectrumEl.innerHTML = "";
  legendEl.innerHTML = "";

  data.lines.forEach((line, i) => {
    const x = wavelengthToPosition(line.nm) * 100;
    const span = document.createElement("div");
    span.className = `spectrum-line ${mode === "absorption" ? "absorption" : ""}`;
    span.style.left = `${x}%`;
    span.style.height = mode === "absorption" ? "100%" : `${60 + (i % 3) * 20}px`;
    span.style.color = line.color;
    span.style.background = mode === "absorption" ? "transparent" : line.color;
    span.style.animationDelay = `${(i * 0.35).toFixed(2)}s`;
    spectrumEl.appendChild(span);

    const legendItem = document.createElement("div");
    legendItem.className = "legend-item";
    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.color = line.color;
    swatch.style.background = line.color;
    const label = document.createElement("span");
    label.textContent = `${line.nm} nm – ${line.series}`;
    legendItem.appendChild(swatch);
    legendItem.appendChild(label);
    legendEl.appendChild(legendItem);
  });
}

// Atom + electron animation -------------------------------------------------

const canvas = document.getElementById("atomCanvas");
const ctx = canvas.getContext("2d");
let dpr = window.devicePixelRatio || 1;
let currentElementKey = elementSelect.value;

function resizeCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const MAX_SHELLS = 4;

function createElectron(shellIndex) {
  return {
    shellIndex,
    angle: Math.random() * Math.PI * 2,
    speed: 0.4 + Math.random() * 0.3, // radians per second
    jumping: false,
    phase: 0, // 0 -> 1 during jump
    fromShell: shellIndex,
    toShell: shellIndex,
    emissionColor: null,
    waveAge: 1.1,
  };
}

let electrons = [createElectron(1), createElectron(2), createElectron(3)];

// EM wave pulses emitted/absorbed
let waves = [];

// Radio simulation ---------------------------------------------------------

const radioCanvas = document.getElementById("radioCanvas");
const radioCtx = radioCanvas ? radioCanvas.getContext("2d") : null;
let radioDpr = window.devicePixelRatio || 1;

function resizeRadioCanvas() {
  if (!radioCanvas || !radioCtx) return;
  // Use offsetWidth/offsetHeight so we always get a non-zero size even
  // before the browser has painted the canvas bounds.
  const width = radioCanvas.offsetWidth || radioCanvas.getBoundingClientRect().width;
  const height = radioCanvas.offsetHeight || 220;
  radioCanvas.width = width * radioDpr;
  radioCanvas.height = height * radioDpr;
  radioCtx.setTransform(radioDpr, 0, 0, radioDpr, 0, 0);
}

if (radioCanvas) {
  window.addEventListener("resize", resizeRadioCanvas);
  // Defer resize until after layout so the canvas gets a real size.
  window.addEventListener("load", resizeRadioCanvas);
  resizeRadioCanvas();
}

let radioPhase = 0;
let radioLast = performance.now();
let radioFrequency = 4; // base angular frequency factor, tuned via tuner

function drawRadioFrame(now) {
  if (!radioCanvas || !radioCtx) {
    requestAnimationFrame(drawRadioFrame);
    return;
  }

  const dt = (now - radioLast) / 1000;
  radioLast = now;
  radioPhase += dt * radioFrequency; // AC frequency controlled by tuner

  const rect = radioCanvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  radioCtx.clearRect(0, 0, w, h);

  // background gradient
  const bgGrad = radioCtx.createLinearGradient(0, 0, w, 0);
  bgGrad.addColorStop(0, "#020617");
  bgGrad.addColorStop(1, "#020617");
  radioCtx.fillStyle = bgGrad;
  radioCtx.fillRect(0, 0, w, h);

  const midY = h * 0.5;
  const antennaX = w * 0.18;
  const antennaHeight = h * 0.7;

  // antenna mast
  radioCtx.strokeStyle = "rgba(148,163,184,0.8)";
  radioCtx.lineWidth = 3;
  radioCtx.beginPath();
  radioCtx.moveTo(antennaX, midY + antennaHeight * 0.35);
  radioCtx.lineTo(antennaX, midY - antennaHeight * 0.65);
  radioCtx.stroke();

  // electrons along the antenna
  const electronCount = 14;
  for (let i = 0; i < electronCount; i++) {
    const t = i / (electronCount - 1);
    const baseY = midY + (t - 0.5) * antennaHeight;
    const offset = Math.sin(radioPhase + t * Math.PI * 2) * 9;
    const y = baseY + offset;

    const glow = radioCtx.createRadialGradient(antennaX, y, 0, antennaX, y, 12);
    glow.addColorStop(0, "rgba(96,165,250,0.9)");
    glow.addColorStop(1, "rgba(15,23,42,0)");
    radioCtx.fillStyle = glow;
    radioCtx.beginPath();
    radioCtx.arc(antennaX, y, 12, 0, Math.PI * 2);
    radioCtx.fill();

    radioCtx.fillStyle = "#e0f2fe";
    radioCtx.beginPath();
    radioCtx.arc(antennaX, y, 4, 0, Math.PI * 2);
    radioCtx.fill();
  }

  // radio wave travelling to the right
  radioCtx.strokeStyle = "rgba(56,189,248,0.9)";
  radioCtx.lineWidth = 2;
  radioCtx.beginPath();
  const wavelength = w * 0.32;
  const amplitude = h * 0.22;
  const phaseOffset = radioPhase * 2;
  for (let x = antennaX; x <= w; x += 4) {
    const t = (x - antennaX) / wavelength;
    const y = midY + Math.sin(t * Math.PI * 2 - phaseOffset) * amplitude;
    if (x === antennaX) radioCtx.moveTo(x, y);
    else radioCtx.lineTo(x, y);
  }
  radioCtx.stroke();

  // faint secondary waves
  radioCtx.strokeStyle = "rgba(59,130,246,0.3)";
  radioCtx.lineWidth = 1;
  radioCtx.beginPath();
  for (let x = antennaX; x <= w; x += 4) {
    const t = (x - antennaX) / wavelength;
    const y = midY + Math.sin(t * Math.PI * 2 - phaseOffset * 0.9) * amplitude * 0.6;
    if (x === antennaX) radioCtx.moveTo(x, y);
    else radioCtx.lineTo(x, y);
  }
  radioCtx.stroke();

  // move receiver electron in its own DOM container to match incoming wave
  if (receiverElectronEl) {
    const receiverRect = receiverElectronEl.parentElement.getBoundingClientRect();
    const recvH = receiverRect.height;
    const offset = Math.sin(radioPhase * 2) * (recvH * 0.25);
    receiverElectronEl.style.transform = `translateY(${offset}px)`;
  }

  requestAnimationFrame(drawRadioFrame);
}

requestAnimationFrame(drawRadioFrame);

function triggerTransition(elementKey, mode) {
  const data = ELEMENT_DATA[elementKey];
  if (!data) return;

  const electron = electrons[Math.floor(Math.random() * electrons.length)];
  const upward = mode === "absorption";

  const possibleShells = data.shells;
  const currentIndex = electron.shellIndex;
  let targetShell = currentIndex;

  if (upward && currentIndex < MAX_SHELLS) {
    targetShell = currentIndex + 1;
  } else if (!upward && currentIndex > 1) {
    targetShell = currentIndex - 1;
  }

  if (targetShell === currentIndex) return;

  const line = data.lines[Math.floor(Math.random() * data.lines.length)];

  electron.jumping = true;
  electron.phase = 0;
  electron.fromShell = currentIndex;
  electron.toShell = targetShell;
  electron.emissionColor = line.color;
  electron.waveAge = 0;

  waves.push({
    color: line.color,
    age: 0,
    outward: !upward,
  });
}

let lastTime = performance.now();

function drawFrame(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const baseRadius = Math.min(w, h) * 0.11;

  // element-specific shell spacing factor (heavier atoms get tighter inner shells)
  const spacingFactor = (() => {
    switch (currentElementKey) {
      case "H":
        return 1.0;
      case "He":
        return 0.85;
      case "Na":
        return 0.65;
      default:
        return 0.9;
    }
  })();

  ctx.save();
  ctx.translate(cx, cy);

  // nucleus
  const nucleusRadius = baseRadius * 0.55;
  const nucleusGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, nucleusRadius);
  nucleusGradient.addColorStop(0, "#f97316");
  nucleusGradient.addColorStop(1, "#450a0a");
  ctx.fillStyle = nucleusGradient;
  ctx.beginPath();
  ctx.arc(0, 0, nucleusRadius, 0, Math.PI * 2);
  ctx.fill();

  // orbits
  for (let i = 1; i <= MAX_SHELLS; i++) {
    const r = baseRadius * i * spacingFactor + nucleusRadius * 0.6;
    ctx.strokeStyle = "rgba(148, 163, 184, 0.4)";
    ctx.lineWidth = i === 1 ? 1.2 : 0.9;
    ctx.setLineDash(i % 2 === 0 ? [5, 6] : [3, 10]);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // waves
  waves = waves.filter((wObj) => wObj.age < 1.1);
  waves.forEach((wObj) => {
    wObj.age += dt * 0.6;
    const progress = wObj.age;
    const maxR = baseRadius * 4.4;
    const r = (wObj.outward ? progress : 1 - progress) * maxR + nucleusRadius * 1.2;
    const alpha = wObj.outward ? 1 - progress : 0.35 + (1 - progress) * 0.6;
    ctx.strokeStyle = `rgba(${hexToRGB(wObj.color)}, ${alpha.toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.stroke();
  });

  // electrons
  electrons.forEach((e) => {
    e.angle += dt * e.speed;

    if (e.jumping) {
      e.phase += dt * 1.6;
      if (e.phase >= 1) {
        e.phase = 1;
        e.jumping = false;
        e.shellIndex = e.toShell;
      }
    }

    const smooth = easeInOutQuad(Math.min(1, e.phase));
    const currentShell = e.jumping
      ? lerp(e.fromShell, e.toShell, smooth)
      : e.shellIndex;

    const r = baseRadius * currentShell * spacingFactor + nucleusRadius * 0.6;
    const x = Math.cos(e.angle) * r;
    const y = Math.sin(e.angle) * r;

    const orbitGlowGrad = ctx.createRadialGradient(x, y, 0, x, y, 16);
    orbitGlowGrad.addColorStop(0, "rgba(94, 234, 212, 0.7)");
    orbitGlowGrad.addColorStop(1, "rgba(8, 47, 73, 0)");
    ctx.fillStyle = orbitGlowGrad;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = e.emissionColor || "#e0f2fe";
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();

  requestAnimationFrame(drawFrame);
}

requestAnimationFrame(drawFrame);

function easeInOutQuad(t) {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hexToRGB(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean.length === 3 ? clean.replace(/(.)/g, "$1$1") : clean, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `${r}, ${g}, ${b}`;
}

// trigger random transitions periodically
setInterval(() => {
  if (!elementSelect || !modeSelect) return;
  // only animate visible-light electron jumps when that simulation is active
  if (visibleSimPanel.hidden) return;
  triggerTransition(elementSelect.value, modeSelect.value);
}, 900);

// initial view state -------------------------------------------------------

function showMenu() {
  menuView.hidden = false;
  simView.hidden = true;
  mainControls.hidden = false;
  simControls.hidden = true;

  visibleSimPanel.hidden = true;
  visibleSpectrumPanel.hidden = true;
  radioSimPanel.hidden = true;
}

function showSimulation(kind) {
  menuView.hidden = true;
  simView.hidden = false;
  mainControls.hidden = true;
  simControls.hidden = false;

  // hide everything first, then enable just the requested simulation panels
  visibleSimPanel.hidden = true;
  visibleSpectrumPanel.hidden = true;
  radioSimPanel.hidden = true;

  if (kind === "visible") {
    visibleSimPanel.hidden = false;
    visibleSpectrumPanel.hidden = false;
  } else if (kind === "radio") {
    radioSimPanel.hidden = false;
  }

  if (kind === "visible") {
    simTitleEl.textContent = "Visible Light: Atomic Line Spectra";
    simSubtitleEl.textContent = "Electrons in atoms absorb and emit discrete photon energies.";
    simExtraEl.innerHTML = "Try switching elements and toggling between emission and absorption.";
    currentElementKey = elementSelect.value;
    renderSpectrum(elementSelect.value, modeSelect.value);
  } else if (kind === "radio") {
    simTitleEl.textContent = "Radio Waves: Antenna Transmission";
    simSubtitleEl.textContent = "An AC current makes electrons in the transmitter vibrate, launching long-wavelength radio waves.";
    simExtraEl.innerHTML = `
      <label style="display:inline-flex;align-items:center;gap:4px;">
        Tuner
        <input id="tuner" type="range" min="1" max="9" step="1" value="4" style="width:120px;" />
      </label>
      <span id="tunerLabel">Station: 4</span>
    `;

    const tuner = document.getElementById("tuner");
    const tunerLabel = document.getElementById("tunerLabel");
    if (tuner && tunerLabel) {
      tuner.addEventListener("input", () => {
        const val = Number(tuner.value);
        radioFrequency = 2 + val; // map slider to pleasant frequency range
        tunerLabel.textContent = `Station: ${val}`;
      });
    }
  } else {
    simTitleEl.textContent = "Simulation";
    simSubtitleEl.textContent = "";
    simExtraEl.textContent = "";
  }
}

showMenu();

// menu interactions --------------------------------------------------------

document.querySelectorAll(".wave-card").forEach((card) => {
  card.addEventListener("click", () => {
    const kind = card.getAttribute("data-sim");
    if (kind === "visible" || kind === "radio") {
      showSimulation(kind);
    }
  });
});

backToMenuBtn.addEventListener("click", () => {
  showMenu();
});

// visible-light controls wiring -------------------------------------------

if (elementSelect && modeSelect) {
  renderSpectrum(elementSelect.value, modeSelect.value);

  [elementSelect, modeSelect].forEach((el) => {
    el.addEventListener("change", () => {
      if (el === elementSelect) {
        currentElementKey = elementSelect.value;
      }
      renderSpectrum(elementSelect.value, modeSelect.value);
    });
  });
}
