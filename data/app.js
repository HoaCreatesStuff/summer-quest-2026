const STORAGE_KEY = "nyc-summer-quest-mvp-v1";
const BRIEFING_STATE_KEY = "nyc-summer-quest-briefing-collapsed";
const QUEST_DATA_MIGRATION_VERSION = 2;
const MEDIA_MIGRATION_VERSION = 1;
const MAX_FRIENDS = 5;
const BONUS_POINTS = 2;
const FINAL_QUEST_ID = "celebrate";
const mediaStore = window.QuestMediaStore;

window.validateBoardConfig();
window.validateQuestData();

const boardItems = window.BOARD_ORDER
  .map((questId, index) => {
    const quest = window.QUESTS[questId];

    if (!quest) {
      console.error(`Missing quest for board ID: ${questId}`);
      return null;
    }

    return {
      id: questId,
      ...quest,
      boardIndex: index,
      boardNumber: index + 1,
      boardColor: window.BOARD_COLORS[index]
    };
  })
  .filter(Boolean);

function isFinalQuest(questOrId) {
  const questId = typeof questOrId === "string" ? questOrId : questOrId?.id;
  return questId === FINAL_QUEST_ID;
}

const LEGACY_QUEST_ID_MAP = {
  1: "golden-hour",
  3: "street-style",
  4: "city-freebies",
  5: "water-wonders",
  7: "showtime",
  8: "random-kindness",
  9: "art-walk",
  10: "diy-craft",
  11: "hidden-gems",
  12: "pup-arazzi",
  15: "open-market",
  16: "get-sweaty",
  17: "street-mural",
  19: "hidden-gems",
  20: "cinema-moment",
  21: "park-picnic",
  22: "celebrate",
  23: "animal-statue",
  24: "human-pyramid",
  25: "celebrate"
};

const LEGACY_BONUS_ID_MAP = {
  "quester-fashionable-look": "self-model",
  "ferry-ride": "nyc-ferry",
  "five-different-breeds": "different-breeds",
  "fresh-purchase": "local-vendor-purchase",
  "nyc-related-scene": "new-york-scene"
};

function loadStoredState() {
  try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"submissions":{}}');
    if (!savedState || typeof savedState !== "object" || Array.isArray(savedState)) {
      console.warn("[Quest migration] Saved progress had an invalid shape and was reset.");
      return { submissions: {} };
    }
    return savedState;
  } catch (error) {
    console.error("[Quest migration] Saved progress could not be parsed.", error);
    return { submissions: {} };
  }
}

function selectedBonusIdsFrom(record) {
  const savedBonuses = Array.isArray(record?.selectedBonusIds)
    ? record.selectedBonusIds
    : Array.isArray(record?.selectedBonuses)
      ? record.selectedBonuses.map((bonus) => typeof bonus === "string" ? bonus : bonus?.id)
      : [];

  return [...new Set(savedBonuses
    .filter(Boolean)
    .map((bonusId) => LEGACY_BONUS_ID_MAP[bonusId] || bonusId))];
}

function migrateSavedCollection(collection, collectionName, migration) {
  const migrated = {};
  const entries = Object.entries(collection || {}).sort(([left], [right]) => {
    if (left === "25") return -1;
    if (right === "25") return 1;
    return 0;
  });

  entries.forEach(([savedId, record]) => {
    if (!record || typeof record !== "object") return;

    const questId = window.QUESTS[savedId]
      ? savedId
      : LEGACY_QUEST_ID_MAP[savedId];

    if (!questId || !window.QUESTS[questId]) {
      console.warn(`[Quest migration] Could not safely map ${collectionName} quest ID: ${savedId}`);
      migration.unmapped[collectionName][savedId] = record;
      return;
    }

    if (migrated[questId]) {
      console.warn(
        `[Quest migration] ${collectionName} IDs ${savedId} and another legacy quest both map to ${questId}; the extra record was retained as unmapped data.`
      );
      migration.unmapped[collectionName][savedId] = record;
      return;
    }

    const selectedBonusIds = selectedBonusIdsFrom(record);
    migrated[questId] = {
      ...record,
      questId,
      selectedBonusIds
    };
    delete migrated[questId].selectedBonuses;
  });

  return migrated;
}

function migrateSavedState(savedState) {
  const migration = {
    version: QUEST_DATA_MIGRATION_VERSION,
    completedAt: new Date().toISOString(),
    unmapped: {
      submissions: {},
      drafts: {}
    }
  };

  const migratedState = {
    ...savedState,
    submissions: migrateSavedCollection(savedState.submissions, "submissions", migration),
    drafts: migrateSavedCollection(savedState.drafts, "drafts", migration),
    questDataMigrationVersion: QUEST_DATA_MIGRATION_VERSION,
    questDataMigration: migration
  };

  return migratedState;
}

let state = loadStoredState();
if (state.questDataMigrationVersion !== QUEST_DATA_MIGRATION_VERSION) {
  state = migrateSavedState(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("[Quest migration] Migrated progress could not be persisted.", error);
  }
}
state.submissions ||= {};
state.drafts ||= {};
Object.values(state.submissions).forEach((submission) => {
  if (submission && typeof submission === "object" && typeof submission.completed !== "boolean") {
    submission.completed = true;
  }
});
let activeQuest = null;
let activeMediaId = null;
let activeMediaBlob = null;
let activeMediaType = null;
let activePreviewUrl = "";
let mediaPreviewRequest = 0;
let friendCount = 0;
let selectedBonusIds = [];
let finalScoreResizeObserver = null;
let saveInProgress = false;
let sheetTrigger = null;

const ranks = [
  { min: 0, max: 29, title: "Summer Rookie", blurb: "Every adventure starts somewhere.", next: 30 },
  { min: 30, max: 59, title: "Neighborhood Explorer", blurb: "Your summer is officially in full swing.", next: 60 },
  { min: 60, max: 89, title: "City Adventurer", blurb: "You're seeing more of NYC than most locals do.", next: 90 },
  { min: 90, max: 119, title: "NYC Insider", blurb: "You've earned serious local bragging rights.", next: 120 },
  { min: 120, max: Infinity, title: "Summer Legend", blurb: "You've conquered our New York summer.", next: null }
];

