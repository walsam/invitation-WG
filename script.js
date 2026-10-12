const EVENT_START = new Date("2026-10-24T18:00:00+00:00"); // 18:00 in Morocco, which is on GMT (+00:00)

// Outer silhouette of door-frame.webp, in % of the door canvas (same polygon as .door__opening).
const DOOR_SILHOUETTE = [
  [2.97, 28.07], [3.26, 25.10], [4.12, 22.17], [5.56, 19.30], [7.54, 16.53], [10.05, 13.90], [13.06, 11.42], [16.53, 9.14],
  [20.43, 7.07], [24.71, 5.24], [29.32, 3.66], [34.21, 2.37], [39.33, 1.37], [44.61, 0.67], [50.00, 0.28], [55.39, 0.67],
  [60.67, 1.37], [65.79, 2.37], [70.68, 3.66], [75.29, 5.24], [79.57, 7.07], [83.47, 9.14], [86.94, 11.42], [89.95, 13.90],
  [92.46, 16.53], [94.44, 19.30], [95.88, 22.17], [96.74, 25.10], [97.03, 28.07], [97.03, 97.19], [99.63, 97.19], [99.63, 99.77],
  [0.37, 99.77], [0.37, 97.19], [2.97, 97.19],
];

const body = document.body;
const wall = document.querySelector("#wall");
const door = document.querySelector("#door");
const card = document.querySelector("#card");
const replayButton = document.querySelector("#replay");
const soundButton = document.querySelector("#sound");
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const TIMING = reducedMotion
  ? { knock: 0, open: 60, rise: 60, monogram: 1, step: 1, word: 1, wipe: 1 }
  : { knock: 900, open: 3300, rise: 700, monogram: 2000, step: 300, word: 70, wipe: 900 };

let timers = [];
const later = (fn, ms) => timers.push(setTimeout(fn, ms));

/* iOS before 15.4 has no svh: use the visible window height instead. */
if (!CSS.supports("height", "100svh")) {
  const setSvh = () => document.documentElement.style.setProperty("--svh", `${innerHeight / 100}px`);
  setSvh();
  addEventListener("resize", setSvh);
}

/* The wall gets a hole the shape of the door frame, so the stage shows through the open doorway. */
function cutDoorwayInWall() {
  const w = wall.clientWidth;
  const h = wall.clientHeight;
  const dw = door.offsetWidth;
  const dh = door.offsetHeight;
  if (!h || !dh) return; // no layout yet: WebKit can run this before styles.css applies
  const left = (w - dw) / 2;
  const top = (h - dh) / 2;
  const hole = DOOR_SILHOUETTE.map(([x, y], i) => `${i ? "L" : "M"}${(left + (x / 100) * dw).toFixed(1)} ${(top + (y / 100) * dh).toFixed(1)}`).join("");
  wall.style.clipPath = `path(evenodd, "M0 0H${w}V${h}H0Z${hole}Z")`;
}
cutDoorwayInWall();
if ("ResizeObserver" in window) {
  const doorwayObserver = new ResizeObserver(cutDoorwayInWall);
  doorwayObserver.observe(wall);
  doorwayObserver.observe(door);
} else {
  addEventListener("load", cutDoorwayInWall);
  addEventListener("resize", cutDoorwayInWall);
}

/* ───────────── Door ───────────── */
function openDoor() {
  if (body.classList.contains("is-knocking")) return;
  body.classList.remove("no-motion");
  body.classList.add("is-knocking");
  door.setAttribute("aria-expanded", "true");
  if (!reducedMotion && navigator.vibrate) navigator.vibrate([28, 420, 28]);
  InviteAudio.unlock();
  InviteAudio.play("knock");
  InviteAudio.prefetchMusic();
  later(() => InviteAudio.play("creak", 0.5), TIMING.knock); // full voice just as the leaves start to swing
  later(() => InviteAudio.startMusic(), TIMING.knock + TIMING.open - 900);
  later(() => body.classList.add("is-opening"), TIMING.knock);
  later(() => {
    body.classList.add("is-open");
    card.inert = false;
    card.focus({ preventScroll: true });
  }, TIMING.knock + TIMING.open);
  later(writeInvitation, TIMING.knock + TIMING.open + TIMING.rise);
}

function closeDoor() {
  timers.forEach(clearTimeout);
  timers = [];
  body.classList.remove("no-motion", "is-knocking", "is-opening", "is-open", "is-writing", "is-written");
  InviteAudio.stopMusic();
  card.inert = true;
  door.setAttribute("aria-expanded", "false");
  later(resetWriting, 1200);
  door.focus({ preventScroll: true });
}

