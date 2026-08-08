(() => {
  const pageElements = Array.from(document.querySelectorAll(".app-page"));
  const storyPage = document.querySelector("#storyPage");
  const keepsakePage = document.querySelector("#keepsakePage");
  const storyTimeline = document.querySelector("#storyTimeline");
  const summerGlanceGrid = document.querySelector("#summerGlanceGrid");
  const keepsakeNameInput = document.querySelector("#keepsakeNameInput");
  const keepsakeArtworkName = document.querySelector("#keepsakeArtworkName");
  const keepsakeArtworkCompleted = document.querySelector("#keepsakeArtworkCompleted");
  const keepsakeArtworkRank = document.querySelector("#keepsakeArtworkRank");
  const keepsakeBoard = document.querySelector("#keepsakeBoard");
  const keepsakePreviewStage = document.querySelector("#keepsakePreviewStage");
  const keepsakePreviewTransform = document.querySelector("#keepsakePreviewTransform");
  const keepsakeGeneratedPreview = document.querySelector("#keepsakeGeneratedPreview");
  const keepsakeShimmer = document.querySelector("#keepsakeShimmer");
  const keepsakeStatus = document.querySelector("#keepsakeStatus");
  const saveKeepsakeBtn = document.querySelector("#saveKeepsakeBtn");
  const shareKeepsakeBtn = document.querySelector("#shareKeepsakeBtn");
  const expandKeepsakeBtn = document.querySelector("#expandKeepsakeBtn");
  const closeKeepsakeFullscreenBtn = document.querySelector("#closeKeepsakeFullscreenBtn");

  let currentPage = "board";
  let keepsakeReturnPage = "board";
  let generatedKeepsake = null;
  let generatedKeepsakeUrl = "";
  let storyMediaUrls = new Set();
  let keepsakeMediaUrls = new Set();
  const videoFrameCache = new Map();

  function analytics() {
    return window.SummerQuestAnalytics;
  }

  function revokeMediaUrls(urls) {
    urls.forEach(url => URL.revokeObjectURL(url));
    urls.clear();
  }

  async function mediaSourceFor(submission, urls) {
    try {
      const blob = await window.QuestMediaStore.blobFor(submission);
      if (!blob) return "";
      const source = URL.createObjectURL(blob);
      urls.add(source);
      return source;
    } catch (error) {
      console.error("[Media storage] Export media could not be loaded.", error);
      return "";
    }
  }

  function completedEntries() {
    return orderedQuests()
      .map((quest, boardIndex) => ({
        quest,
        boardIndex,
        submission: completedSubmission(quest.id)
      }))
      .filter(entry => Boolean(entry.submission))
      .map(entry => ({
        ...entry,
        adventureDate: adventureDateForSubmission(entry.submission)
      }))
      .sort((left, right) => {
        const dateOrder = left.adventureDate.localeCompare(right.adventureDate);
        if (dateOrder) return dateOrder;

        const leftTime = new Date(left.submission.completedAt || 0).getTime();
        const rightTime = new Date(right.submission.completedAt || 0).getTime();
        if (
          Number.isFinite(leftTime) &&
          Number.isFinite(rightTime) &&
          leftTime !== rightTime
        ) {
          return leftTime - rightTime;
        }
        if (Number.isFinite(leftTime) !== Number.isFinite(rightTime)) {
          return Number.isFinite(leftTime) ? -1 : 1;
        }
        return left.boardIndex - right.boardIndex;
      });
  }

  function formattedDate(value) {
    const date = parseLocalCalendarDate(value);
    if (!date) return "Date not recorded";
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function friendsLabel(value) {
  const count = Math.max(0, Math.trunc(Number(value) || 0));
  return count === 0 ? "Solo" : String(count);
}

  function mediaMarkup(entry, className) {
    const { submission, quest } = entry;
    if (!entry.mediaSource) return "";
    const alt = `${quest.title} memory`;
    if (submission.mediaType?.startsWith("video/")) {
      return `<video class="${className}" src="${entry.mediaSource}" data-media-id="${escapeStoryText(submission.mediaId || "")}" muted playsinline preload="metadata" aria-label="${escapeStoryText(alt)}"></video>`;
    }
    return `<img class="${className}" src="${entry.mediaSource}" alt="${escapeStoryText(alt)}" />`;
  }

  async function renderStory() {
    const entries = completedEntries();
    const newestQuestId = [...entries]
      .sort((left, right) => {
        const leftTime = new Date(left.submission.completedAt || 0).getTime();
        const rightTime = new Date(right.submission.completedAt || 0).getTime();
        return leftTime - rightTime;
      })
      .at(-1)?.quest.id;
    const nextUrls = new Set();
    await Promise.all(entries.map(async (entry) => {
      entry.mediaSource = await mediaSourceFor(entry.submission, nextUrls);
    }));
    revokeMediaUrls(storyMediaUrls);
    storyMediaUrls = nextUrls;

    const groups = [];
    entries.forEach((entry) => {
      const key = entry.adventureDate;
      let group = groups[groups.length - 1];
      if (!group || group.key !== key) {
        group = { key, date: entry.adventureDate, entries: [] };
        groups.push(group);
      }
      group.entries.push(entry);
    });

    if (!groups.length) {
      storyTimeline.innerHTML = `
        <div class="story-empty-state">
          <p class="label">Your story starts here</p>
          <h2>Complete a quest to add your first memory.</h2>
          <button class="secondary-button" type="button" data-route="board">Back to Board</button>
        </div>`;
    } else {
      storyTimeline.innerHTML = groups.map((group, groupIndex) => `
        <section id="storyDate-${groupIndex}" class="story-date-group" aria-labelledby="storyDateTitle-${groupIndex}">
          <header class="story-date-heading">
  <span class="story-date-dot" aria-hidden="true"></span>

  <h2 id="storyDateTitle-${groupIndex}">
    ${formattedDate(group.date)}
  </h2>

  <button
    class="story-next-date"
    type="button"
    data-next-target="${
      groupIndex === groups.length - 1
        ? "summerGlance"
        : `storyDate-${groupIndex + 1}`
    }"
    aria-label="${
      groupIndex === groups.length - 1
        ? "Jump to Summer at a Glance"
        : "Jump to next date"
    }"
  >
    ↓
  </button>
</header>
          <div class="story-date-entries">
            ${group.entries.map(entry => {
              const location = entry.quest.story.includes("{locationSentence}")
                ? String(entry.submission.location || "").trim()
                : "";
              const caption = String(entry.submission.caption || "").trim();
              const generatedStory = questStoryCandidate(entry)?.html || "";
              return `
                <article class="story-entry" id="story-${entry.quest.id}" data-quest-id="${entry.quest.id}">
                  <header class="story-entry-header">
                    <h3>
  ${escapeStoryText(entry.quest.title)}
  ${
    entry.quest.id === newestQuestId
      ? '<span class="story-new-pill">NEW</span>'
      : ""
  }
                    </h3>
                    <p>
                      ${location ? `
                      <span class="story-meta-item">
                      <span class="material-symbols-outlined" aria-hidden="true">location_on</span>
                      ${escapeStoryText(location)}
                      </span>` : ""}
                      <span class="story-meta-item">
                      <span class="material-symbols-outlined" aria-hidden="true">groups</span>
                      ${friendsLabel(entry.submission.friends)}
                      </span>
                    </p>
                  </header>
                  ${mediaMarkup(entry, "story-entry-photo")}
                  ${generatedStory
  ? `<p class="story-generated-copy">${generatedStory}</p>`
  : ""}
                  ${caption
                    ? `<p class="story-caption">${escapeStoryText(caption)}</p>`
  : ""}
                </article>`;
            }).join("")}
          </div>
        </section>`).join("");
    }

    const totals = getTotals();
    const rank = currentRank(totals.score);
    const friends = entries.reduce(
      (sum, entry) => sum + normalizeFriendCount(entry.submission.friends),
      0
    );
    const glanceItems = [
      ["Completed Quests", totals.completed],
      ["Current Rank", rank.title],
      ["Points Earned", totals.score],
      ["Friends Joined", friends]
    ];
    summerGlanceGrid.innerHTML = glanceItems.map(([label, value]) => `
      <div class="summer-glance-item">
        <p>${label}</p>
        <strong>${escapeStoryText(value)}</strong>
      </div>`).join("");

    storyTimeline.querySelectorAll("video").forEach(async (video) => {
      const still = await captureVideoFrame(video.src, video.dataset.mediaId || video.src);
      if (!still || !video.isConnected) return;
      const image = document.createElement("img");
      image.className = video.className;
      image.alt = video.getAttribute("aria-label") || "Quest memory";
      image.src = still;
      video.replaceWith(image);
    });
  }

  const boardCategoryColorVariables = Object.freeze({
    experience: "--category-experience",
    community: "--category-community",
    challenges: "--category-challenges",
    final: "--board-final"
  });

  function cssVariableColor(variableName) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(variableName)
      .trim();
  }

  function boardTileColor(quest) {
    const colorVariable = boardCategoryColorVariables[quest.boardColor]
      || boardCategoryColorVariables.experience;
    return cssVariableColor(colorVariable);
  }

  function keepsakeTileMarkup(quest, mediaSource) {
    const submission = completedSubmission(quest.id);
    const isImage = mediaSource && !submission?.mediaType?.startsWith("video/");
    if (isImage) {
      return `
        <div class="quest-card keepsake-quest-card board-square--${quest.boardColor} is-photo" aria-label="${escapeStoryText(quest.title)}, completed">
          <img class="keepsake-tile-photo" src="${mediaSource}" alt="" />
        </div>`;
    }
    return `
      <div class="quest-card keepsake-quest-card board-square--${quest.boardColor}${isFinalQuest(quest) ? " final-quest-card" : ""}" data-keepsake-quest="${quest.id}" data-media-source="${mediaSource || ""}" aria-label="${escapeStoryText(quest.title)}">
        <span class="quest-card__visual is-open">
          <span class="quest-card-content">
            ${questVisualMarkup(quest)}
            <span class="quest-title">${renderQuestTitle(quest.title)}</span>
          </span>
        </span>
      </div>`;
  }

  async function renderKeepsake() {
    const totals = getTotals();
    const rank = currentRank(totals.score);
    const quests = orderedQuests();
    const nextUrls = new Set();
    const mediaSources = await Promise.all(quests.map(quest => (
      mediaSourceFor(completedSubmission(quest.id), nextUrls)
    )));
    revokeMediaUrls(keepsakeMediaUrls);
    keepsakeMediaUrls = nextUrls;

    keepsakeArtworkCompleted.textContent = `${totals.completed}/${window.BOARD_ORDER.length} Quests`;
    keepsakeArtworkRank.textContent = rank.title;
    keepsakeBoard.innerHTML = quests.map((quest, index) => keepsakeTileMarkup(quest, mediaSources[index])).join("");
    keepsakeBoard.querySelectorAll("[data-keepsake-quest]").forEach(async (tile) => {
      const submission = completedSubmission(tile.dataset.keepsakeQuest);
      if (!tile.dataset.mediaSource || !submission?.mediaType?.startsWith("video/")) return;
      const still = await captureVideoFrame(tile.dataset.mediaSource, submission.mediaId || tile.dataset.mediaSource);
      if (!still || !tile.isConnected) return;
      tile.classList.add("is-photo");
      tile.innerHTML = `<img class="keepsake-tile-photo" src="${still}" alt="" />`;
    });
    invalidateGeneratedKeepsake();
  }

  function validKeepsakeName() {
    return keepsakeNameInput.value.trim().length > 0;
  }

  function syncKeepsakeName() {
    const name = keepsakeNameInput.value.trim();
    keepsakeArtworkName.textContent = name || "Your Name";
    saveKeepsakeBtn.disabled = !name;
    shareKeepsakeBtn.disabled = !name;
    if (generatedKeepsake) invalidateGeneratedKeepsake();
  }

  function invalidateGeneratedKeepsake() {
    generatedKeepsake = null;
    if (generatedKeepsakeUrl) URL.revokeObjectURL(generatedKeepsakeUrl);
    generatedKeepsakeUrl = "";
    keepsakeGeneratedPreview.hidden = true;
    keepsakeGeneratedPreview.classList.remove("is-revealed");
    keepsakeGeneratedPreview.removeAttribute("src");
    document.querySelector("#keepsakeArtwork").hidden = false;
    saveKeepsakeBtn.disabled = !validKeepsakeName();
    shareKeepsakeBtn.disabled = !validKeepsakeName();
    keepsakeStatus.textContent = "";
  }

  async function captureVideoFrame(source, cacheKey = source) {
    if (!source) return "";
    if (videoFrameCache.has(cacheKey)) return videoFrameCache.get(cacheKey);
    const promise = new Promise((resolve) => {
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const finish = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 640;
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", .86));
        } catch (error) {
          resolve("");
        }
        video.removeAttribute("src");
        video.load();
      };
      video.addEventListener("loadeddata", () => {
        if (video.duration && Number.isFinite(video.duration)) {
          video.currentTime = Math.min(.15, video.duration / 2);
        } else {
          finish();
        }
      }, { once: true });
      video.addEventListener("seeked", finish, { once: true });
      video.addEventListener("error", () => resolve(""), { once: true });
      video.src = source;
    });
    videoFrameCache.set(cacheKey, promise);
    return promise;
  }

  function loadCanvasImage(source) {
    return new Promise((resolve) => {
      if (!source) return resolve(null);
      const image = new Image();
      image.decoding = "async";
      image.onload = async () => {
        try { await image.decode?.(); } catch (error) { /* Some browsers decode before onload. */ }
        resolve(image);
      };
      image.onerror = () => resolve(null);
      window.setTimeout(() => resolve(null), 6000);
      image.src = source;
    });
  }

  async function loadSubmissionCanvasImage(submission) {
    if (!submission) return null;
    let sourceUrl = "";
    try {
      const blob = await window.QuestMediaStore.blobFor(submission);
      if (!blob) return null;
      sourceUrl = URL.createObjectURL(blob);
      const source = submission.mediaType?.startsWith("video/")
        ? await captureVideoFrame(sourceUrl, submission.mediaId || sourceUrl)
        : sourceUrl;
      return await loadCanvasImage(source);
    } catch (error) {
      console.error("[Media storage] Canvas media could not be loaded.", error);
      return null;
    } finally {
      if (sourceUrl) URL.revokeObjectURL(sourceUrl);
    }
  }

  function roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    if (typeof context.roundRect === "function") {
      context.roundRect(x, y, width, height, radius);
      return;
    }
    const right = x + width;
    const bottom = y + height;
    context.moveTo(x + radius, y);
    context.lineTo(right - radius, y);
    context.quadraticCurveTo(right, y, right, y + radius);
    context.lineTo(right, bottom - radius);
    context.quadraticCurveTo(right, bottom, right - radius, bottom);
    context.lineTo(x + radius, bottom);
    context.quadraticCurveTo(x, bottom, x, bottom - radius);
    context.lineTo(x, y + radius);
    context.quadraticCurveTo(x, y, x + radius, y);
    context.closePath();
  }

  function drawCoverImage(context, image, x, y, width, height) {
    const scale = Math.max(width / image.width, height / image.height);
    const sourceWidth = width / scale;
    const sourceHeight = height / scale;
    const sourceX = (image.width - sourceWidth) / 2;
    const sourceY = (image.height - sourceHeight) / 2;
    context.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
  }

  function wrapCanvasText(context, text, maxWidth, maxLines = 2) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const candidate = line ? `${line} ${word}` : word;
      if (context.measureText(candidate).width <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  async function renderKeepsakeCanvas() {
    await document.fonts?.ready;
    const quests = orderedQuests();
    const illustrations = quests.map(
      quest => questIllustrationPath(quest.id)
    );
    const [mediaImages, iconImages] = await Promise.all([
      Promise.all(quests.map(quest => loadSubmissionCanvasImage(completedSubmission(quest.id)))),
      Promise.all(illustrations.map(loadCanvasImage))
    ]);

    const width = 1800;
    const height = 2100;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.fillStyle = "#f7f2e9";
    context.fillRect(0, 0, width, height);

    const margin = 60;
    context.textBaseline = "top";
    context.fillStyle = "#272522";
    context.font = '600 25px Montserrat, sans-serif';
    context.fillText("Hoa & Erika's Birthday Edition", margin, 64);
    context.font = '700 62px "Libre Baskerville", serif';
    context.fillStyle = cssVariableColor("--coral");
    context.fillText("NYC Summer Quest", margin, 120);
    const totals = getTotals();
    const rank = currentRank(totals.score);
    context.textAlign = "right";
    context.fillStyle = "#272522";
    context.font = '600 25px Montserrat, sans-serif';
    context.fillText("August 2026", width - margin, 64);
    context.fillStyle = cssVariableColor("--teal");
    context.font = '700 42px Montserrat, sans-serif';
    context.fillText(keepsakeNameInput.value.trim(), width - margin, 110);
    context.fillStyle = "#272522";
    context.font = '400 30px "Libre Baskerville", serif';
    context.fillText(rank.title, width - margin, 166);
    context.textAlign = "left";

    const boardX = margin;
    const boardY = 315;
    const boardSize = width - margin * 2;
    const gap = 22;
    const tileSize = (boardSize - gap * 4) / 5;
    quests.forEach((quest, index) => {
  const column = index % 5;
  const row = Math.floor(index / 5);
  const x = boardX + column * (tileSize + gap);
  const y = boardY + row * (tileSize + gap);

  context.save();
  roundedRect(context, x, y, tileSize, tileSize, 26);
  context.clip();

  if (mediaImages[index]) {
    drawCoverImage(
      context,
      mediaImages[index],
      x,
      y,
      tileSize,
      tileSize
    );
  } else {
    if (isFinalQuest(quest)) {
      const gradient = context.createLinearGradient(
        x,
        y,
        x + tileSize,
        y + tileSize
      );

      gradient.addColorStop(0, "#fff4d5");
      gradient.addColorStop(.52, "#ead19a");
      gradient.addColorStop(1, "#f8e7bd");
      context.fillStyle = gradient;
    } else {
      context.fillStyle = boardTileColor(quest);
    }

    context.fillRect(x, y, tileSize, tileSize);

        if (iconImages[index]) {
      const iconSize = tileSize * .52;

      context.drawImage(
        iconImages[index],
        x + (tileSize - iconSize) / 2,
        y + (tileSize - iconSize) / 2,
        iconSize,
        iconSize
      );
    }
  }

  context.restore();
});

return new Promise((resolve, reject) => {
  canvas.toBlob(
    blob =>
      blob
        ? resolve(blob)
        : reject(new Error("PNG generation failed")),
    "image/png"
  );
});
}

  function setKeepsakeActionState(isPreparing) {
    saveKeepsakeBtn.disabled = isPreparing || !validKeepsakeName();
    shareKeepsakeBtn.disabled = isPreparing || !validKeepsakeName();
    saveKeepsakeBtn.textContent = isPreparing ? "Preparing keepsake..." : "Save to Camera Roll";
    shareKeepsakeBtn.textContent = isPreparing ? "Preparing keepsake..." : "Share";
  }

  async function generateKeepsake() {
    if (!validKeepsakeName()) {
      keepsakeNameInput.focus();
      return false;
    }
    setKeepsakeActionState(true);
    keepsakeGeneratedPreview.classList.remove("is-revealed");
    keepsakeStatus.textContent = "Preparing keepsake...";
    keepsakeShimmer.hidden = false;
    keepsakePreviewStage.classList.add("is-preparing");
    const start = performance.now();

    try {
      generatedKeepsake = await renderKeepsakeCanvas();
      const remaining = Math.max(0, 280 - (performance.now() - start));
      await new Promise(resolve => window.setTimeout(resolve, remaining));
      if (generatedKeepsakeUrl) URL.revokeObjectURL(generatedKeepsakeUrl);
      generatedKeepsakeUrl = URL.createObjectURL(generatedKeepsake);
      keepsakeGeneratedPreview.src = generatedKeepsakeUrl;
      keepsakeGeneratedPreview.hidden = false;
      document.querySelector("#keepsakeArtwork").hidden = true;
      requestAnimationFrame(() => keepsakeGeneratedPreview.classList.add("is-revealed"));
      keepsakeStatus.textContent = "Your keepsake is ready.";
      analytics()?.trackKeepsakeGenerated?.();
      setKeepsakeActionState(false);
      return true;
    } catch (error) {
  console.error("Keepsake PNG generation failed:", error);
  keepsakeStatus.textContent = "We couldn't prepare the PNG. Please try again.";
  setKeepsakeActionState(false);
  return false;
} finally {
      keepsakeShimmer.hidden = true;
      keepsakePreviewStage.classList.remove("is-preparing");
    }
  }

  function safeFileName() {
    const name = keepsakeNameInput.value.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    return `${name || "summer-quest"}-memory-keepsake.png`;
  }

  function keepsakeFile() {
    return new File([generatedKeepsake], safeFileName(), { type: "image/png" });
  }

  async function openShareSheet() {
    if (!generatedKeepsake && !(await generateKeepsake())) return;
    if (!generatedKeepsake) return;
    const file = keepsakeFile();
    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
      try {
        await navigator.share({ files: [file], title: "My NYC Summer Quest Keepsake" });
      } catch (error) {
        if (error.name !== "AbortError") downloadKeepsake();
      }
      return;
    }
    downloadKeepsake();
  }

  function downloadKeepsake() {
    if (!generatedKeepsakeUrl) return;
    const link = document.createElement("a");
    link.href = generatedKeepsakeUrl;
    link.download = safeFileName();
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function drawWrappedText(context, text, x, y, maxWidth, lineHeight, maxLines = Infinity) {
    const lines = wrapCanvasText(context, text, maxWidth, maxLines);
    lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
    return y + lines.length * lineHeight;
  }

  // === Ported from standalone prototype (prototypes/journal-export) ===
  const JE_DPI = 96, JE_PAGE_W = 612, JE_PAGE_H = 792, JE_M_TOP = 0.85*96, JE_M_SIDE=0.90*96, JE_M_BOTTOM=0.55*96, JE_FOOTER_H=32, JE_CONT_EXTRA=18, JE_CONTENT_W=6.7, JE_GAP_PREF=42, JE_GAP_MAX=50, JE_HEADER_GAP=36;
  const JE_TILTS=[-1.2,5.8,-0.7,3.9,-5.4,1.4,-3.1,6.1];
  const JE_STAMP_SIZES=[50,58,62,66,71,53,69,60], JE_STAMP_ROTS=[-38,22,-12,40,-28,15,-41,33], JE_STAMP_OFFX=[-6,5,-4,7,-8,3,-2,6], JE_STAMP_OFFY=[-5,6,-3,2,-7,4,-8,1];
  function jeHash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
  function jeBoardColorVar(c){return boardCategoryColorVariables[c]||boardCategoryColorVariables.experience;}

  async function renderJournalPagesToCanvases(){
    await document.fonts?.ready;
    const entries = completedEntries();
    const totals = getTotals(); const rank = currentRank(totals.score);
    const friendsJoined = entries.reduce((s,e)=>s+normalizeFriendCount(e.submission.friends),0);
    // Load images
    const mediaImages = await Promise.all(entries.map(e=>loadSubmissionCanvasImage(e.submission)));
    const heroImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/hero-journal-new.png"));
    const pigeonImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/illustrations/icons/old/judgmental-pigeon.png"));
    const stampImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/illustrations/overlays/completed-stamp-256.png"));
    const iconImgs = await Promise.all(entries.map(e=>loadCanvasImage(questIllustrationPath(e.quest.id))));
    const boardQuests = orderedQuests();
    const boardMedia = await Promise.all(boardQuests.map(q=>loadSubmissionCanvasImage(completedSubmission(q.id))));
    const boardIcons = await Promise.all(boardQuests.map(q=>loadCanvasImage(questIllustrationPath(q.id))));

    // Estimate heights via offscreen measurement (like prototype) - use simplified heights for canvas
    // For canvas pagination we estimate via text metrics + image size
    function estimateEntryHeight(entry, idx){
      const hasLong = String(entry.submission.caption||"").length>120 || String(questStoryCandidate(entry)?.html||"").length>180;
      return hasLong ? 320 : 260;
    }
    const headerH = 520;
    const CONTENT_H = 1056 - JE_M_TOP - 0.55*96 - JE_FOOTER_H;
    const CONTENT_H_CONT = CONTENT_H - JE_CONT_EXTRA;
    const pages = [];
    const firstH = estimateEntryHeight(entries[0]||{submission:{},quest:{id:""}},0);
    let remainingIdx = 0;
    if(entries.length && headerH + JE_HEADER_GAP + firstH <= CONTENT_H){
      pages.push({header:true, entries:[entries[0]], gap:JE_HEADER_GAP});
      remainingIdx=1;
    } else {
      pages.push({header:true, entries:[], gap:0});
    }
    let cur=[], used=0, pageIdx=1;
    function capFor(i){return i===0?CONTENT_H:CONTENT_H_CONT;}
    for(let i=remainingIdx;i<entries.length;i++){
      const h = estimateEntryHeight(entries[i],i);
      const cap = capFor(pageIdx);
      const need = (cur.length? JE_GAP_PREF:0)+h;
      if(used+need <= cap){ if(cur.length) used+=JE_GAP_PREF; cur.push({entry:entries[i], img:mediaImages[i], icon:iconImgs[i], idx:i}); used+=h; }
      else { pages.push({header:false, entries:cur, gap:JE_GAP_PREF}); pageIdx++; cur=[{entry:entries[i], img:mediaImages[i], icon:iconImgs[i], idx:i}]; used=h; }
    }
    if(cur.length) pages.push({header:false, entries:cur, gap:JE_GAP_PREF});
    // Ending dedicated
    pages.push({ending:true, boardQuests, boardMedia, boardIcons, totals, rank, friendsJoined});

    // Render canvases
    const canvases=[];
    for(let pi=0; pi<pages.length; pi++){
      const page = pages[pi];
      const canvas = document.createElement('canvas');
      canvas.width = 816; canvas.height = 1056;
      const ctx = canvas.getContext('2d', {alpha:false});
      ctx.fillStyle = '#fffefb'; ctx.fillRect(0,0,canvas.width,canvas.height);
      // footer
      const fy = canvas.height - 0.45*96 - 32;
      ctx.fillStyle='rgba(39,37,34,.09)'; ctx.fillRect(0.90*96, fy, canvas.width-1.8*96, 0.8);
      ctx.fillStyle='#9a958f'; ctx.font='600 9px Montserrat, sans-serif'; ctx.textBaseline='middle';
      ctx.fillText('NYC Summer Quest · 2026 Birthday Edition', 0.90*96, fy+16);
      const num = String(pi+1).padStart(2,'0'); ctx.fillStyle='#6f6a63'; ctx.textAlign='right'; ctx.fillText(num, canvas.width-0.90*96, fy+16); ctx.textAlign='left';
      let y = JE_M_TOP;
      if(page.header){
        ctx.fillStyle='#1ba9b9'; ctx.font='600 10px Montserrat'; ctx.textAlign='center'; ctx.fillText("Hoa & Erika's 2026 Birthday Edition".toUpperCase(), canvas.width/2, y+10); ctx.textAlign='left';
        ctx.fillStyle='#272522'; ctx.font='400 42px "Libre Baskerville"'; ctx.textAlign='center'; ctx.fillText('Summer Journal', canvas.width/2, y+48); ctx.textAlign='left';
        if(heroImg){ const hw=460, hh=heroImg.height*(hw/heroImg.width); ctx.drawImage(heroImg, (canvas.width-hw)/2, y+62, hw, hh); y+=62+hh+12; } else y+=110;
        const gen = new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();
        ctx.fillStyle='#f35f59'; ctx.font='600 9px Montserrat'; ctx.textAlign='center'; ctx.fillText(gen, canvas.width/2, y+6); y+=22; ctx.textAlign='left';
        // Glance 4x1
        ctx.strokeStyle='rgba(157,112,29,.28)'; ctx.beginPath(); ctx.moveTo(0.90*96,y); ctx.lineTo(canvas.width-0.90*96,y); ctx.stroke();
        y+=18; ctx.fillStyle='#87661f'; ctx.font='600 9px Montserrat'; ctx.textAlign='center'; ctx.fillText('SUMMER AT A GLANCE', canvas.width/2, y); y+=18; ctx.textAlign='left';
        const cols=['Completed Quests','Current Rank','Points Earned','Friends Joined'];
        const vals=[String(totals.completed), rank.title, String(totals.score), String(friendsJoined)];
        const colW=(canvas.width-1.8*96)/4;
        cols.forEach((label,i)=>{
          const x=0.90*96 + i*colW + 10;
          if(i>0){ ctx.strokeStyle='rgba(157,112,29,.24)'; ctx.beginPath(); ctx.moveTo(0.90*96+i*colW, y-6); ctx.lineTo(0.90*96+i*colW, y+44); ctx.stroke(); }
          ctx.fillStyle='#6f6a63'; ctx.font='700 7px Montserrat'; ctx.fillText(label.toUpperCase(), x, y);
          ctx.fillStyle='#272522'; ctx.font='400 14px "Libre Baskerville"'; ctx.fillText(vals[i], x, y+18);
        });
        y+=50; ctx.strokeStyle='rgba(157,112,29,.28)'; ctx.beginPath(); ctx.moveTo(0.90*96,y); ctx.lineTo(canvas.width-0.90*96,y); ctx.stroke(); y+=JE_HEADER_GAP;
        if(page.entries.length){
          // draw single entry under header with generous gap already added
        }
      } else {
        y+= (pi>0? JE_CONT_EXTRA:0);
      }
      // draw entries
      const ents = page.entries;
      for(let ei=0; ei<ents.length; ei++){
        const {entry, img, icon, idx} = ents[ei];
        const isRev = (entry.boardIndex!=null? entry.boardIndex: idx) %2===1;
        const polaroidW=208, polaroidH=236, photo=188;
        const tilt = JE_TILTS[idx%JE_TILTS.length];
        const h = jeHash(entry.quest.id); const sSize=JE_STAMP_SIZES[h%JE_STAMP_SIZES.length]; const sRot=JE_STAMP_ROTS[h%JE_STAMP_ROTS.length]; const offX=JE_STAMP_OFFX[h%JE_STAMP_OFFX.length]; const offY=JE_STAMP_OFFY[h%JE_STAMP_OFFY.length];
        const colX = isRev ? canvas.width-0.90*96 - polaroidW : 0.90*96;
        const textX = isRev ? 0.90*96 : 0.90*96+polaroidW+36;
        const textW = canvas.width-1.8*96 - polaroidW -36;
        // polaroid backing
        ctx.save(); ctx.translate(colX+polaroidW/2, y+polaroidH/2); ctx.rotate((isRev?-2.2:2.2)*Math.PI/180); ctx.fillStyle = ['#fff4d2','#d5e8e3','#f9d7d4','#f8e7bd'][idx%4]; ctx.fillRect(-polaroidW/2+8, -polaroidH/2+10, polaroidW, polaroidH); ctx.restore();
        // polaroid frame
        ctx.save(); ctx.translate(colX+polaroidW/2, y+ polaroidW/2); ctx.rotate(tilt*Math.PI/180);
        ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(39,37,34,.07)'; ctx.lineWidth=1;
        ctx.fillRect(-polaroidW/2, -polaroidW/2, polaroidW, polaroidW+28); ctx.strokeRect(-polaroidW/2, -polaroidW/2, polaroidW, polaroidW+28);
        const imgX=-photo/2, imgY=-polaroidW/2+9;
        if(img){ ctx.save(); ctx.beginPath(); ctx.rect(imgX, imgY, photo, photo); ctx.clip(); const scale=Math.max(photo/img.width, photo/img.height); const sw=photo/scale, sh=photo/scale, sx=(img.width-sw)/2, sy=(img.height-sh)/2; ctx.drawImage(img,sx,sy,sw,sh,imgX,imgY,photo,photo); ctx.restore(); } else if(icon){ ctx.drawImage(icon, imgX+photo*0.2, imgY+photo*0.2, photo*0.6, photo*0.6); }
        ctx.fillStyle='#4f4a44'; ctx.font='500 13px Caveat'; ctx.textAlign='center'; const loc=String(entry.submission.location||'').trim(); if(loc) ctx.fillText(loc,0, polaroidW/2+14); ctx.textAlign='left';
        // stamp
        ctx.save(); ctx.translate(polaroidW/2-24+offX, -polaroidW/2-24+offY); ctx.rotate(sRot*Math.PI/180); if(stampImg) ctx.drawImage(stampImg, -sSize/2, -sSize/2, sSize, sSize); ctx.restore();
        ctx.restore();
        // text
        let ty=y+6;
        ctx.fillStyle='#f35f59'; ctx.font='600 8px Montserrat'; if(icon) ctx.drawImage(icon, textX, ty-10, 12,12);
        ctx.fillText(formattedDate(entry.adventureDate).toUpperCase(), textX+16, ty); ty+=14;
        ctx.fillStyle='#272522'; ctx.font='400 17px "Libre Baskerville"'; ty = drawWrappedText(ctx, entry.quest.title, textX, ty, textW, 20, 2)+6;
        const caption = String(entry.submission.caption||'').trim();
        const fallback = !caption ? (questStoryCandidate(entry)?.html?.replace(/<[^>]+>/g,'')||'') : '';
        ctx.fillStyle = caption? '#4f4a44':'#272522';
        ctx.font = caption? '500 14px Caveat' : '400 11px Montserrat';
        const body = caption || fallback;
        if(body) ty = drawWrappedText(ctx, body, textX, ty, textW, caption?18:15, 6)+8;
        const fCount = Math.max(0, Math.trunc(Number(entry.submission.friends)||0));
        if(fCount>0){ ctx.fillStyle='#6f6a63'; ctx.font='500 10px Montserrat'; ctx.fillText(`+${fCount} ${fCount===1?'friend':'friends'}`, textX, ty+10); ty+=14; }
        const entryH = Math.max(polaroidH+28, ty - y);
        y += entryH + (ei<ents.length-1? JE_GAP_PREF:0);
      }
      if(page.ending){
        // hero board
        ctx.fillStyle='#f35f59'; ctx.font='600 8px Montserrat'; ctx.textAlign='center'; ctx.fillText("THAT'S A WRAP", canvas.width/2, y); y+=14;
        ctx.fillStyle='#272522'; ctx.font='400 20px "Libre Baskerville"'; ctx.fillText('What an adventure!', canvas.width/2, y); y+=28; ctx.textAlign='left';
        const boardSize = (canvas.width-1.8*96)*0.83; const boardX=(canvas.width-boardSize)/2; const gap=6; const tile=(boardSize-gap*4)/5;
        boardQuests.forEach((q,i)=>{
          const col=i%5, row=Math.floor(i/5); const x=boardX+col*(tile+gap), yy=y+row*(tile+gap);
          const sub=completedSubmission(q.id); const hasPhoto=boardMedia[i];
          ctx.save(); ctx.beginPath(); roundedRect(ctx,x,yy,tile,tile,8); ctx.clip();
          if(hasPhoto){ const im=boardMedia[i]; const sc=Math.max(tile/im.width, tile/im.height); const sw=tile/sc, sh=tile/sc, sx=(im.width-sw)/2, sy=(im.height-sh)/2; ctx.drawImage(im,sx,sy,sw,sh,x,yy,tile,tile); }
          else { const colr = q.boardColor==='community'?'#b4e0d5':q.boardColor==='challenges'?'#f5d0ca':q.boardColor==='final'?'#e8d2a2':'#f8e6b2'; ctx.fillStyle=colr; ctx.fillRect(x,yy,tile,tile); const ic=boardIcons[i]; if(ic) ctx.drawImage(ic, x+tile*0.2, yy+tile*0.2, tile*0.6, tile*0.6); }
          ctx.restore();
        });
        y+= boardSize+24;
        const body="The birthday quests may be done, but my summer doesn’t end here. Here’s to taking the scenic route, trying things outside my comfort zone, and making new memories with friends, old and new.";
        ctx.fillStyle='#272522'; ctx.font='400 11px Montserrat'; ctx.textAlign='center'; const bw=boardSize; const bx=(canvas.width-bw)/2; const lines=wrapCanvasText(ctx, body, bw, 99); lines.forEach((ln,i)=>ctx.fillText(ln, canvas.width/2, y+i*15)); y+=lines.length*15+24; ctx.textAlign='left';
        if(pigeonImg){ const ph=48, pw=pigeonImg.width*(ph/pigeonImg.height); ctx.drawImage(pigeonImg, (canvas.width-pw)/2, y, pw, ph); y+=ph+12; }
        ctx.fillStyle='#f35f59'; ctx.font='500 20px Caveat'; ctx.textAlign='center'; ctx.fillText('’Til next time!', canvas.width/2, y); ctx.textAlign='left';
      }
      canvases.push(canvas);
    }
    return canvases;
  }

  function pdfFromJpegDataUrls(jpegs, w, h){
    const pageW=612, pageH=792;
    const scale = pageW / w;
    const imgH = Math.round(h*scale);
    let pdf='%PDF-1.4\n'; const offsets=[0]; const objs=[];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push(`<< /Type /Pages /Kids [${jpegs.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${jpegs.length} >>`);
    jpegs.forEach((jpeg,i)=>{
      const bin = atob(jpeg.split(',')[1]);
      const n = 3+i*3;
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`);
      objs.push(`<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bin.length} >>\nstream\n${bin}\nendstream`);
      const content=`q\n${pageW} 0 0 ${imgH} 0 ${pageH-imgH} cm\n/Im0 Do\nQ\n`;
      objs.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    });
    objs.forEach((o,i)=>{ offsets.push(pdf.length); pdf+=`${i+1} 0 obj\n${o}\nendobj\n`; });
    const xref=pdf.length; pdf+=`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`; offsets.slice(1).forEach(off=> pdf+=`${String(off).padStart(10,'0')} 00000 n \n`);
    pdf+=`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return new Blob([binaryStringToBytes(pdf)],{type:'application/pdf'});
  }

  async function exportStoryPdf(){
    const btn=document.querySelector("#shareStoryBtn"); const orig=btn.textContent; btn.textContent="Preparing PDF..."; btn.disabled=true;
    try{
      const canvases = await renderJournalPagesToCanvases();
      const jpegs = canvases.map(c=>c.toDataURL('image/jpeg',.92));
      const pdfBlob = pdfFromJpegDataUrls(jpegs, canvases[0].width, canvases[0].height);
      const url=URL.createObjectURL(pdfBlob); const a=document.createElement('a'); a.href=url; a.download='Summer-Journal-2026.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e){ console.error('Journal export failed',e); alert('PDF export failed. Please try again.'); }
    finally{ btn.textContent=orig; btn.disabled=false; }
  }

  async function saveKeepsake() {
    if (!generatedKeepsake && !(await generateKeepsake())) return;
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) && navigator.share) {
      await openShareSheet();
    } else {
      downloadKeepsake();
    }
  }

  async function navigateTo(page) {
    if (!pageElements.some(element => element.dataset.page === page)) return;

    if (currentPage === "story" && page !== "story") {
      revokeMediaUrls(storyMediaUrls);
    }
    if (currentPage === "keepsake" && page !== "keepsake") {
      revokeMediaUrls(keepsakeMediaUrls);
    }

    if (page === "keepsake") {
      keepsakeReturnPage = currentPage === "keepsake"
        ? keepsakeReturnPage
        : currentPage;
      analytics()?.trackKeepsakeOpened?.();
      await renderKeepsake();
    }

    if (page === "story") {
      analytics()?.trackJournalOpened?.();
      await renderStory();
    }

    pageElements.forEach(element => {
      element.hidden = element.dataset.page !== page;
    });

    currentPage = page;
    document.body.dataset.page = page;
    document.dispatchEvent(new CustomEvent("summerquest:pagechange", {
      detail: { page }
    }));
    document.title = page === "story"
      ? "My Summer Story — NYC Summer Quest"
      : page === "keepsake"
        ? "Create Memory Keepsake — NYC Summer Quest"
        : "NYC Summer Quest";

    window.scrollTo({ top: 0, behavior: "auto" });

    if (page === "story" && window.pendingStoryQuestId) {
      const targetQuestId = window.pendingStoryQuestId;
      window.pendingStoryQuestId = null;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document
            .getElementById(`story-${targetQuestId}`)
            ?.scrollIntoView({
              behavior: "smooth",
              block: "center"
            });
        });
      });
    }
  }

  const zoomState = { scale: 1, x: 0, y: 0, pointers: new Map(), start: null, pinch: null, moved: false };

  function applyPreviewTransform() {
    keepsakePreviewTransform.style.transform = `translate3d(${zoomState.x}px, ${zoomState.y}px, 0) scale(${zoomState.scale})`;
    keepsakePreviewStage.classList.toggle("is-zoomed", zoomState.scale > 1.01);
  }

  function clampPan() {
    const rect = keepsakePreviewStage.getBoundingClientRect();
    const maxX = rect.width * (zoomState.scale - 1) / 2;
    const maxY = rect.height * (zoomState.scale - 1) / 2;
    zoomState.x = Math.max(-maxX, Math.min(maxX, zoomState.x));
    zoomState.y = Math.max(-maxY, Math.min(maxY, zoomState.y));
  }

  function resetZoom() {
    zoomState.scale = 1;
    zoomState.x = 0;
    zoomState.y = 0;
    zoomState.pointers.clear();
    zoomState.start = null;
    zoomState.pinch = null;
    applyPreviewTransform();
  }

  function toggleZoom() {
    if (zoomState.scale > 1.01) resetZoom();
    else {
      zoomState.scale = 2;
      applyPreviewTransform();
    }
  }

  function pointerDistance(points) {
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  keepsakePreviewStage.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    keepsakePreviewStage.setPointerCapture(event.pointerId);
    zoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    zoomState.moved = false;
    if (zoomState.pointers.size === 1) {
      zoomState.start = { clientX: event.clientX, clientY: event.clientY, x: zoomState.x, y: zoomState.y, time: performance.now() };
    } else if (zoomState.pointers.size === 2) {
      zoomState.pinch = { distance: pointerDistance(Array.from(zoomState.pointers.values())), scale: zoomState.scale };
    }
  });

  keepsakePreviewStage.addEventListener("pointermove", (event) => {
    if (!zoomState.pointers.has(event.pointerId)) return;
    zoomState.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (zoomState.pointers.size === 2 && zoomState.pinch) {
      event.preventDefault();
      const distance = pointerDistance(Array.from(zoomState.pointers.values()));
      zoomState.scale = Math.max(1, Math.min(4, zoomState.pinch.scale * distance / Math.max(1, zoomState.pinch.distance)));
      if (Math.abs(distance - zoomState.pinch.distance) > 5) zoomState.moved = true;
      clampPan();
      applyPreviewTransform();
    } else if (zoomState.pointers.size === 1 && zoomState.start && zoomState.scale > 1.01) {
      const dx = event.clientX - zoomState.start.clientX;
      const dy = event.clientY - zoomState.start.clientY;
      if (Math.hypot(dx, dy) > 5) zoomState.moved = true;
      zoomState.x = zoomState.start.x + dx;
      zoomState.y = zoomState.start.y + dy;
      clampPan();
      applyPreviewTransform();
    }
  });

  function releasePreviewPointer(event) {
    const wasTap = zoomState.pointers.size === 1 && !zoomState.moved && zoomState.start && performance.now() - zoomState.start.time < 320;
    zoomState.pointers.delete(event.pointerId);
    if (wasTap) toggleZoom();
    if (zoomState.pointers.size === 1) {
      const remaining = Array.from(zoomState.pointers.values())[0];
      zoomState.start = { clientX: remaining.x, clientY: remaining.y, x: zoomState.x, y: zoomState.y, time: performance.now() };
    } else if (!zoomState.pointers.size) {
      zoomState.start = null;
      zoomState.pinch = null;
    }
  }

  keepsakePreviewStage.addEventListener("pointerup", releasePreviewPointer);
  keepsakePreviewStage.addEventListener("pointercancel", releasePreviewPointer);

  function setFullscreenPreview(enabled) {
    keepsakePreviewStage.classList.toggle("is-fullscreen", enabled);
    closeKeepsakeFullscreenBtn.hidden = !enabled;
    expandKeepsakeBtn.hidden = enabled;
    document.body.classList.toggle("keepsake-preview-open", enabled);
    resetZoom();
  }

  document.addEventListener("click", (event) => {
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) navigateTo(route);
  });
  document.querySelector("#viewBoardBtn").addEventListener("click", () => navigateTo("story"));
  document.querySelector("#saveBoardBtn").addEventListener("click", () => navigateTo("keepsake"));
  document.querySelector("#keepsakeBackBtn").addEventListener("click", () => navigateTo("board"));
  document.querySelector("#shareStoryBtn").addEventListener("click", exportStoryPdf);
  storyTimeline.addEventListener("click", (event) => {
    const targetId = event.target.closest("[data-next-target]")?.dataset.nextTarget;
    if (targetId) document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  keepsakeNameInput.addEventListener("input", syncKeepsakeName);
  saveKeepsakeBtn.addEventListener("click", saveKeepsake);
  shareKeepsakeBtn.addEventListener("click", openShareSheet);
  expandKeepsakeBtn.addEventListener("click", () => setFullscreenPreview(true));
  closeKeepsakeFullscreenBtn.addEventListener("click", () => setFullscreenPreview(false));
  keepsakePreviewStage.addEventListener("keydown", (event) => {
    if (["Enter", " "].includes(event.key)) {
      event.preventDefault();
      toggleZoom();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && keepsakePreviewStage.classList.contains("is-fullscreen")) setFullscreenPreview(false);
  });
  window.addEventListener("pagehide", () => {
    revokeMediaUrls(storyMediaUrls);
    revokeMediaUrls(keepsakeMediaUrls);
    if (generatedKeepsakeUrl) URL.revokeObjectURL(generatedKeepsakeUrl);
  });

  syncKeepsakeName();
})();