const els = {
  grid: document.querySelector("#questGrid"),
  score: document.querySelector("#score"),
  rankTitle: document.querySelector("#rankTitle"),
  rankBlurb: document.querySelector("#rankBlurb"),
  progressFill: document.querySelector("#progressFill"),
  completedCount: document.querySelector("#completedCount"),
  nextRankText: document.querySelector("#nextRankText"),
  board: document.querySelector("#questBoard"),
  briefing: document.querySelector("#briefing"),
  briefingToggle: document.querySelector("#briefingToggle"),
  briefingBody: document.querySelector("#briefingBody"),
  backdrop: document.querySelector("#sheetBackdrop"),
  modalWrapper: document.querySelector("#questModalWrapper"),
  sheet: document.querySelector("#questSheet"),
  close: document.querySelector("#closeSheet"),
  content: document.querySelector("#questContent"),
  previousQuest: document.querySelector("#previousQuest"),
  nextQuest: document.querySelector("#nextQuest"),
  desktopPreviousQuest: document.querySelector("#desktopPreviousQuest"),
  desktopNextQuest: document.querySelector("#desktopNextQuest"),
  questPosition: document.querySelector("#questPosition"),
  announcement: document.querySelector("#questAnnouncement"),
  questNumber: document.querySelector("#sheetQuestNumber"),
  category: document.querySelector("#sheetCategory"),
  questIcon: document.querySelector("#sheetQuestIcon"),
  completedStamp: document.querySelector("#completedStamp"),
  title: document.querySelector("#sheetTitle"),
  desc: document.querySelector("#sheetDescription"),
  form: document.querySelector("#questForm"),
  standardFields: document.querySelector("#standardQuestFields"),
  finalFlow: document.querySelector("#finalQuestFlow"),
  missionCodeSection: document.querySelector("#missionCodeSection"),
  missionCodeInput: document.querySelector("#missionCodeInput"),
  missionCodeError: document.querySelector("#missionCodeError"),
  unlockFinalChallenge: document.querySelector("#unlockFinalChallenge"),
  finalGateQuestion: document.querySelector("#finalGateQuestion"),
  finalResults: document.querySelector("#finalResults"),
  mediaInput: document.querySelector("#mediaInput"),
  mediaPreview: document.querySelector("#mediaPreview"),
  friendsField: document.querySelector("#friendsField"),
  questDetailsRow: document.querySelector("#questDetailsRow"),
  location: document.querySelector("#locationInput"),
  caption: document.querySelector("#captionInput"),
  bonusField: document.querySelector("#bonusField"),
  friendCount: document.querySelector("#friendCount"),
  incrementFriends: document.querySelector("#incrementFriends"),
  decrementFriends: document.querySelector("#decrementFriends"),
  rewardTitle: document.querySelector("#rewardTitle"),
  rewardRows: document.querySelector("#rewardRows"),
  rewardPreview: document.querySelector(".reward-preview"),
  saveQuest: document.querySelector("#saveQuest"),
  remove: document.querySelector("#removeQuest"),
  viewBoard: document.querySelector("#viewBoardBtn"),
  saveBoard: document.querySelector("#saveBoardBtn"),
  resetBoard: document.querySelector("#resetBoard"),
};

const storyIcons = {
  location: "location_on",
  completed: "flag",
  friends: "groups",
  bonuses: "auto_awesome"
};

function questIllustrationPath(questId) {
  return window.QUEST_ILLUSTRATIONS[questId] || "";
}

function questVisualMarkup(quest) {
  const illustration = questIllustrationPath(quest.id);
  if (illustration) {
    return `<img class="quest-illustration" src="${illustration}" alt="" aria-hidden="true" />`;
  }
  return `<span class="quest-illustration quest-symbol material-symbols-outlined" aria-hidden="true">${quest.icon}</span>`;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function mediaRecordsInState() {
  const collections = [
    state.submissions,
    state.drafts,
    state.questDataMigration?.unmapped?.submissions,
    state.questDataMigration?.unmapped?.drafts
  ];
  return collections.flatMap(collection => Object.values(collection || {}))
    .filter(record => record && typeof record === "object");
}

function referencedMediaIds() {
  const ids = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.mediaId === "string" && value.mediaId) ids.add(value.mediaId);
    Object.values(value).forEach(visit);
  };
  visit(state);
  return ids;
}

async function migrateLegacyMediaState() {
  const legacyRecords = mediaRecordsInState()
    .filter(record => typeof record.dataUrl === "string" && record.dataUrl.startsWith("data:"));

  for (const record of legacyRecords) {
    const blob = mediaStore.dataUrlToBlob(record.dataUrl);
    const mediaId = record.mediaId || mediaStore.createMediaId();
    await mediaStore.put(mediaId, blob);
    record.mediaId = mediaId;
    record.mediaType = record.mediaType || blob.type || "application/octet-stream";
    delete record.dataUrl;
  }

  if (legacyRecords.length || state.mediaMigrationVersion !== MEDIA_MIGRATION_VERSION) {
    state.mediaMigrationVersion = MEDIA_MIGRATION_VERSION;
    save();
  }
}

function mediaErrorMessage(error, action = "save") {
  if (error?.code === "indexeddb-unavailable") {
    return "Photo storage isn't available in this browser. Try a current browser with private browsing turned off.";
  }
  if (error?.code === "compression-failure") {
    return "We couldn't prepare that image. Please choose a different photo and try again.";
  }
  if (action === "load") {
    return "We couldn't load this photo from device storage. It may have been removed by the browser.";
  }
  if (action === "reset") {
    return "We couldn't fully reset photos stored on this device. Close other Summer Quest tabs and try again.";
  }
  if (action === "remove") {
    return "The memory was removed, but its photo could not be fully cleared from device storage. We'll try again next time.";
  }
  return "We couldn't save this photo on your device. Free up some browser storage and try again.";
}

function reportMediaError(error, action = "save") {
  console.error(`[Media storage] ${action} failed.`, error);
  window.alert(mediaErrorMessage(error, action));
}

function completedSubmission(questId) {
  const submission = state.submissions[questId];
  return submission?.completed === true ? submission : null;
}

function questIsCompleted(questId) {
  return Boolean(completedSubmission(questId));
}

function questPoints(submission) {
  if (!submission) return 0;
  if (Number.isFinite(submission.earnedPoints)) {
    return submission.earnedPoints;
  }

  const basePoints = submission.basePoints ?? 5;

  const friendPoints =
    Math.min(
      MAX_FRIENDS,
      Math.max(0, Number(submission.friends) || 0)
    ) * 2;

  const bonusPoints = selectedBonusIdsFrom(submission).length * BONUS_POINTS;

  return basePoints + friendPoints + bonusPoints;
}

