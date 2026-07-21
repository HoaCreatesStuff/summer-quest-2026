const storyTemplates = window.STORY_TEMPLATES;

const STORAGE_KEY = "nyc-summer-quest-mvp-v1";
const BRIEFING_STATE_KEY = "nyc-summer-quest-briefing-collapsed";
const MAX_FRIENDS = 5;
const state = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{"submissions":{}}');
state.submissions ||= {};
state.drafts ||= {};
Object.values(state.submissions).forEach((submission) => {
  if (submission && typeof submission === "object" && typeof submission.completed !== "boolean") {
    submission.completed = true;
  }
});
let activeQuest = null;
let activeFileData = null;
let friendCount = 0;
let bonusChecked = false;
let finalScoreResizeObserver = null;

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
  finalChallenge: document.querySelector("#finalChallengeSection"),
  finalQuestionOne: document.querySelector("#finalQuestionOne"),
  finalQuestionTwo: document.querySelector("#finalQuestionTwo"),
  finalAnswerOne: document.querySelector("#finalAnswerOne"),
  finalAnswerTwo: document.querySelector("#finalAnswerTwo"),
  finalResults: document.querySelector("#finalResults"),
  mediaInput: document.querySelector("#mediaInput"),
  mediaPreview: document.querySelector("#mediaPreview"),
  location: document.querySelector("#locationInput"),
  caption: document.querySelector("#captionInput"),
  bonusField: document.querySelector("#bonusField"),
  bonusInput: document.querySelector("#bonusInput"),
  bonusLabel: document.querySelector("#bonusLabel"),
  friendCount: document.querySelector("#friendCount"),
  incrementFriends: document.querySelector("#incrementFriends"),
  decrementFriends: document.querySelector("#decrementFriends"),
  rewardTitle: document.querySelector("#rewardTitle"),
  rewardRows: document.querySelector("#rewardRows"),
  saveQuest: document.querySelector("#saveQuest"),
  remove: document.querySelector("#removeQuest"),
  viewBoard: document.querySelector("#viewBoardBtn"),
  saveBoard: document.querySelector("#saveBoardBtn"),
};

const questIllustrations = {
  1: "01-golden-hour",
  2: "12-judgmental-pigeon",
  3: "02-street-fashion",
  4: "03-free-event",
  5: "04-waterfront-wonders",
  6: "13-dance-party",
  7: "19-showtime",
  8: "24-random-kindness",
  9: "08-favorite-art",
  10: "14-diy-craft",
  11: "11-hidden-bookstore",
  12: "15-pup-arazzi",
  13: "07-iconic-skyline",
  14: "09-kindness-notes",
  15: "10-farmers-market",
  16: "16-get-sweaty",
  17: "18-street-mural",
  18: "23-group-stoop",
  19: "17-favorite-hideaway",
  20: "22-cinema-moment",
  21: "05-park-picnic",
  22: "20-birthday-selfie",
  23: "06-animal-statue",
  24: "21-human-pyramid",
  25: "25-celebrate-together"
};

const storyIcons = {
  Q01: "wb_twilight",
  Q02: "self_improvement",
  Q03: "checkroom",
  Q04: "local_activity",
  Q05: "water",
  Q06: "music_note",
  Q07: "music_note",
  Q08: "volunteer_activism",
  Q09: "palette",
  Q10: "brush",
  Q11: "menu_book",
  Q12: "pets",
  Q13: "landscape",
  Q14: "sticky_note_2",
  Q15: "grocery",
  Q16: "fitness_center",
  Q17: "music_note",
  Q18: "groups",
  Q19: "favorite",
  Q20: "movie",
  Q21: "park",
  Q22: "photo_camera",
  Q23: "restaurant",
  Q24: "explore",
  friends: "groups",
  bonuses: "workspace_premium",
  caption: "format_quote"
};

function questIllustrationPath(quest, compact = false) {
  const illustration = questIllustrations[quest.id];
  if (!illustration) return "";
  return `assets/illustrations/icons/${illustration}${compact ? "-48" : ""}.png`;
}

const categoryMeta = {
  experience: { label: "NYC Experience", className: "category-experience" },
  community: { label: "Community", className: "category-community" },
  challenge: { label: "Challenge", className: "category-challenge" },
  final: { label: "Final Quest", className: "category-final" }
};

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
  if (Number.isFinite(submission.earnedPoints)) return submission.earnedPoints;
  const base = submission.basePoints ?? 5;
  const friendPoints = Math.min(MAX_FRIENDS, Math.max(0, submission.friends || 0)) * 2;
  return base + friendPoints + (submission.bonusChecked ? (submission.bonusPoints || 0) : 0);
}