door.addEventListener("click", openDoor);
door.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openDoor();
  }
});
replayButton.addEventListener("click", closeDoor);

/* Sound on/off, remembered on this phone. */
function showSoundState() {
  soundButton.setAttribute("aria-pressed", String(InviteAudio.muted));
  soundButton.setAttribute("aria-label", InviteAudio.muted ? "تشغيل الصوت" : "إيقاف الصوت");
  soundButton.title = soundButton.getAttribute("aria-label");
}
soundButton.addEventListener("click", () => {
  InviteAudio.unlock();
  InviteAudio.setMuted(!InviteAudio.muted);
  showSoundState();
  if (!InviteAudio.muted && body.classList.contains("is-opening")) InviteAudio.startMusic();
});
showSoundState();

/* ───────────── Writing, from top to bottom ───────────── */
const revealItems = [...card.querySelectorAll(".card__content > [data-reveal]")];
const bismillah = card.querySelector(".card__content > .bismillah");
const verse = card.querySelector(".card__content > .verse");

/* The bismillah and the verse first write themselves large in the middle of the card,
   then glide up into their place at their small size, and only then is the rest written. */
const intro = document.createElement("div");
const introBlock = document.createElement("div");
intro.className = "verse-intro";
intro.setAttribute("aria-hidden", "true");
introBlock.className = "verse-intro__block";
introBlock.append(bismillah.cloneNode(true), verse.cloneNode(true));
intro.append(introBlock);
card.querySelector(".card__content").append(intro);

function playVerseIntro() {
  const introBismillah = introBlock.querySelector(".bismillah");
  const introWords = [...introBlock.querySelectorAll(".w")];
  const wordsStart = 300 + TIMING.wipe;
  const settle = wordsStart + introWords.length * TIMING.word + 1500; // read time before it moves
  intro.classList.add("is-on");
  introBismillah.style.transitionDelay = "300ms";
  introWords.forEach((word, i) => { word.style.transitionDelay = `${wordsStart + i * TIMING.word}ms`; });
  requestAnimationFrame(() => {
    introBismillah.classList.add("is-shown");
    introWords.forEach((word) => word.classList.add("is-shown"));
  });
  later(() => {
    const first = introBlock.getBoundingClientRect();
    const top = bismillah.getBoundingClientRect();
    const bottom = verse.getBoundingClientRect();
    const last = { left: Math.min(top.left, bottom.left), right: Math.max(top.right, bottom.right), top: top.top, bottom: bottom.bottom };
    const scale = (last.bottom - last.top) / first.height;
    const dx = (last.left + last.right - first.left - first.right) / 2;
    const dy = (last.top + last.bottom - first.top - first.bottom) / 2;
    introBlock.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) scale(${scale.toFixed(3)})`;
    intro.classList.add("is-leaving");
  }, settle);
  return { handoff: settle + 1000, next: settle + 1700 };
}

async function writeInvitation() {
  try {
    await Promise.race([
      document.fonts.load('400 20px "Scheherazade New"'),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch { /* fall back to whatever font is available */ }
  if (!body.classList.contains("is-open") || body.classList.contains("is-written")) return;
  body.classList.add("is-writing");

  let t = 0;
  let handoff = null;
  if (!reducedMotion) {
    const intro = playVerseIntro();
    handoff = intro.handoff;
    t = intro.next;
  }
  for (const item of revealItems) {
    const kind = item.dataset.reveal;
    if (handoff !== null && (item === bismillah || item === verse)) {
      // Already written in the middle: the small copies simply fade in as the large ones arrive.
      item.classList.add("is-handoff");
      item.style.setProperty("--handoff-delay", `${handoff}ms`);
      getComputedStyle(item).opacity; // commit the hidden state so the later fade-in really transitions
      const targets = item === verse ? [...item.querySelectorAll(".w")] : [item];
      if (item === verse) targets.forEach((el) => { el.style.transitionDelay = `${handoff}ms`; });
      requestAnimationFrame(() => targets.forEach((el) => el.classList.add("is-shown")));
      continue;
    }
    if (kind === "pen") {
      t = writeMonogram(item, t);
    } else if (kind === "words") {
      const words = [...item.querySelectorAll(".w")];
      words.forEach((word, i) => {
        word.style.transitionDelay = `${t + i * TIMING.word}ms`;
      });
      requestAnimationFrame(() => words.forEach((word) => word.classList.add("is-shown")));
      t += words.length * TIMING.word + 250;
    } else {
      item.style.transitionDelay = `${t}ms`;
      requestAnimationFrame(() => item.classList.add("is-shown"));
      t += kind === "wipe" ? TIMING.wipe : TIMING.step;
    }
  }
  later(() => body.classList.add("is-written"), t + 600);
}

function writeMonogram(svg, start) {
  const pens = [...svg.querySelectorAll(".pen")].sort((a, b) => a.dataset.order - b.dataset.order);
  const total = pens.reduce((sum, pen) => sum + Number(pen.dataset.len), 0);
  let t = start;
  svg.classList.add("is-shown");
  for (const pen of pens) {
    const length = Number(pen.dataset.len);
    const duration = Math.max(180, (length / total) * TIMING.monogram);
    pen.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(.45, .05, .55, .95) ${t}ms`;
    later(() => { pen.style.visibility = "visible"; }, t);
    requestAnimationFrame(() => { pen.style.strokeDashoffset = "0"; });
    t += length < 100 ? duration : duration * 0.92; // short ticks never start before the stroke they finish
  }
  return t + 200;
}

