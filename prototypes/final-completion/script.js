/* ==========================================================================
   FINALE TIMING CONFIGURATION
   All choreography values and easing curves live here. Values are milliseconds.
   Adjust this object to tune pacing without restructuring the sequence.
   ========================================================================== */
const TIMING = {
  total: 10920,

  background: {
    freezeStart: 0,
    freezeDuration: 520,
    blur: 10,
    brightness: 0.83,
    paperOverlayOpacity: 0.92,
    restoreStart: 9820,
    restoreDuration: 700
  },
  initialModal: {
    fadeStart: 0,
    fadeDuration: 780
  },

  confetti: {
    burstStart: 0,
    burstCount: 58,
    burstDurationMin: 2300,
    burstDurationMax: 3100,
    driftStartMin: 1450,
    driftStartMax: 3200,
    driftCount: 30,
    driftDurationMin: 6100,
    driftDurationMax: 6900,
    goldRatio: 0.18
  },

  boardReveal: {
    start: 430,
    duration: 720,
    completedBoardHold: 510,
    easing: "cubic-bezier(.18,.82,.28,1)"
  },
  sweep: {
    start: 1660,
    duration: 1500,
    sparkleDuration: 390,
    easing: "cubic-bezier(.32,.02,.25,1)"
  },

  photoWave: {
    start: 3360,
    pauseAfterSweep: 200,
    flipDuration: 560,
    overlapAtStart: 488,
    baseStagger: 72,
    // The last seven gaps expand so the collage finishes intentionally.
    intervals: [
      72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72,
      88, 88, 88, 88, 88,
      110, 135, 165, 200, 240, 285, 330
    ],
    easing: "cubic-bezier(.38,.01,.17,1)"
  },

  collagePause: {
    duration: 631
  },
  message: {
    start: 7320,
    duration: 520,
    easing: "cubic-bezier(.18,.8,.25,1)",
    defaultOption: "D",
    options: {
      A: "Your summer, beautifully lived.",
      B: "Summer was better together.",
      C: "One summer. Twenty-five memories.",
      D: "Here's to a summer well spent."
    }
  },
  ranks: {
    start: 7940,
    earlyDuration: 190,
    earlyOverlap: 28,
    finalDuration: 1120,
    easing: "cubic-bezier(.2,.75,.22,1)"
  },
  finaleHold: {
    end: 9820
  },
  exit: {
    start: 9820,
    duration: 700,
    easing: "ease-in-out"
  },
  summary: {
    start: 10070,
    duration: 850,
    easing: "cubic-bezier(.18,.84,.26,1)"
  },

  inspectionMoments: {
    sweep: 0.22,
    photoWave: 0.39,
    finalFlips: 0.58,
    message: 0.67,
    ranks: 0.76,
    summary: 0.95
  }
};

/* Simulated upload/completion order. Board positions are zero-based and form
   a diagonal wave instead of following numerical quest order. */
const COMPLETION_ORDER = [
  0, 5, 1, 10, 6, 2, 15, 11, 7, 3,
  20, 16, 12, 8, 4, 21, 17, 13, 9, 22,
  18, 14, 23, 19, 24
];

const QUESTS = [
  ["NY Eats", "ny-eats.png", "experience"],
  ["Bodega Cat", "bodega-cat.png", "community"],
  ["Subway Romance", "subway-romance.png", "challenges"],
  ["Water Wonders", "waterfront-wonders.png", "experience"],
  ["City Freebies", "city-freebies.png", "community"],
  ["Animal Statue", "animal-statue.png", "challenges"],
  ["Time Capsule", "time-capsule.png", "experience"],
  ["Park Picnic", "park-picnic.png", "community"],
  ["Pup-arazzi", "pup-arazzi.png", "challenges"],
  ["Hidden Gems", "hidden-gems.png", "experience"],
  ["Showtime!", "showtime.png", "community"],
  ["Get Sweaty", "get-sweaty.png", "challenges"],
  ["Golden Hour", "golden-hour.png", "experience"],
  ["Art Walk", "favorite-art.png", "community"],
  ["Street Style", "street-fashion.png", "challenges"],
  ["Street Mural", "street-mural.png", "experience"],
  ["Random Kindness", "random-kindness.png", "community"],
  ["DIY Craft", "diy-craft.png", "challenges"],
  ["Open Market", "open-market.png", "experience"],
  ["Live Events", "live-events.png", "community"],
  ["Off the Map", "off-the-map.png", "challenges"],
  ["Cinema Moment", "cinema-moment.png", "experience"],
  ["NYC Spirit", "nyc-spirit.png", "community"],
  ["Human Pyramid", "human-pyramid.png", "challenges"],
  ["Party Time", "celebrate-together.png", "final"]
];

