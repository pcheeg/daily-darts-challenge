const APP_URL = "https://pcheeg.github.io/daily-darts-challenge/";
const START_DATE = "2026-04-01";
const STATS_KEY = "daily-darts-challenge-stats-v4";

const CATEGORIES = [
  { key: "singles", label: "Singles", title: "Hit three single numbers in order" },
  { key: "double", label: "Double", title: "Hit 1 double" },
  { key: "checkout", label: "Checkout", title: "Checkout" },
  { key: "exactScore", label: "Exact score", title: "Score exactly" }
];

let screen = "play";
let mode = "ready"; // ready | playing | finished
let isPracticeMode = false;

let challenge = generateDailyChallenge();
let currentTaskIndex = 0;
let startedAt = null;
let taskStartedAt = null;
let elapsedMs = 0;
let timerInterval = null;
let categoryTimes = {};
let shareMessage = "";

function $(id) {
  return document.getElementById(id);
}

function safeRender() {
  try {
    render();
  } catch (error) {
    console.error(error);
    const app = $("app");
    if (app) {
      app.innerHTML = `
        <section class="card" style="margin-top:40px">
          <p class="eyebrow">Daily Darts</p>
          <h1>Something went wrong</h1>
          <p class="muted">Please clear site data or refresh the page.</p>
          <button class="danger" onclick="localStorage.clear(); location.reload();">Reset app data</button>
        </section>
      `;
    }
  }
}

function render() {
  const app = $("app");

  app.innerHTML = `
    ${screen === "play" ? renderPlay() : ""}
    ${screen === "stats" ? renderStats() : ""}
    ${screen === "settings" ? renderSettings() : ""}
    ${renderNav()}
  `;

  bindEvents();
}

function bindEvents() {
  const startBtn = $("startBtn");
  if (startBtn) startBtn.onclick = () => startChallenge(false);

  const practiceBtn = $("practiceBtn");
  if (practiceBtn) practiceBtn.onclick = () => startChallenge(true);

  const hitBtn = $("hitBtn");
  if (hitBtn) hitBtn.onclick = completeTask;

  const shareBtn = $("shareBtn");
  if (shareBtn) shareBtn.onclick = shareCurrentResult;

  const copyBtn = $("copyBtn");
  if (copyBtn) copyBtn.onclick = copyCurrentResult;

  const tryAgainBtn = $("tryAgainBtn");
  if (tryAgainBtn) tryAgainBtn.onclick = () => startChallenge(true);

  const clearBtn = $("clearBtn");
  if (clearBtn) clearBtn.onclick = clearStats;

  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.onclick = () => {
      screen = button.dataset.screen;
      mode = mode === "playing" ? "playing" : "ready";
      safeRender();
    };
  });
}

function renderHeader(title = `Challenge #${challenge.dayNumber}`) {
  return `
    <header class="header">
      <div>
        <p class="eyebrow">Daily Darts</p>
        <h1>${title}</h1>
      </div>
      <img class="logo" src="icon-192.png?v=7" alt="Daily Darts logo">
    </header>
  `;
}

function renderPlay() {
  const todayRun = getTodayRun();

  if (mode === "playing") return renderPlaying();
  if (mode === "finished") return renderFinished();

  if (todayRun) return renderCompletedToday(todayRun);

  return renderStartScreen();
}

function renderStartScreen() {
  return `
    ${renderHeader("Challenge")}
    <section class="card">
      <p class="muted">Same challenge for everyone today</p>

      <div class="challenge-list">
        ${challenge.tasks.map((task, index) => `
          <div class="challenge-row ${index === 0 ? "active" : ""}">
            <span class="num">${index + 1}</span>
            <div>
              <p class="row-title">${escapeHtml(task.title)}</p>
              <p class="row-value ${index === 0 ? "" : "blur"}">${index === 0 ? escapeHtml(task.value) : "Blurred until unlocked"}</p>
            </div>
          </div>
        `).join("")}
      </div>

      <button class="primary" id="startBtn">Start Challenge</button>
    </section>
  `;
}

