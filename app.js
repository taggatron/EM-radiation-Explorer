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
const simTitleBelow = document.getElementById("simTitleBelow");

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
const microwaveSimPanel = document.getElementById("microwaveSimPanel");
const xraySimPanel = document.getElementById("xraySimPanel");
// Visible-light inline controls (Element/Mode) live inside the visible panel by default.
const visibleInlineControls = document.querySelector("#visibleSimPanel .inline-controls");
const visibleControlsHome = visibleInlineControls ? visibleInlineControls.parentElement : null;
const visiblePanelHeader = document.querySelector("#visibleSimPanel .sim-panel-header");

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
// Initial sizing; will also be called again when the visible sim is shown.
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

  // Use the intrinsic canvas size (already scaled by radioDpr) and
  // convert back to CSS pixels so drawing coordinates line up.
  const w = radioCanvas.width / radioDpr;
  const h = radioCanvas.height / radioDpr;
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
    // compute the instantaneous wave displacement at a point near the right
    // side of the canvas (where a receiver would sit) so the DOM dot
    // matches the canvas waveform timing and frequency.
    const receiverRect = receiverElectronEl.parentElement.getBoundingClientRect();
    const recvH = receiverRect.height;
    // pick a receiver X position near the right edge of the canvas
    const receiverX = Math.min(w, antennaX + wavelength * 1.6); // some distance from antenna
    const tRecv = (receiverX - antennaX) / wavelength; // cycles from antenna to receiver
    const recvWave = Math.sin(tRecv * Math.PI * 2 - phaseOffset);
    // map the wave value to a small vertical motion inside the receiver box
    const maxTravel = Math.max(8, recvH * 0.25);
    const offset = recvWave * maxTravel;
    // Set a CSS variable instead of directly setting `transform` because
    // the element's animation also modifies transform. Using a variable
    // lets the keyframes include the translateY without overwriting it.
    receiverElectronEl.style.setProperty('--recv-y', `${offset}px`);
  }

  requestAnimationFrame(drawRadioFrame);
}

requestAnimationFrame(drawRadioFrame);

// Microwave simulation ------------------------------------------------------

const microwaveCanvas = document.getElementById("microwaveCanvas");
const microwaveCtx = microwaveCanvas ? microwaveCanvas.getContext("2d") : null;
let microwaveDpr = window.devicePixelRatio || 1;
let microwavePhase = 0;
let microwaveLast = performance.now();
let microwavePower = 5; // 1..10 UI slider, affects speed and intensity

function resizeMicrowaveCanvas() {
  if (!microwaveCanvas || !microwaveCtx) return;
  const parent = microwaveCanvas.parentElement;
  const rect = parent ? parent.getBoundingClientRect() : microwaveCanvas.getBoundingClientRect();
  const width = rect.width || 300;
  const height = rect.height || 220;
  microwaveCanvas.width = width * microwaveDpr;
  microwaveCanvas.height = height * microwaveDpr;
  microwaveCtx.setTransform(microwaveDpr, 0, 0, microwaveDpr, 0, 0);
}

if (microwaveCanvas) {
  window.addEventListener("resize", resizeMicrowaveCanvas);
  window.addEventListener("load", resizeMicrowaveCanvas);
  resizeMicrowaveCanvas();
}

