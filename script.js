// Session lengths: 5 minutes normally, 10 seconds in Test Mode
const FULL_DURATION = 5 * 60;
const TEST_DURATION = 10;
const STORAGE_KEY = "focusGardenBlooms";
const THEME_KEY = "focusGardenTheme";
const FLOWERS = ["🌸", "🌺", "🌼", "🌻", "🌷"];

const timerEl = document.getElementById("timer");
const statusEl = document.getElementById("status");
const plantEl = document.getElementById("plant");
const startBtn = document.getElementById("startBtn");
const giveUpBtn = document.getElementById("giveUpBtn");
const testModeEl = document.getElementById("testMode");
const gardenRow = document.getElementById("gardenRow");
const gardenEmpty = document.getElementById("gardenEmpty");
const plantsCountEl = document.getElementById("plantsCount");
const themeToggle = document.getElementById("themeToggle");

// Audio
let audioCtx = null;

function ensureAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playBloomChime() {
  if (!audioCtx) return;
  const now = audioCtx.currentTime;

  // Create two short bell-like tones using sine oscillators
  const o1 = audioCtx.createOscillator();
  const o2 = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  o1.type = "sine";
  o2.type = "sine";
  o1.frequency.setValueAtTime(660, now);
  o2.frequency.setValueAtTime(880, now);

  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);

  // Slight detune sweep for a pleasant shimmer
  o1.frequency.exponentialRampToValueAtTime(720, now + 0.6);
  o2.frequency.exponentialRampToValueAtTime(940, now + 1.0);

  o1.connect(gain);
  o2.connect(gain);
  gain.connect(audioCtx.destination);

  o1.start(now);
  o2.start(now + 0.02);
  o1.stop(now + 2);
  o2.stop(now + 2.2);
}

let totalSeconds = FULL_DURATION;
let remaining = FULL_DURATION;
let intervalId = null;
let running = false;

// Restore saved flowers from localStorage
function loadGarden() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveGarden(flowers) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(flowers));
}

function renderGarden() {
  const flowers = loadGarden();
  gardenRow.querySelectorAll(".bloom-mark").forEach((el) => el.remove());
  gardenEmpty.hidden = flowers.length > 0;
  flowers.forEach((emoji) => {
    const span = document.createElement("span");
    span.className = "bloom-mark";
    span.textContent = emoji;
    gardenRow.appendChild(span);
  });
  // Update counter display
  if (plantsCountEl) plantsCountEl.textContent = String(flowers.length);
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function setStatus(text, kind = "") {
  statusEl.textContent = text;
  statusEl.className = "status" + (kind ? ` ${kind}` : "");
}

function setWilted(wilted) {
  plantEl.classList.toggle("wilted", wilted);
}

// Map elapsed progress onto 5 plant stages (seed → bloom)
function updatePlant(elapsed, wilted) {
  setWilted(wilted);
  if (wilted) return;
  const ratio = totalSeconds === 0 ? 1 : elapsed / totalSeconds;
  const stage = Math.min(4, Math.floor(ratio * 5));
  plantEl.dataset.stage = String(stage);
}

function stopTicker() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  running = false;
}

function chosenDuration() {
  return testModeEl.checked ? TEST_DURATION : FULL_DURATION;
}

function resetIdle() {
  stopTicker();
  totalSeconds = chosenDuration();
  remaining = totalSeconds;
  timerEl.textContent = formatTime(remaining);
  setWilted(false);
  plantEl.dataset.stage = "0";
  giveUpBtn.disabled = true;
  startBtn.disabled = false;
}

function tick() {
  remaining -= 1;
  timerEl.textContent = formatTime(Math.max(0, remaining));
  const elapsed = totalSeconds - remaining;
  updatePlant(elapsed, false);

  if (remaining <= 0) {
    completeSession();
  }
}

function completeSession() {
  stopTicker();
  plantEl.dataset.stage = "4";
  setWilted(false);
  setStatus("Bloomed!", "success");
  giveUpBtn.disabled = true;
  startBtn.disabled = false;

  // Add one flower to the garden and persist it
  const flowers = loadGarden();
  const emoji = FLOWERS[flowers.length % FLOWERS.length];
  flowers.push(emoji);
  saveGarden(flowers);
  renderGarden();
  // Play a soft chime for bloom
  // Ensure the context is available (created on user gesture)
  try {
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    playBloomChime();
  } catch (e) {
    // ignore audio errors
  }
}

function startSession() {
  stopTicker();
  totalSeconds = chosenDuration();
  remaining = totalSeconds;
  running = true;
  setWilted(false);
  plantEl.dataset.stage = "0";
  timerEl.textContent = formatTime(remaining);
  setStatus("Growing… stay with your plant.");
  startBtn.disabled = true;
  giveUpBtn.disabled = false;
  intervalId = setInterval(tick, 1000);
  // Create/resume audio context on first user gesture
  try {
    ensureAudioContext();
    if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {
    // ignore
  }
}

function giveUp() {
  if (!running) return;
  stopTicker();
  setWilted(true);
  setStatus("The plant wilted. Try again when you’re ready.", "wilt");
  giveUpBtn.disabled = true;
  startBtn.disabled = false;
}

startBtn.addEventListener("click", startSession);
giveUpBtn.addEventListener("click", giveUp);

// Live-update the idle clock if Test Mode is toggled before starting
testModeEl.addEventListener("change", () => {
  if (!running) resetIdle();
});

// Theme handling
function applyTheme(theme) {
  if (theme === "dark") document.body.classList.add("dark");
  else document.body.classList.remove("dark");
  if (themeToggle) themeToggle.checked = theme === "dark";
}

function loadTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "light";
  } catch {
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {}
}

themeToggle?.addEventListener("change", (e) => {
  const t = e.target.checked ? "dark" : "light";
  applyTheme(t);
  saveTheme(t);
});

// Apply saved theme on load
applyTheme(loadTheme());

renderGarden();
resetIdle();
// Ensure counter and theme are correct on load
renderGarden();
