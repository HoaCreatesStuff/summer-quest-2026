(() => {
  const pageElements = Array.from(document.querySelectorAll(".app-page"));
  const storyPage = document.querySelector("#storyPage");
  const keepsakePage = document.querySelector("#keepsakePage");
  const storyTimeline = document.querySelector("#storyTimeline");
  const summerGlanceGrid = document.querySelector("#summerGlanceGrid");
  const keepsakeNameInput = document.querySelector("#keepsakeNameInput");
  const keepsakeSummaryInput = document.querySelector("#keepsakeSummaryInput");
  const keepsakeArtworkDate = document.querySelector("#keepsakeArtworkDate");
  const keepsakeArtworkName = document.querySelector("#keepsakeArtworkName");
  const keepsakeArtworkCompleted = document.querySelector("#keepsakeArtworkCompleted");
  const keepsakeArtworkScore = document.querySelector("#keepsakeArtworkScore");
  const keepsakeArtworkRank = document.querySelector("#keepsakeArtworkRank");
  const keepsakeArtworkFriends = document.querySelector("#keepsakeArtworkFriends");
  const keepsakeArtworkFriendsLabel = document.querySelector("#keepsakeArtworkFriendsLabel");
  const keepsakeScoreField = document.querySelector("#keepsakeScoreField");
  const keepsakeBoard = document.querySelector("#keepsakeBoard");
  const keepsakeGlance = document.querySelector("#keepsakeGlance");
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

  function summerGlanceItems(entries = completedEntries()) {
    const totals = getTotals();
    const rank = currentRank(totals.score);
    const friends = entries.reduce(
      (sum, entry) => sum + normalizeFriendCount(entry.submission.friends),
      0
    );
    return [
      ["Completed Quests", totals.completed],
      ["Current Rank", rank.title],
      ["Points Earned", totals.score],
      ["Friends Joined", friends]
    ];
  }

  function summerGlanceMarkup(items) {
    return items.map(([label, value]) => `
      <div class="summer-glance-item">
        <p>${label}</p>
        <strong>${escapeStoryText(value)}</strong>
      </div>`).join("");
  }

  function keepsakePointSummaryItems() {
    return summerGlanceItems().filter(([label]) => label !== "Current Rank");
  }

  function pluralizedSummaryLabel(value, singular, plural) {
    return Number(value) === 1 ? singular : plural;
  }

  function keepsakePointSummaryMarkup(items = keepsakePointSummaryItems()) {
    const values = Object.fromEntries(items);
    const completed = values["Completed Quests"];
    const points = values["Points Earned"];
    const friends = values["Friends Joined"];
    return `
      <span class="keepsake-glance-kicker">SUMMER AT A GLANCE :</span>
      <span><strong>${escapeStoryText(completed)}</strong> ${escapeStoryText(pluralizedSummaryLabel(completed, "Quest Completed", "Quests Completed"))}</span>
      <span aria-hidden="true"> · </span>
      <span><strong>${escapeStoryText(points)}</strong> Points Earned</span>
      <span aria-hidden="true"> · </span>
      <span><strong>${escapeStoryText(friends)}</strong> ${escapeStoryText(pluralizedSummaryLabel(friends, "Friend Joined", "Friends Joined"))}</span>`;
  }

  function keepsakeSummaryData(monthYear = keepsakeArtworkDate.textContent || keepsakeGenerationMonthYear()) {
    const totals = getTotals();
    const values = Object.fromEntries(keepsakePointSummaryItems());
    return {
      completed: totals.completed,
      score: totals.score,
      rank: currentRank(totals.score).title,
      friends: Number(values["Friends Joined"]) || 0,
      monthYear
    };
  }

  function keepsakeRankLines(rank) {
    const words = String(rank || "").trim().split(/\s+/).filter(Boolean);
    const splitAt = Math.ceil(words.length / 2);
    return [
      words.slice(0, splitAt).join(" "),
      words.slice(splitAt).join(" ")
    ].filter(Boolean);
  }

  function keepsakeGenerationMonthYear() {
    return new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric"
    }).format(new Date());
  }

  function syncKeepsakeGenerationDate(monthYear = keepsakeGenerationMonthYear()) {
    keepsakeArtworkDate.textContent = monthYear;
    return monthYear;
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
      const nextAdventureEndCap = finalQuestCompleted()
        ? ""
        : `
          <section class="story-date-group story-next-adventure" aria-label="Your next adventure awaits">
            <header class="story-date-heading">
              <span class="story-date-dot" aria-hidden="true"></span>
              <h2 class="label">Your next adventure awaits…</h2>
            </header>
          </section>`;
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
        </section>`).join("") + nextAdventureEndCap;
    }

    summerGlanceGrid.innerHTML = summerGlanceMarkup(summerGlanceItems(entries));

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

  const keepsakeBoardOpenColorVariables = Object.freeze({
    experience: "--board-open-yellow",
    community: "--board-open-teal",
    challenges: "--board-open-coral",
    final: "--board-open-final"
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

  function keepsakeBoardOpenColor(quest) {
    const colorVariable = keepsakeBoardOpenColorVariables[quest.boardColor]
      || keepsakeBoardOpenColorVariables.experience;
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
    const summary = keepsakeSummaryData(keepsakeGenerationMonthYear());
    const quests = orderedQuests();
    const nextUrls = new Set();
    const mediaSources = await Promise.all(quests.map(quest => (
      mediaSourceFor(completedSubmission(quest.id), nextUrls)
    )));
    revokeMediaUrls(keepsakeMediaUrls);
    keepsakeMediaUrls = nextUrls;

    keepsakeArtworkCompleted.textContent = `${summary.completed}/${window.BOARD_ORDER.length}`;
    keepsakeArtworkScore.textContent = summary.score;
    keepsakeArtworkRank.textContent = keepsakeRankLines(summary.rank).join("\n");
    keepsakeArtworkFriends.textContent = summary.friends;
    keepsakeArtworkFriendsLabel.textContent = ` ${pluralizedSummaryLabel(summary.friends, "Friend Joined", "Friends Joined")}`;
    syncKeepsakeGenerationDate(summary.monthYear);
    keepsakeGlance.hidden = !keepsakeSummaryInput.checked;
    keepsakeScoreField.hidden = !keepsakeSummaryInput.checked;
    keepsakePreviewStage.classList.toggle("has-point-summary", keepsakeSummaryInput.checked);
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

  function syncKeepsakeSummary() {
    keepsakeGlance.hidden = !keepsakeSummaryInput.checked;
    keepsakeScoreField.hidden = !keepsakeSummaryInput.checked;
    keepsakePreviewStage.classList.toggle("has-point-summary", keepsakeSummaryInput.checked);
    resetZoom();
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

  const KEEPSAKE_LAYOUT = Object.freeze({
    width: 1800,
    heightWithSummary: 2104,
    heightWithoutSummary: 1986,
    marginX: 123,
    headerY: 105,
    boardGap: 21,
    contentGap: 76,
    ownerFontRatio: .0215,
    ownerTrackingRatio: .14,
    ownerLineHeight: 1.28,
    ownerTitleGapRatio: .012,
    titleFontRatio: .066,
    titleLineHeight: .96,
    titleTrackingRatio: -.07,
    titleNycGapRatio: .28,
    titleSummerGapRatio: .4,
    titleSummerGapAdjustment: 12,
    scoreFontRatio: .045,
    rankFontRatio: .0175,
    rankLineHeight: 1.08,
    scorePaddingX: 6,
    scorePaddingTop: 3,
    scorePaddingBottom: 2,
    scoreRankGapRatio: .0105,
    footerFontRatio: .021
  });

  function keepsakeBoardY() {
    const boardSize = KEEPSAKE_LAYOUT.width - KEEPSAKE_LAYOUT.marginX * 2;
    const mastheadHeight = boardSize * KEEPSAKE_LAYOUT.ownerFontRatio * KEEPSAKE_LAYOUT.ownerLineHeight
      + boardSize * KEEPSAKE_LAYOUT.ownerTitleGapRatio
      + boardSize * KEEPSAKE_LAYOUT.titleFontRatio * KEEPSAKE_LAYOUT.titleLineHeight;
    return KEEPSAKE_LAYOUT.headerY + mastheadHeight + KEEPSAKE_LAYOUT.contentGap;
  }

  function syncKeepsakePreviewLayout() {
    const { width, heightWithSummary, heightWithoutSummary, marginX, headerY, boardGap } = KEEPSAKE_LAYOUT;
    const boardSize = width - marginX * 2;
    const boardY = keepsakeBoardY();
    const unit = value => `${(value / width) * 100}cqw`;
    const style = keepsakePreviewStage.style;
    const values = {
      "--keepsake-aspect-with-summary": `${width} / ${heightWithSummary}`,
      "--keepsake-aspect-without-summary": `${width} / ${heightWithoutSummary}`,
      "--keepsake-margin-x": unit(marginX),
      "--keepsake-header-y": unit(headerY),
      "--keepsake-board-y": unit(boardY),
      "--keepsake-board-size": unit(boardSize),
      "--keepsake-tile-size": unit((boardSize - boardGap * 4) / 5),
      "--keepsake-board-gap": unit(boardGap),
      "--keepsake-footer-y": unit(boardY + boardSize + KEEPSAKE_LAYOUT.contentGap),
      "--keepsake-owner-font-size": unit(boardSize * KEEPSAKE_LAYOUT.ownerFontRatio),
      "--keepsake-owner-title-gap": unit(boardSize * KEEPSAKE_LAYOUT.ownerTitleGapRatio),
      "--keepsake-title-font-size": unit(boardSize * KEEPSAKE_LAYOUT.titleFontRatio),
      "--keepsake-title-summer-adjustment": unit(KEEPSAKE_LAYOUT.titleSummerGapAdjustment),
      "--keepsake-score-font-size": unit(boardSize * KEEPSAKE_LAYOUT.scoreFontRatio),
      "--keepsake-rank-font-size": unit(boardSize * KEEPSAKE_LAYOUT.rankFontRatio),
      "--keepsake-score-padding-x": unit(boardSize * .014 + KEEPSAKE_LAYOUT.scorePaddingX),
      "--keepsake-score-padding-top": unit(boardSize * .01 + KEEPSAKE_LAYOUT.scorePaddingTop),
      "--keepsake-score-padding-bottom": unit(boardSize * .01 + KEEPSAKE_LAYOUT.scorePaddingBottom),
      "--keepsake-score-rank-gap": unit(boardSize * KEEPSAKE_LAYOUT.scoreRankGapRatio),
      "--keepsake-footer-font-size": unit(boardSize * KEEPSAKE_LAYOUT.footerFontRatio),
      "--keepsake-footer-spacing": unit(boardSize * .031)
    };
    Object.entries(values).forEach(([name, value]) => style.setProperty(name, value));
  }

  syncKeepsakePreviewLayout();

  function trackedCanvasWidth(context, text, tracking = 0) {
    const characters = Array.from(String(text));
    return characters.reduce((width, character, index) => (
      width + context.measureText(character).width + (index ? tracking : 0)
    ), 0);
  }

  function fillTrackedCanvasText(context, text, x, y, tracking = 0) {
    let cursor = x;
    Array.from(String(text)).forEach((character) => {
      context.fillText(character, cursor, y);
      cursor += context.measureText(character).width + tracking;
    });
    return cursor;
  }

  function fillMeasuredTrackedCanvasText(context, text, x, y, tracking = 0) {
    const characters = Array.from(String(text));
    let cursor = x;
    characters.forEach((character, index) => {
      context.fillText(character, cursor, y);
      cursor += context.measureText(character).width;
      if (index < characters.length - 1) cursor += tracking;
    });
    return cursor;
  }

  function drawKeepsakeTitle(context, x, y, fontSize) {
    const tracking = fontSize * KEEPSAKE_LAYOUT.titleTrackingRatio;
    const words = [
      { text: "NYC", color: cssVariableColor("--teal"), gap: fontSize * KEEPSAKE_LAYOUT.titleNycGapRatio },
      { text: "Summer", color: cssVariableColor("--coral"), gap: fontSize * KEEPSAKE_LAYOUT.titleSummerGapRatio - KEEPSAKE_LAYOUT.titleSummerGapAdjustment },
      { text: "Quest", color: cssVariableColor("--coral"), gap: 0 }
    ];
    context.font = `700 ${fontSize}px "Libre Baskerville", serif`;
    let cursor = x;
    words.forEach(({ text, color, gap }) => {
      context.fillStyle = color;
      cursor = fillTrackedCanvasText(context, text, cursor, y, tracking) + gap;
    });
  }

  function drawKeepsakeFooter(context, { boardX, boardSize, y, summary }) {
    const footerFontSize = boardSize * KEEPSAKE_LAYOUT.footerFontRatio;
    const tracking = footerFontSize * .095;
    const regular = `400 ${footerFontSize}px Montserrat, sans-serif`;
    const medium = `500 ${footerFontSize}px Montserrat, sans-serif`;
    const bold = `800 ${footerFontSize}px Montserrat, sans-serif`;
    const separator = `600 ${footerFontSize * 1.25}px Montserrat, sans-serif`;
    const neutral = cssVariableColor("--muted");
    const ink = cssVariableColor("--ink");
    const groups = [
      [{ text: "Hoa & Erika's Birthday Edition", color: cssVariableColor("--ink"), font: medium, tracking }],
      [{ text: "·", color: "#9d701d", font: separator, tracking: 0 }],
      [{ text: summary.monthYear, color: neutral, font: regular, tracking }],
      [{ text: "·", color: "#9d701d", font: separator, tracking: 0 }],
      [
        { text: `${summary.completed}/25`, color: ink, font: bold, tracking },
        { text: " Quests", color: neutral, font: regular, tracking }
      ],
      [{ text: "·", color: "#9d701d", font: separator, tracking: 0 }],
      [
        { text: String(summary.friends), color: ink, font: bold, tracking },
        { text: ` ${pluralizedSummaryLabel(summary.friends, "Friend Joined", "Friends Joined")}`, color: neutral, font: regular, tracking }
      ]
    ];
    const groupWidths = groups.map(parts => parts.reduce((sum, part) => {
      context.font = part.font;
      return sum + trackedCanvasWidth(context, part.text, part.tracking);
    }, 0));
    const availableGap = Math.max(0, (boardSize - groupWidths.reduce((sum, width) => sum + width, 0)) / (groups.length - 1));
    let cursor = boardX;
    groups.forEach((parts, index) => {
      parts.forEach((part) => {
        context.font = part.font;
        context.fillStyle = part.color;
        cursor = fillMeasuredTrackedCanvasText(context, part.text, cursor, y, part.tracking);
      });
      if (index < groups.length - 1) cursor += availableGap;
    });
  }

  async function renderKeepsakeCanvas() {
    await document.fonts?.ready;
    const quests = orderedQuests();
    const illustrations = quests.map(quest => questIllustrationPath(quest.id));
    const [mediaImages, iconImages] = await Promise.all([
      Promise.all(quests.map(quest => loadSubmissionCanvasImage(completedSubmission(quest.id)))),
      Promise.all(illustrations.map(loadCanvasImage))
    ]);
    const includePointSummary = keepsakeSummaryInput.checked;
    const summary = keepsakeSummaryData();
    syncKeepsakeGenerationDate(summary.monthYear);
    const { width, marginX, headerY, boardGap } = KEEPSAKE_LAYOUT;
    const boardY = keepsakeBoardY();
    const height = includePointSummary
      ? KEEPSAKE_LAYOUT.heightWithSummary
      : KEEPSAKE_LAYOUT.heightWithoutSummary;
    const boardX = marginX;
    const boardSize = width - marginX * 2;
    const tileSize = (boardSize - boardGap * 4) / 5;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    context.textBaseline = "top";
    context.fillStyle = cssVariableColor("--sand-2");
    context.fillRect(0, 0, width, height);

    const ownerFontSize = boardSize * KEEPSAKE_LAYOUT.ownerFontRatio;
    const ownerTracking = ownerFontSize * KEEPSAKE_LAYOUT.ownerTrackingRatio;
    const titleFontSize = boardSize * KEEPSAKE_LAYOUT.titleFontRatio;
    const ownerName = keepsakeNameInput.value.trim().toUpperCase() || "YOUR NAME";
    context.font = `800 ${ownerFontSize}px Montserrat, sans-serif`;
    context.fillStyle = cssVariableColor("--ink");
    fillTrackedCanvasText(context, ownerName, boardX, headerY, ownerTracking);
    drawKeepsakeTitle(
      context,
      boardX,
      headerY + ownerFontSize * KEEPSAKE_LAYOUT.ownerLineHeight + boardSize * KEEPSAKE_LAYOUT.ownerTitleGapRatio,
      titleFontSize
    );

    if (includePointSummary) {
      const scoreFontSize = boardSize * KEEPSAKE_LAYOUT.scoreFontRatio;
      const rankFontSize = boardSize * KEEPSAKE_LAYOUT.rankFontRatio;
      const paddingX = boardSize * .014 + KEEPSAKE_LAYOUT.scorePaddingX * (width / KEEPSAKE_LAYOUT.width);
      const paddingBottom = boardSize * .01 + KEEPSAKE_LAYOUT.scorePaddingBottom * (width / KEEPSAKE_LAYOUT.width);
      const paddingTop = boardSize * .01 + KEEPSAKE_LAYOUT.scorePaddingTop * (width / KEEPSAKE_LAYOUT.width);
      const rankLineHeight = rankFontSize * KEEPSAKE_LAYOUT.rankLineHeight;
      context.font = `600 ${rankFontSize}px Montserrat, sans-serif`;
      const rankLines = keepsakeRankLines(summary.rank);
      const widestRankLine = Math.max(...rankLines.map(line => context.measureText(line).width), 0);
      context.font = `700 ${scoreFontSize}px "Libre Baskerville", serif`;
      const scoreWidth = context.measureText(String(summary.score)).width;
      const fieldWidth = Math.min(tileSize, Math.max(scoreWidth, widestRankLine) + paddingX * 2);
      const fieldHeight = paddingTop
        + scoreFontSize * .86
        + boardSize * KEEPSAKE_LAYOUT.scoreRankGapRatio
        + rankLines.length * rankLineHeight
        + paddingBottom;
      const fieldX = boardX + boardSize - fieldWidth;
      context.fillStyle = cssVariableColor("--board-open-yellow");
      context.fillRect(fieldX, headerY, fieldWidth, fieldHeight);
      context.textAlign = "center";
      const fieldTextX = fieldX + fieldWidth / 2;
      context.fillStyle = cssVariableColor("--teal");
      context.font = `700 ${scoreFontSize}px "Libre Baskerville", serif`;
      context.fillText(String(summary.score), fieldTextX, headerY + paddingTop);
      context.fillStyle = cssVariableColor("--ink");
      context.font = `600 ${rankFontSize}px Montserrat, sans-serif`;
      const rankY = headerY + paddingTop + scoreFontSize * .86 + boardSize * KEEPSAKE_LAYOUT.scoreRankGapRatio;
      rankLines.forEach((line, index) => {
        context.fillText(line, fieldTextX, rankY + index * rankLineHeight);
      });
      context.textAlign = "left";
    }

    quests.forEach((quest, index) => {
      const column = index % 5;
      const row = Math.floor(index / 5);
      const x = boardX + column * (tileSize + boardGap);
      const y = boardY + row * (tileSize + boardGap);
      context.save();
      roundedRect(context, x, y, tileSize, tileSize, boardSize * .0016);
      context.clip();
      if (mediaImages[index]) {
        drawCoverImage(context, mediaImages[index], x, y, tileSize, tileSize);
      } else {
        context.fillStyle = keepsakeBoardOpenColor(quest);
        context.fillRect(x, y, tileSize, tileSize);
        if (iconImages[index]) {
          const iconSize = tileSize * .51;
          context.drawImage(iconImages[index], x + (tileSize - iconSize) / 2, y + (tileSize - iconSize) / 2, iconSize, iconSize);
        }
      }
      context.restore();
    });

    if (includePointSummary) {
      drawKeepsakeFooter(context, {
        boardX,
        boardSize,
        y: boardY + boardSize + KEEPSAKE_LAYOUT.contentGap,
        summary
      });
    }

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("PNG generation failed")),
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
  const JE_DPI = 96, JE_PAGE_W = 612, JE_PAGE_H = 792, JE_M_TOP = 0.85*96, JE_M_SIDE=0.90*96, JE_M_BOTTOM=0.55*96, JE_FOOTER_H=32, JE_CONT_EXTRA=18, JE_CONTENT_W=6.7, JE_GAP_PREF=42, JE_GAP_MAX=50;
  const JE_TILTS=[-1.2,5.8,-0.7,3.9,-5.4,1.4,-3.1,6.1];
  // Keep the prototype's bounded rotation variation (within the ±45° cap),
  // but anchor the stamp to its frame rather than the entry coordinate space.
  const JE_STAMP_SIZES=[42,55,65,78,88,47,82,60], JE_STAMP_ROTS=[-38,22,-12,40,-28,15,-41,33], JE_STAMP_OFFX=[-3,2,-2,3,-3,2,-2,3], JE_STAMP_OFFY=[-2,2,-1,1,-2,2,-2,1];
  const JE_POLAROID_W=208, JE_POLAROID_H=236, JE_POLAROID_TEXT_GAP=36, JE_LEFT_TEXT_GAP=50, JE_STAMP_OVERLAP=.55, JE_OPTICAL_GAP=42, JE_EDGE_CLEARANCE=10;
  const JE_CAPTION_FONT='500 18.5px "Caveat"', JE_CAPTION_LINE_HEIGHT=27, JE_LOCATION_FONT='500 16.3px "Caveat"';
  function jeHash(s){let h=0;for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))>>>0;return h;}
  function jeBoardColorVar(c){return boardCategoryColorVariables[c]||boardCategoryColorVariables.experience;}

  function journalEntryBody(entry){
    const caption=String(entry.submission.caption||'').trim();
    const storyHtml=questStoryCandidate(entry)?.html||'';
    const fallback=!caption && storyHtml ? (()=>{ const node=document.createElement('div'); node.innerHTML=storyHtml; return node.textContent||''; })() : '';
    return {body:caption||fallback, isCaption:!!caption};
  }

  async function ensureJournalCanvasFonts(){
    if(!document.fonts) return;
    // Canvas does not trigger the CSS Font Loading API itself. Load the exact
    // bundled Caveat faces before both measurement and paint, then verify it.
    await Promise.all([
      document.fonts.load(JE_CAPTION_FONT,'Summer journal caption'),
      document.fonts.load(JE_LOCATION_FONT,'Chelsea Market'),
      document.fonts.load('500 27.5px "Caveat"','Til next time'),
      document.fonts.load('400 17px "Material Symbols Outlined"','groups')
    ]);
    await document.fonts.ready;
    if(!document.fonts.check(JE_CAPTION_FONT,'Summer journal caption')){
      throw new Error('Caveat font was not ready for Journal PDF rendering.');
    }
  }

  function journalTextGap(entry,idx){
    const reversed=idx%2===1;
    return reversed ? JE_POLAROID_TEXT_GAP : JE_LEFT_TEXT_GAP;
  }
  function journalTextWidth(entry,idx){ return JE_CONTENT_W*96-JE_POLAROID_W-journalTextGap(entry,idx); }

  // Canvas has no CSS overflow-wrap, so split a single long token when needed.
  // This keeps the PDF's content behavior consistent with the prototype's text column.
  function wrapJournalText(context, text, maxWidth){
    const lines=[];
    let line='';
    String(text).trim().split(/\s+/).filter(Boolean).forEach(word=>{
      const candidate=line ? `${line} ${word}` : word;
      if(context.measureText(candidate).width<=maxWidth){ line=candidate; return; }
      if(line){ lines.push(line); line=''; }
      if(context.measureText(word).width<=maxWidth){ line=word; return; }
      let piece='';
      for(const char of Array.from(word)){
        if(piece && context.measureText(piece+char).width>maxWidth){ lines.push(piece); piece=char; }
        else piece+=char;
      }
      line=piece;
    });
    if(line) lines.push(line);
    return lines;
  }

  function rotatedRectBounds(cx, cy, width, height, degrees){
    const radians=degrees*Math.PI/180, cos=Math.cos(radians), sin=Math.sin(radians);
    const points=[[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2]].map(([x,y])=>({x:cx+x*cos-y*sin,y:cy+x*sin+y*cos}));
    return points.reduce((bounds, point)=>({left:Math.min(bounds.left,point.x), right:Math.max(bounds.right,point.x), top:Math.min(bounds.top,point.y), bottom:Math.max(bounds.bottom,point.y)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
  }

  function journalStampAnchor(stampSize, offX, offY){
    // Anchor to the transformed frame's upper-left corner. About 55% overlaps
    // the frame, with a small inward optical safety allowance and tiny jitter.
    return {
      x:-JE_POLAROID_W/2+stampSize/2-stampSize*(1-JE_STAMP_OVERLAP)+JE_EDGE_CLEARANCE*.2+offX,
      y:-JE_POLAROID_W/2+stampSize/2-stampSize*(1-JE_STAMP_OVERLAP)+JE_EDGE_CLEARANCE*.5+offY
    };
  }

  // These are the same transforms used by the renderer below. They are kept as
  // decoration data, distinct from the entry's structural stacking height.
  function journalPolaroidBounds(entry, idx){
    const tilt=JE_TILTS[idx%JE_TILTS.length];
    const h=jeHash(entry.quest.id);
    const stampSize=JE_STAMP_SIZES[h%JE_STAMP_SIZES.length];
    const stampRot=JE_STAMP_ROTS[h%JE_STAMP_ROTS.length];
    const offX=JE_STAMP_OFFX[h%JE_STAMP_OFFX.length];
    const offY=JE_STAMP_OFFY[h%JE_STAMP_OFFY.length];
    const isRev=idx%2===1;
    const bounds=[];
    // Backing is offset 8px right and 10px down inside its independently tilted box.
    bounds.push(rotatedRectBounds(112, 128, JE_POLAROID_W, JE_POLAROID_H, isRev?-2.2:2.2));
    // Frame transform origin is its 208px square center, exactly as drawn below.
    bounds.push(rotatedRectBounds(104, 118, JE_POLAROID_W, JE_POLAROID_H, tilt));
    const anchor=journalStampAnchor(stampSize,offX,offY);
    const radians=tilt*Math.PI/180, localX=anchor.x, localY=anchor.y;
    const stampCx=104+localX*Math.cos(radians)-localY*Math.sin(radians);
    const stampCy=104+localX*Math.sin(radians)+localY*Math.cos(radians);
    bounds.push(rotatedRectBounds(stampCx, stampCy, stampSize, stampSize, tilt+stampRot));
    return bounds.reduce((all, box)=>({left:Math.min(all.left,box.left),right:Math.max(all.right,box.right),top:Math.min(all.top,box.top),bottom:Math.max(all.bottom,box.bottom)}),{left:Infinity,right:-Infinity,top:Infinity,bottom:-Infinity});
  }

  async function renderJournalPagesToCanvases(){
    console.log('[Journal Export] assets/fonts ready check...');
    await document.fonts?.ready;
    await ensureJournalCanvasFonts();
    console.log('[Journal Export] fonts ready');
    const entries = completedEntries();
    const totals = getTotals(); const rank = currentRank(totals.score);
    const friendsJoined = entries.reduce((s,e)=>s+normalizeFriendCount(e.submission.friends),0);
    console.log('[Journal Export] totals', {completed:totals.completed, rank:rank.title, score:totals.score, friendsJoined});
    // Load images
    console.log('[Journal Export] photos loaded start', entries.length);
    const mediaImages = await Promise.all(entries.map(e=>loadSubmissionCanvasImage(e.submission)));
    console.log('[Journal Export] media images loaded', mediaImages.filter(Boolean).length);
    const heroImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/hero-summer-journal.png"));
    const pigeonImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/illustrations/icons/old/judgmental-pigeon.png"));
    const stampImg = await loadCanvasImage(window.SUMMER_QUEST_BUILD.assetUrl("assets/illustrations/overlays/completed-stamp-256.png"));
    console.log('[Journal Export] hero/pigeon/stamp', !!heroImg, !!pigeonImg, !!stampImg);
    const iconImgs = await Promise.all(entries.map(e=>loadCanvasImage(questIllustrationPath(e.quest.id))));
    const boardQuests = orderedQuests();
    const boardMedia = await Promise.all(boardQuests.map(q=>loadSubmissionCanvasImage(completedSubmission(q.id))));
    const boardIcons = await Promise.all(boardQuests.map(q=>loadCanvasImage(questIllustrationPath(q.id))));
    console.log('[Journal Export] board assets loaded');

    const CONTENT_H = 1056 - JE_M_TOP - 0.55*96 - JE_FOOTER_H;
    const CONTENT_H_CONT = CONTENT_H - JE_CONT_EXTRA;
    const CONTENT_W_PX = JE_CONTENT_W*96;
    const measureCtx = document.createElement('canvas').getContext('2d');
    const heroW=560;
    const heroH=heroImg ? heroImg.height*(heroW/heroImg.width) : 110;
    // Matches the source header's block flow: eyebrow, two-line title, 560px hero,
    // generated date, and the 4-column glance block.
    const headerH=27.5+104+heroH+34.2+218.5;
    function measureEntry(entry, idx){
      const {body,isCaption}=journalEntryBody(entry);
      const textWForMeasure=journalTextWidth(entry,idx);
      let textBottom=6;
      measureCtx.font='600 12.8px Montserrat';
      textBottom+=36;
      measureCtx.font='400 26px "Libre Baskerville"';
      const titleLines=wrapJournalText(measureCtx, entry.quest.title, textWForMeasure);
      textBottom+=titleLines.length*30+16;
      if(body){
        measureCtx.font = isCaption? JE_CAPTION_FONT : '400 15px Montserrat';
        const bodyLines=wrapJournalText(measureCtx, body, textWForMeasure);
        textBottom+=bodyLines.length*(isCaption?JE_CAPTION_LINE_HEIGHT:24);
      }
      const fCount = Math.max(0, Math.trunc(Number(entry.submission.friends)||0));
      if(fCount>0) textBottom+=14+17;
      const polaroid=journalPolaroidBounds(entry,idx);
      const layoutHeight=Math.max(textBottom,JE_POLAROID_H);
      return {
        layoutHeight,
        textBottom,
        polaroid,
        decoration:{
          top:Math.min(0,polaroid.top),
          bottom:Math.max(0,polaroid.bottom-layoutHeight),
          left:polaroid.left,
          right:polaroid.right
        }
      };
    }
    function entryLanes(entry, measure, idx){
      const reversed=idx%2===1;
      const polaroidX=reversed ? CONTENT_W_PX-JE_POLAROID_W : 0;
      const textX=reversed ? 0 : JE_POLAROID_W+JE_LEFT_TEXT_GAP;
      return {
        decoration:[polaroidX+measure.decoration.left,polaroidX+measure.decoration.right],
        structural:[[polaroidX,polaroidX+JE_POLAROID_W],[textX,textX+journalTextWidth(entry,idx)]]
      };
    }
    function overlapsX(a,b){ return a[0]<b[1] && b[0]<a[1]; }
    function transformedClearance(previous, next){
      const prevLanes=entryLanes(previous.entry,previous.measure,previous.idx);
      const nextLanes=entryLanes(next.entry,next.measure,next.idx);
      const nextTopIntrusion=Math.max(0,-next.measure.decoration.top);
      const prevBottomIntrusion=previous.measure.decoration.bottom;
      const nextSharesLane=prevLanes.structural.some(lane=>overlapsX(lane,nextLanes.decoration));
      const prevSharesLane=nextLanes.structural.some(lane=>overlapsX(lane,prevLanes.decoration));
      return Math.max(
        JE_OPTICAL_GAP,
        nextSharesLane ? nextTopIntrusion : 0,
        prevSharesLane ? prevBottomIntrusion : 0
      );
    }
    function continuationTopInset(measure){
      // Continuation pages already reserve JE_CONT_EXTRA above their first
      // structural module, so only the remaining decorative overhang needs
      // additional vertical space.
      return Math.max(0,-measure.decoration.top-JE_CONT_EXTRA);
    }
    const pages = [];
    const measures=entries.map((entry,idx)=>measureEntry(entry,idx));
    // The first page is the journal cover, always; entries begin on Page 2.
    pages.push({header:true, entries:[], gap:0});
    let remainingIdx = 0;
    let cur=[], curGaps=[], used=0, curTopInset=0, pageIdx=1;
    function capFor(i){return i===0?CONTENT_H:CONTENT_H_CONT;}
    for(let i=remainingIdx;i<entries.length;i++){
      const measure=measures[i];
      const cap = capFor(pageIdx);
      const wrapped={entry:entries[i], img:mediaImages[i], icon:iconImgs[i], idx:i, measure};
      const topInset=cur.length ? 0 : continuationTopInset(measure);
      const gap=cur.length ? transformedClearance(cur[cur.length-1],wrapped) : 0;
      const need=gap+topInset+measure.layoutHeight;
      if(used+need <= cap + 0.5){ if(cur.length){ used+=gap; curGaps.push(gap); } else { used+=topInset; curTopInset=topInset; } cur.push(wrapped); used+=measure.layoutHeight; }
      else {
        if(!cur.length) throw new Error(`Quest Entry “${entries[i].quest.title}” is too tall to fit on one Letter page.`);
        const gaps=cur.length-1, leftover=cap-used;
        const extra=gaps ? Math.min(leftover/gaps,JE_GAP_MAX-JE_GAP_PREF) : 0;
        pages.push({header:false, entries:cur, gap:JE_GAP_PREF+extra, entryGaps:curGaps.map(g=>g+extra), topInset:curTopInset});
        pageIdx++;
        cur=[wrapped];
        curGaps=[];
        curTopInset=continuationTopInset(measure);
        used=curTopInset+measure.layoutHeight;
      }
    }
    if(cur.length){
      const cap=capFor(pageIdx), gaps=cur.length-1, leftover=cap-used;
      const extra=gaps ? Math.min(leftover/gaps,JE_GAP_MAX-JE_GAP_PREF) : 0;
      pages.push({header:false, entries:cur, gap:JE_GAP_PREF+extra, entryGaps:curGaps.map(g=>g+extra), topInset:curTopInset});
    }
    console.log('[Journal Export] pagination', {headerH, contentHeight:CONTENT_H, continuationHeight:CONTENT_H_CONT, entryHeights:measures.map(m=>Math.round(m.layoutHeight*10)/10), longestEntryHeight:Math.round(Math.max(0,...measures.map(m=>m.layoutHeight))*10)/10, entriesPerPage:pages.map(page=>page.entries.length)});
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
      ctx.fillStyle='#9a958f'; ctx.font='600 11px Montserrat, sans-serif'; ctx.textBaseline='middle';
      ctx.fillText('NYC Summer Quest · 2026 Birthday Edition', 0.90*96, fy+16);
      const num = String(pi+1).padStart(2,'0'); ctx.fillStyle='#6f6a63'; ctx.textAlign='right'; ctx.fillText(num, canvas.width-0.90*96, fy+16); ctx.textAlign='left';
      let y = JE_M_TOP;
      if(page.header){
        ctx.fillStyle='#1ba9b9'; ctx.font='600 16px Montserrat'; ctx.textAlign='center'; ctx.fillText("Hoa & Erika's 2026 Birthday Edition".toUpperCase(), canvas.width/2, y+16); ctx.textAlign='left';
        y+=27.5;
        ctx.fillStyle='#272522'; ctx.font='400 52px "Libre Baskerville"'; ctx.textAlign='center'; ctx.fillText('My Summer Journal', canvas.width/2, y+43); ctx.textAlign='left';
        y+=104;
        if(heroImg) ctx.drawImage(heroImg, (canvas.width-heroW)/2, y, heroW, heroH);
        y+=heroH;
        const gen = new Intl.DateTimeFormat('en-US',{month:'long',day:'numeric',year:'numeric'}).format(new Date()).toUpperCase();
        ctx.fillStyle='#f35f59'; ctx.font='600 14.5px Montserrat'; ctx.textAlign='center'; ctx.fillText(gen, canvas.width/2, y+30.5); y+=34.2; ctx.textAlign='left';
        // Glance 4x1
        y+=28; ctx.strokeStyle='rgba(157,112,29,.28)'; ctx.beginPath(); ctx.moveTo(0.90*96,y); ctx.lineTo(canvas.width-0.90*96,y); ctx.stroke();
        y+=28; ctx.fillStyle='#87661f'; ctx.font='600 14.5px Montserrat'; ctx.textAlign='center'; ctx.fillText('SUMMER AT A GLANCE', canvas.width/2, y+14.5); y+=16.1+20; ctx.textAlign='left';
        const cols=['Completed Quests','Current Rank','Points Earned','Friends Joined'];
        const vals=[String(totals.completed), rank.title, String(totals.score), String(friendsJoined)];
        const colW=(canvas.width-1.8*96)/4;
        cols.forEach((label,i)=>{
          const x=0.90*96 + i*colW + 10;
          if(i>0){ ctx.strokeStyle='rgba(157,112,29,.24)'; ctx.beginPath(); ctx.moveTo(0.90*96+i*colW, y); ctx.lineTo(0.90*96+i*colW, y+96.3); ctx.stroke(); }
          ctx.fillStyle='#6f6a63'; ctx.font='700 12.8px Montserrat'; ctx.fillText(label.toUpperCase(), x, y+16);
          ctx.fillStyle='#272522'; ctx.font='400 24.8px "Libre Baskerville"'; const valueLines=wrapJournalText(ctx,String(vals[i]),colW-20); valueLines.slice(0,2).forEach((line,lineIndex)=>ctx.fillText(line,x,y+50+lineIndex*31.5));
        });
        y+=96.3+28; ctx.strokeStyle='rgba(157,112,29,.28)'; ctx.beginPath(); ctx.moveTo(0.90*96,y); ctx.lineTo(canvas.width-0.90*96,y); ctx.stroke(); y+=page.gap;
        if(page.entries.length){
          // draw single entry under header with generous gap already added
        }
      } else {
        y+= (!page.ending && pi>0 ? JE_CONT_EXTRA+(page.topInset||0) : 0);
      }
      // draw entries
      const ents = page.entries || [];
      for(let ei=0; ei<ents.length; ei++){
        const {entry, img, icon, idx} = ents[ei];
        const isRev = idx%2===1;
        const polaroidW=JE_POLAROID_W, polaroidH=JE_POLAROID_H, photo=188;
        const tilt = JE_TILTS[idx%JE_TILTS.length];
        const h = jeHash(entry.quest.id); const sSize=JE_STAMP_SIZES[h%JE_STAMP_SIZES.length]; const sRot=JE_STAMP_ROTS[h%JE_STAMP_ROTS.length]; const offX=JE_STAMP_OFFX[h%JE_STAMP_OFFX.length]; const offY=JE_STAMP_OFFY[h%JE_STAMP_OFFY.length];
        const colX = isRev ? canvas.width-0.90*96 - polaroidW : 0.90*96;
        const entryGap=journalTextGap(entry,idx);
        const textX = isRev ? 0.90*96 : 0.90*96+polaroidW+entryGap;
        const textW = canvas.width-1.8*96 - polaroidW-entryGap;
        // polaroid backing
        ctx.save(); ctx.translate(colX+polaroidW/2, y+polaroidH/2); ctx.rotate((isRev?-2.2:2.2)*Math.PI/180); ctx.fillStyle = ['#fff4d2','#d5e8e3','#f9d7d4','#f8e7bd'][idx%4]; ctx.fillRect(-polaroidW/2+8, -polaroidH/2+10, polaroidW, polaroidH); ctx.restore();
        // polaroid frame
        ctx.save(); ctx.translate(colX+polaroidW/2, y+ polaroidW/2); ctx.rotate(tilt*Math.PI/180);
        ctx.fillStyle='#fff'; ctx.strokeStyle='rgba(39,37,34,.07)'; ctx.lineWidth=1;
        ctx.fillRect(-polaroidW/2, -polaroidW/2, polaroidW, polaroidW+28); ctx.strokeRect(-polaroidW/2, -polaroidW/2, polaroidW, polaroidW+28);
        const imgX=-photo/2, imgY=-polaroidW/2+9;
        if(img){ ctx.save(); ctx.beginPath(); ctx.rect(imgX, imgY, photo, photo); ctx.clip(); const scale=Math.max(photo/img.width, photo/img.height); const sw=photo/scale, sh=photo/scale, sx=(img.width-sw)/2, sy=(img.height-sh)/2; ctx.drawImage(img,sx,sy,sw,sh,imgX,imgY,photo,photo); ctx.restore(); } else if(icon){ ctx.drawImage(icon, imgX+photo*0.2, imgY+photo*0.2, photo*0.6, photo*0.6); }
        ctx.fillStyle='#4f4a44'; ctx.font=JE_LOCATION_FONT; ctx.textAlign='center'; const loc=String(entry.submission.location||'').trim(); if(loc) ctx.fillText(loc,0, polaroidW/2+14); ctx.textAlign='left';
        // stamp
        const stampAnchor=journalStampAnchor(sSize,offX,offY);
        ctx.save(); ctx.translate(stampAnchor.x, stampAnchor.y); ctx.rotate(sRot*Math.PI/180); if(stampImg) ctx.drawImage(stampImg, -sSize/2, -sSize/2, sSize, sSize); ctx.restore();
        ctx.restore();
        // text
        let ty=y+6;
        ctx.fillStyle='#f35f59'; ctx.font='600 12.8px Montserrat'; if(icon) ctx.drawImage(icon, textX, ty-14, 22,22);
        ctx.fillText(formattedDate(entry.adventureDate).toUpperCase(), textX+30, ty); ty+=36;
        ctx.fillStyle='#272522'; ctx.font='400 26px "Libre Baskerville"'; const titleLines=wrapJournalText(ctx,entry.quest.title,textW); titleLines.forEach((line,lineIndex)=>ctx.fillText(line,textX,ty+lineIndex*30)); ty+=titleLines.length*30+16;
        const {body,isCaption}=journalEntryBody(entry);
        ctx.fillStyle = isCaption? '#4f4a44':'#272522';
        ctx.font = isCaption? JE_CAPTION_FONT : '400 15px Montserrat';
        if(body){ const bodyLines=wrapJournalText(ctx,body,textW); bodyLines.forEach((line,lineIndex)=>ctx.fillText(line,textX,ty+lineIndex*(isCaption?JE_CAPTION_LINE_HEIGHT:24))); ty+=bodyLines.length*(isCaption?JE_CAPTION_LINE_HEIGHT:24); }
        const fCount = Math.max(0, Math.trunc(Number(entry.submission.friends)||0));
        if(fCount>0){
          ty+=14;
          ctx.fillStyle='#6f6a63'; ctx.textBaseline='alphabetic';
          ctx.font='500 12.5px Montserrat'; const friendTextMetrics=ctx.measureText(`+${fCount} ${fCount===1?'friend':'friends'}`);
          ctx.font='400 17px "Material Symbols Outlined"'; const friendIconMetrics=ctx.measureText('groups');
          const friendIconBaseline=ty+((friendIconMetrics.actualBoundingBoxAscent-friendIconMetrics.actualBoundingBoxDescent)-(friendTextMetrics.actualBoundingBoxAscent-friendTextMetrics.actualBoundingBoxDescent))/2;
          ctx.fillText('groups',textX,friendIconBaseline);
          ctx.font='500 12.5px Montserrat'; ctx.fillText(`+${fCount} ${fCount===1?'friend':'friends'}`,textX+22,ty); ty+=17;
        }
        y += ents[ei].measure.layoutHeight + (ei<ents.length-1?(page.entryGaps?.[ei]??page.gap):0);
      }
      if(page.ending){
        // hero board
        ctx.fillStyle='#f35f59'; ctx.font='600 10.5px Montserrat'; ctx.textAlign='center'; ctx.fillText("THAT'S A WRAP", canvas.width/2, y+10.5); y+=20.8;
        ctx.fillStyle='#272522'; ctx.font='400 29.6px "Libre Baskerville"'; ctx.fillText('What an adventure!', canvas.width/2, y+29.6); y+=34+43; ctx.textAlign='left';
        const boardSize = (canvas.width-1.8*96)*0.83; const boardX=(canvas.width-boardSize)/2; const gap=7; const tile=(boardSize-gap*4)/5;
        boardQuests.forEach((q,i)=>{
          const col=i%5, row=Math.floor(i/5); const x=boardX+col*(tile+gap), yy=y+row*(tile+gap);
          const sub=completedSubmission(q.id); const hasPhoto=boardMedia[i];
          ctx.save(); ctx.beginPath(); roundedRect(ctx,x,yy,tile,tile,8); ctx.clip();
          if(hasPhoto){ const im=boardMedia[i]; const sc=Math.max(tile/im.width, tile/im.height); const sw=tile/sc, sh=tile/sc, sx=(im.width-sw)/2, sy=(im.height-sh)/2; ctx.drawImage(im,sx,sy,sw,sh,x,yy,tile,tile); }
          else { const colr = q.boardColor==='community'?'#b4e0d5':q.boardColor==='challenges'?'#f5d0ca':q.boardColor==='final'?'#e8d2a2':'#f8e6b2'; ctx.fillStyle=colr; ctx.fillRect(x,yy,tile,tile); const ic=boardIcons[i]; if(ic) ctx.drawImage(ic, x+tile*0.2, yy+tile*0.2, tile*0.6, tile*0.6); }
          ctx.restore();
        });
        y+= boardSize+42;
        const endingLines=['The birthday quests may be done, but my summer','doesn’t end here. Here’s to taking the scenic route,','trying things outside my comfort zone, and making','new memories with friends, old and new.'];
        const endingBodyW=boardSize, endingLineH=27.72, endingTransitionGap=16;
        ctx.fillStyle='#272522'; ctx.font='400 16.8px Montserrat'; ctx.textAlign='center';
        endingLines.forEach((line,i)=>ctx.fillText(line,boardX+endingBodyW/2,y+i*endingLineH));
        const endingBodyMetrics=ctx.measureText(endingLines.at(-1));
        const pigeonY=y+(endingLines.length-1)*endingLineH+endingBodyMetrics.actualBoundingBoxDescent+endingTransitionGap;
        if(pigeonImg){ const ph=48, pw=pigeonImg.width*(ph/pigeonImg.height); ctx.drawImage(pigeonImg, (canvas.width-pw)/2, pigeonY, pw, ph); ctx.fillStyle='#f35f59'; ctx.font='500 27.5px "Caveat"'; const signoffAscent=ctx.measureText('’Til next time!').actualBoundingBoxAscent; ctx.fillText('’Til next time!',canvas.width/2,pigeonY+ph+endingTransitionGap+signoffAscent); }
        ctx.textAlign='left';
      }
      canvases.push(canvas);
    }
    return canvases;
  }

  function binaryStringToBytes(str){ const b=new Uint8Array(str.length); for(let i=0;i<str.length;i++) b[i]=str.charCodeAt(i)&0xFF; return b; }
  function pdfFromJpegDataUrls(jpegs, w, h){
    const pageW=612, pageH=792;
    const scale = pageW / w;
    const imgH = Math.round(h*scale);
    const header='%PDF-1.4\n';
    const objs=[];
    objs.push('<< /Type /Catalog /Pages 2 0 R >>');
    objs.push(`<< /Type /Pages /Kids [${jpegs.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] /Count ${jpegs.length} >>`);
    const jpegBins = jpegs.map(j=>{ const b64=j.split(',')[1]||''; const bin=atob(b64); const u8=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) u8[i]=bin.charCodeAt(i)&0xFF; return u8; });
    jpegBins.forEach((u8,i)=>{
      const n = 3+i*3;
      objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageW} ${pageH}] /Resources << /XObject << /Im0 ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`);
      objs.push({ header: `<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${u8.length} >>\nstream\n`, data: u8, footer: '\nendstream' });
      const content=`q\n${pageW} 0 0 ${imgH} 0 ${pageH-imgH} cm\n/Im0 Do\nQ\n`;
      objs.push(`<< /Length ${content.length} >>\nstream\n${content}endstream`);
    });
    const enc = s=>binaryStringToBytes(s);
    let total = enc(header).length;
    const offsets=[];
    const parts=[enc(header)];
    objs.forEach((o,i)=>{
      const idx=i+1;
      const pre=enc(`${idx} 0 obj\n`);
      let body, post;
      if(typeof o==='string'){ body=enc(o); post=enc('\nendobj\n'); }
      else { const hB=enc(o.header); const fB=enc(o.footer); const eB=enc('\nendobj\n'); body=new Uint8Array(hB.length+o.data.length+fB.length); body.set(hB,0); body.set(o.data,hB.length); body.set(fB,hB.length+o.data.length); post=eB; const combined=new Uint8Array(pre.length+body.length+post.length); combined.set(pre,0); combined.set(body,pre.length); combined.set(post,pre.length+body.length); offsets.push(total); total+=combined.length; parts.push(combined); return; }
      const combined=new Uint8Array(pre.length+body.length+post.length); combined.set(pre,0); combined.set(body,pre.length); combined.set(post,pre.length+body.length);
      offsets.push(total); total+=combined.length; parts.push(combined);
    });
    const xrefOff=total;
    const xrefHeader=enc(`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`);
    total+=xrefHeader.length; parts.push(xrefHeader);
    offsets.forEach(off=>{ const l=enc(`${String(off).padStart(10,'0')} 00000 n \n`); total+=l.length; parts.push(l); });
    const trailer=enc(`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF`);
    parts.push(trailer);
    const out=new Uint8Array(parts.reduce((s,a)=>s+a.length,0));
    let o=0; parts.forEach(a=>{ out.set(a,o); o+=a.length; });
    return new Blob([out],{type:'application/pdf'});
  }

  async function exportStoryPdf(){
    console.log('[Journal Export] button click reached: #shareStoryBtn');
    const btn=document.querySelector("#shareStoryBtn"); if(!btn){ console.error('[Journal Export] button #shareStoryBtn not found'); return; }
    const orig=btn.textContent; btn.textContent="Preparing PDF..."; btn.disabled=true;
    console.log('[Journal Export] export function entered');
    try{
      console.log('[Journal Export] resolving completed entries...');
      const entries = completedEntries();
      console.log('[Journal Export] completed entries resolved', entries.length);
      console.log('[Journal Export] loading photos/assets/fonts...');
      const canvases = await renderJournalPagesToCanvases();
      console.log('[Journal Export] pages rendered', canvases.length, canvases.map(c=>`${c.width}x${c.height}`).join(', '));
      console.log('[Journal Export] PDF generation started');
      const jpegs = canvases.map(c=>c.toDataURL('image/jpeg',.92));
      if(!jpegs.length) throw new Error('No pages rendered');
      const pdfBlob = pdfFromJpegDataUrls(jpegs, canvases[0].width, canvases[0].height);
      console.log('[Journal Export] PDF generation completed', pdfBlob.size, 'bytes');
      const url=URL.createObjectURL(pdfBlob); const a=document.createElement('a'); a.href=url; a.download='Summer-Journal-2026.pdf'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000);
      console.log('[Journal Export] download triggered');
    } catch(e){ console.error('[Journal Export] FAILED at stage', e); console.error(e.stack||e); alert('PDF export failed. Please try again. (see console for details)'); }
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
  keepsakeSummaryInput.addEventListener("change", syncKeepsakeSummary);
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