function drawMicrowaveFrame(now) {
  if (!microwaveCanvas || !microwaveCtx) {
    requestAnimationFrame(drawMicrowaveFrame);
    return;
  }

  const dt = (now - microwaveLast) / 1000;
  microwaveLast = now;
  microwavePhase += dt * (1 + microwavePower * 0.8);

  const w = microwaveCanvas.width / microwaveDpr;
  const h = microwaveCanvas.height / microwaveDpr;
  microwaveCtx.clearRect(0, 0, w, h);

  // cavity background
  const grad = microwaveCtx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#020617");
  grad.addColorStop(1, "#020617");
  microwaveCtx.fillStyle = grad;
  microwaveCtx.fillRect(0, 0, w, h);

  // draw a grid of water molecules as small dipoles
  const rows = 3;
  const cols = 7;
  const spacingX = w / (cols + 1);
  const spacingY = h / (rows + 1);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = spacingX * (col + 1);
      const cy = spacingY * (row + 1);

      const localPhase = microwavePhase + (row * 0.6 + col * 0.4);
      const angle = Math.sin(localPhase) * (0.5 + microwavePower * 0.06); // dipole rotation

      microwaveCtx.save();
      microwaveCtx.translate(cx, cy);
      microwaveCtx.rotate(angle);

      // oxygen
      const oxyGrad = microwaveCtx.createRadialGradient(0, 0, 0, 0, 0, 13);
      oxyGrad.addColorStop(0, "#0ea5e9");
      oxyGrad.addColorStop(1, "#022c22");
      microwaveCtx.fillStyle = oxyGrad;
      microwaveCtx.beginPath();
      microwaveCtx.arc(0, 0, 11, 0, Math.PI * 2);
      microwaveCtx.fill();

      // hydrogens
      const armLen = 20;
      for (let s = -1; s <= 1; s += 2) {
        const hx = Math.cos(0.9 * s) * armLen;
        const hy = Math.sin(0.9 * s) * armLen;

        microwaveCtx.strokeStyle = "rgba(148,163,184,0.7)";
        microwaveCtx.lineWidth = 2;
        microwaveCtx.beginPath();
        microwaveCtx.moveTo(0, 0);
        microwaveCtx.lineTo(hx, hy);
        microwaveCtx.stroke();

        const hGrad = microwaveCtx.createRadialGradient(hx, hy, 0, hx, hy, 9);
        hGrad.addColorStop(0, "#22c55e");
        hGrad.addColorStop(1, "#052e16");
        microwaveCtx.fillStyle = hGrad;
        microwaveCtx.beginPath();
        microwaveCtx.arc(hx, hy, 6, 0, Math.PI * 2);
        microwaveCtx.fill();
      }

      microwaveCtx.restore();
    }
  }

  // standing-wave like field stripes
  const bandAlpha = Math.min(0.12 + microwavePower * 0.06, 0.9);
  microwaveCtx.globalAlpha = 1;
  microwaveCtx.fillStyle = `rgba(34,197,94,${bandAlpha.toFixed(2)})`;
  const bandCount = 6;
  for (let i = 0; i < bandCount; i++) {
    const t = i / bandCount;
    const offset = Math.sin(microwavePhase + t * Math.PI * 2) * (8 + microwavePower * 2.5);
    const y = t * h + offset;
    const bandH = 8 + microwavePower * 1.2;
    microwaveCtx.fillRect(0, y, w, bandH);
  }

  requestAnimationFrame(drawMicrowaveFrame);
}

requestAnimationFrame(drawMicrowaveFrame);

// X-ray simulation ---------------------------------------------------------

const xrayCanvas = document.getElementById("xrayCanvas");
const xrayCtx = xrayCanvas ? xrayCanvas.getContext("2d") : null;
let xrayDpr = window.devicePixelRatio || 1;
let xrayLast = performance.now();
let xrayPhase = 0;

function resizeXrayCanvas() {
  if (!xrayCanvas || !xrayCtx) return;
  const parent = xrayCanvas.parentElement;
  const rect = parent ? parent.getBoundingClientRect() : xrayCanvas.getBoundingClientRect();
  const width = rect.width || 300;
  const height = rect.height || 220;
  xrayCanvas.width = width * xrayDpr;
  xrayCanvas.height = height * xrayDpr;
  xrayCtx.setTransform(xrayDpr, 0, 0, xrayDpr, 0, 0);
}

if (xrayCanvas) {
  window.addEventListener("resize", resizeXrayCanvas);
  window.addEventListener("load", resizeXrayCanvas);
  resizeXrayCanvas();
}

