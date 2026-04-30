const APP_URL = "https://pcheeg.github.io/daily-darts-challenge";
const START_DATE = "2026-05-01";
const STATS_KEY = "daily-darts-challenge-stats-v1";

const categories = [
  { key: "singles", label: "Singles", title: "Hit three single numbers in order" },
  { key: "double", label: "Double", title: "Hit 1 double" },
  { key: "checkout", label: "Checkout", title: "Checkout" },
  { key: "exactScore", label: "Exact score", title: "Score exactly" }
];

let challenge = generateDailyChallenge();
let currentTaskIndex = 0;
let startedAt = null;
let taskStartedAt = null;
let elapsedMs = 0;
let timerInterval = null;
let categoryTimes = {};
let shareMessage = "";

const $ = (id) => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  challenge = generateDailyChallenge();

  $("challengeTitle").textContent = `Challenge #${challenge.dayNumber}`;
  $("dailyPill").textContent = `Challenge #${challenge.dayNumber}`;
  $("previewSingles").textContent = challenge.tasks[0].value;

  renderDots();
  renderLockedList();
  renderStats();

  $("startBtn").addEventListener("click", startChallenge);
  $("hitBtn").addEventListener("click", completeTask);
  $("shareBtn").addEventListener("click", shareResult);
  $("copyBtn").addEventListener("click", copyResult);
  $("tryAgainBtn").addEventListener("click", resetPlayScreen);
  $("resetStatsBtn").addEventListener("click", resetStats);

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.addEventListener("click", () => switchScreen(button.dataset.screen));
  });

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
});

function startChallenge() {
  currentTaskIndex = 0;
  categoryTimes = {};
  startedAt = Date.now();
  taskStartedAt = startedAt;
  elapsedMs = 0;

  $("introCard").classList.add("hidden");
  $("resultCard").classList.add("hidden");
  $("gameCard").classList.remove("hidden");

  renderActiveTask();
  renderDots();
  renderLockedList();

  updateTimer();
  timerInterval = setInterval(updateTimer, 250);
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
  renderActiveTask();
  renderDots();
  renderLockedList();
}

function finishChallenge() {
  clearInterval(timerInterval);
  elapsedMs = Date.now() - startedAt;

  const finalTime = formatTime(elapsedMs);
  shareMessage = `I completed Daily Darts Challenge #${challenge.dayNumber} in ${finalTime} 🎯\n\nCan you beat me?\n\n${APP_URL}`;

  saveRun({
    dayNumber: challenge.dayNumber,
    date: todayKey(),
    totalTimeMs: elapsedMs,
    categoryTimes
  });

  $("gameCard").classList.add("hidden");
  $("resultCard").classList.remove("hidden");
  $("finalTime").textContent = finalTime;
  $("resultText").textContent = shareMessage;

  renderStats();
}

function resetPlayScreen() {
  clearInterval(timerInterval);
  currentTaskIndex = 0;
  startedAt = null;
  taskStartedAt = null;
  elapsedMs = 0;
  categoryTimes = {};

  $("timer").textContent = "00:00";
  $("resultCard").classList.add("hidden");
  $("gameCard").classList.add("hidden");
  $("introCard").classList.remove("hidden");
  renderDots();
}

function renderActiveTask() {
  const task = challenge.tasks[currentTaskIndex];

  $("progressLabel").textContent = `Challenge ${currentTaskIndex + 1} of ${challenge.tasks.length}`;
  $("taskCategory").textContent = task.label;
  $("activeTaskTitle").textContent = task.title;

  if (task.key === "singles") {
    const parts = task.value.split(" → ");
    $("activeTaskValue").innerHTML = `<div class="single-boxes">${parts.map((part, index) => `
      <span class="single-box">${part}</span>${index < parts.length - 1 ? "<span>→</span>" : ""}
    `).join("")}</div>`;
  } else {
    $("activeTaskValue").textContent = task.value;
  }
}

function renderLockedList() {
  const container = $("lockedList");
  container.innerHTML = "";

  challenge.tasks.forEach((task, index) => {
    if (index <= currentTaskIndex) return;

    const row = document.createElement("div");
    row.className = "locked-row";
    row.innerHTML = `
      <span>${index + 1}</span>
      <div class="locked-text">${task.title}</div>
      <div class="lock">🔒</div>
    `;
    container.appendChild(row);
  });
}

function renderDots() {
  const dots = $("dots");
  dots.innerHTML = "";

  challenge.tasks.forEach((_, index) => {
    const dot = document.createElement("span");
    dot.className = "dot";
    if (index < currentTaskIndex) dot.classList.add("done");
    if (index === currentTaskIndex) dot.classList.add("active");
    dots.appendChild(dot);
  });
}

async function shareResult() {
  if (navigator.share) {
    try {
      await navigator.share({
        title: "Daily Darts Challenge",
        text: shareMessage,
        url: APP_URL
      });
    } catch (error) {}
  } else {
    copyResult();
  }
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(shareMessage);
    $("copyBtn").textContent = "Copied";
    setTimeout(() => ($("copyBtn").textContent = "Copy"), 1200);
  } catch (error) {
    alert("Could not copy the result.");
  }
}