function getTotals() {
  const submissions = window.BOARD_ORDER
    .map((questId) => state.submissions[questId])
    .filter((submission) => submission?.completed === true);

  return {
    score: submissions.reduce(
      (total, submission) => total + questPoints(submission),
      0
    ),

    completed: submissions.length,

    friendPoints: submissions.reduce((total, submission) => {
      const friends = Math.min(
        MAX_FRIENDS,
        Math.max(0, Number(submission.friends) || 0)
      );

      return total + friends * 2;
    }, 0),

    bonusCount: submissions.reduce(
      (total, submission) =>
        total +
        selectedBonusIdsFrom(submission).length,
      0
    )
  };
}

function currentRank(score) {
  return ranks.find(r => score >= r.min && score <= r.max) || ranks[0];
}

function finalQuestCompleted() {
  return questIsCompleted(FINAL_QUEST_ID);
}

function renderBoardActions() {
  els.viewBoard.disabled = false;
  els.saveBoard.disabled = false;
}

function renderProgress() {
  const { score, completed } = getTotals();
  const rank = currentRank(score);
  els.score.textContent = score;
  els.rankTitle.textContent = rank.title;
  els.rankBlurb.textContent = rank.blurb;
  els.completedCount.textContent = `${completed} / ${window.BOARD_ORDER.length} completed`;

  if (!rank.next) {
    els.progressFill.style.width = "100%";
    els.nextRankText.textContent = "Top rank reached";
  } else {
    const span = rank.next - rank.min;
    const progress = ((score - rank.min) / span) * 100;
    els.progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
    els.nextRankText.textContent = `${rank.next - score} pts to next rank`;
  }
}

function rewardValue(earned, maximum, total = false) {
  return `
    <span class="${total ? "reward-total-earned" : "reward-earned"}">${earned}</span>
    <span class="reward-maximum">/${maximum}</span>
  `;
}

function renderRewardPreview() {
  if (!activeQuest) return;

  const savedSubmission = completedSubmission(activeQuest.id);
  const includesFriends = !isFinalQuest(activeQuest);

  const baseMaximum =
    savedSubmission?.basePoints ??
    activeQuest.basePoints ??
    5;

  const basePoints =
    savedSubmission || activeMediaId
      ? baseMaximum
      : 0;

  const friendPoints =
    includesFriends
      ? Math.min(
        MAX_FRIENDS,
        Math.max(0, friendCount)
      ) * 2
      : 0;

  const questBonuses = Array.isArray(activeQuest.bonuses)
    ? activeQuest.bonuses
    : [];

  const bonusMaximum = questBonuses.reduce(
    (total) => total + BONUS_POINTS,
    0
  );

  const bonusEarned = questBonuses.reduce(
    (total, bonus) =>
      selectedBonusIds.includes(bonus.id)
        ? total + BONUS_POINTS
        : total,
    0
  );

  const maximumPoints =
    baseMaximum +
    (includesFriends ? MAX_FRIENDS * 2 : 0) +
    bonusMaximum;

  const currentPoints =
    basePoints +
    friendPoints +
    bonusEarned;

  const details = [
    `<span><b>Base</b> ${rewardValue(basePoints, baseMaximum)}</span>`
  ];

  if (includesFriends) {
    details.push(
      `<span><b>Friends</b> ${rewardValue(friendPoints, MAX_FRIENDS * 2)}</span>`
    );
  }

  if (questBonuses.length > 0) {
    details.push(
      `<span><b>Bonus</b> ${rewardValue(bonusEarned, bonusMaximum)}</span>`
    );
  }

  els.rewardTitle.textContent = "Rewards";

  els.rewardRows.innerHTML = `
    <div class="reward-total-line">
      ${rewardValue(currentPoints, maximumPoints, true)}
    </div>

    <div class="reward-detail-line">
      ${details.join('<span class="reward-separator">•</span>')}
    </div>
  `;
}

function renderFriendControls() {
  els.friendCount.textContent = friendCount;
  els.decrementFriends.disabled = friendCount <= 0;
  els.incrementFriends.disabled = friendCount >= MAX_FRIENDS;
  renderRewardPreview();
}

function renderBonusOptions() {
  const bonuses = Array.isArray(activeQuest?.bonuses)
    ? activeQuest.bonuses
    : [];

  els.bonusField.hidden = bonuses.length === 0;

  if (bonuses.length === 0) {
    els.bonusField.innerHTML = "";
    return;
  }

  els.bonusField.innerHTML = bonuses.map((bonus) => `
    <label class="bonus-option">
      <input
        type="checkbox"
        class="bonus-option-input"
        value="${bonus.id}"
        ${selectedBonusIds.includes(bonus.id) ? "checked" : ""}
      />

      <span class="bonus-option-content">
          <span class="bonus-pill">BONUS</span>
          <span class="bonus-option-label">${bonus.label}</span>
      </span>
    </label>
  `).join("");
}