function drawXrayFrame(now) {
  if (!xrayCanvas || !xrayCtx) {
    requestAnimationFrame(drawXrayFrame);
    return;
  }

  const dt = (now - xrayLast) / 1000;
  xrayLast = now;
  xrayPhase += dt * 3.5;

  const w = xrayCanvas.width / xrayDpr;
  const h = xrayCanvas.height / xrayDpr;
  xrayCtx.clearRect(0, 0, w, h);

  // background soft tissue
  const bg = xrayCtx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#020617");
  bg.addColorStop(1, "#020617");
  xrayCtx.fillStyle = bg;
  xrayCtx.fillRect(0, 0, w, h);

  // simple rib-like arcs (higher absorption)
  xrayCtx.strokeStyle = "rgba(226,232,240,0.7)";
  xrayCtx.lineWidth = 3;
  const ribs = 6;
  for (let i = 0; i < ribs; i++) {
    const t = (i + 1) / (ribs + 1);
    const y = t * h * 0.85 + h * 0.05;
    xrayCtx.beginPath();
    xrayCtx.moveTo(w * 0.2, y);
    xrayCtx.quadraticCurveTo(w * 0.5, y - 30, w * 0.8, y);
    xrayCtx.stroke();
  }

  // faint spine
  xrayCtx.strokeStyle = "rgba(148,163,184,0.6)";
  xrayCtx.lineWidth = 4;
  xrayCtx.beginPath();
  xrayCtx.moveTo(w * 0.5, h * 0.15);
  xrayCtx.lineTo(w * 0.5, h * 0.85);
  xrayCtx.stroke();

  // X-ray beam from left
  const beamCount = 24;
  for (let i = 0; i < beamCount; i++) {
    const t = i / (beamCount - 1);
    const y = t * h;
    const intensity = 0.25 + 0.75 * Math.exp(-Math.abs(Math.sin(y * 0.03 + xrayPhase)) * 1.6);

    const startAlpha = 0.55 * intensity;
    const endAlpha = 0.1 * intensity;
    const gradBeam = xrayCtx.createLinearGradient(0, y, w, y);
    gradBeam.addColorStop(0, `rgba(248,250,252,${startAlpha.toFixed(2)})`);
    gradBeam.addColorStop(1, `rgba(148,163,184,${endAlpha.toFixed(2)})`);
    xrayCtx.strokeStyle = gradBeam;
    xrayCtx.lineWidth = 2;
    xrayCtx.beginPath();
    xrayCtx.moveTo(0, y);
    xrayCtx.lineTo(w, y);
    xrayCtx.stroke();
  }

  requestAnimationFrame(drawXrayFrame);
}

requestAnimationFrame(drawXrayFrame);

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

  // Atom canvas: also use intrinsic size / dpr so we match resizeCanvas.
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;
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
  if (simTitleBelow) simTitleBelow.hidden = true;

  // Return visible-light controls to their original header container
  if (visibleInlineControls && visibleControlsHome && visibleInlineControls.parentElement !== visibleControlsHome) {
    visibleControlsHome.appendChild(visibleInlineControls);
  }
  if (visiblePanelHeader) visiblePanelHeader.hidden = false;

  visibleSimPanel.hidden = true;
  visibleSpectrumPanel.hidden = true;
  radioSimPanel.hidden = true;
  if (microwaveSimPanel) microwaveSimPanel.hidden = true;
  if (xraySimPanel) xraySimPanel.hidden = true;
}