function updateTimer() {
  elapsedMs = Date.now() - startedAt;
  $("timer").textContent = formatTime(elapsedMs);
}

function generateDailyChallenge(date = new Date()) {
  const dayNumber = getDayNumber(date);
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

  const singles = getWeeklyPick(singleSequences, weekNumber, dayIndex, 10);
  const double = getWeeklyPick(doubles, weekNumber, dayIndex, 20);
  const checkout = getWeeklyPick(checkouts, weekNumber, dayIndex, 30);
  const exactScore = getWeeklyPick(exactScores, weekNumber, dayIndex, 40);

  return {
    dayNumber,
    date: todayKey(date),
    tasks: [
      { ...categories[0], value: singles },
      { ...categories[1], value: `D${double}` },
      { ...categories[2], value: `${checkout}` },
      { ...categories[3], value: `${exactScore}` }
    ]
  };
}

function getDayNumber(date = new Date()) {
  const start = parseLocalDate(START_DATE);
  const today = parseLocalDate(todayKey(date));
  return Math.floor((today - start) / 86400000) + 1;
}

function getWeeklyPick(options, weekNumber, dayIndex, offset) {
  const shuffled = shuffleSeeded(options, weekNumber * 1000 + offset);
  return shuffled[dayIndex];
}

function shuffleSeeded(array, seed) {
  return array
    .map((value, index) => ({ value, sort: seededRandom(seed + index * 97) }))
    .sort((a, b) => a.sort - b.sort)
    .map((item) => item.value);
}

function seededRandom(seed) {
  let x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function getStats() {
  try {
    return JSON.parse(localStorage.getItem(STATS_KEY)) || { runs: [] };
  } catch {
    return { runs: [] };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function saveRun(run) {
  const stats = getStats();

  const existingIndex = stats.runs.findIndex((item) => item.date === run.date);
  if (existingIndex >= 0) {
    stats.runs[existingIndex] = run;
  } else {
    stats.runs.push(run);
  }

  stats.runs.sort((a, b) => a.date.localeCompare(b.date));
  saveStats(stats);
}

function renderStats() {
  const stats = getStats();
  const runs = stats.runs || [];

  if (!runs.length) {
    $("bestTime").textContent = "--:--";
    $("averageTime").textContent = "--:--";
    $("currentStreak").textContent = "0 days";
    $("longestStreak").textContent = "0 days";
    $("bestCategory").textContent = "Best category: --";
    $("totalCompleted").textContent = "0 total runs";
    $("categoryStats").innerHTML = categories.map((cat) => `
      <div class="category-row">
        <span>${cat.label}</span>
        <strong>--:--</strong>
      </div>
    `).join("");
    return;
  }

  const totalTimes = runs.map((run) => run.totalTimeMs);
  const best = Math.min(...totalTimes);
  const average = totalTimes.reduce((sum, value) => sum + value, 0) / totalTimes.length;

  $("bestTime").textContent = formatTime(best);
  $("averageTime").textContent = formatTime(average);
  $("totalCompleted").textContent = `${runs.length} total run${runs.length === 1 ? "" : "s"}`;

  const streaks = calculateStreaks(runs.map((run) => run.date));
  $("currentStreak").textContent = `${streaks.current} day${streaks.current === 1 ? "" : "s"}`;
  $("longestStreak").textContent = `${streaks.longest} day${streaks.longest === 1 ? "" : "s"}`;

  const averagesByCategory = categories.map((cat) => {
    const values = runs
      .map((run) => run.categoryTimes?.[cat.key])
      .filter((value) => typeof value === "number");

    const avg = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : null;

    return { ...cat, avg };
  });

  const validAverages = averagesByCategory.filter((item) => item.avg !== null);
  const bestCategory = validAverages.length
    ? validAverages.reduce((best, item) => item.avg < best.avg ? item : best)
    : null;

  $("bestCategory").textContent = `Best category: ${bestCategory ? bestCategory.label : "--"}`;

  $("categoryStats").innerHTML = averagesByCategory.map((cat) => `
    <div class="category-row">
      <span>${cat.label}</span>
      <strong>${cat.avg === null ? "--:--" : formatTime(cat.avg)}</strong>
    </div>
  `).join("");
}

function calculateStreaks(dates) {
  const unique = [...new Set(dates)].sort();
  if (!unique.length) return { current: 0, longest: 0 };

  let longest = 1;
  let run = 1;

  for (let i = 1; i < unique.length; i++) {
    if (daysBetween(unique[i - 1], unique[i]) === 1) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
  }

  let current = 0;
  let cursor = todayKey();
  const dateSet = new Set(unique);

  while (dateSet.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

function resetStats() {
  if (!confirm("Reset all local stats?")) return;
  localStorage.removeItem(STATS_KEY);
  renderStats();
}

function switchScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.toggle("active", screen.id === screenId);
  });

  document.querySelectorAll(".nav-btn").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screenId);
  });

  if (screenId === "statsScreen") renderStats();
}

function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
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

function parseLocalDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
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