function normalizeFinalAnswer(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function finalAnswerIsCorrect(answer, acceptedAnswers = []) {
  const normalizedAnswer = normalizeFinalAnswer(answer);
  return acceptedAnswers.some(candidate => normalizeFinalAnswer(candidate) === normalizedAnswer);
}

function finalGateQuestionFor(quest) {
  return (quest?.triviaQuestions || []).find(
    question => /how many days apart/i.test(question.prompt)
  ) || quest?.triviaQuestions?.[0];
}

function escapeStoryText(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function renderStoryMarkup(template, values = {}) {
  if (typeof template !== "string" || !template.trim()) return "";

  const populated = template.replace(/\{([a-zA-Z][\w]*)\}/g, (placeholder, key) => {
    const value = String(values[key] ?? "").trim();
    return value ? escapeStoryText(value) : placeholder;
  });
  if (/\{[^{}]+\}/.test(populated)) return "";

  const source = document.createElement("template");
  source.innerHTML = populated;

  const serializeAllowedMarkup = (node) => {
    if (node.nodeType === 3) return escapeStoryText(node.textContent || "");
    const children = Array.from(node.childNodes).map(serializeAllowedMarkup).join("");
    return node.nodeName === "STRONG" ? `<strong>${children}</strong>` : children;
  };

  return Array.from(source.content.childNodes).map(serializeAllowedMarkup).join("").trim();
}

function storyTextContent(markup) {
  const wrapper = document.createElement("div");
  wrapper.innerHTML = markup;
  return wrapper.textContent.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

function completedStandardQuestEntries() {
  return orderedQuests()
    .filter((quest) => !isFinalQuest(quest))
    .map((quest) => ({
      quest,
      submission: completedSubmission(quest.id)
    }))
    .filter((entry) => Boolean(entry.submission));
}

function questStoryCandidate(entry) {
  const quest = window.QUESTS[entry.quest.id];
  if (!quest) return null;

  const location = String(entry.submission.location || "").trim();
  const hasLocationToken = quest.story.includes("{locationSentence}");
  const locationSentence = hasLocationToken && location
    ? ` at <strong>${escapeStoryText(location)}</strong>`
    : "";
  const baseHtml = renderStoryMarkup(
    quest.story.replaceAll("{locationSentence}", locationSentence)
  );
  if (!baseHtml) return null;

  const reflectionHtml = renderStoryMarkup(quest.reflection);
  const earnedBonusIds = new Set(selectedBonusIdsFrom(entry.submission));
  const bonusHtml = quest.bonuses
    .filter((bonus) => earnedBonusIds.has(bonus.id))
    .map((bonus) => renderStoryMarkup(quest.bonusMemories[bonus.id]))
    .filter(Boolean);

  return {
    html: [baseHtml, reflectionHtml, ...bonusHtml].filter(Boolean).join(" "),
    kind: hasLocationToken && location ? "location" : null,
    completedAt: entry.submission.completedAt || ""
  };
}

function storyIconName(story) {
  return storyIcons[story.kind] || "";
}

function buildSummerStory() {
  const completedEntries = completedStandardQuestEntries();

  const questStories = completedEntries
    .map(questStoryCandidate)
    .filter(Boolean);

  const totalFriendJoins = completedEntries.reduce(
    (total, { submission }) => {
      const count = Number(submission.friends);

      return total + (
        Number.isFinite(count)
          ? Math.max(0, Math.trunc(count))
          : 0
      );
    },
    0
  );

  const bonusCount = completedEntries.filter(
    ({ submission }) => selectedBonusIdsFrom(submission).length > 0
  ).length;

  const aggregateStories = [];

  if (totalFriendJoins > 0) {
    const friendTemplate = totalFriendJoins === 1
      ? "<strong>{friendCount}</strong> person joined your adventures across NYC."
      : "<strong>{friendCount}</strong> people joined your adventures across NYC.";

    const html = renderStoryMarkup(friendTemplate, {
      friendCount: totalFriendJoins
    });

    if (html) {
      aggregateStories.push({
        html,
        kind: "friends"
      });
    }
  }

  if (bonusCount > 0) {
    const bonusTemplate = bonusCount === 1
      ? "You went above and beyond for <strong>{bonusCount}</strong> quest."
      : "You went above and beyond for <strong>{bonusCount}</strong> quests.";

    const html = renderStoryMarkup(bonusTemplate, {
      bonusCount
    });

    if (html) {
      aggregateStories.push({
        html,
        kind: "bonuses"
      });
    }
  }

  return [
    ...questStories,
    ...aggregateStories
  ];
}

function buildFinalSummary() {
  const completedEntries = completedStandardQuestEntries();

  const completedCount =
    completedEntries.length + (finalQuestCompleted() ? 1 : 0);

  const friendCount = completedEntries.reduce(
    (total, { submission }) =>
      total + Math.max(0, Math.trunc(Number(submission.friends) || 0)),
    0
  );

  const bonusCount = completedEntries.reduce(
    (total, { submission }) =>
      total +
      (
        selectedBonusIdsFrom(submission).length
      ),
    0
  );

  const summary = [
    {
      kind: "completed",
      html: `One adventure at a time, you completed <strong>${completedCount} NYC ${completedCount === 1 ? "quest" : "quests"}</strong>.`
    }
  ];

  if (friendCount === 1) {
    summary.push({
      kind: "friends",
      html: "Along the way, <strong>1 person</strong> joined your adventures."
    });
  } else if (friendCount > 1) {
    summary.push({
      kind: "friends",
      html: `Along the way, <strong>${friendCount} people</strong> joined your adventures.`
    });
  }

  if (bonusCount === 1) {
    summary.push({
      kind: "bonuses",
      html: `You even unlocked <strong>1 bonus memory</strong> along the way.`
    });
  } else if (bonusCount > 1) {
    summary.push({
      kind: "bonuses",
      html: `You even unlocked <strong>${bonusCount} bonus memories</strong> along the way.`
    });
  }

  const baseStories = completedEntries
    .map((entry) => questStoryCandidate(entry))
    .filter(Boolean);

  const featuredCount = Math.min(2, baseStories.length);

  return [
    ...summary,
    ...baseStories.slice(0, featuredCount)
  ];
}

function syncFinalScoreToRank() {
  const scoreValue = els.finalResults.querySelector(".adventure-score-value");
  const rankCopy = els.finalResults.querySelector(".adventure-rank-copy");
  if (!scoreValue || !rankCopy) return;

  const rankHeight = rankCopy.getBoundingClientRect().height;
  if (!rankHeight) return;

  const matchedHeight = `${Math.round(rankHeight * 100) / 100}px`;
  scoreValue.style.setProperty("--final-score-height", matchedHeight);
  scoreValue.style.setProperty("--final-score-font-size", matchedHeight);
}

function startFinalScoreSync() {
  finalScoreResizeObserver?.disconnect();
  finalScoreResizeObserver = null;

  const rankCopy = els.finalResults.querySelector(".adventure-rank-copy");
  if (!rankCopy) return;

  requestAnimationFrame(syncFinalScoreToRank);
  document.fonts?.ready.then(syncFinalScoreToRank);

  if ("ResizeObserver" in window) {
    finalScoreResizeObserver = new ResizeObserver(syncFinalScoreToRank);
    finalScoreResizeObserver.observe(rankCopy);
  }
}

function renderFinalResults() {
  const { score } = getTotals();
  const rank = currentRank(score);
  const stories = buildFinalSummary();

  els.finalResults.innerHTML = `
    <div class="adventure-complete-page">
      <header class="adventure-complete-header">
        <img class="adventure-complete-stamp" src="assets/illustrations/overlays/completed-stamp-256.png" alt="Completed" />
        <h3>Adventure Complete!</h3>
      </header>

      <section class="adventure-results-row" aria-label="Final results">
        <div class="adventure-result adventure-final-score">
          <p class="label">Score</p>
          <p class="adventure-score-value">${score}</p>
        </div>
        <div class="adventure-result adventure-final-rank">
          <p class="label">Rank</p>
          <div class="adventure-rank-copy">
            <h4 class="adventure-rank-value">${rank.title}</h4>
            <p class="adventure-rank-description">${rank.blurb}</p>
          </div>
        </div>
      </section>

      <section class="adventure-story">
        <div class="adventure-story-lines">
          ${stories.map(story => `
            <div class="adventure-story-line">
              <span class="material-symbols-rounded adventure-story-icon" aria-hidden="true">
  ${storyIconName(story) || "auto_awesome"}
</span>

<p>${story.html}</p>
            </div>
          `).join("")}
        </div>
      </section>

      <p class="adventure-closing"><strong>Thanks for celebrating with us and making this birthday unforgettable.</strong></p>

      <div class="adventure-complete-actions">
        <button class="primary-button" type="button" data-final-action="review-memories"> VIEW YOUR SUMMER STORY
        </button>
        <button class="adventure-text-button" type="button" data-final-action="view-board"> BACK TO BOARD
        </button>
      </div>
    </div>
  `;
  startFinalScoreSync();
}

function renderFinalQuest(quest, existing, draft) {
  const unlocked = Boolean(existing || draft?.finalUnlocked);
  const gateQuestion = finalGateQuestionFor(quest);

  els.missionCodeInput.value = draft?.gateAnswer || "";
  els.finalGateQuestion.textContent = gateQuestion?.prompt || "How many days apart are their birthdays?";
  els.missionCodeError.hidden = true;
  els.missionCodeInput.removeAttribute("aria-invalid");

  if (existing) {
    els.standardFields.hidden = true;
    els.finalFlow.hidden = false;
    els.missionCodeSection.hidden = true;
    els.finalResults.hidden = false;
    els.form.classList.add("final-quest-mode", "final-complete-mode");
    els.form.classList.remove("final-gate-mode");
    els.saveQuest.hidden = true;
    els.remove.hidden = true;
    renderFinalResults();
    return;
  }

  if (unlocked) {
    renderStandardQuest(null, true);
    return;
  }

  finalScoreResizeObserver?.disconnect();
  finalScoreResizeObserver = null;
  els.standardFields.hidden = true;
  els.finalFlow.hidden = false;
  els.missionCodeSection.hidden = false;
  els.finalResults.hidden = true;
  els.form.classList.add("final-gate-mode");
  els.form.classList.remove("final-quest-mode", "final-complete-mode");
  els.title.textContent = "Final Quest Locked";
  els.desc.textContent = "Answer the birthday trivia question to unlock the final mission.";
  els.questIcon.hidden = true;
  els.saveQuest.hidden = true;
  els.remove.hidden = true;
}

function renderStandardQuest(existing, finalQuest = false) {
  finalScoreResizeObserver?.disconnect();
  finalScoreResizeObserver = null;
  els.standardFields.hidden = false;
  els.finalFlow.hidden = true;
  els.friendsField.hidden = finalQuest;
  els.questDetailsRow.classList.toggle("no-friends", finalQuest);
  els.form.classList.toggle("final-quest-mode", finalQuest);
  els.form.classList.remove("final-gate-mode", "final-complete-mode");
  els.saveQuest.textContent = finalQuest ? "Submit Final Quest" : "Save Memory";
  els.saveQuest.disabled = false;
  els.saveQuest.hidden = false;
  els.remove.hidden = finalQuest || !existing;
}

function orderedQuests() {
  return boardItems;
}

function renderQuestTitle(title) {
  return title
    .split(/\s+/)
    .map(word => `<span class="quest-title-word">${word}</span>`)
    .join("");
}

function renderGrid() {
  els.grid.innerHTML = "";
  const quests = orderedQuests();

  quests.forEach((quest) => {
    const completed = questIsCompleted(quest.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "quest-card",
      `board-square--${quest.boardColor}`,
      isFinalQuest(quest) ? "final-quest-card" : ""
    ].filter(Boolean).join(" ");
    button.dataset.questId = String(quest.id);
    button.setAttribute("aria-label", completed ? `${quest.title}, completed` : quest.title);

    button.innerHTML = `
      <span class="quest-card__visual ${completed ? "is-completed" : "is-open"}">
        <span class="quest-completed-badge material-symbols-outlined" aria-hidden="true">check_small</span>
        <span class="quest-card-content">
          ${questVisualMarkup(quest)}
          <span class="quest-title">${renderQuestTitle(quest.title)}</span>
        </span>
      </span>
    `;
    button.addEventListener("click", () => openSheet(quest));
    els.grid.appendChild(button);
  });
}

function setBriefingCollapsed(isCollapsed) {
  els.briefing.classList.toggle("collapsed", isCollapsed);
  els.briefingToggle.setAttribute("aria-expanded", String(!isCollapsed));
  try {
    localStorage.setItem(BRIEFING_STATE_KEY, String(isCollapsed));
  } catch (error) {
    console.warn("[Quest state] Briefing preference could not be saved.", error);
  }
}

function initBriefing() {
  if (getTotals().completed > 0) {
    els.board.insertAdjacentElement("afterend", els.briefing);
    setBriefingCollapsed(true);
  } else {
    // Always start expanded until they complete their first quest.
    setBriefingCollapsed(false);
  }
}

function updateBriefingPlacement() {
  if (getTotals().completed > 0) {
    els.board.insertAdjacentElement("afterend", els.briefing);
    setBriefingCollapsed(true);
  }
}

function captureDraft() {
  if (!activeQuest || els.sheet.hidden) return false;
  const finalQuest = isFinalQuest(activeQuest);
  const finalUnlocked = Boolean(state.drafts[activeQuest.id]?.finalUnlocked);
  const previousDraft = state.drafts[activeQuest.id];
  const restorePreviousDraft = () => {
    if (previousDraft) state.drafts[activeQuest.id] = previousDraft;
    else delete state.drafts[activeQuest.id];
  };

  if (finalQuest && !finalUnlocked) {
    if (questIsCompleted(activeQuest.id)) return false;
    state.drafts[activeQuest.id] = {
      ...state.drafts[activeQuest.id],
      questId: activeQuest.id,
      finalUnlocked: false,
      gateAnswer: els.missionCodeInput.value
    };
    try {
      save();
      return true;
    } catch (error) {
      restorePreviousDraft();
      console.warn("[Quest drafts] Final Quest draft could not be saved.", error);
      return false;
    }
  }
  state.drafts[activeQuest.id] = {
    questId: activeQuest.id,
    mediaId: activeMediaId,
    mediaType: activeMediaType || completedSubmission(activeQuest.id)?.mediaType || null,
    friends: finalQuest ? 0 : friendCount,
    location: els.location.value,
    caption: els.caption.value,
    selectedBonusIds: [...selectedBonusIds],
    ...(finalQuest ? {
      finalUnlocked: true,
      gateAnswer: state.drafts[activeQuest.id]?.gateAnswer || els.missionCodeInput.value
    } : {})
  };
  try {
    save();
    return true;
  } catch (error) {
    restorePreviousDraft();
    console.warn("[Quest drafts] Draft metadata could not be saved.", error);
    return false;
  }
}

function renderQuest(quest, announce = false) {
  activeQuest = quest;
  const existing = completedSubmission(quest.id);
  const draft = state.drafts[quest.id] || existing;
  activeMediaId = draft?.mediaId || null;
  activeMediaBlob = null;
  activeMediaType = draft?.mediaType || null;
  friendCount = Math.min(MAX_FRIENDS, Math.max(0, draft?.friends || 0));
  selectedBonusIds = selectedBonusIdsFrom(draft);
  const meta = window.QUEST_CATEGORIES[quest.category];
  const quests = orderedQuests();
  const questIndex = quests.findIndex(item => item.id === quest.id);

  els.questNumber.textContent = isFinalQuest(quest) ? "Final Quest" : `Quest ${quest.boardNumber}`;
  els.category.textContent = meta.label;
  els.category.className = `category-pill ${meta.className}`;
  els.category.hidden = isFinalQuest(quest);
  const modalIllustration = questIllustrationPath(quest.id);
  els.questIcon.src = modalIllustration;
  els.questIcon.hidden = !modalIllustration;
  els.completedStamp.hidden = !existing;
  els.title.textContent = quest.title;
  els.desc.textContent = quest.description;
  els.previousQuest.disabled = questIndex === 0;
  els.nextQuest.disabled = questIndex === quests.length - 1;
  els.desktopPreviousQuest.disabled = questIndex === 0;
  els.desktopNextQuest.disabled = questIndex === quests.length - 1;
  els.desktopPreviousQuest.hidden = Boolean(isFinalQuest(quest) && existing);
  els.desktopNextQuest.hidden = Boolean(isFinalQuest(quest) && existing);
  els.questPosition.textContent = `Quest ${questIndex + 1} of ${quests.length}`;

  if (isFinalQuest(quest)) {
    renderFinalQuest(quest, existing, draft);
    renderMediaPreview(null, null);
    if (!existing && draft?.finalUnlocked) {
      renderFriendControls();
      els.location.value = draft?.location || "";
      els.caption.value = draft?.caption || "";
      renderBonusOptions();
      loadMediaPreviewForRecord(draft, quest.id);
    }
  } else {
    renderStandardQuest(existing, false);
    renderFriendControls();
    els.location.value = draft?.location || "";
    els.caption.value = draft?.caption || "";
    renderBonusOptions();
    renderMediaPreview(null, null);
    loadMediaPreviewForRecord(draft, quest.id);
  }
  els.form.scrollTop = 0;
  if (announce) els.announcement.textContent = `${quest.title} opened`;
}

function openSheet(quest) {
  sheetTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  renderQuest(quest);
  els.backdrop.hidden = false;
  els.modalWrapper.hidden = false;
  els.sheet.hidden = false;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => els.close.focus());
}

function closeSheet(preserveDraft = true) {
  if (saveInProgress) return;
  const focusTarget = sheetTrigger;
  sheetTrigger = null;
  if (preserveDraft) captureDraft();
  mediaPreviewRequest += 1;
  renderMediaPreview(null, null);
  els.sheet.hidden = true;
  els.modalWrapper.hidden = true;
  els.backdrop.hidden = true;
  document.body.classList.remove("sheet-open");
  els.mediaInput.value = "";
  focusTarget?.focus({ preventScroll: true });
}

function navigateQuest(offset) {
  if (saveInProgress) return;
  const quests = orderedQuests();
  const currentIndex = quests.findIndex(quest => quest.id === activeQuest?.id);
  const target = quests[currentIndex + offset];
  if (!target || els.content.classList.contains("is-transitioning")) return;
  captureDraft();
  const direction = offset > 0 ? "next" : "previous";
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion) {
    renderQuest(target, true);
    return;
  }
  els.content.classList.add("is-transitioning", `quest-exit-${direction}`);
  window.setTimeout(() => {
    renderQuest(target, true);
    els.content.className = `quest-content is-transitioning quest-enter-${direction}`;
    const finishTransition = () => {
      els.content.className = "quest-content";
    };
    requestAnimationFrame(() => requestAnimationFrame(() => {
      finishTransition();
    }));
    window.setTimeout(finishTransition, 200);
  }, 130);
}

function renderMediaPreview(blob, mediaType) {
  if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
  activePreviewUrl = "";
  els.mediaPreview.innerHTML = "";
  if (!blob) {
    els.mediaPreview.hidden = true;
    delete els.mediaPreview.dataset.mediaType;
    return;
  }
  els.mediaPreview.hidden = false;
  if (mediaType) els.mediaPreview.dataset.mediaType = mediaType;
  const media = document.createElement(mediaType?.startsWith("video/") ? "video" : "img");
  activePreviewUrl = URL.createObjectURL(blob);
  media.src = activePreviewUrl;
  if (media.tagName === "VIDEO") media.controls = true;
  els.mediaPreview.appendChild(media);
}

async function loadMediaPreviewForRecord(record, questId) {
  const requestId = ++mediaPreviewRequest;
  if (!record?.mediaId && !record?.dataUrl) return;

  try {
    const blob = await mediaStore.blobFor(record);
    if (!blob) {
      const error = new Error("The media record is missing from IndexedDB.");
      error.code = "storage-failure";
      throw error;
    }
    if (requestId !== mediaPreviewRequest || activeQuest?.id !== questId) return;
    activeMediaBlob = blob;
    activeMediaType = record.mediaType || blob.type;
    renderMediaPreview(blob, activeMediaType);
  } catch (error) {
    if (requestId !== mediaPreviewRequest || activeQuest?.id !== questId) return;
    reportMediaError(error, "load");
  }
}

els.mediaInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const selectionRequest = ++mediaPreviewRequest;
  const questId = activeQuest?.id;
  const existingMediaId = completedSubmission(questId)?.mediaId || null;
  const priorDraftMediaId = state.drafts[questId]?.mediaId || null;
  const previousMediaRecord = state.drafts[questId] || completedSubmission(questId);
  let newMediaId = null;

  try {
    const blob = file.type.startsWith("image/") ? await mediaStore.compressImage(file) : file;
    const mediaId = mediaStore.createMediaId();
    newMediaId = mediaId;
    await mediaStore.put(mediaId, blob);
    if (selectionRequest !== mediaPreviewRequest || activeQuest?.id !== questId) {
      await mediaStore.remove(mediaId);
      return;
    }

    activeMediaId = mediaId;
    activeMediaBlob = blob;
    activeMediaType = blob.type || file.type;
    renderMediaPreview(blob, activeMediaType);
    renderRewardPreview();
    const draftSaved = captureDraft();

    if (!draftSaved) {
      activeMediaId = previousMediaRecord?.mediaId || null;
      activeMediaBlob = null;
      activeMediaType = previousMediaRecord?.mediaType || null;
      await mediaStore.remove(mediaId);
      if (previousMediaRecord?.mediaId || previousMediaRecord?.dataUrl) {
        await loadMediaPreviewForRecord(previousMediaRecord, questId);
      } else {
        renderMediaPreview(null, null);
      }
      window.alert("We couldn't save this photo draft on your device. Check browser storage access and try again.");
      els.mediaInput.value = "";
      return;
    }

    if (draftSaved && priorDraftMediaId && priorDraftMediaId !== existingMediaId && priorDraftMediaId !== mediaId) {
      try {
        await mediaStore.remove(priorDraftMediaId);
      } catch (error) {
        console.warn("[Media storage] Replaced draft cleanup will be retried on startup.", error);
      }
    }
  } catch (error) {
    if (newMediaId && newMediaId !== activeMediaId) {
      try {
        await mediaStore.remove(newMediaId);
      } catch (cleanupError) {
        console.warn("[Media storage] Failed photo selection cleanup will be retried on startup.", cleanupError);
      }
    }
    reportMediaError(error, error?.code === "compression-failure" ? "compress" : "save");
    els.mediaInput.value = "";
  }
});