function showSimulation(kind) {
  menuView.hidden = true;
  simView.hidden = false;
  mainControls.hidden = true;
  simControls.hidden = false;
  if (simTitleBelow) simTitleBelow.hidden = false;

  // By default, put visible-light controls back in their home container
  if (visibleInlineControls && visibleControlsHome && visibleInlineControls.parentElement !== visibleControlsHome) {
    visibleControlsHome.appendChild(visibleInlineControls);
  }
  if (visiblePanelHeader) visiblePanelHeader.hidden = false;

  // hide everything first, then enable just the requested simulation panels
  visibleSimPanel.hidden = true;
  visibleSpectrumPanel.hidden = true;
  radioSimPanel.hidden = true;
    if (microwaveSimPanel) microwaveSimPanel.hidden = true;
    if (xraySimPanel) xraySimPanel.hidden = true;

  if (kind === "visible") {
    visibleSimPanel.hidden = false;
    visibleSpectrumPanel.hidden = false;

    simTitleEl.textContent = "Visible Light: Atomic Line Spectra";
    simSubtitleEl.textContent = "Electrons in atoms absorb and emit discrete photon energies.";
    // Move element/mode controls below the simulation cards for consistency
    simExtraEl.innerHTML = "";
    if (visibleInlineControls) {
      simExtraEl.appendChild(visibleInlineControls);
      if (visiblePanelHeader) visiblePanelHeader.hidden = true;
    }
    const tip = document.createElement("span");
    tip.textContent = "Tip: switch element and emission/absorption.";
    tip.style.opacity = 0.8;
    simExtraEl.appendChild(tip);
    currentElementKey = elementSelect.value;
    renderSpectrum(elementSelect.value, modeSelect.value);

    // Ensure the atom canvas is correctly sized now that the panel is visible
    if (typeof resizeCanvas === "function") {
      resizeCanvas();
    }
  } else if (kind === "radio") {
    radioSimPanel.hidden = false;

    simTitleEl.textContent = "Radio Waves: Antenna Transmission";
    simSubtitleEl.textContent = "An AC current makes electrons in the transmitter vibrate, launching long-wavelength radio waves.";

    // Build tuner UI
    // rotating knob tuner with analog display
    simExtraEl.innerHTML = `
      <div class="tuner-wrapper" aria-hidden="false">
        <div class="tuner-knob" id="tunerKnob" tabindex="0" role="slider" aria-valuemin="1" aria-valuemax="9" aria-valuenow="4" aria-label="Tuner knob">
          <div class="knob-face" id="knobFace"><div class="knob-indicator"></div></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start;">
          <div class="tuner-label" id="tunerLabel">Station: 4</div>
          <div class="tuner-display" id="tunerDisplay">88.0 MHz</div>
        </div>
      </div>
    `;

    // Wire up interaction: pointer drag, keyboard and programmatic updates
    const knob = document.getElementById('tunerKnob');
    const knobFace = document.getElementById('knobFace');
    const tunerLabel = document.getElementById('tunerLabel');
    const tunerDisplay = document.getElementById('tunerDisplay');

    // knob geometry and mapping: angle range -135..+135 maps to values 1..9
    const minVal = 1, maxVal = 9;
    const minAngle = -135, maxAngle = 135;

    function valueToAngle(v) {
      const t = (v - minVal) / (maxVal - minVal);
      return minAngle + t * (maxAngle - minAngle);
    }
    function angleToValue(a) {
      const t = (a - minAngle) / (maxAngle - minAngle);
      return Math.round(minVal + t * (maxVal - minVal));
    }
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

    function setKnobValue(v, opts = {}) {
      const val = clamp(Math.round(v), minVal, maxVal);
      const ang = valueToAngle(val);
      if (knobFace) knobFace.style.transform = `rotate(${ang}deg)`;
      radioFrequency = 2 + val; // maintain existing mapping
      if (tunerLabel) tunerLabel.textContent = `Station: ${val}`;
      if (tunerDisplay) {
        const freq = 88 + (val - 1) * (20 / (maxVal - minVal));
        tunerDisplay.textContent = `${freq.toFixed(1)} MHz`;
      }
      if (knob) knob.setAttribute('aria-valuenow', String(val));
      if (!opts.silent) {
        // small visual cue could be added here
      }
      return val;
    }

    // initialize knob
    setKnobValue(4, { silent: true });

    // pointer drag handling
    let dragging = false;
    let rectCenter = null;

    function updateFromPointer(clientX, clientY) {
      if (!rectCenter) return;
      const dx = clientX - rectCenter.x;
      const dy = clientY - rectCenter.y;
      let ang = Math.atan2(dy, dx) * 180 / Math.PI; // -180..180
      // convert to knob coordinate where 0deg is to the right; our mapping is already in degrees
      // normalize ang to -180..180
      if (ang > 180) ang -= 360;
      if (ang < -180) ang += 360;
      // Clamp into our usable arc
      ang = clamp(ang, minAngle, maxAngle);
      const val = angleToValue(ang);
      setKnobValue(val);
    }

    knob && knob.addEventListener('pointerdown', (ev) => {
      ev.preventDefault();
      dragging = true;
      const r = knob.getBoundingClientRect();
      rectCenter = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      knob.setPointerCapture(ev.pointerId);
    });

    window.addEventListener('pointermove', (ev) => {
      if (!dragging) return;
      updateFromPointer(ev.clientX, ev.clientY);
    });

    window.addEventListener('pointerup', (ev) => {
      if (!dragging) return;
      dragging = false;
      try { knob.releasePointerCapture(ev.pointerId); } catch (e) {}
    });

    // keyboard support
    knob && knob.addEventListener('keydown', (ev) => {
      const key = ev.key;
      const current = Number(knob.getAttribute('aria-valuenow') || 4);
      if (key === 'ArrowLeft' || key === 'ArrowDown') {
        setKnobValue(current - 1);
        ev.preventDefault();
      } else if (key === 'ArrowRight' || key === 'ArrowUp') {
        setKnobValue(current + 1);
        ev.preventDefault();
      } else if (key === 'Home') {
        setKnobValue(minVal);
        ev.preventDefault();
      } else if (key === 'End') {
        setKnobValue(maxVal);
        ev.preventDefault();
      }
    });

    // Ensure the radio canvas is correctly sized now that the panel is visible
    if (typeof resizeRadioCanvas === "function") {
      resizeRadioCanvas();
    }
  } else if (kind === "microwave") {
    if (microwaveSimPanel) microwaveSimPanel.hidden = false;

    simTitleEl.textContent = "Microwaves: Molecular Rotation & Heating";
    simSubtitleEl.textContent = "Microwave fields make polar water molecules rotate and jostle.";
    simExtraEl.innerHTML = `
      <label style="display:inline-flex;align-items:center;gap:4px;">
        Power
        <input id="mwPower" type="range" min="1" max="10" step="1" value="${microwavePower}" style="width:120px;" />
      </label>
      <span id="mwPowerLabel">Level: ${microwavePower}</span>
    `;

    const mwPower = document.getElementById("mwPower");
    const mwPowerLabel = document.getElementById("mwPowerLabel");
    if (mwPower && mwPowerLabel) {
      mwPower.addEventListener("input", () => {
        microwavePower = Number(mwPower.value);
        mwPowerLabel.textContent = `Level: ${microwavePower}`;
      });
    }

    if (typeof resizeMicrowaveCanvas === "function") {
      // Wait one frame to ensure layout has updated after unhide
      requestAnimationFrame(() => resizeMicrowaveCanvas());
    }
  } else if (kind === "xray") {
    if (xraySimPanel) xraySimPanel.hidden = false;

    simTitleEl.textContent = "X-rays: Differential Absorption";
    simSubtitleEl.textContent = "Dense bone absorbs more X-rays than soft tissue.";
    simExtraEl.textContent = "Bright ribs and spine show where fewer photons get through.";

    if (typeof resizeXrayCanvas === "function") {
      requestAnimationFrame(() => resizeXrayCanvas());
    }
  } else {
    // Fallback for unimplemented sims (microwave, x-ray)
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
    if (!kind) return;
    showSimulation(kind);
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