function renderCompletedToday(todayRun) {
  const message = buildShareMessage(todayRun.dayNumber, todayRun.totalTimeMs);

  return `
    ${renderHeader(`Challenge #${challenge.dayNumber}`)}
    <section class="card result">
      <div class="tick">✓</div>
      <p class="eyebrow">Completed today</p>
      <div class="result-time">${formatTime(todayRun.totalTimeMs)}</div>
      <div class="share-box">${escapeHtml(message)}</div>

      <div class="button-row">
        <button class="secondary" id="shareBtn">Share</button>
        <button class="secondary" id="copyBtn">Copy</button>
      </div>

      <p class="muted">Come back tomorrow for the next daily challenge.</p>
      <button class="secondary" id="practiceBtn">Practice mode</button>
    </section>
  `;
}

function renderPlaying() {
  const task = challenge.tasks[currentTaskIndex];

  return `
    ${renderHeader(isPracticeMode ? "Practice" : `Challenge #${challenge.dayNumber}`)}
    <section class="timer-wrap">
      <span class="pill">${isPracticeMode ? "Practice Mode" : `Challenge #${challenge.dayNumber}`}</span>
      <div class="timer" id="timer">${formatTime(elapsedMs)}</div>
      <p class="muted">Time elapsed</p>
    </section>

    <p class="progress-text">Challenge ${currentTaskIndex + 1} of 4</p>

    <div class="dots">
      ${challenge.tasks.map((_, index) => `
        <span class="dot ${index < currentTaskIndex ? "done" : ""} ${index === currentTaskIndex ? "active" : ""}"></span>
      `).join("")}
    </div>

    <section class="card active-card">
      <div class="target">🎯</div>
      <p class="task-label">${escapeHtml(task.label)}</p>
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-value">${formatTaskValue(task)}</div>
    </section>

    <section class="locked-list">
      ${challenge.tasks.slice(currentTaskIndex + 1).map((task, i) => `
        <div class="locked-row">
          <span class="num">${currentTaskIndex + i + 2}</span>
          <div class="locked-text">${escapeHtml(task.title)}</div>
          <div>🔒</div>
        </div>
      `).join("")}
    </section>

    <button class="primary" id="hitBtn">Hit</button>
  `;
}

function renderFinished() {
  const title = isPracticeMode ? "Practice completed" : "Challenge completed";

  return `
    ${renderHeader(isPracticeMode ? "Practice" : `Challenge #${challenge.dayNumber}`)}
    <section class="card result">
      <div class="tick">✓</div>
      <p class="eyebrow">${title}</p>
      <div class="result-time">${formatTime(elapsedMs)}</div>

      ${isPracticeMode
        ? `<p class="muted">Practice runs do not save to stats.</p>`
        : `<div class="share-box">${escapeHtml(shareMessage)}</div>
           <div class="button-row">
             <button class="secondary" id="shareBtn">Share</button>
             <button class="secondary" id="copyBtn">Copy</button>
           </div>`
      }

      <button class="secondary" id="tryAgainBtn">${isPracticeMode ? "Practice again" : "Practice mode"}</button>
    </section>
  `;
}

function renderStats() {
  const runs = getRuns();
  const stats = calculateStats(runs);

  return `
    ${renderHeader("Stats")}
    <section class="stats-grid">
      <div class="stat"><p>Best time</p><strong>${stats.bestTime}</strong></div>
      <div class="stat"><p>Average time</p><strong>${stats.averageTime}</strong></div>
      <div class="stat"><p>Current streak</p><strong>${stats.currentStreak}</strong></div>
      <div class="stat"><p>Longest streak</p><strong>${stats.longestStreak}</strong></div>
    </section>

    <section class="card">
      <p class="eyebrow">Best category</p>
      <h2>${stats.bestCategory}</h2>

      ${CATEGORIES.map((category) => `
        <div class="category-row">
          <span>${category.label}</span>
          <strong>${stats.categoryAverages[category.key]}</strong>
        </div>
      `).join("")}
    </section>

    <section class="card">
      <p class="muted">${runs.length} completed run${runs.length === 1 ? "" : "s"} on this device.</p>
      <button class="danger" id="clearBtn">Clear stats</button>
    </section>
  `;
}

function renderSettings() {
  return `
    ${renderHeader("Settings")}
    <section class="card">
      <h2>About</h2>
      <p class="muted">No accounts. No backend. No leaderboard. Your stats are saved locally on this device.</p>
    </section>

    <section class="card">
      <h2>Rules</h2>
      <ul class="rules">
        <li>Challenge 1: hit three singles in order.</li>
        <li>Challenge 2: hit one double.</li>
        <li>Challenge 3: checkout the number shown.</li>
        <li>Challenge 4: score exactly the number shown.</li>
        <li>Upcoming challenges stay blurred until unlocked.</li>
        <li>Practice mode only appears after the daily challenge is complete and does not save stats.</li>
      </ul>
    </section>
  `;
}

function renderNav() {
  return `
    <nav class="nav">
      <button class="${screen === "play" ? "active" : ""}" data-screen="play">Play</button>
      <button class="${screen === "stats" ? "active" : ""}" data-screen="stats">Stats</button>
      <button class="${screen === "settings" ? "active" : ""}" data-screen="settings">Settings</button>
    </nav>
  `;
}

function startChallenge(practice = false) {
  isPracticeMode = practice;
  mode = "playing";
  screen = "play";
  currentTaskIndex = 0;
  elapsedMs = 0;
  categoryTimes = {};
  startedAt = Date.now();
  taskStartedAt = startedAt;

  clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    elapsedMs = Date.now() - startedAt;
    const timer = $("timer");
    if (timer) timer.textContent = formatTime(elapsedMs);
  }, 250);

  safeRender();
}

function completeTask() {
  const now = Date.now();
  const task = challenge.tasks[currentTaskIndex];

  categoryTimes[task.key] = now - taskStartedAt;
  taskStartedAt = now;

  if (currentTaskIndex === challenge.tasks.length - 1) {
    finishChallenge();
    return;
  }

  currentTaskIndex += 1;
  safeRender();
}

function finishChallenge() {
  clearInterval(timerInterval);
  elapsedMs = Date.now() - startedAt;

  if (!isPracticeMode) {
    saveRun({
      date: todayKey(),
      dayNumber: challenge.dayNumber,
      totalTimeMs: elapsedMs,
      categoryTimes
    });

    shareMessage = buildShareMessage(challenge.dayNumber, elapsedMs);
  }

  mode = "finished";
  safeRender();
}

function formatTaskValue(task) {
  if (task.key !== "singles") return escapeHtml(task.value);

  return `
    <div class="single-boxes">
      ${task.value.split(" → ").map((part, index, arr) => `
        <span class="single-box">${escapeHtml(part)}</span>${index < arr.length - 1 ? "<span>→</span>" : ""}
      `).join("")}
    </div>
  `;
}

function generateDailyChallenge(date = new Date()) {
  const dayNumber = Math.max(1, getDayNumber(date));
  const weekNumber = Math.floor((dayNumber - 1) / 7) + 1;
  const dayIndex = (dayNumber - 1) % 7;

  const singleSequences = [];

  for (let start = 1; start <= 18; start++) {
    singleSequences.push(`S${start} → S${start + 1} → S${start + 2}`);
  }

  for (let start = 20; start >= 3; start--) {
    singleSequences.push(`S${start} → S${start - 1} → S${start - 2}`);
  }

  const doubles = Array.from({ length: 20 }, (_, i) => i + 1);

  const checkouts = [
    ...Array.from({ length: 19 }, (_, i) => i * 2 + 3),
    ...Array.from({ length: 59 }, (_, i) => i + 41)
  ];

  const exactScores = Array.from({ length: 40 }, (_, i) => i + 61);

  return {
    dayNumber,
    tasks: [
      { ...CATEGORIES[0], value: getWeeklyPick(singleSequences, weekNumber, dayIndex, 11) },
      { ...CATEGORIES[1], value: `D${getWeeklyPick(doubles, weekNumber, dayIndex, 22)}` },
      { ...CATEGORIES[2], value: `${getWeeklyPick(checkouts, weekNumber, dayIndex, 33)}` },
      { ...CATEGORIES[3], value: `${getWeeklyPick(exactScores, weekNumber, dayIndex, 44)}` }
    ]
  };
}

function getDayNumber(date = new Date()) {
  const start = parseLocalDate(START_DATE);
  const today = parseLocalDate(todayKey(date));
  return Math.floor((today - start) / 86400000) + 1;
}

function getWeeklyPick(options, weekNumber, dayIndex, offset) {
  return shuffleSeeded(options, weekNumber * 1000 + offset)[dayIndex % options.length];
}

function shuffleSeeded(array, seed) {
  return array
    .map((value, index) => ({ value, sort: seededRandom(seed + index * 101) }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function seededRandom(seed) {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getTodayRun() {
  return getRuns().find((run) => run.date === todayKey()) || null;
}

function getRuns() {
  try {
    const stored = JSON.parse(localStorage.getItem(STATS_KEY));

    if (Array.isArray(stored)) return stored.filter(isValidRun);
    if (stored && Array.isArray(stored.runs)) return stored.runs.filter(isValidRun);

    return [];
  } catch {
    return [];
  }
}

function isValidRun(run) {
  return run
    && typeof run.date === "string"
    && typeof run.dayNumber === "number"
    && typeof run.totalTimeMs === "number"
    && run.categoryTimes
    && typeof run.categoryTimes === "object";
}

function saveRun(run) {
  const runs = getRuns();
  const existing = runs.findIndex((item) => item.date === run.date);

  if (existing >= 0) runs[existing] = run;
  else runs.push(run);

  runs.sort((a, b) => a.date.localeCompare(b.date));
  localStorage.setItem(STATS_KEY, JSON.stringify(runs));
}

function calculateStats(runs) {
  if (!runs.length) {
    return {
      bestTime: "--:--",
      averageTime: "--:--",
      currentStreak: "0",
      longestStreak: "0",
      bestCategory: "--",
      categoryAverages: Object.fromEntries(CATEGORIES.map((category) => [category.key, "--:--"]))
    };
  }

  const totalTimes = runs.map((run) => run.totalTimeMs);
  const best = Math.min(...totalTimes);
  const average = totalTimes.reduce((sum, value) => sum + value, 0) / totalTimes.length;

  const categoryAverages = {};
  let bestCategory = null;

  CATEGORIES.forEach((category) => {
    const values = runs
      .map((run) => run.categoryTimes?.[category.key])
      .filter((value) => typeof value === "number");

    if (!values.length) {
      categoryAverages[category.key] = "--:--";
      return;
    }

    const categoryAverage = values.reduce((sum, value) => sum + value, 0) / values.length;
    categoryAverages[category.key] = formatTime(categoryAverage);

    if (!bestCategory || categoryAverage < bestCategory.average) {
      bestCategory = {
        label: category.label,
        average: categoryAverage
      };
    }
  });

  const streaks = calculateStreaks(runs.map((run) => run.date));

  return {
    bestTime: formatTime(best),
    averageTime: formatTime(average),
    currentStreak: String(streaks.current),
    longestStreak: String(streaks.longest),
    bestCategory: bestCategory ? bestCategory.label : "--",
    categoryAverages
  };
}

function calculateStreaks(dates) {
  const unique = [...new Set(dates)].sort();

  if (!unique.length) {
    return { current: 0, longest: 0 };
  }

  let longest = 0;
  let run = 0;
  let previous = null;

  unique.forEach((date) => {
    if (previous && daysBetween(previous, date) === 1) run += 1;
    else run = 1;

    longest = Math.max(longest, run);
    previous = date;
  });

  let current = 0;
  const dateSet = new Set(unique);
  let cursor = todayKey();

  while (dateSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

function clearStats() {
  if (!confirm("Clear all stats on this device?")) return;
  localStorage.removeItem(STATS_KEY);
  mode = "ready";
  isPracticeMode = false;
  safeRender();
}

function buildShareMessage(dayNumber, timeMs) {
  return `I completed Daily Darts Challenge #${dayNumber} in ${formatTime(timeMs)} 🎯\n\nCan you beat me?\n\n${APP_URL}`;
}

async function shareCurrentResult() {
  const todayRun = getTodayRun();
  const message = shareMessage || (todayRun ? buildShareMessage(todayRun.dayNumber, todayRun.totalTimeMs) : "");

  if (!message) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "Daily Darts Challenge",
        text: message,
        url: APP_URL
      });
      return;
    } catch {}
  }

  await copyText(message);
}

async function copyCurrentResult() {
  const todayRun = getTodayRun();
  const message = shareMessage || (todayRun ? buildShareMessage(todayRun.dayNumber, todayRun.totalTimeMs) : "");

  if (!message) return;
  await copyText(message);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied");
  } catch {
    alert("Could not copy");
  }
}

function formatTime(ms) {
  const safeMs = Number.isFinite(ms) ? ms : 0;
  const totalSeconds = Math.floor(safeMs / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(dateString, days) {
  const date = parseLocalDate(dateString);
  date.setDate(date.getDate() + days);
  return todayKey(date);
}

function daysBetween(a, b) {
  return Math.round((parseLocalDate(b) - parseLocalDate(a)) / 86400000);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {}
  });
}

safeRender();