els.incrementFriends.addEventListener("click", () => {
  friendCount = Math.min(MAX_FRIENDS, friendCount + 1);
  renderFriendControls();
  captureDraft();
});
els.decrementFriends.addEventListener("click", () => {
  friendCount = Math.max(0, friendCount - 1);
  renderFriendControls();
  captureDraft();
});

els.bonusField.addEventListener("change", (event) => {
  const input = event.target.closest(".bonus-option-input");
  if (!input) return;

  if (input.checked) {
    if (!selectedBonusIds.includes(input.value)) {
      selectedBonusIds.push(input.value);
    }
  } else {
    selectedBonusIds = selectedBonusIds.filter(
      bonusId => bonusId !== input.value
    );
  }
  renderRewardPreview();
  captureDraft();
});
els.rewardPreview.addEventListener("click", () => {
  els.rewardPreview.classList.toggle("expanded");
});
els.location.addEventListener("input", captureDraft);
els.caption.addEventListener("input", captureDraft);
els.missionCodeInput.addEventListener("input", captureDraft);
els.previousQuest.addEventListener("click", () => navigateQuest(-1));
els.nextQuest.addEventListener("click", () => navigateQuest(1));
els.desktopPreviousQuest.addEventListener("click", () => navigateQuest(-1));
els.desktopNextQuest.addEventListener("click", () => navigateQuest(1));