function getTotals() {
  const submissions = Object.values(state.submissions).filter(submission => submission?.completed === true);
  const bonus = submissions.reduce((sum, s) => sum + (s.friends || 0) * 2, 0);
  return {
    score: submissions.reduce((sum, s) => sum + questPoints(s), 0),
    completed: submissions.length,
    bonus
  };
}

function currentRank(score) {
  return ranks.find(r => score >= r.min && score <= r.max) || ranks[0];
}

function finalQuestCompleted() {
  const finalQuest = window.QUESTS.find(quest => quest.final);
  return Boolean(finalQuest && questIsCompleted(finalQuest.id));
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
  els.completedCount.textContent = `${completed} / ${window.QUESTS.length} completed`;

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

function rewardValue(earned, maximum) {
  return `<span class="reward-earned">${earned}</span><span class="reward-maximum">/${maximum}</span>`;
}

function renderRewardPreview() {
  if (!activeQuest || activeQuest.final) return;

  const savedSubmission = completedSubmission(activeQuest.id);
  const baseMaximum = savedSubmission?.basePoints ?? activeQuest.basePoints ?? 5;
  const basePoints = (savedSubmission || activeFileData) ? baseMaximum : 0;
  const friendPoints = Math.min(MAX_FRIENDS, Math.max(0, friendCount)) * 2;
  const hasQuestBonus = Boolean(activeQuest.bonus);
  const questBonusMaximum = hasQuestBonus
    ? (savedSubmission?.bonusPoints ?? activeQuest.bonusPoints ?? 2)
    : 0;
  const questBonusEarned = hasQuestBonus && bonusChecked ? questBonusMaximum : 0;
  const maximumPoints = baseMaximum + (MAX_FRIENDS * 2) + questBonusMaximum;
  const currentPoints = basePoints + friendPoints + questBonusEarned;
  const details = [
    `<span><b>Base</b> ${rewardValue(basePoints, baseMaximum)}</span>`,
    `<span><b>Friends</b> ${rewardValue(friendPoints, MAX_FRIENDS * 2)}</span>`
  ];

  if (hasQuestBonus) {
    details.push(`<span><b>Bonus</b> ${rewardValue(questBonusEarned, questBonusMaximum)}</span>`);
  }

  els.rewardTitle.textContent = "Rewards";
  els.rewardRows.innerHTML = `
    <div class="reward-total-line">${rewardValue(currentPoints, maximumPoints)}</div>
    <div class="reward-detail-line">${details.join('<span class="reward-separator">•</span>')}</div>
  `;
}

function renderFriendControls() {
  els.friendCount.textContent = friendCount;
  els.decrementFriends.disabled = friendCount <= 0;
  els.incrementFriends.disabled = friendCount >= MAX_FRIENDS;
  renderRewardPreview();
}

function bonusLabel(quest) {
  if (!quest.bonus) return "";
  const prefix = /^\s*if\b/i.test(quest.bonus) ? "" : "if ";
  return `+${quest.bonusPoints || 0} ${prefix}${quest.bonus}`;
}

function normalizeFinalAnswer(value) {
  return String(value || "").trim().toLocaleLowerCase();
}

function finalAnswerIsCorrect(answer, acceptedAnswers = []) {
  const normalizedAnswer = normalizeFinalAnswer(answer);
  return acceptedAnswers.some(candidate => normalizeFinalAnswer(candidate) === normalizedAnswer);
}

function finalQuestionLabel(number, prompt) {
  return `<small>Question ${number}</small>${prompt}`;
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

function questStoryKey(quest) {
  return `Q${String(quest.id).padStart(2, "0")}`;
}

function completedStandardQuestEntries() {
  return orderedQuests()
    .filter(quest => !quest.final)
    .map((quest, order) => ({ quest, order, submission: completedSubmission(quest.id) }))
    .filter(entry => Boolean(entry.submission));
}

function questStoryCandidate(entry) {
  const storyKey = questStoryKey(entry.quest);
  const template = storyTemplates[storyKey];
  if (!template || !Number.isFinite(template.weight) || template.weight <= 0) return null;

  const location = String(entry.submission.location || "").trim();
  const storyTemplate = location && template.withLocation
    ? template.withLocation
    : template.withoutLocation || template.default;
  const html = renderStoryMarkup(storyTemplate, { location });
  if (!html) return null;

  return {
    html,
    normalizedText: storyTextContent(html),
    theme: template.theme || null,
    weight: template.weight,
    order: entry.order,
    kind: "quest",
    storyKey
  };
}

function storyIconName(story) {
  return storyIcons[story.kind === "quest" ? story.storyKey : story.kind] || "auto_awesome";
}

function storyCandidatesAreSimilar(candidate, selectedCandidates) {
  return selectedCandidates.some(selected => (
    candidate.normalizedText === selected.normalizedText
    || (candidate.theme && selected.theme === candidate.theme)
  ));
}

function buildSummerStory() {
  const completedEntries = completedStandardQuestEntries();
  const questCandidates = completedEntries
    .map(questStoryCandidate)
    .filter(Boolean)
    .sort((a, b) => b.weight - a.weight || a.order - b.order);

  const distinctQuestCandidates = [];
  questCandidates.forEach(candidate => {
    if (!storyCandidatesAreSimilar(candidate, distinctQuestCandidates)) {
      distinctQuestCandidates.push(candidate);
    }
  });

  const totalFriendJoins = completedEntries.reduce((total, { submission }) => {
    const count = Number(submission.friends);
    return total + (Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0);
  }, 0);
  const bonusCount = completedEntries.filter(({ submission }) => submission.bonusChecked === true).length;
  const captionEntry = completedEntries
    .filter(({ submission }) => String(submission.caption || "").trim())
    .sort((a, b) => {
      const aWeight = Number(storyTemplates[questStoryKey(a.quest)]?.weight) || 0;
      const bWeight = Number(storyTemplates[questStoryKey(b.quest)]?.weight) || 0;
      return bWeight - aWeight || a.order - b.order;
    })[0];

  const aggregateCandidates = [];
  if (totalFriendJoins > 0) {
    const friendTemplate = totalFriendJoins === 1
      ? storyTemplates.summary?.friendsSingular
      : storyTemplates.summary?.friends;
    const html = renderStoryMarkup(friendTemplate, { friendCount: totalFriendJoins });
    if (html) aggregateCandidates.push({ html, kind: "friends" });
  }
  if (bonusCount > 0) {
    const bonusTemplate = bonusCount === 1
      ? storyTemplates.summary?.bonusesSingular
      : storyTemplates.summary?.bonuses;
    const html = renderStoryMarkup(bonusTemplate, { bonusCount });
    if (html) aggregateCandidates.push({ html, kind: "bonuses" });
  }

  let captionCandidate = null;
  if (captionEntry) {
    const html = renderStoryMarkup(storyTemplates.summary?.favoriteCaption, {
      caption: captionEntry.submission.caption
    });
    if (html) captionCandidate = { html, kind: "caption" };
  }

  const selected = distinctQuestCandidates.slice(0, 3);
  aggregateCandidates.forEach(candidate => {
    if (selected.length < 5) selected.push(candidate);
  });
  if (captionCandidate && selected.length < 5) selected.push(captionCandidate);

  for (const candidate of distinctQuestCandidates.slice(3)) {
    if (selected.length >= 5) break;
    selected.push(candidate);
  }

  return selected.slice(0, 5);
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
  const stories = buildSummerStory();

  els.finalResults.innerHTML = `
    <div class="adventure-complete-page">
      <header class="adventure-complete-header">
        <img class="adventure-complete-stamp" src="assets/illustrations/overlays/completed-stamp-256.png" alt="Completed" />
        <h3>🎉 Adventure Complete!</h3>
      </header>

      <section class="adventure-results-row" aria-label="Final results">
        <div class="adventure-result adventure-final-score">
          <p class="label">Final Score</p>
          <p class="adventure-score-value">${score}</p>
        </div>
        <div class="adventure-result adventure-final-rank">
          <p class="label">Final Rank</p>
          <div class="adventure-rank-copy">
            <h4 class="adventure-rank-value">${rank.title}</h4>
            <p class="adventure-rank-description">${rank.blurb}</p>
          </div>
        </div>
      </section>

      <section class="adventure-story" aria-labelledby="summerStoryTitle">
        <h4 id="summerStoryTitle">Your Summer Story</h4>
        <div class="adventure-story-lines">
          ${stories.map(story => `
            <div class="adventure-story-line">
              <span class="material-symbols-rounded adventure-story-icon" aria-hidden="true">${storyIconName(story)}</span>
              <p>${story.html}</p>
            </div>
          `).join("")}
        </div>
      </section>

      <p class="adventure-closing"><strong>Thanks for celebrating with us and making this birthday unforgettable.</strong></p>

      <div class="adventure-complete-actions">
        <button class="primary-button" type="button" data-final-action="view-board">VIEW MY BOARD</button>
        <button class="adventure-text-button" type="button" data-final-action="review-memories">VIEW MY SUMMER STORY</button>
      </div>
    </div>
  `;
  startFinalScoreSync();
}

function renderFinalQuest(quest, existing, draft) {
  const unlocked = Boolean(existing || draft?.finalUnlocked);
  const answers = existing?.triviaAnswers || draft?.triviaAnswers || ["", ""];
  const questions = quest.triviaQuestions || [];

  els.standardFields.hidden = true;
  els.finalFlow.hidden = false;
  els.form.classList.add("final-quest-mode");
  els.form.classList.toggle("final-complete-mode", Boolean(existing));
  els.missionCodeSection.hidden = unlocked;
  els.finalChallenge.hidden = !unlocked || Boolean(existing);
  els.finalResults.hidden = !existing;
  els.missionCodeInput.value = draft?.missionCode || "";
  els.missionCodeError.hidden = true;
  els.finalQuestionOne.innerHTML = finalQuestionLabel(1, questions[0]?.prompt || "Question 1");
  els.finalQuestionTwo.innerHTML = finalQuestionLabel(2, questions[1]?.prompt || "Question 2");
  els.finalAnswerOne.value = answers[0] || "";
  els.finalAnswerTwo.value = answers[1] || "";
  els.saveQuest.textContent = "COMPLETE ADVENTURE";
  els.saveQuest.hidden = !unlocked || Boolean(existing);
  els.remove.hidden = true;

  if (existing) renderFinalResults();
}

function renderStandardQuest(existing) {
  finalScoreResizeObserver?.disconnect();
  finalScoreResizeObserver = null;
  els.standardFields.hidden = false;
  els.finalFlow.hidden = true;
  els.form.classList.remove("final-quest-mode", "final-complete-mode");
  els.saveQuest.textContent = "Save Memory";
  els.saveQuest.hidden = false;
  els.remove.hidden = !existing;
}

function orderedQuests() {
  return [
    ...window.QUESTS.filter(quest => !quest.final),
    ...window.QUESTS.filter(quest => quest.final)
  ];
}

function renderQuestTitle(title) {
  const cardTitleLines = {
    "SHOWTIME!": ["SHOW", "TIME!"],
    "Pup-arazzi": ["Pup-", "arazzi"]
  };

  return (cardTitleLines[title] || title.split(" "))
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
    button.className = `quest-card${quest.final ? " final-quest-card" : ""}`;
    button.dataset.questId = String(quest.id);
    button.setAttribute("aria-label", completed ? `${quest.title}, completed` : quest.title);

    button.innerHTML = `
      <span class="quest-card__visual ${completed ? "is-completed" : "is-open"}">
        <span class="quest-completed-badge" aria-hidden="true">✓</span>
        <span class="quest-card-content">
          <img class="quest-illustration" src="${questIllustrationPath(quest, true)}" alt="" aria-hidden="true" />
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
  localStorage.setItem(BRIEFING_STATE_KEY, String(isCollapsed));
}

function initBriefing() {
  const stored = localStorage.getItem(BRIEFING_STATE_KEY);
  setBriefingCollapsed(stored === "true");
}

function captureDraft() {
  if (!activeQuest || els.sheet.hidden) return;
  if (activeQuest.final) {
    if (questIsCompleted(activeQuest.id)) return;
    state.drafts[activeQuest.id] = {
      ...state.drafts[activeQuest.id],
      finalUnlocked: !els.finalChallenge.hidden,
      missionCode: els.missionCodeInput.value,
      triviaAnswers: [els.finalAnswerOne.value, els.finalAnswerTwo.value]
    };
    try { save(); } catch (error) { /* Final Quest drafts contain text only. */ }
    return;
  }
  state.drafts[activeQuest.id] = {
    dataUrl: activeFileData,
    mediaType: els.mediaPreview.dataset.mediaType || completedSubmission(activeQuest.id)?.mediaType || null,
    friends: friendCount,
    location: els.location.value,
    caption: els.caption.value,
    bonusChecked
  };
  try { save(); } catch (error) { /* Saving the completed submission still reports storage errors. */ }
}

function renderQuest(quest, announce = false) {
  activeQuest = quest;
  const existing = completedSubmission(quest.id);
  const draft = state.drafts[quest.id] || existing;
  activeFileData = draft?.dataUrl || null;
  friendCount = Math.min(MAX_FRIENDS, Math.max(0, draft?.friends || 0));
  bonusChecked = Boolean(draft?.bonusChecked);
  const meta = categoryMeta[quest.category] || categoryMeta.experience;
  const quests = orderedQuests();
  const questIndex = quests.findIndex(item => item.id === quest.id);

  els.questNumber.textContent = quest.final ? "Final Quest" : `Quest ${quest.position}`;
  els.category.textContent = meta.label;
  els.category.className = `category-pill ${meta.className}`;
  els.category.hidden = Boolean(quest.final);
  els.questIcon.src = questIllustrationPath(quest);
  els.completedStamp.hidden = !existing;
  els.title.textContent = quest.title;
  els.desc.textContent = quest.description;
  els.previousQuest.disabled = questIndex === 0;
  els.nextQuest.disabled = questIndex === quests.length - 1;
  els.desktopPreviousQuest.disabled = questIndex === 0;
  els.desktopNextQuest.disabled = questIndex === quests.length - 1;
  els.desktopPreviousQuest.hidden = Boolean(quest.final && existing);
  els.desktopNextQuest.hidden = Boolean(quest.final && existing);
  els.questPosition.textContent = `Quest ${questIndex + 1} of ${quests.length}`;

  if (quest.final) {
    renderFinalQuest(quest, existing, draft);
    renderMediaPreview(null, null);
  } else {
    renderStandardQuest(existing);
    renderFriendControls();
    els.location.value = draft?.location || "";
    els.caption.value = draft?.caption || "";
    els.bonusField.hidden = !quest.bonus;
    els.bonusInput.checked = bonusChecked;
    els.bonusLabel.textContent = bonusLabel(quest);
    renderMediaPreview(draft?.dataUrl, draft?.mediaType);
  }
  els.form.scrollTop = 0;
  if (announce) els.announcement.textContent = `${quest.title} opened`;
}

function openSheet(quest) {
  renderQuest(quest);
  els.backdrop.hidden = false;
  els.modalWrapper.hidden = false;
  els.sheet.hidden = false;
  document.body.classList.add("sheet-open");
}

function closeSheet(preserveDraft = true) {
  if (preserveDraft) captureDraft();
  els.sheet.hidden = true;
  els.modalWrapper.hidden = true;
  els.backdrop.hidden = true;
  document.body.classList.remove("sheet-open");
  els.mediaInput.value = "";
}

function navigateQuest(offset) {
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

function renderMediaPreview(dataUrl, mediaType) {
  els.mediaPreview.innerHTML = "";
  if (!dataUrl) {
    els.mediaPreview.hidden = true;
    delete els.mediaPreview.dataset.mediaType;
    return;
  }
  els.mediaPreview.hidden = false;
  if (mediaType) els.mediaPreview.dataset.mediaType = mediaType;
  const media = document.createElement(mediaType?.startsWith("video/") ? "video" : "img");
  media.src = dataUrl;
  if (media.tagName === "VIDEO") media.controls = true;
  els.mediaPreview.appendChild(media);
}

function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1200;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", .78));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

els.mediaInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  if (file.type.startsWith("image/")) {
    activeFileData = await compressImage(file);
  } else {
    // LocalStorage is intentionally limited; small video files may work, large ones will not.
    activeFileData = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  renderMediaPreview(activeFileData, file.type);
  els.mediaPreview.dataset.mediaType = file.type;
  renderRewardPreview();
  captureDraft();
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

els.bonusInput.addEventListener("change", () => {
  bonusChecked = els.bonusInput.checked;
  renderRewardPreview();
  captureDraft();
});

els.location.addEventListener("input", captureDraft);
els.caption.addEventListener("input", captureDraft);
els.finalAnswerOne.addEventListener("input", captureDraft);
els.finalAnswerTwo.addEventListener("input", captureDraft);
els.previousQuest.addEventListener("click", () => navigateQuest(-1));
els.nextQuest.addEventListener("click", () => navigateQuest(1));
els.desktopPreviousQuest.addEventListener("click", () => navigateQuest(-1));
els.desktopNextQuest.addEventListener("click", () => navigateQuest(1));

els.briefingToggle.addEventListener("click", () => {
  setBriefingCollapsed(!els.briefing.classList.contains("collapsed"));
});

els.unlockFinalChallenge.addEventListener("click", () => {
  if (!activeQuest?.final || questIsCompleted(activeQuest.id)) return;
  const submittedCode = normalizeFinalAnswer(els.missionCodeInput.value);
  const configuredCode = normalizeFinalAnswer(activeQuest.missionCode);

  if (!submittedCode || submittedCode !== configuredCode) {
    els.missionCodeError.textContent = "Incorrect Mission Code.\nPlease try again.";
    els.missionCodeError.hidden = false;
    els.missionCodeInput.setAttribute("aria-invalid", "true");
    els.missionCodeInput.focus();
    return;
  }

  els.missionCodeError.hidden = true;
  els.missionCodeInput.removeAttribute("aria-invalid");
  els.missionCodeSection.hidden = true;
  els.finalChallenge.hidden = false;
  els.finalChallenge.classList.add("is-revealing");
  els.saveQuest.hidden = false;
  captureDraft();
  els.announcement.textContent = "Final Challenge unlocked";
  els.finalAnswerOne.focus({ preventScroll: true });
  window.setTimeout(() => els.finalChallenge.classList.remove("is-revealing"), 420);
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

els.form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (activeQuest?.final) {
    if (questIsCompleted(activeQuest.id) || els.finalChallenge.hidden) return;
    const triviaAnswers = [els.finalAnswerOne.value.trim(), els.finalAnswerTwo.value.trim()];
    const triviaResults = (activeQuest.triviaQuestions || []).slice(0, 2).map((question, index) => (
      finalAnswerIsCorrect(triviaAnswers[index], question.acceptedAnswers)
    ));
    while (triviaResults.length < 2) triviaResults.push(false);
    const earnedPoints = triviaResults.filter(Boolean).length * 5;

    state.submissions[activeQuest.id] = {
      completed: true,
      final: true,
      missionCode: els.missionCodeInput.value.trim(),
      triviaAnswers,
      triviaResults,
      earnedPoints,
      basePoints: 0,
      completedAt: new Date().toISOString()
    };
    delete state.drafts[activeQuest.id];
    save();
    renderGrid();
    renderProgress();
    renderBoardActions();
    renderQuest(activeQuest);
    els.announcement.textContent = `Adventure complete. ${earnedPoints} points earned.`;
    return;
  }
  if (!activeFileData) {
    alert("Add a photo or video first.");
    return;
  }
  const mediaType = els.mediaPreview.dataset.mediaType || completedSubmission(activeQuest.id)?.mediaType || "image/jpeg";
  state.submissions[activeQuest.id] = {
    completed: true,
    dataUrl: activeFileData,
    mediaType,
    friends: friendCount,
    location: els.location.value.trim(),
    caption: els.caption.value.trim(),
    basePoints: activeQuest.basePoints ?? 5,
    bonusChecked,
    bonusPoints: activeQuest.bonusPoints || 0,
    completedAt: new Date().toISOString()
  };
  delete state.drafts[activeQuest.id];
  try {
    save();
  } catch (error) {
    alert("This file is too large for the local prototype. Try a photo or a shorter video.");
    return;
  }
  renderGrid();
  renderProgress();
  renderBoardActions();
  renderQuest(activeQuest);
  els.announcement.textContent = `${activeQuest.title} completed. ${questPoints(state.submissions[activeQuest.id])} points earned.`;
});

els.remove.addEventListener("click", () => {
  if (!activeQuest) return;
  delete state.submissions[activeQuest.id];
  delete state.drafts[activeQuest.id];
  save();
  renderGrid();
  renderProgress();
  renderBoardActions();
  closeSheet(false);
});

els.close.addEventListener("click", closeSheet);
els.backdrop.addEventListener("click", closeSheet);

document.addEventListener("keydown", (event) => {
  if (els.sheet.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
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

renderGrid();
renderProgress();
renderBoardActions();
initBriefing();
