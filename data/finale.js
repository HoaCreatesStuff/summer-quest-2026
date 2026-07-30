/**
 * Final Quest completion finale.
 *
 * Presentation only: app.js owns saving, scoring, rank calculation, and the
 * existing Final Summary modal. This module owns the temporary overlay,
 * coordinated timeline, media preparation, and cleanup.
 */
(() => {
  const FINALE_TIMING = Object.freeze({
    total: 10920,
    paperOpacity: 0.92,
    blur: 10,
    brightness: 0.83,
    boardReveal: Object.freeze({
      start: 430,
      duration: 720,
      easing: "cubic-bezier(.18,.82,.28,1)"
    }),
    sweep: Object.freeze({
      start: 1660,
      duration: 1500,
      pauseAfter: 200,
      sparkleDuration: 390,
      easing: "cubic-bezier(.32,.02,.25,1)"
    }),
    photoWave: Object.freeze({
      start: 3360,
      flipDuration: 560,
      intervals: Object.freeze([
        72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72, 72,
        88, 88, 88, 88, 88,
        110, 135, 165, 200, 240, 285, 330
      ]),
      easing: "cubic-bezier(.38,.01,.17,1)"
    }),
    message: Object.freeze({
      start: 7320,
      duration: 520,
      text: "Here’s to a summer well spent.",
      easing: "cubic-bezier(.18,.8,.25,1)"
    }),
    ranks: Object.freeze({
      start: 7940,
      step: 190,
      overlap: 28,
      easing: "cubic-bezier(.2,.75,.22,1)"
    }),
    exit: Object.freeze({
      start: 9820,
      duration: 700,
      easing: "ease-in-out"
    }),
    summary: Object.freeze({
      start: 10070,
      duration: 850,
      easing: "cubic-bezier(.18,.84,.26,1)"
    }),
    reduced: Object.freeze({
      total: 1450,
      photoStart: 230,
      photoDuration: 260,
      messageStart: 520,
      rankStart: 760,
      summaryStart: 900,
      exitStart: 980,
      exitDuration: 360
    }),
    confetti: Object.freeze({
      burstCount: 58,
      driftCount: 30,
      burstDurationMin: 2300,
      burstDurationMax: 3100,
      driftStartMin: 1450,
      driftStartMax: 3200,
      driftDurationMin: 6100,
      driftDurationMax: 6900,
      goldRatio: 0.18
    })
  });

  let activeRun = null;
  let lastCompletionKey = "";

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

  function seededRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (value * 1664525 + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function parsedCompletionTime(value) {
    const time = Date.parse(value || "");
    return Number.isFinite(time) ? time : null;
  }

  function completionOrder(entries) {
    return [...entries].sort((left, right) => {
      const leftTime = parsedCompletionTime(left.submission?.completedAt);
      const rightTime = parsedCompletionTime(right.submission?.completedAt);

      if (leftTime !== null && rightTime !== null && leftTime !== rightTime) {
        return leftTime - rightTime;
      }
      if (leftTime !== null && rightTime === null) return -1;
      if (leftTime === null && rightTime !== null) return 1;
      return left.boardIndex - right.boardIndex;
    });
  }

  function confettiColor(random) {
    const value = random();
    if (value < FINALE_TIMING.confetti.goldRatio) return "#c69a3a";
    if (value < 0.38) return "#fff4d2";
    if (value < 0.68) return "#1ba9b9";
    return "#f35f59";
  }

  function buildConfetti(layer, reducedMotion) {
    const random = seededRandom(2026);
    const burstCount = reducedMotion ? 8 : FINALE_TIMING.confetti.burstCount;
    const driftCount = reducedMotion ? 0 : FINALE_TIMING.confetti.driftCount;
    const pieces = [];

    for (let index = 0; index < burstCount + driftCount; index += 1) {
      const isBurst = index < burstCount;
      const piece = document.createElement("span");
      piece.className = `finale-confetti ${isBurst ? "is-burst" : "is-drift"}`;
      piece.dataset.kind = isBurst ? "burst" : "drift";
      piece.dataset.x = ((random() - 0.5) * 110).toFixed(2);
      piece.dataset.y = (-18 - random() * 46).toFixed(2);
      piece.dataset.drift = ((random() - 0.5) * 30).toFixed(2);
      piece.dataset.spin = Math.round(420 + random() * 920);
      piece.dataset.delay = isBurst
        ? Math.round(random() * 120)
        : Math.round(
            FINALE_TIMING.confetti.driftStartMin +
            random() * (
              FINALE_TIMING.confetti.driftStartMax -
              FINALE_TIMING.confetti.driftStartMin
            )
          );
      piece.dataset.duration = Math.round(
        isBurst
          ? FINALE_TIMING.confetti.burstDurationMin +
              random() * (
                FINALE_TIMING.confetti.burstDurationMax -
                FINALE_TIMING.confetti.burstDurationMin
              )
          : FINALE_TIMING.confetti.driftDurationMin +
              random() * (
                FINALE_TIMING.confetti.driftDurationMax -
                FINALE_TIMING.confetti.driftDurationMin
              )
      );
      piece.style.setProperty("--finale-confetti-left", `${random() * 100}%`);
      piece.style.setProperty("--finale-confetti-width", `${4 + random() * 5}px`);
      piece.style.setProperty("--finale-confetti-height", `${8 + random() * 8}px`);
      piece.style.setProperty(
        "--finale-confetti-radius",
        random() > 0.58 ? "50%" : "2px"
      );
      piece.style.setProperty("--finale-confetti-color", confettiColor(random));
      layer.appendChild(piece);
      pieces.push(piece);
    }

    return pieces;
  }

  function buildSparkles(layer) {
    const positions = [
      [12, 16], [31, 29], [50, 15], [67, 35], [83, 21],
      [21, 63], [43, 72], [64, 59], [82, 78]
    ];

    return positions.map(([x, y]) => {
      const sparkle = document.createElement("span");
      sparkle.className = "finale-sparkle";
      sparkle.style.left = `${x}%`;
      sparkle.style.top = `${y}%`;
      layer.appendChild(sparkle);
      return sparkle;
    });
  }

  function buildOverlay(entries, rankTitles, reducedMotion) {
    const overlay = document.createElement("div");
    overlay.className = `finale-overlay${reducedMotion ? " is-reduced-motion" : ""}`;
    overlay.dataset.finalQuestFinale = "";
    overlay.innerHTML = `
      <div class="finale-paper" aria-hidden="true"></div>
      <div class="finale-confetti-layer" aria-hidden="true"></div>
      <div class="finale-content" aria-hidden="true">
        <div class="finale-board"></div>
        <p class="finale-message">${FINALE_TIMING.message.text}</p>
        <div class="finale-ranks"></div>
      </div>
      <p class="sr-only" role="status" aria-live="assertive">Adventure complete</p>
    `;

    overlay.style.setProperty("--finale-paper-opacity", FINALE_TIMING.paperOpacity);
    overlay.style.setProperty("--finale-background-blur", `${FINALE_TIMING.blur}px`);
    overlay.style.setProperty(
      "--finale-background-brightness",
      FINALE_TIMING.brightness
    );

    const board = overlay.querySelector(".finale-board");
    const sortedByPosition = [...entries].sort(
      (left, right) => left.boardIndex - right.boardIndex
    );
    const tiles = new Map();

    sortedByPosition.forEach((entry) => {
      const tile = document.createElement("div");
      tile.className = "finale-tile";
      tile.dataset.finaleQuestId = entry.questId;
      tile.innerHTML = `
        <div class="finale-tile-card">
          <div class="finale-tile-face finale-tile-front finale-tile--${entry.boardColor}">
            <img src="${entry.illustration}" alt="" />
          </div>
          <div class="finale-tile-face finale-tile-back finale-tile--${entry.boardColor}">
            <img class="finale-tile-fallback" src="${entry.illustration}" alt="" />
            <img class="finale-tile-photo" alt="" hidden />
          </div>
        </div>
      `;
      board.appendChild(tile);
      tiles.set(entry.questId, {
        tile,
        card: tile.querySelector(".finale-tile-card"),
        photoFace: tile.querySelector(".finale-tile-back"),
        fallback: tile.querySelector(".finale-tile-fallback"),
        photo: tile.querySelector(".finale-tile-photo"),
        hasPhoto: false
      });
    });

    const sweep = document.createElement("div");
    sweep.className = "finale-light-sweep";
    sweep.setAttribute("aria-hidden", "true");
    board.appendChild(sweep);

    const sparkleLayer = document.createElement("div");
    sparkleLayer.className = "finale-sparkle-layer";
    sparkleLayer.setAttribute("aria-hidden", "true");
    board.appendChild(sparkleLayer);

    const ranks = overlay.querySelector(".finale-ranks");
    const rankElements = rankTitles.map((title, index) => {
      const rank = document.createElement("div");
      const isFinal = index === rankTitles.length - 1;
      rank.className = `finale-rank${isFinal ? " is-final" : ""}`;
      rank.innerHTML = `
        <span>${title}</span>
        ${isFinal ? '<span class="finale-rank-shine" aria-hidden="true"></span>' : ""}
      `;
      ranks.appendChild(rank);
      return rank;
    });

    return {
      overlay,
      board,
      confettiLayer: overlay.querySelector(".finale-confetti-layer"),
      message: overlay.querySelector(".finale-message"),
      rankElements,
      sparkleLayer,
      sweep,
      tiles
    };
  }

  function waitForImage(image, timeout = 5000) {
    return new Promise((resolve, reject) => {
      if (image.complete && image.naturalWidth > 0) {
        image.decode?.().catch(() => {});
        resolve();
        return;
      }

      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        image.onload = null;
        image.onerror = null;
        callback(value);
      };
      const timeoutId = window.setTimeout(
        () => finish(reject, new Error("Image decode timed out.")),
        timeout
      );
      image.onload = async () => {
        try {
          await image.decode?.();
        } catch {
          // Some browsers complete decode before onload.
        }
        finish(resolve);
      };
      image.onerror = () => finish(reject, new Error("Image decode failed."));
    });
  }

  function captureVideoFrame(sourceUrl) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      let settled = false;
      const timeoutId = window.setTimeout(
        () => finish(reject, new Error("Video frame timed out.")),
        5000
      );
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        video.removeAttribute("src");
        video.load();
        callback(value);
      };
      const draw = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 640;
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Canvas is unavailable.");
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(resolve, canvas.toDataURL("image/jpeg", 0.86));
        } catch (error) {
          finish(reject, error);
        }
      };
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      video.addEventListener("loadeddata", () => {
        if (video.duration && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(0.15, video.duration / 2);
        } else {
          draw();
        }
      }, { once: true });
      video.addEventListener("seeked", draw, { once: true });
      video.addEventListener(
        "error",
        () => finish(reject, new Error("Video frame could not be loaded.")),
        { once: true }
      );
      video.src = sourceUrl;
    });
  }

  async function preparePhoto(entry, tileParts, objectUrls, reducedMotion) {
    let sourceUrl = "";
    try {
      const blob = await window.QuestMediaStore.blobFor(entry.submission);
      if (!(blob instanceof Blob)) {
        throw new Error("Saved media blob is unavailable.");
      }

      sourceUrl = URL.createObjectURL(blob);
      const displaySource = entry.submission.mediaType?.startsWith("video/")
        ? await captureVideoFrame(sourceUrl)
        : sourceUrl;

      tileParts.photo.src = displaySource;
      await waitForImage(tileParts.photo, reducedMotion ? 1400 : 5000);
      tileParts.photo.hidden = false;
      tileParts.fallback.hidden = true;
      tileParts.tile.classList.add("has-photo");
      tileParts.hasPhoto = true;

      if (displaySource === sourceUrl) {
        objectUrls.add(sourceUrl);
        sourceUrl = "";
      }
    } catch (error) {
      tileParts.photo.removeAttribute("src");
      tileParts.photo.hidden = true;
      tileParts.fallback.hidden = false;
      tileParts.hasPhoto = false;
      console.warn(
        `[Finale] Photo unavailable for ${entry.questId}; keeping its completed illustration.`,
        error
      );
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }

  class MasterTimeline {
    constructor(duration, gate = null) {
      this.duration = duration;
      this.gate = gate;
      this.currentTime = 0;
      this.animations = [];
      this.frame = 0;
      this.lastFrame = null;
      this.resolve = null;
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
    }

    render() {
      this.animations.forEach(({ animation, start, duration }) => {
        animation.currentTime = clamp(this.currentTime - start, 0, duration);
      });
    }

    play() {
      return new Promise((resolve) => {
        this.resolve = resolve;
        this.lastFrame = performance.now();
        this.tick();
      });
    }

    tick = (now = performance.now()) => {
      const elapsed = now - this.lastFrame;
      this.lastFrame = now;
      let nextTime = this.currentTime + elapsed;

      if (
        this.gate &&
        nextTime >= this.gate.time &&
        !this.gate.ready()
      ) {
        nextTime = this.gate.time;
      }

      this.currentTime = clamp(nextTime, 0, this.duration);
      this.render();

      if (this.currentTime >= this.duration) {
        this.resolve?.();
        this.resolve = null;
        return;
      }
      this.frame = requestAnimationFrame(this.tick);
    };

    cancel() {
      if (this.frame) cancelAnimationFrame(this.frame);
      this.animations.forEach(({ animation }) => animation.cancel());
      this.animations = [];
      this.resolve?.();
      this.resolve = null;
    }
  }

  function addConfettiAnimations(timeline, pieces, reducedMotion) {
    pieces.forEach((piece) => {
      const isBurst = piece.dataset.kind === "burst";
      const x = Number(piece.dataset.x);
      const y = Number(piece.dataset.y);
      const drift = Number(piece.dataset.drift);
      const spin = Number(piece.dataset.spin);
      const delay = Number(piece.dataset.delay);
      const duration = reducedMotion ? 520 : Number(piece.dataset.duration);
      const keyframes = reducedMotion
        ? [
            { opacity: 0, transform: "translate3d(0,0,0)" },
            {
              opacity: 0.2,
              transform: `translate3d(${drift * 0.08}vw,8vh,0)`,
              offset: 0.25
            },
            {
              opacity: 0,
              transform: `translate3d(${drift * 0.14}vw,18vh,0)`
            }
          ]
        : isBurst
          ? [
              { opacity: 0, transform: "translate3d(0,0,0) rotate(0deg)" },
              {
                opacity: 0.86,
                transform: `translate3d(${x * 0.75}vw,${y}vh,0) rotate(${spin * 0.35}deg)`,
                offset: 0.18
              },
              {
                opacity: 0.72,
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
                opacity: 0.48,
                transform: `translate3d(${drift * 0.28}vw,18vh,0) rotate(${spin * 0.25}deg)`,
                offset: 0.14
              },
              {
                opacity: 0.38,
                transform: `translate3d(${drift * 0.72}vw,82vh,0) rotate(${spin * 0.78}deg)`,
                offset: 0.78
              },
              {
                opacity: 0,
                transform: `translate3d(${drift}vw,118vh,0) rotate(${spin}deg)`
              }
            ];

      timeline.add(
        piece,
        keyframes,
        {
          duration,
          easing: reducedMotion
            ? "linear"
            : isBurst
              ? "cubic-bezier(.16,.58,.42,1)"
              : "linear"
        },
        reducedMotion ? 0 : delay
      );
    });
  }

  function addRegularAnimations(
    timeline,
    parts,
    orderedEntries,
    summaryWrapper
  ) {
    timeline.add(
      parts.board,
      [
        { opacity: 0, transform: "translateY(16px) scale(.965)" },
        { opacity: 1, transform: "translateY(0) scale(1.01)", offset: 0.78 },
        { opacity: 1, transform: "translateY(0) scale(1)" }
      ],
      {
        duration: FINALE_TIMING.boardReveal.duration,
        easing: FINALE_TIMING.boardReveal.easing
      },
      FINALE_TIMING.boardReveal.start
    );

    timeline.add(
      parts.sweep,
      [
        { opacity: 0, transform: "translateX(-60%) rotate(17deg)" },
        {
          opacity: 0.88,
          transform: "translateX(275%) rotate(17deg)",
          offset: 0.42
        },
        {
          opacity: 0.76,
          transform: "translateX(520%) rotate(17deg)",
          offset: 0.72
        },
        { opacity: 0, transform: "translateX(770%) rotate(17deg)" }
      ],
      {
        duration: FINALE_TIMING.sweep.duration,
        easing: FINALE_TIMING.sweep.easing
      },
      FINALE_TIMING.sweep.start
    );

    [...parts.sparkleLayer.children].forEach((sparkle, index) => {
      const stagger = (index % 5) * 115 + Math.floor(index / 5) * 86;
      timeline.add(
        sparkle,
        [
          { opacity: 0, transform: "rotate(45deg) scale(.1)" },
          {
            opacity: 0.82,
            transform: "rotate(70deg) scale(1)",
            offset: 0.42
          },
          { opacity: 0, transform: "rotate(95deg) scale(.25)" }
        ],
        {
          duration: FINALE_TIMING.sweep.sparkleDuration,
          easing: "ease-out"
        },
        FINALE_TIMING.sweep.start + 190 + stagger
      );
    });

    let flipStart = FINALE_TIMING.photoWave.start;
    orderedEntries.forEach((entry, orderIndex) => {
      const tileParts = parts.tiles.get(entry.questId);
      timeline.add(
        tileParts.card,
        [
          { transform: "rotateY(0deg) scale(1)" },
          { transform: "rotateY(92deg) scale(.965)", offset: 0.47 },
          {
            transform: "rotateY(180deg) scale(1.02)",
            offset: 0.82
          },
          { transform: "rotateY(180deg) scale(1)" }
        ],
        {
          duration: FINALE_TIMING.photoWave.flipDuration,
          easing: FINALE_TIMING.photoWave.easing
        },
        flipStart
      );
      if (orderIndex < FINALE_TIMING.photoWave.intervals.length) {
        flipStart += FINALE_TIMING.photoWave.intervals[orderIndex];
      }
    });

    timeline.add(
      parts.message,
      [
        { opacity: 0, transform: "translateY(8px)" },
        { opacity: 1, transform: "translateY(0)" }
      ],
      {
        duration: FINALE_TIMING.message.duration,
        easing: FINALE_TIMING.message.easing
      },
      FINALE_TIMING.message.start
    );

    parts.rankElements.forEach((rank, index) => {
      const isFinal = index === parts.rankElements.length - 1;
      const start = FINALE_TIMING.ranks.start + index * FINALE_TIMING.ranks.step;
      const finalDuration = Math.max(
        420,
        FINALE_TIMING.exit.start - start
      );
      const duration = isFinal
        ? finalDuration
        : FINALE_TIMING.ranks.step + FINALE_TIMING.ranks.overlap;

      timeline.add(
        rank,
        isFinal
          ? [
              { opacity: 0, transform: "translateY(6px) scale(.94)" },
              {
                opacity: 1,
                transform: "translateY(-1px) scale(1.045)",
                offset: 0.2
              },
              {
                opacity: 1,
                transform: "translateY(0) scale(1)",
                offset: 0.37
              },
              { opacity: 1, transform: "translateY(0) scale(1)" }
            ]
          : [
              { opacity: 0, transform: "translateY(5px)" },
              { opacity: 1, transform: "translateY(0)", offset: 0.16 },
              { opacity: 1, transform: "translateY(0)", offset: 0.7 },
              { opacity: 0, transform: "translateY(-4px)" }
            ],
        { duration, easing: FINALE_TIMING.ranks.easing },
        start
      );
    });

    const finalRank = parts.rankElements.at(-1);
    const finalRankStart =
      FINALE_TIMING.ranks.start +
      (parts.rankElements.length - 1) * FINALE_TIMING.ranks.step;
    const rankShine = finalRank?.querySelector(".finale-rank-shine");
    if (rankShine) {
      timeline.add(
        rankShine,
        [
          { opacity: 0, transform: "translateX(-90%)" },
          { opacity: 0.82, offset: 0.2 },
          { opacity: 0.62, transform: "translateX(90%)", offset: 0.82 },
          { opacity: 0, transform: "translateX(110%)" }
        ],
        { duration: 760, easing: "cubic-bezier(.2,.7,.2,1)" },
        finalRankStart + 170
      );
    }

    timeline.add(
      parts.overlay,
      [{ opacity: 1 }, { opacity: 0 }],
      {
        duration: FINALE_TIMING.exit.duration,
        easing: FINALE_TIMING.exit.easing
      },
      FINALE_TIMING.exit.start
    );

    timeline.add(
      summaryWrapper,
      [
        { opacity: 0, transform: "translateX(-50%) translateY(18px)" },
        { opacity: 1, transform: "translateX(-50%) translateY(0)" }
      ],
      {
        duration: FINALE_TIMING.summary.duration,
        easing: FINALE_TIMING.summary.easing
      },
      FINALE_TIMING.summary.start
    );
  }

  function addReducedAnimations(
    timeline,
    parts,
    entries,
    summaryWrapper
  ) {
    const reduced = FINALE_TIMING.reduced;

    timeline.add(
      parts.board,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 160, easing: "ease-out" },
      40
    );

    entries.forEach((entry) => {
      const tileParts = parts.tiles.get(entry.questId);
      timeline.add(
        tileParts.photoFace,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: reduced.photoDuration, easing: "ease-out" },
        reduced.photoStart
      );
    });

    timeline.add(
      parts.message,
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 180, easing: "ease-out" },
      reduced.messageStart
    );

    const finalRank = parts.rankElements.at(-1);
    if (finalRank) {
      timeline.add(
        finalRank,
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 180, easing: "ease-out" },
        reduced.rankStart
      );
    }

    timeline.add(
      summaryWrapper,
      [
        { opacity: 0, transform: "translateX(-50%)" },
        { opacity: 1, transform: "translateX(-50%)" }
      ],
      { duration: 360, easing: "ease-out" },
      reduced.summaryStart
    );

    timeline.add(
      parts.overlay,
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: reduced.exitDuration, easing: "ease-in-out" },
      reduced.exitStart
    );
  }

  function setUnderlyingInert(summaryWrapper) {
    const targets = [
      ...document.querySelectorAll(".app-page"),
      summaryWrapper
    ].filter(Boolean);
    const previous = targets.map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
      ariaBusy: element.getAttribute("aria-busy")
    }));

    targets.forEach((element) => element.setAttribute("inert", ""));
    summaryWrapper?.setAttribute("aria-busy", "true");

    return () => {
      previous.forEach(({ element, inert, ariaBusy }) => {
        if (!inert) element.removeAttribute("inert");
        if (ariaBusy === null) element.removeAttribute("aria-busy");
        else element.setAttribute("aria-busy", ariaBusy);
      });
    };
  }

  async function runFinale(options) {
    const {
      completionKey,
      entries,
      finalRankTitle,
      rankTitles,
      summaryClose,
      summaryWrapper
    } = options;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const eligibleRanks = rankTitles.length ? rankTitles : [finalRankTitle];
    const parts = buildOverlay(entries, eligibleRanks, reducedMotion);
    const objectUrls = new Set();
    const restoreInert = setUnderlyingInert(summaryWrapper);
    let photosReady = false;
    let timeline = null;
    const orderedEntries = completionOrder(entries);

    try {
      document.body.classList.add("finale-open");
      document.body.appendChild(parts.overlay);
      const confetti = buildConfetti(parts.confettiLayer, reducedMotion);
      buildSparkles(parts.sparkleLayer);

      const preparation = Promise.all(
        entries.map((entry) =>
          preparePhoto(
            entry,
            parts.tiles.get(entry.questId),
            objectUrls,
            reducedMotion
          )
        )
      ).finally(() => {
        photosReady = true;
      });

      const duration = reducedMotion
        ? FINALE_TIMING.reduced.total
        : FINALE_TIMING.total;
      const gateTime = reducedMotion
        ? FINALE_TIMING.reduced.photoStart
        : FINALE_TIMING.photoWave.start;
      timeline = new MasterTimeline(duration, {
        time: gateTime,
        ready: () => photosReady
      });
      addConfettiAnimations(timeline, confetti, reducedMotion);

      if (reducedMotion) {
        addReducedAnimations(timeline, parts, entries, summaryWrapper);
      } else {
        addRegularAnimations(timeline, parts, orderedEntries, summaryWrapper);
      }

      await Promise.all([timeline.play(), preparation]);
      return {
        played: true,
        completionKey,
        order: orderedEntries.map((entry) => entry.questId),
        photoCount: entries.filter(
          (entry) => parts.tiles.get(entry.questId)?.hasPhoto
        ).length,
        reducedMotion
      };
    } finally {
      timeline?.cancel();
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
      objectUrls.clear();
      parts.overlay.remove();
      document.body.classList.remove("finale-open");
      restoreInert();
      summaryClose?.focus({ preventScroll: true });
    }
  }

  function play(options) {
    const completionKey = String(options?.completionKey || "");
    if (!completionKey || activeRun || completionKey === lastCompletionKey) {
      return activeRun || Promise.resolve({
        played: false,
        reason: activeRun ? "already-running" : "already-played"
      });
    }

    lastCompletionKey = completionKey;
    activeRun = runFinale(options)
      .catch((error) => {
        console.warn(
          "[Finale] Animation failed after the quest was safely saved; showing the Final Summary.",
          error
        );
        return { played: false, reason: "animation-failed", error };
      })
      .finally(() => {
        activeRun = null;
      });
    return activeRun;
  }

  function resetReplayGuardForDevelopment() {
    lastCompletionKey = "";
  }

  window.SummerQuestFinale = Object.freeze({
    play,
    timing: FINALE_TIMING,
    completionOrder,
    resetReplayGuardForDevelopment
  });
})();