els.briefingToggle.addEventListener("click", () => {
  setBriefingCollapsed(!els.briefing.classList.contains("collapsed"));
});

els.resetBoard.addEventListener("click", async () => {
  const confirmed = window.confirm(
    "Start over and remove all completed quests, photos, and saved progress?"
  );
  if (!confirmed) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BRIEFING_STATE_KEY);
  } catch (error) {
    console.error("[Quest state] Reset metadata failed.", error);
    window.alert("We couldn't reset saved progress in this browser. Check storage access and try again.");
    return;
  }
  try {
    await mediaStore.clearDatabase();
  } catch (error) {
    reportMediaError(error, "reset");
  }
  window.location.reload();
});

function unlockFinalQuest() {
  if (!isFinalQuest(activeQuest) || questIsCompleted(activeQuest.id)) return;
  const gateAnswer = els.missionCodeInput.value;
  const gateQuestion = finalGateQuestionFor(activeQuest);

  if (!finalAnswerIsCorrect(gateAnswer, gateQuestion?.acceptedAnswers)) {
    els.missionCodeError.textContent = "That answer isn't correct.\nPlease try again.";
    els.missionCodeError.hidden = false;
    els.missionCodeInput.setAttribute("aria-invalid", "true");
    els.missionCodeInput.focus();
    return;
  }

  const previousDraft = state.drafts[activeQuest.id] || null;
  state.drafts[activeQuest.id] = {
    ...previousDraft,
    questId: activeQuest.id,
    finalUnlocked: true,
    gateAnswer
  };

  try {
    save();
  } catch (error) {
    if (previousDraft) state.drafts[activeQuest.id] = previousDraft;
    else delete state.drafts[activeQuest.id];
    console.warn("[Quest drafts] Final Quest unlock could not be saved.", error);
    els.missionCodeError.textContent = "We couldn't save the unlock. Please try again.";
    els.missionCodeError.hidden = false;
    return;
  }

  renderQuest(activeQuest);
  els.announcement.textContent = "Final mission unlocked";
}