/* A tap on the card while it is writing shows everything at once. */
function finishWriting() {
  if (!body.classList.contains("is-open") || body.classList.contains("is-written")) return;
  timers.forEach(clearTimeout);
  timers = [];
  body.classList.add("is-writing", "is-written");
  card.querySelectorAll(".pen").forEach((pen) => { pen.style.visibility = "visible"; pen.style.strokeDashoffset = "0"; });
  card.querySelectorAll("[data-reveal], .w").forEach((el) => el.classList.add("is-shown"));
  intro.classList.remove("is-on", "is-leaving");
  // Transitions still waiting out their delay ignore new delay/duration values, so jump them to the end.
  if (card.getAnimations) card.getAnimations({ subtree: true }).forEach((animation) => { try { animation.finish(); } catch { /* infinite animations cannot finish */ } });
}
card.addEventListener("click", (event) => {
  if (!event.target.closest("a, button")) finishWriting();
});

function resetWriting() {
  card.querySelectorAll(".is-shown, .is-handoff").forEach((el) => el.classList.remove("is-shown", "is-handoff"));
  intro.classList.remove("is-on", "is-leaving");
  introBlock.style.transform = "";
  card.querySelectorAll("[style*='--handoff-delay']").forEach((el) => el.style.removeProperty("--handoff-delay"));
  card.querySelectorAll("[data-reveal], .w").forEach((el) => { el.style.transitionDelay = ""; });
  card.querySelectorAll(".pen").forEach((pen) => {
    pen.style.transition = "none";
    pen.style.strokeDashoffset = "";
    pen.style.visibility = "";
  });
}

/* Testing aids: ?open plays the opening on load, ?final shows the finished invitation at once. */
const params = new URLSearchParams(location.search);
if (params.has("final")) {
  body.classList.add("no-motion", "is-knocking", "is-opening", "is-open", "is-writing", "is-written");
  card.inert = false;
  card.querySelectorAll(".pen").forEach((pen) => { pen.style.visibility = "visible"; pen.style.strokeDashoffset = "0"; });
  card.querySelectorAll("[data-reveal], .w").forEach((el) => el.classList.add("is-shown"));
} else if (params.has("open")) {
  addEventListener("load", () => setTimeout(openDoor, 400));
}

/* ───────────── Countdown ───────────── */
const pad = (value) => String(value).padStart(2, "0");

function updateCountdown() {
  const remaining = EVENT_START.getTime() - Date.now();
  if (remaining <= 0) {
    document.querySelector("#countdown").innerHTML = '<p class="event-day">اليوم يومنا، ننتظركم بكل حب</p>';
    return false;
  }
  document.querySelector("#days").textContent = pad(Math.floor(remaining / 86_400_000));
  document.querySelector("#hours").textContent = pad(Math.floor(remaining / 3_600_000) % 24);
  document.querySelector("#minutes").textContent = pad(Math.floor(remaining / 60_000) % 60);
  document.querySelector("#seconds").textContent = pad(Math.floor(remaining / 1_000) % 60);
  return true;
}
if (updateCountdown()) {
  const interval = setInterval(() => {
    if (!updateCountdown()) clearInterval(interval);
  }, 1000);
}