const TILE_STYLES = {
  experience: { color: "#F6B900", text: "#272522" },
  community: { color: "#1BA9B9", text: "#FFFaf2" },
  challenges: { color: "#F35F59", text: "#FFFaf2" },
  final: { color: "#E8D2A2", text: "#5F481D" }
};

const RANKS = [
  "Summer Rookie",
  "Neighborhood Explorer",
  "City Adventurer",
  "NYC Insider",
  "Summer Legend"
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function formatTime(milliseconds) {
  const seconds = milliseconds / 1000;
  return `0:${seconds.toFixed(1).padStart(4, "0")}`;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function buildBoards() {
  const backgroundBoard = $("#background-board");
  const finaleBoard = $("#finale-board");

  QUESTS.forEach(([title, icon, category], index) => {
    const style = TILE_STYLES[category];
    const iconPath = `./assets/production-icons/${icon}`;
    const row = Math.floor(index / 5);
    const column = index % 5;

    const backgroundTile = document.createElement("div");
    backgroundTile.className = "background-quest-card";
    backgroundTile.style.setProperty("--tile-color", style.color);
    backgroundTile.style.setProperty("--tile-text", style.text);
    backgroundTile.innerHTML = `
      <img src="${iconPath}" alt="" />
      <span>${title}</span>
    `;
    backgroundBoard.appendChild(backgroundTile);

    const tile = document.createElement("div");
    tile.className = "finale-tile";
    tile.dataset.index = index;
    tile.style.setProperty("--tile-color", style.color);
    tile.style.setProperty("--tile-text", style.text);
    tile.innerHTML = `
      <div class="tile-card">
        <div class="tile-face tile-front${category === "final" ? " final-tile" : ""}">
          <div class="tile-front-content">
            <img src="${iconPath}" alt="" />
          </div>
        </div>
        <div
          class="tile-face tile-photo"
          role="img"
          aria-label="Placeholder summer photo ${index + 1}"
          style="--photo-x:${column * 25}%; --photo-y:${row * 25}%"
        ></div>
      </div>
    `;
    finaleBoard.appendChild(tile);
  });

  const sweep = document.createElement("div");
  sweep.id = "light-sweep";
  sweep.className = "light-sweep";
  sweep.setAttribute("aria-hidden", "true");
  finaleBoard.appendChild(sweep);

  const sparkleLayer = document.createElement("div");
  sparkleLayer.id = "sparkle-layer";
  sparkleLayer.className = "sparkle-layer";
  sparkleLayer.setAttribute("aria-hidden", "true");
  finaleBoard.appendChild(sparkleLayer);
}

function buildSparkles() {
  const positions = [
    [12, 16], [31, 29], [50, 15], [67, 35], [83, 21],
    [21, 63], [43, 72], [64, 59], [82, 78]
  ];
  const layer = $("#sparkle-layer");
  positions.forEach(([x, y]) => {
    const sparkle = document.createElement("span");
    sparkle.className = "sparkle";
    sparkle.style.left = `${x}%`;
    sparkle.style.top = `${y}%`;
    layer.appendChild(sparkle);
  });
}

function buildRanks() {
  const container = $("#rank-review");
  RANKS.forEach((name, index) => {
    const rank = document.createElement("div");
    rank.className = `rank${index === RANKS.length - 1 ? " final" : ""}`;
    rank.innerHTML = `
      <span>${name}</span>
      ${index === RANKS.length - 1 ? '<span class="rank-shine" aria-hidden="true"></span>' : ""}
    `;
    container.appendChild(rank);
  });
}

function setMessageOption(optionKey) {
  const options = TIMING.message.options;
  const keys = Object.keys(options);
  const nextKey = keys.includes(optionKey) ? optionKey : TIMING.message.defaultOption;
  $("#finale-message").textContent = options[nextKey];
  $("#message-select").value = nextKey;
  $("#message-select").dataset.activeOption = nextKey;
}

function buildMessagePicker() {
  const select = $("#message-select");
  Object.entries(TIMING.message.options).forEach(([key, message]) => {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = `${key} · ${message}`;
    select.appendChild(option);
  });
  setMessageOption(TIMING.message.defaultOption);
}

function cycleMessageOption() {
  const keys = Object.keys(TIMING.message.options);
  const current = $("#message-select").dataset.activeOption;
  const nextIndex = (keys.indexOf(current) + 1) % keys.length;
  setMessageOption(keys[nextIndex]);
}

function confettiColor(random) {
  const value = random();
  if (value < TIMING.confetti.goldRatio) return "#C69A3A";
  if (value < 0.38) return "#FFF4D2";
  if (value < 0.68) return "#1BA9B9";
  return "#F35F59";
}

function buildConfetti() {
  const layer = $("#confetti-layer");
  const random = seededRandom(2026);
  const total = TIMING.confetti.burstCount + TIMING.confetti.driftCount;

  for (let index = 0; index < total; index += 1) {
    const isBurst = index < TIMING.confetti.burstCount;
    const piece = document.createElement("span");
    piece.className = `confetti ${isBurst ? "burst" : "drift"}`;
    piece.dataset.kind = isBurst ? "burst" : "drift";
    piece.dataset.x = ((random() - 0.5) * 110).toFixed(2);
    piece.dataset.y = (-18 - random() * 46).toFixed(2);
    piece.dataset.drift = ((random() - 0.5) * 30).toFixed(2);
    piece.dataset.spin = Math.round(420 + random() * 920);
    piece.dataset.delay = isBurst
      ? Math.round(random() * 120)
      : Math.round(
          TIMING.confetti.driftStartMin +
          random() * (TIMING.confetti.driftStartMax - TIMING.confetti.driftStartMin)
        );
    piece.dataset.duration = Math.round(
      isBurst
        ? TIMING.confetti.burstDurationMin +
            random() * (TIMING.confetti.burstDurationMax - TIMING.confetti.burstDurationMin)
        : TIMING.confetti.driftDurationMin +
            random() * (TIMING.confetti.driftDurationMax - TIMING.confetti.driftDurationMin)
    );
    piece.style.setProperty("--confetti-left", `${random() * 100}%`);
    piece.style.setProperty("--confetti-w", `${4 + random() * 5}px`);
    piece.style.setProperty("--confetti-h", `${8 + random() * 8}px`);
    piece.style.setProperty("--confetti-radius", random() > 0.58 ? "50%" : "2px");
    piece.style.setProperty("--confetti-color", confettiColor(random));
    layer.appendChild(piece);
  }
}

class MasterTimeline {
  constructor(duration) {
    this.duration = duration;
    this.currentTime = 0;
    this.playbackRate = 1;
    this.playing = true;
    this.animations = [];
    this.raf = null;
    this.lastFrame = null;
    this.onUpdate = () => {};
  }

  add(element, keyframes, options, start = 0) {
    const animation = element.animate(keyframes, {
      ...options,
      fill: options.fill || "both"
    });
    animation.pause();
    this.animations.push({
      animation,
      start,
      duration: Number(options.duration)
    });
    return animation;
  }

  clear() {
    this.animations.forEach(({ animation }) => animation.cancel());
    this.animations = [];
  }

  seek(time) {
    this.currentTime = clamp(time, 0, this.duration);
    this.render();
  }

  play() {
    if (this.currentTime >= this.duration) this.currentTime = 0;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.playing = true;
    this.lastFrame = performance.now();
    this.tick();
  }

  pause() {
    this.playing = false;
    this.lastFrame = null;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    this.render();
  }

  setPlaybackRate(rate) {
    this.playbackRate = rate;
  }

  tick = (now = performance.now()) => {
    if (!this.playing) return;
    if (this.lastFrame === null) this.lastFrame = now;
    const elapsed = now - this.lastFrame;
    this.lastFrame = now;
    this.currentTime = clamp(this.currentTime + elapsed * this.playbackRate, 0, this.duration);
    this.render();

    if (this.currentTime >= this.duration) {
      this.playing = false;
      this.lastFrame = null;
      this.raf = null;
      this.onUpdate();
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  render() {
    this.animations.forEach(({ animation, start, duration }) => {
      animation.currentTime = clamp(this.currentTime - start, 0, duration);
    });
    this.onUpdate();
  }
}

const timeline = new MasterTimeline(TIMING.total);
let reducedMotion = false;

function flipStartTimes() {
  const starts = [];
  let cursor = TIMING.photoWave.start;
  COMPLETION_ORDER.forEach((_, orderIndex) => {
    starts.push(cursor);
    if (orderIndex < TIMING.photoWave.intervals.length) {
      cursor += TIMING.photoWave.intervals[orderIndex];
    }
  });
  return starts;
}

function createAnimations() {
  const current = timeline.currentTime;
  timeline.clear();

  const restoreEnd = TIMING.background.restoreStart + TIMING.background.restoreDuration;
  timeline.add(
    $("#app-underlay"),
    [
      {
        filter: "blur(0px) brightness(1)",
        transform: "scale(1)",
        offset: 0,
        easing: "ease-out"
      },
      {
        filter: `blur(${TIMING.background.blur}px) brightness(${TIMING.background.brightness})`,
        transform: "scale(1.018)",
        offset: TIMING.background.freezeDuration / restoreEnd
      },
      {
        filter: `blur(${TIMING.background.blur}px) brightness(${TIMING.background.brightness})`,
        transform: "scale(1.018)",
        offset: TIMING.background.restoreStart / restoreEnd,
        easing: "ease-in-out"
      },
      { filter: "blur(0px) brightness(1)", transform: "scale(1)", offset: 1 }
    ],
    { duration: restoreEnd, easing: "linear" },
    0
  );

  timeline.add(
    $("#initial-modal-layer"),
    reducedMotion
      ? [{ opacity: 1 }, { opacity: 0 }]
      : [
          { opacity: 1, filter: "blur(0px) brightness(1)" },
          {
            opacity: 0,
            filter: `blur(${TIMING.background.blur}px) brightness(${TIMING.background.brightness})`
          }
        ],
    { duration: TIMING.initialModal.fadeDuration, easing: "ease-out" },
    TIMING.initialModal.fadeStart
  );

  const boardFrames = reducedMotion
    ? [{ opacity: 0 }, { opacity: 1 }]
    : [
        { opacity: 0, transform: "translateY(16px) scale(.965)" },
        { opacity: 1, transform: "translateY(0) scale(1.01)", offset: 0.78 },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ];
  timeline.add(
    $("#finale-board"),
    boardFrames,
    { duration: TIMING.boardReveal.duration, easing: TIMING.boardReveal.easing },
    TIMING.boardReveal.start
  );

  timeline.add(
    $("#light-sweep"),
    reducedMotion
      ? [
          { opacity: 0, transform: "translateX(-60%) rotate(17deg)" },
          { opacity: 0.22, transform: "translateX(420%) rotate(17deg)", offset: 0.55 },
          { opacity: 0, transform: "translateX(740%) rotate(17deg)" }
        ]
      : [
          { opacity: 0, transform: "translateX(-60%) rotate(17deg)" },
          { opacity: 0.88, transform: "translateX(275%) rotate(17deg)", offset: 0.42 },
          { opacity: 0.76, transform: "translateX(520%) rotate(17deg)", offset: 0.72 },
          { opacity: 0, transform: "translateX(770%) rotate(17deg)" }
        ],
    { duration: TIMING.sweep.duration, easing: TIMING.sweep.easing },
    TIMING.sweep.start
  );

  $$(".sparkle").forEach((sparkle, index) => {
    const stagger = (index % 5) * 115 + Math.floor(index / 5) * 86;
    timeline.add(
      sparkle,
      reducedMotion
        ? [{ opacity: 0 }, { opacity: 0.26 }, { opacity: 0 }]
        : [
            { opacity: 0, transform: "rotate(45deg) scale(.1)" },
            { opacity: 0.82, transform: "rotate(70deg) scale(1)", offset: 0.42 },
            { opacity: 0, transform: "rotate(95deg) scale(.25)" }
          ],
      { duration: TIMING.sweep.sparkleDuration, easing: "ease-out" },
      TIMING.sweep.start + 190 + stagger
    );
  });

  $$(".confetti").forEach((piece) => {
    const isBurst = piece.dataset.kind === "burst";
    const x = Number(piece.dataset.x);
    const y = Number(piece.dataset.y);
    const drift = Number(piece.dataset.drift);
    const spin = Number(piece.dataset.spin);
    const delay = Number(piece.dataset.delay);
    const duration = Number(piece.dataset.duration);

    const keyframes = reducedMotion
      ? [
          { opacity: 0, transform: "translate3d(0,0,0)" },
          { opacity: 0.32, transform: `translate3d(${drift * 0.1}vw,12vh,0)`, offset: 0.25 },
          { opacity: 0, transform: `translate3d(${drift * 0.2}vw,24vh,0)` }
        ]
      : isBurst
        ? [
            { opacity: 0, transform: "translate3d(0,0,0) rotate(0deg)" },
            {
              opacity: 0.96,
              transform: `translate3d(${x * 0.75}vw,${y}vh,0) rotate(${spin * 0.35}deg)`,
              offset: 0.18
            },
            {
              opacity: 0.84,
              transform: `translate3d(${x}vw,18vh,0) rotate(${spin * 0.72}deg)`,
              offset: 0.62
            },
            {
              opacity: 0,
              transform: `translate3d(${x + drift}vw,78vh,0) rotate(${spin}deg)`
            }
          ]
        : [
            { opacity: 0, transform: "translate3d(0,-8vh,0) rotate(0deg)" },
            {
              opacity: 0.56,
              transform: `translate3d(${drift * 0.28}vw,18vh,0) rotate(${spin * 0.25}deg)`,
              offset: 0.14
            },
            {
              opacity: 0.45,
              transform: `translate3d(${drift * 0.72}vw,82vh,0) rotate(${spin * 0.78}deg)`,
              offset: 0.78
            },
            {
              opacity: 0,
              transform: `translate3d(${drift}vw,118vh,0) rotate(${spin}deg)`
            }
          ];

    const animationStart = isBurst
      ? TIMING.confetti.burstStart + delay
      : delay;

    timeline.add(
      piece,
      keyframes,
      { duration, easing: isBurst ? "cubic-bezier(.16,.58,.42,1)" : "linear" },
      animationStart
    );
  });

  const starts = flipStartTimes();
  COMPLETION_ORDER.forEach((tileIndex, orderIndex) => {
    const card = $(`.finale-tile[data-index="${tileIndex}"] .tile-card`);
    timeline.add(
      card,
      reducedMotion
        ? [
            { transform: "rotateY(0deg) scale(1)" },
            { transform: "rotateY(180deg) scale(1)" }
          ]
        : [
            { transform: "rotateY(0deg) scale(1)" },
            { transform: "rotateY(92deg) scale(.965)", offset: 0.47 },
            { transform: "rotateY(180deg) scale(1.02)", offset: 0.82 },
            { transform: "rotateY(180deg) scale(1)" }
          ],
      {
        duration: reducedMotion ? 170 : TIMING.photoWave.flipDuration,
        easing: reducedMotion ? "linear" : TIMING.photoWave.easing
      },
      starts[orderIndex]
    );
  });

  timeline.add(
    $("#finale-message"),
    reducedMotion
      ? [{ opacity: 0 }, { opacity: 1 }]
      : [
          { opacity: 0, transform: "translateY(8px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
    { duration: TIMING.message.duration, easing: TIMING.message.easing },
    TIMING.message.start
  );

  const rankElements = $$(".rank");
  rankElements.forEach((rank, index) => {
    const isFinal = index === rankElements.length - 1;
    const start = TIMING.ranks.start + index * TIMING.ranks.earlyDuration;
    const duration = isFinal
      ? TIMING.ranks.finalDuration
      : TIMING.ranks.earlyDuration + TIMING.ranks.earlyOverlap;

    timeline.add(
      rank,
      isFinal
        ? reducedMotion
          ? [{ opacity: 0 }, { opacity: 1, offset: 0.18 }, { opacity: 1 }]
          : [
              { opacity: 0, transform: "translateY(6px) scale(.94)" },
              { opacity: 1, transform: "translateY(-1px) scale(1.045)", offset: 0.2 },
              { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.37 },
              { opacity: 1, transform: "translateY(0) scale(1)" }
            ]
        : [
            { opacity: 0, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)", offset: 0.16 },
            { opacity: 1, transform: "translateY(0)", offset: 0.7 },
            { opacity: 0, transform: "translateY(-4px)" }
          ],
      { duration, easing: TIMING.ranks.easing },
      start
    );
  });

  const finalStart = TIMING.ranks.start + (RANKS.length - 1) * TIMING.ranks.earlyDuration;
  timeline.add(
    $(".rank-shine"),
    [
      { opacity: 0, transform: "translateX(-90%)" },
      { opacity: reducedMotion ? 0.18 : 0.82, offset: 0.2 },
      { opacity: reducedMotion ? 0.12 : 0.62, transform: "translateX(90%)", offset: 0.82 },
      { opacity: 0, transform: "translateX(110%)" }
    ],
    { duration: 760, easing: "cubic-bezier(.2,.7,.2,1)" },
    finalStart + 170
  );

  const exitEnd = TIMING.exit.start + TIMING.exit.duration;
  timeline.add(
    $("#celebration-stage"),
    [
      { opacity: 1, offset: 0 },
      { opacity: 1, offset: TIMING.exit.start / exitEnd, easing: TIMING.exit.easing },
      { opacity: 0, offset: 1 }
    ],
    { duration: exitEnd, easing: "linear" },
    0
  );

  timeline.add(
    $("#summary-layer"),
    [
      { opacity: 0, visibility: "hidden", offset: 0 },
      { opacity: 0, visibility: "visible", offset: 0.001 },
      { opacity: 1, visibility: "visible" }
    ],
    { duration: TIMING.summary.duration, easing: TIMING.summary.easing },
    TIMING.summary.start
  );

  timeline.add(
    $(".production-summary-sheet"),
    reducedMotion
      ? [
          { transform: "translateY(0)" },
          { transform: "translateY(0)" }
        ]
      : [
          { transform: "translateY(18px)" },
          { transform: "translateY(0)" }
        ],
    { duration: TIMING.summary.duration, easing: TIMING.summary.easing },
    TIMING.summary.start
  );

  timeline.seek(current);
}

function wireControls() {
  const slider = $("#timeline-slider");
  const pauseLabel = $("#pause-label");
  const pauseIcon = $("#pause-icon");

  $("#total-time").textContent = formatTime(TIMING.total);

  timeline.onUpdate = () => {
    const ratio = timeline.currentTime / timeline.duration;
    slider.value = (ratio * 100).toFixed(1);
    slider.style.setProperty("--timeline-progress", `${ratio * 100}%`);
    slider.setAttribute(
      "aria-valuetext",
      `${Math.round(ratio * 100)}% — ${formatTime(timeline.currentTime)}`
    );
    $("#current-time").textContent = formatTime(timeline.currentTime);
    pauseLabel.textContent = timeline.playing ? "Pause" : "Resume";
    pauseIcon.textContent = timeline.playing ? "Ⅱ" : "▶";
  };

  $("#replay-button").addEventListener("click", () => {
    timeline.seek(0);
    timeline.play();
  });

  $("#pause-button").addEventListener("click", () => {
    if (timeline.playing) timeline.pause();
    else timeline.play();
  });

  slider.addEventListener("input", (event) => {
    timeline.seek((Number(event.target.value) / 100) * timeline.duration);
  });

  $$("[data-speed]").forEach((button) => {
    button.addEventListener("click", () => {
      timeline.setPlaybackRate(Number(button.dataset.speed));
      $$("[data-speed]").forEach((candidate) => {
        candidate.classList.toggle("active", candidate === button);
      });
    });
  });

  $$("[data-jump-key]").forEach((button) => {
    button.addEventListener("click", () => {
      timeline.seek(TIMING.inspectionMoments[button.dataset.jumpKey] * timeline.duration);
    });
  });

  $("#reduced-motion-toggle").addEventListener("change", (event) => {
    reducedMotion = event.target.checked;
    createAnimations();
  });

  $("#message-select").addEventListener("change", (event) => {
    setMessageOption(event.target.value);
  });

  document.addEventListener("keydown", (event) => {
    const isTypingTarget = ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName);
    if (event.code === "Space" && event.target.tagName !== "BUTTON" && !isTypingTarget) {
      event.preventDefault();
      if (timeline.playing) timeline.pause();
      else timeline.play();
    }
    if (!isTypingTarget && event.key === "ArrowLeft") {
      timeline.seek(timeline.currentTime - 250);
    }
    if (!isTypingTarget && event.key === "ArrowRight") {
      timeline.seek(timeline.currentTime + 250);
    }
    if (!isTypingTarget && event.key.toLowerCase() === "m") {
      cycleMessageOption();
    }
  });
}

function init() {
  buildBoards();
  buildSparkles();
  buildRanks();
  buildConfetti();
  buildMessagePicker();
  wireControls();

  reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  $("#reduced-motion-toggle").checked = reducedMotion;
  document.documentElement.style.setProperty(
    "--paper-overlay-opacity",
    TIMING.background.paperOverlayOpacity
  );
  createAnimations();
  timeline.seek(0);
  timeline.play();
}

init();