els.unlockFinalChallenge.addEventListener("click", () => {
  unlockFinalQuest();
});

els.finalResults.addEventListener("click", (event) => {
  const action = event.target.closest("[data-final-action]")?.dataset.finalAction;
  if (!action) return;

  if (action === "view-board") {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeSheet(false);
    requestAnimationFrame(() => {
      els.board.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return;
  }

  if (action === "review-memories") {
    closeSheet(false);
    document.querySelector("#viewBoardBtn")?.click();
  }
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (saveInProgress) return;
  const finalQuest = isFinalQuest(activeQuest);

  if (finalQuest && !state.drafts[activeQuest.id]?.finalUnlocked) {
    unlockFinalQuest();
    return;
  }
  if (finalQuest && questIsCompleted(activeQuest.id)) return;

  if (!activeMediaId) {
    alert("Add a photo or video first.");
    return;
  }
  saveInProgress = true;
  els.saveQuest.disabled = true;
  els.saveQuest.textContent = "Saving…";
  const mediaType = activeMediaType || completedSubmission(activeQuest.id)?.mediaType || "image/jpeg";
  const questId = activeQuest.id;
  const submittedMediaId = activeMediaId;
  const submittedMediaBlob = activeMediaBlob;
  const previousSubmission = state.submissions[questId] || null;
  const previousDraft = state.drafts[questId] || null;
  const nextSubmission = {
    questId: activeQuest.id,
    completed: true,
    mediaId: submittedMediaId,
    mediaType,
    friends: finalQuest ? 0 : friendCount,
    location: els.location.value.trim(),
    caption: els.caption.value.trim(),
    basePoints: activeQuest.basePoints ?? 5,
    selectedBonusIds: (activeQuest.bonuses || [])
      .filter((bonus) => selectedBonusIds.includes(bonus.id))
      .map((bonus) => bonus.id),
    ...(finalQuest ? {
      final: true,
      finalUnlocked: true,
      gateAnswer: previousDraft?.gateAnswer || ""
    } : {}),
    completedAt: new Date().toISOString()
  };

  try {
    const blob = submittedMediaBlob || await mediaStore.get(submittedMediaId);
    if (!blob) throw new Error("The selected media is missing from IndexedDB.");
    await mediaStore.put(submittedMediaId, blob);
    state.submissions[questId] = nextSubmission;
    delete state.drafts[questId];
    save();
  } catch (error) {
    if (previousSubmission) state.submissions[questId] = previousSubmission;
    else delete state.submissions[questId];
    if (previousDraft) state.drafts[questId] = previousDraft;
    reportMediaError(error, "save");
    saveInProgress = false;
    els.saveQuest.disabled = false;
    els.saveQuest.textContent = finalQuest ? "Submit Final Quest" : "Save Memory";
    return;
  }

  const obsoleteMediaIds = new Set([
    previousSubmission?.mediaId,
    previousDraft?.mediaId
  ].filter(mediaId => mediaId && mediaId !== submittedMediaId));
  try {
    await Promise.all(Array.from(obsoleteMediaIds, mediaId => mediaStore.remove(mediaId)));
  } catch (error) {
    console.warn("[Media storage] Obsolete media cleanup will be retried on startup.", error);
  }

  renderGrid();
  renderProgress();
  renderBoardActions();
  renderQuest(activeQuest);
  els.announcement.textContent = `${activeQuest.title} completed. ${questPoints(nextSubmission)} points earned.`;
  saveInProgress = false;
  els.saveQuest.disabled = false;
});

els.remove.addEventListener("click", async () => {
  if (!activeQuest || saveInProgress) return;
  const questId = activeQuest.id;
  const removedSubmission = state.submissions[questId] || null;
  const removedDraft = state.drafts[questId] || null;
  const mediaIds = new Set([
    removedSubmission?.mediaId,
    removedDraft?.mediaId
  ].filter(Boolean));
  delete state.submissions[questId];
  delete state.drafts[questId];
  try {
    save();
  } catch (error) {
    if (removedSubmission) state.submissions[questId] = removedSubmission;
    if (removedDraft) state.drafts[questId] = removedDraft;
    reportMediaError(error, "save");
    return;
  }
  try {
    await Promise.all(Array.from(mediaIds, mediaId => mediaStore.remove(mediaId)));
  } catch (error) {
    reportMediaError(error, "remove");
  }
  renderGrid();
  renderProgress();
  renderBoardActions();
  closeSheet(false);
});

els.close.addEventListener("click", closeSheet);
els.backdrop.addEventListener("click", closeSheet);

document.addEventListener("keydown", (event) => {
  if (els.sheet.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Escape") {
    event.preventDefault();
    closeSheet();
    return;
  }
  if (event.key === "Tab") {
    const focusable = Array.from(els.modalWrapper.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter(element => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!els.modalWrapper.contains(document.activeElement)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
    return;
  }
  const formControl = event.target.closest("input, textarea, select, [contenteditable='true']");
  if (formControl || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  navigateQuest(event.key === "ArrowLeft" ? -1 : 1);
});

let swipe = null;
const swipeExcluded = ".upload-box, .media-preview, input, textarea, .counter, .bonus-field";
els.content.addEventListener("touchstart", (event) => {
  if (event.touches.length !== 1 || event.target.closest(swipeExcluded)) return;
  const touch = event.touches[0];
  swipe = { x: touch.clientX, y: touch.clientY, intent: null };
}, { passive: true });
els.content.addEventListener("touchmove", (event) => {
  if (!swipe) return;
  const touch = event.touches[0];
  const dx = touch.clientX - swipe.x;
  const dy = touch.clientY - swipe.y;
  if (!swipe.intent && Math.max(Math.abs(dx), Math.abs(dy)) > 10) {
    swipe.intent = Math.abs(dx) > Math.abs(dy) * 1.35 ? "horizontal" : "vertical";
  }
  if (swipe.intent === "horizontal") event.preventDefault();
}, { passive: false });
els.content.addEventListener("touchend", (event) => {
  if (!swipe) return;
  const touch = event.changedTouches[0];
  const dx = touch.clientX - swipe.x;
  const dy = touch.clientY - swipe.y;
  if (swipe.intent === "horizontal" && Math.abs(dx) >= 64 && Math.abs(dx) > Math.abs(dy) * 1.35) {
    navigateQuest(dx < 0 ? 1 : -1);
  }
  swipe = null;
}, { passive: true });
els.content.addEventListener("touchcancel", () => { swipe = null; }, { passive: true });

window.addEventListener("pagehide", () => {
  if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
});

async function initializeApp() {
  let mediaReady = true;
  try {
    await migrateLegacyMediaState();
  } catch (error) {
    mediaReady = false;
    reportMediaError(error, "save");
  }

  if (mediaReady) {
    try {
      await mediaStore.removeUnreferenced(referencedMediaIds());
    } catch (error) {
      reportMediaError(error, "save");
    }
  }

  renderGrid();
  renderProgress();
  renderBoardActions();
  initBriefing();
}

initializeApp();
