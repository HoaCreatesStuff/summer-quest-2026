const STORAGE_KEY = "nyc-summer-quest-mvp-v1";
const HAD_STORED_APP_STATE = (() => {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
})();
const BRIEFING_STATE_KEY = "nyc-summer-quest-briefing-collapsed";
const DESKTOP_NOTICE_SESSION_KEY = "nyc-summer-quest-desktop-notice-shown";
const DESKTOP_NOTICE_MIN_WIDTH = 768;
const DESKTOP_NOTICE_MIN_HEIGHT = 480;
const QUEST_DATA_MIGRATION_VERSION = 3;
const MEDIA_MIGRATION_VERSION = 1;
const FINAL_QUEST_ID = "party-time";
const CONTACT_FORM_ENDPOINT = "https://formspree.io/f/mvkppjvo";
const FRIEND_SCORING = Object.freeze({
  pointsPerFriend: 2,
  maxFriends: 5
});
const LOCAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_FRIEND_REWARD =
  FRIEND_SCORING.pointsPerFriend * FRIEND_SCORING.maxFriends;
const COMPLETION_TIMING = Object.freeze({
  focus: 350,
  stamp: 200,
  particles: 360,
  restore: 180
});
const CAPTION_VISIBLE_LINES = Object.freeze({
  min: 3,
  max: 9
});
const mediaStore = window.QuestMediaStore;
const finalQuestFinale = window.SummerQuestFinale;
const analyticsSync = window.SummerQuestAnalytics;

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

function normalizeFriendCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return 0;

  return Math.min(
    FRIEND_SCORING.maxFriends,
    Math.max(0, Math.trunc(numericValue))
  );
}

function friendPointsFor(value) {
  return normalizeFriendCount(value) * FRIEND_SCORING.pointsPerFriend;
}

function localCalendarDate(date = new Date()) {
  if (
    !date ||
    typeof date.getTime !== "function" ||
    Number.isNaN(date.getTime())
  ) return "";
  return [
    String(date.getFullYear()).padStart(4, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function parseLocalCalendarDate(value) {
  const match = LOCAL_DATE_PATTERN.exec(String(value || ""));
  if (!match) return null;

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const date = new Date(0);
  date.setHours(12, 0, 0, 0);
  date.setFullYear(year, monthIndex, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === monthIndex &&
    date.getDate() === day
  ) ? date : null;
}

function isValidLocalCalendarDate(value) {
  return Boolean(parseLocalCalendarDate(value));
}

function formatAdventureDate(value) {
  const date = parseLocalCalendarDate(value);
  if (!date) return "Select a date";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function adventureDateForSubmission(submission, fallback = localCalendarDate()) {
  if (isValidLocalCalendarDate(submission?.adventureDate)) {
    return submission.adventureDate;
  }

  const completedDate = new Date(submission?.completedAt || "");
  return localCalendarDate(completedDate) || fallback;
}

function adventureDateForEditableRecord(
  record,
  savedSubmission,
  fallback = localCalendarDate()
) {
  if (isValidLocalCalendarDate(record?.adventureDate)) {
    return record.adventureDate;
  }

  if (savedSubmission) {
    return adventureDateForSubmission(savedSubmission, fallback);
  }

  return adventureDateForSubmission(record, fallback);
}

function isSelectableAdventureDate(value, today = localCalendarDate()) {
  return (
    isValidLocalCalendarDate(value) &&
    isValidLocalCalendarDate(today) &&
    value <= today
  );
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
  22: FINAL_QUEST_ID,
  23: "animal-statue",
  24: "human-pyramid",
  25: FINAL_QUEST_ID,
  celebrate: FINAL_QUEST_ID
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

function canonicalSelectedBonusIds(quest, record) {
  const validBonusIds = new Set((quest?.bonuses || []).map((bonus) => bonus.id));
  return selectedBonusIdsFrom(record).filter((bonusId) => validBonusIds.has(bonusId));
}

function savedRecordPriority(savedId) {
  if (savedId === FINAL_QUEST_ID) return 0;
  if (savedId === "25") return 1;
  if (savedId === "22") return 2;
  if (savedId === "celebrate") return 3;
  return 4;
}

function migrateSavedCollection(collection, collectionName, migration) {
  const migrated = {};
  const entries = Object.entries(collection || {}).sort(
    ([left], [right]) => savedRecordPriority(left) - savedRecordPriority(right)
  );

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
      friends: normalizeFriendCount(record.friends),
      selectedBonusIds
    };
    delete migrated[questId].selectedBonuses;
    delete migrated[questId].earnedPoints;
    delete migrated[questId].basePoints;
  });

  return migrated;
}

function migrateSavedState(savedState) {
  const migration = {
    version: QUEST_DATA_MIGRATION_VERSION,
    completedAt: new Date().toISOString(),
    unmapped: {
      submissions: {
        ...(savedState.questDataMigration?.unmapped?.submissions || {})
      },
      drafts: {
        ...(savedState.questDataMigration?.unmapped?.drafts || {})
      }
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
// State loading and legacy ID migration above are synchronous. Analytics gets
// this exact object only after both have completed, never an empty startup copy.
const persistedQuestStateReady = true;
let activeQuest = null;
let activeMediaId = null;
let activeMediaType = null;
let activePreviewUrl = "";
let mediaPreviewRequest = 0;
let mediaRenderRequest = 0;
let mediaPickerTrigger = null;
let cropper = null;
let cropSourceUrl = "";
let pendingCropFile = null;
let cropTrigger = null;
let friendCount = 0;
let selectedBonusIds = [];
let finalScoreResizeObserver = null;
let saveInProgress = false;
let removeInProgress = false;
let questHasUnsavedChanges = false;
let sheetTrigger = null;
let homeScreenSheetTrigger = null;
let removeDialogTrigger = null;
let desktopNoticeTrigger = null;
let privacyDialogTrigger = null;
let contactDialogTrigger = null;
let desktopNoticeShownThisDocument = false;
let desktopNoticeResizeTimer = 0;
let contactSubmitInProgress = false;
let captionViewportActive = false;
let captionViewportBaselineHeight = 0;
let captionViewportReleaseTimer = 0;
let captionPositionTimer = 0;
let questViewportBaselineHeight = 0;
let questSwipeGesture = null;
let questSwipeSettleTimer = 0;
let finalQuestFinaleCompletionKey = "";

const ranks = [
  {
    min: 0,
    title: "Summer Rookie",
    blurb: "Every adventure starts somewhere."
  },
  {
    min: 25,
    title: "Neighborhood Explorer",
    blurb: "Your summer is officially in full swing."
  },
  {
    min: 60,
    title: "City Adventurer",
    blurb: "You're seeing more of NYC than most locals do."
  },
  {
    min: 100,
    title: "Local Insider",
    blurb: "You've earned serious local bragging rights."
  },
  {
    min: 170,
    title: "NYC Champion",
    blurb: "You've conquered our New York summer."
  },
  {
    min: 220,
    title: "Social Legend",
    blurb: "You made this summer legendary by bringing people together."
  }
];

const els = {
  appPages: document.querySelectorAll(".app-page"),
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
  homeScreenHelpItem: document.querySelector("#homeScreenHelpItem"),
  homeScreenHelpLink: document.querySelector("#homeScreenHelpLink"),
  backdrop: document.querySelector("#sheetBackdrop"),
  modalWrapper: document.querySelector("#questModalWrapper"),
  sheet: document.querySelector("#questSheet"),
  close: document.querySelector("#closeSheet"),
  homeScreenModalWrapper: document.querySelector("#homeScreenModalWrapper"),
  homeScreenSheet: document.querySelector("#homeScreenSheet"),
  closeHomeScreenSheet: document.querySelector("#closeHomeScreenSheet"),
  confirmHomeScreenHelp: document.querySelector("#confirmHomeScreenHelp"),
  platformTabs: document.querySelector(".platform-tabs"),
  platformPanels: document.querySelectorAll(".platform-panel"),
  content: document.querySelector("#questContent"),
  previousQuest: document.querySelector("#previousQuest"),
  nextQuest: document.querySelector("#nextQuest"),
  desktopPreviousQuest: document.querySelector("#desktopPreviousQuest"),
  desktopNextQuest: document.querySelector("#desktopNextQuest"),
  questPosition: document.querySelector("#questPosition"),
  announcement: document.querySelector("#questAnnouncement"),
  finalCompleteHeading: document.querySelector("#finalCompleteHeading"),
  category: document.querySelector("#sheetCategory"),
  questIcon: document.querySelector("#sheetQuestIcon"),
  completedStamp: document.querySelector("#completedStamp"),
  stampParticles: document.querySelector("#stampParticles"),
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
  mediaUpload: document.querySelector("#mediaUpload"),
  mediaPreview: document.querySelector("#mediaPreview"),

  cropModal: document.querySelector("#cropModal"),
  cropImage: document.querySelector("#cropImage"),
  closeCropModal: document.querySelector("#closeCropModal"),
  cancelCrop: document.querySelector("#cancelCrop"),
  confirmCrop: document.querySelector("#confirmCrop"),
  
  friendsField: document.querySelector("#friendsField"),
  questDetailsRow: document.querySelector("#questDetailsRow"),
  adventureDateControl: document.querySelector("#adventureDateControl"),
  adventureDate: document.querySelector("#adventureDateInput"),
  adventureDateDisplay: document.querySelector("#adventureDateDisplay"),
  adventureDateError: document.querySelector("#adventureDateError"),
  location: document.querySelector("#locationInput"),
  caption: document.querySelector("#captionInput"),
  bonusField: document.querySelector("#bonusField"),
  friendCount: document.querySelector("#friendCount"),
  incrementFriends: document.querySelector("#incrementFriends"),
  decrementFriends: document.querySelector("#decrementFriends"),
  rewardTitle: document.querySelector("#rewardTitle"),
  rewardDisclosure: document.querySelector("#rewardDisclosure"),
  rewardTotal: document.querySelector("#rewardTotal"),
  rewardDetails: document.querySelector("#rewardDetails"),
  rewardPreview: document.querySelector(".reward-preview"),
  saveQuest: document.querySelector("#saveQuest"),
  remove: document.querySelector("#removeQuest"),
  removeMemoryModal: document.querySelector("#removeMemoryModal"),
  keepMemory: document.querySelector("#keepMemory"),
  confirmRemoveMemory: document.querySelector("#confirmRemoveMemory"),
  removeMemoryError: document.querySelector("#removeMemoryError"),
  desktopNoticeModal: document.querySelector("#desktopNoticeModal"),
  continueOnDesktop: document.querySelector("#continueOnDesktop"),
  openPrivacyModal: document.querySelector("#openPrivacyModal"),
  privacyModal: document.querySelector("#privacyModal"),
  closePrivacyModal: document.querySelector("#closePrivacyModal"),
  confirmPrivacyModal: document.querySelector("#confirmPrivacyModal"),
  privacySharingToggle: document.querySelector("#privacySharingToggle"),
  syncAnalyticsNow: document.querySelector("#syncAnalyticsNow"),
  privacySyncStatus: document.querySelector("#privacySyncStatus"),
  openContactModal: document.querySelector("#openContactModal"),
  contactModal: document.querySelector("#contactModal"),
  closeContactModal: document.querySelector("#closeContactModal"),
  contactForm: document.querySelector("#contactForm"),
  contactName: document.querySelector("#contactName"),
  contactEmail: document.querySelector("#contactEmail"),
  contactEmailError: document.querySelector("#contactEmailError"),
  contactMessage: document.querySelector("#contactMessage"),
  contactMessageError: document.querySelector("#contactMessageError"),
  contactHoneypot: document.querySelector("#contactHoneypot"),
  contactStatus: document.querySelector("#contactStatus"),
  contactDone: document.querySelector("#contactDone"),
  sendContact: document.querySelector("#sendContact"),
  footerInstallItem: document.querySelector("#footerInstallItem"),
  footerInstallApp: document.querySelector("#footerInstallApp"),
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

function delay(milliseconds) {
  return new Promise(resolve => window.setTimeout(resolve, Math.max(0, milliseconds)));
}

function captionSizingMetrics() {
  const styles = window.getComputedStyle(els.caption);
  const fontSize = Number.parseFloat(styles.fontSize) || 16;
  const lineHeight = Number.parseFloat(styles.lineHeight) || fontSize * 1.5;
  const verticalChrome = [
    styles.paddingTop,
    styles.paddingBottom,
    styles.borderTopWidth,
    styles.borderBottomWidth
  ].reduce((total, value) => total + (Number.parseFloat(value) || 0), 0);

  return {
    minHeight: lineHeight * CAPTION_VISIBLE_LINES.min + verticalChrome,
    maxHeight: lineHeight * CAPTION_VISIBLE_LINES.max + verticalChrome
  };
}

function autosizeCaption() {
  const selectionStart = els.caption.selectionStart;
  const selectionEnd = els.caption.selectionEnd;
  const selectionDirection = els.caption.selectionDirection;
  const textareaScrollTop = els.caption.scrollTop;
  const textareaScrollLeft = els.caption.scrollLeft;
  const modalScrollTop = els.form.scrollTop;
  const { minHeight, maxHeight } = captionSizingMetrics();

  if (!els.caption.value) {
    els.caption.style.removeProperty("height");
    els.caption.style.overflowY = "hidden";
    els.form.scrollTop = modalScrollTop;
    return;
  }

  els.caption.style.height = "auto";
  const contentHeight = els.caption.scrollHeight;
  const nextHeight = Math.min(maxHeight, Math.max(minHeight, contentHeight));
  els.caption.style.height = `${Math.ceil(nextHeight)}px`;
  els.caption.style.overflowY = contentHeight > maxHeight + 1 ? "auto" : "hidden";

  // Measuring with height:auto can momentarily move both scroll containers.
  // Restore their state before the browser paints the final capped height.
  els.form.scrollTop = modalScrollTop;
  els.caption.scrollTop = textareaScrollTop;
  els.caption.scrollLeft = textareaScrollLeft;
  if (selectionStart !== null && selectionEnd !== null) {
    els.caption.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection || "none"
    );
  }
}

function questVisualViewport() {
  const viewport = window.visualViewport;
  return {
    height: viewport?.height || window.innerHeight,
    offsetTop: viewport?.offsetTop || 0
  };
}

function syncCaptionViewport() {
  if (!captionViewportActive || els.modalWrapper.hidden || els.sheet.hidden) return;

  const { height, offsetTop } = questVisualViewport();
  const modalHeight = Math.min(height * 0.92, 860);
  const modalTop = offsetTop + height - modalHeight;
  const modalScrollTop = els.form.scrollTop;

  els.modalWrapper.style.setProperty(
    "--quest-visual-viewport-height",
    `${Math.max(1, modalHeight)}px`
  );
  els.modalWrapper.style.setProperty(
    "--quest-visual-viewport-top",
    `${Math.max(0, modalTop)}px`
  );
  els.modalWrapper.classList.add("is-caption-editing");

  // Safari may adjust an overflow container while its fixed ancestor changes size.
  els.form.scrollTop = modalScrollTop;
}

function positionCaptionForKeyboard() {
  const focusedControl = document.activeElement;
  if (
    els.sheet.hidden ||
    !(focusedControl instanceof HTMLElement) ||
    !els.sheet.contains(focusedControl) ||
    !focusedControl.matches("input[type='text'], textarea")
  ) return;

  const isCaption = focusedControl === els.caption;
  const selectionStart = isCaption ? els.caption.selectionStart : null;
  const selectionEnd = isCaption ? els.caption.selectionEnd : null;
  const selectionDirection = isCaption ? els.caption.selectionDirection : null;
  const textareaScrollTop = isCaption ? els.caption.scrollTop : 0;
  const scrollRect = els.form.getBoundingClientRect();
  const field = focusedControl.closest(".field") || focusedControl;
  const fieldRect = field.getBoundingClientRect();
  const comfortableTop = scrollRect.top + 18;
  const comfortableBottom = scrollRect.bottom - 24;
  const availableHeight = comfortableBottom - comfortableTop;
  let scrollDelta = 0;

  if (fieldRect.height <= availableHeight) {
    if (fieldRect.top < comfortableTop) {
      scrollDelta = fieldRect.top - comfortableTop;
    } else if (fieldRect.bottom > comfortableBottom) {
      scrollDelta = fieldRect.bottom - comfortableBottom;
    }
  } else {
    const controlRect = focusedControl.getBoundingClientRect();
    scrollDelta = controlRect.top - comfortableTop;
  }

  if (Math.abs(scrollDelta) > 1) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    els.form.scrollTo({
      top: Math.max(0, els.form.scrollTop + scrollDelta),
      behavior: reducedMotion ? "auto" : "smooth"
    });
  }

  if (isCaption) els.caption.scrollTop = textareaScrollTop;
  if (isCaption && selectionStart !== null && selectionEnd !== null) {
    els.caption.setSelectionRange(
      selectionStart,
      selectionEnd,
      selectionDirection || "none"
    );
  }
}

function queueCaptionPosition() {
  window.clearTimeout(captionPositionTimer);
  requestAnimationFrame(() => requestAnimationFrame(positionCaptionForKeyboard));
  captionPositionTimer = window.setTimeout(positionCaptionForKeyboard, 320);
}

function beginCaptionEditing() {
  window.clearTimeout(captionViewportReleaseTimer);
  captionViewportBaselineHeight = questVisualViewport().height;
  captionViewportActive = true;
  syncCaptionViewport();
  queueCaptionPosition();
}

function finishCaptionEditing() {
  window.clearTimeout(captionViewportReleaseTimer);
  captionViewportReleaseTimer = window.setTimeout(() => {
    if (questFormControlIsFocused()) return;

    const viewportRecovered =
      questVisualViewport().height >= captionViewportBaselineHeight - 80;
    if (!viewportRecovered) return;

    captionViewportActive = false;
    els.modalWrapper.classList.remove("is-caption-editing");
    els.modalWrapper.style.removeProperty("--quest-visual-viewport-height");
    els.modalWrapper.style.removeProperty("--quest-visual-viewport-top");
  }, 350);
}

function handleCaptionViewportChange() {
  if (!captionViewportActive) return;
  syncCaptionViewport();
  if (questFormControlIsFocused()) queueCaptionPosition();
  else finishCaptionEditing();
}

function questFormControlIsFocused() {
  const activeElement = document.activeElement;
  return Boolean(
    activeElement &&
    els.sheet.contains(activeElement) &&
    activeElement.matches(
      "input, textarea, select, [contenteditable='true']"
    )
  );
}

function questKeyboardIsOpen() {
  if (questFormControlIsFocused()) return true;

  const viewportHeight = questVisualViewport().height;
  const captionKeyboardIsOpen =
    captionViewportActive &&
    viewportHeight < captionViewportBaselineHeight - 80;
  const questViewportIsReduced =
    questViewportBaselineHeight > 0 &&
    viewportHeight < questViewportBaselineHeight - 100;

  return captionKeyboardIsOpen || questViewportIsReduced;
}

function resetQuestSwipeVisuals({ removeAnimation = false } = {}) {
  window.clearTimeout(questSwipeSettleTimer);
  questSwipeSettleTimer = 0;
  questSwipeGesture = null;
  els.sheet.classList.remove("is-swipe-dragging", "is-swipe-settling");
  els.sheet.style.removeProperty("transform");
  if (removeAnimation) els.sheet.style.removeProperty("animation");
}

function releaseQuestSwipePointer(pointerId) {
  if (!els.sheet.hasPointerCapture?.(pointerId)) return;
  try {
    els.sheet.releasePointerCapture(pointerId);
  } catch (error) {
    // The browser may have already released capture during pointercancel.
  }
}

function beginQuestSwipe(event) {
  const target = event.target instanceof Element ? event.target : null;
  const swipeHandle = target?.closest("[data-quest-swipe-handle]");
  const interactiveTarget = target?.closest(
    "button, a, input, textarea, select, [contenteditable='true']"
  );

  if (
    !event.isPrimary ||
    (event.pointerType === "mouse" && event.button !== 0) ||
    !swipeHandle ||
    !els.sheet.contains(swipeHandle) ||
    interactiveTarget ||
    els.form.scrollTop > 1 ||
    questKeyboardIsOpen() ||
    saveInProgress ||
    removeInProgress ||
    els.modalWrapper.hasAttribute("data-completion-locked")
  ) {
    return;
  }

  window.clearTimeout(questSwipeSettleTimer);
  els.sheet.classList.remove("is-swipe-settling");
  els.sheet.style.animation = "none";
  els.sheet.style.removeProperty("transform");
  questSwipeGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    lastY: event.clientY,
    startTime: event.timeStamp,
    lastTime: event.timeStamp,
    offset: 0,
    velocity: 0,
    dragging: false
  };

  try {
    els.sheet.setPointerCapture(event.pointerId);
  } catch (error) {
    // Synthetic pointer events and older Safari versions may not expose capture.
  }
}

function moveQuestSwipe(event) {
  const gesture = questSwipeGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  const deltaX = event.clientX - gesture.startX;
  const deltaY = event.clientY - gesture.startY;
  if (!gesture.dragging) {
    if (deltaY <= 4) return;
    if (Math.abs(deltaX) > deltaY * 1.15) {
      releaseQuestSwipePointer(gesture.pointerId);
      resetQuestSwipeVisuals();
      return;
    }
    gesture.dragging = true;
    els.sheet.classList.add("is-swipe-dragging");
  }

  if (event.cancelable) event.preventDefault();
  const elapsed = Math.max(1, event.timeStamp - gesture.lastTime);
  const instantVelocity = (event.clientY - gesture.lastY) / elapsed;
  gesture.velocity =
    gesture.velocity * 0.65 + Math.max(0, instantVelocity) * 0.35;
  gesture.lastY = event.clientY;
  gesture.lastTime = event.timeStamp;
  gesture.offset = Math.max(0, deltaY);
  els.sheet.style.transform = `translateY(${gesture.offset}px)`;
}

function settleQuestSwipe({ dismiss, reducedMotion }) {
  els.sheet.classList.remove("is-swipe-dragging");
  els.sheet.classList.add("is-swipe-settling");
  els.sheet.style.transform = dismiss ? "translateY(100%)" : "translateY(0)";

  const finish = () => {
    if (dismiss) {
      closeSheet();
      return;
    }
    resetQuestSwipeVisuals();
  };

  if (reducedMotion) {
    finish();
  } else {
    questSwipeSettleTimer = window.setTimeout(finish, 210);
  }
}

function endQuestSwipe(event) {
  const gesture = questSwipeGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;

  releaseQuestSwipePointer(gesture.pointerId);
  if (!gesture.dragging) {
    resetQuestSwipeVisuals();
    return;
  }

  const sheetHeight = els.sheet.getBoundingClientRect().height;
  const distanceThreshold = Math.min(
    160,
    Math.max(120, sheetHeight * 0.22)
  );
  const totalElapsed = Math.max(1, event.timeStamp - gesture.startTime);
  const averageVelocity = gesture.offset / totalElapsed;
  const velocity = Math.max(gesture.velocity, averageVelocity);
  const dismiss =
    gesture.offset >= distanceThreshold ||
    (gesture.offset >= 52 && velocity >= 0.7);
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  settleQuestSwipe({ dismiss, reducedMotion });
}

function cancelQuestSwipe(event) {
  const gesture = questSwipeGesture;
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  releaseQuestSwipePointer(gesture.pointerId);
  if (!gesture.dragging) {
    resetQuestSwipeVisuals();
    return;
  }
  settleQuestSwipe({
    dismiss: false,
    reducedMotion: window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches
  });
}

function delayUntil(startedAt, elapsedMilliseconds) {
  return delay(elapsedMilliseconds - (performance.now() - startedAt));
}

function syncQuestModalInert() {
  const topModalIsOpen =
    !els.cropModal.hidden ||
    !els.removeMemoryModal.hidden ||
    !els.desktopNoticeModal.hidden;
  const completionIsLocked =
    els.modalWrapper.hasAttribute("data-completion-locked");
  els.modalWrapper.toggleAttribute("inert", topModalIsOpen || completionIsLocked);
  els.appPages.forEach((page) => {
    page.toggleAttribute("inert", topModalIsOpen);
  });
  els.homeScreenModalWrapper.toggleAttribute("inert", !els.desktopNoticeModal.hidden);
}

function setCompletionInteractionLock(locked) {
  els.modalWrapper.toggleAttribute("data-completion-locked", locked);
  els.sheet.classList.toggle("is-completing", locked);
  els.sheet.setAttribute("aria-busy", String(locked));
  syncQuestModalInert();
}

function clearCompletionStage() {
  els.sheet.classList.remove(
    "is-completing",
    "is-completion-stamp-visible",
    "is-completion-restoring"
  );
  els.modalWrapper.removeAttribute("data-completion-locked");
  syncQuestModalInert();
  els.sheet.removeAttribute("aria-busy");
  const context = els.stampParticles.getContext("2d");
  context?.clearRect(0, 0, els.stampParticles.width, els.stampParticles.height);
}

function beginCompletionFocus() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const scrollBounds = els.form.getBoundingClientRect();
  const titleBounds = els.title.getBoundingClientRect();
  const iconBounds = els.questIcon.parentElement.getBoundingClientRect();
  const fullyVisible = [titleBounds, iconBounds].every(bounds => (
    bounds.top >= scrollBounds.top && bounds.bottom <= scrollBounds.bottom
  ));

  setCompletionInteractionLock(true);

  // Stage 1: reveal the keepsake header while the lower form gently recedes.
  if (!reducedMotion && !fullyVisible) {
    els.form.scrollTo({ top: 0, behavior: "smooth" });
  }

  return { reducedMotion, startedAt: performance.now() };
}

function triggerCompletionHaptic() {
  try {
    navigator.vibrate?.(12);
  } catch (error) {
    // Vibration is optional and may be blocked by the browser or device.
  }
}

function drawParticle(context, particle, x, y, rotation, alpha) {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  context.fillStyle = particle.color;

  if (particle.shape === "dot") {
    context.beginPath();
    context.arc(0, 0, particle.size * .55, 0, Math.PI * 2);
    context.fill();
  } else if (particle.shape === "fleck") {
    context.fillRect(-particle.size * .35, -particle.size, particle.size * .7, particle.size * 2);
  } else {
    const points = particle.shape === "sparkle" ? 4 : 5;
    const innerRadius = particle.shape === "sparkle" ? particle.size * .16 : particle.size * .42;
    context.beginPath();
    for (let point = 0; point < points * 2; point += 1) {
      const radius = point % 2 ? innerRadius : particle.size;
      const angle = -Math.PI / 2 + (point * Math.PI) / points;
      context.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    }
    context.closePath();
    context.fill();
  }
  context.restore();
}

function launchGoldParticleBurst() {
  const canvas = els.stampParticles;
  const context = canvas.getContext("2d");
  if (!context) return;

  const cssSize = 300;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = cssSize * pixelRatio;
  canvas.height = cssSize * pixelRatio;
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  const shapes = ["star", "sparkle", "fleck", "dot"];
  const golds = ["#c98b13", "#e4aa24", "#f3c75d", "#fff0a8"];
  const particles = Array.from({ length: 24 }, (_, index) => ({
    angle: (index / 24) * Math.PI * 2 + (Math.random() - .5) * .2,
    color: golds[index % golds.length],
    rotation: Math.random() * Math.PI,
    rotationSpeed: (Math.random() - .5) * 7,
    shape: shapes[index % shapes.length],
    size: 1.7 + Math.random() * 2.4,
    speed: 185 + Math.random() * 125
  }));
  const startedAt = performance.now();

  function paint(now) {
    const elapsed = Math.min((now - startedAt) / 1000, COMPLETION_TIMING.particles / 1000);
    const progress = elapsed / (COMPLETION_TIMING.particles / 1000);
    context.clearRect(0, 0, cssSize, cssSize);

    particles.forEach(particle => {
      const distance = particle.speed * elapsed * (1 - progress * .24);
      const x = cssSize / 2 + Math.cos(particle.angle) * distance;
      const y = cssSize / 2 + Math.sin(particle.angle) * distance + 42 * elapsed * elapsed;
      drawParticle(
        context,
        particle,
        x,
        y,
        particle.rotation + particle.rotationSpeed * elapsed,
        Math.max(0, 1 - progress * progress)
      );
    });

    if (progress < 1) {
      requestAnimationFrame(paint);
    } else {
      context.clearRect(0, 0, cssSize, cssSize);
    }
  }

  requestAnimationFrame(paint);
}

async function playCompletionCelebration(stage) {
  try {
    if (stage.reducedMotion) {
      // Reduced motion: show the durable state immediately without scroll or particles.
      els.sheet.classList.add("is-completion-stamp-visible", "is-completion-restoring");
      triggerCompletionHaptic();
      await delay(20);
      return;
    }

    // Stage 2: let the fixed stamp settle through opacity only.
    await delayUntil(stage.startedAt, COMPLETION_TIMING.focus);
    els.sheet.classList.add("is-completion-stamp-visible");
    await delay(COMPLETION_TIMING.stamp);

    // Stage 3: one haptic and one localized metallic-gold burst at full opacity.
    triggerCompletionHaptic();
    launchGoldParticleBurst();
    await delay(COMPLETION_TIMING.particles);

    // Stage 4: bring the journal details back, keeping the completed state visible.
    els.sheet.classList.add("is-completion-restoring");
    await delay(COMPLETION_TIMING.restore);
  } finally {
    clearCompletionStage();
  }
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
  const diagnosis = mediaStore.diagnoseError(error);
  const browserErrorName = diagnosis.causeName || (
    diagnosis.name !== "MediaStorageError" ? diagnosis.name : null
  );
  const errorLabel = browserErrorName ? ` (${browserErrorName})` : "";

  if (diagnosis.code === "indexeddb-unavailable") {
    return "The browser blocked access to Summer Quest photo storage. Your existing memories are unchanged. Reopen Summer Quest and try again.";
  }
  if (diagnosis.code === "quota-exceeded") {
    return "The browser reached the storage allowance available to Summer Quest, so this photo wasn't saved. Your existing memories are unchanged. Please try again later.";
  }
  if (diagnosis.code === "transaction-aborted") {
    return "The browser interrupted the photo save before it finished. Your existing memories are unchanged. Please try again.";
  }
  if (diagnosis.code === "compression-failure") {
    return "We couldn't prepare that image. Please choose a different photo and try again.";
  }
  if (action === "load") {
    return `The browser couldn't load this saved photo${errorLabel}. Your quest details are still available. Reload Summer Quest and try again.`;
  }
  if (action === "reset") {
    return `The browser couldn't finish removing the saved photos${errorLabel}. Summer Quest will retry cleanup the next time it opens.`;
  }
  return `The browser couldn't complete the photo save${errorLabel}. Your existing memories are unchanged. Please try again.`;
}

function reportMediaError(error, action = "save") {
  const diagnosis = mediaStore.diagnoseError(error);
  console.error(`[Media storage] ${action} failed.`, diagnosis, error);
  mediaStore.estimateStorage().then(estimate => {
    console.error(`[Media storage] ${action} storage estimate.`, estimate);
  });
  window.alert(mediaErrorMessage(error, action));
}

function completedSubmission(questId) {
  const submission = state.submissions[questId];
  return submission?.completed === true ? submission : null;
}

function questIsCompleted(questId) {
  return Boolean(completedSubmission(questId));
}

function getBonusPoints(quest, bonusId) {
  return quest?.bonuses?.find(bonus => bonus.id === bonusId)?.points ?? 0;
}

function questPoints(submission, questId = submission?.questId) {
  if (!submission) return 0;
  const quest = window.QUESTS[questId];
  if (!quest) return 0;

  const bonusPoints = canonicalSelectedBonusIds(quest, submission).reduce(
    (total, bonusId) => total + getBonusPoints(quest, bonusId),
    0
  );

  return (
    quest.basePoints +
    (isFinalQuest(questId) ? 0 : friendPointsFor(submission.friends)) +
    bonusPoints
  );
}

function totalsForSubmissions(savedSubmissions = {}) {
  const submissions = window.BOARD_ORDER
    .map((questId) => ({
      questId,
      submission: savedSubmissions[questId]
    }))
    .filter(({ submission }) => submission?.completed === true);

  return {
    score: submissions.reduce(
      (total, { questId, submission }) => total + questPoints(submission, questId),
      0
    ),

    completed: submissions.length
  };
}

function getTotals() {
  return totalsForSubmissions(state.submissions);
}

function initializeAnalyticsSync() {
  try {
    analyticsSync?.init({
      hadStoredAppState: HAD_STORED_APP_STATE,
      getState: () => state,
      stateReady: () => persistedQuestStateReady,
      quests: window.QUESTS,
      boardOrder: window.BOARD_ORDER,
      finalQuestId: FINAL_QUEST_ID,
      appVersion: window.SUMMER_QUEST_BUILD?.version || "unknown",
      normalizeFriendCount,
      friendPointsFor,
      selectedBonusIdsFrom,
      canonicalSelectedBonusIds,
      questPoints,
      totalsForSubmissions,
      isFinalQuest,
      rankForScore: currentRank
    });
    analyticsSync?.onStatusChange(renderPrivacySharingStatus);
  } catch (error) {
    console.error("[Analytics] Initialization failed; gameplay remains available.", error);
  }
  renderPrivacySharingStatus();
}

function renderPrivacySharingStatus() {
  try {
    els.privacySharingToggle.checked = analyticsSync?.isSharingEnabled?.() !== false;
    const syncState = analyticsSync?.reconciliationStatus?.();
    if (!els.privacySharingToggle.checked) {
      els.privacySyncStatus.textContent = "Sharing is off";
    } else if (syncState?.pending) {
      els.privacySyncStatus.textContent = navigator.onLine === false
        ? "Waiting for connection"
        : "Sync pending";
    } else if (syncState?.lastSuccessAt) {
      els.privacySyncStatus.textContent = "Up to date";
    } else {
      els.privacySyncStatus.textContent = "Ready to sync";
    }
  } catch (error) {
    els.privacySharingToggle.checked = true;
    els.privacySyncStatus.textContent = "";
    console.warn("[Analytics] Privacy status was unavailable.", error);
  }
}

function updatePrivacySharingPreference() {
  analyticsSync?.setSharingEnabled?.(els.privacySharingToggle.checked);
  renderPrivacySharingStatus();
}

async function syncAnonymousDataNow() {
  if (!analyticsSync?.isSharingEnabled?.()) {
    els.privacySyncStatus.textContent = "Turn sharing on to sync";
    return;
  }
  els.syncAnalyticsNow.disabled = true;
  els.privacySyncStatus.textContent = "Syncing...";
  try {
    const result = await analyticsSync.reconcileQuestState?.({
      force: true,
      reason: "manual_sync"
    });
    els.privacySyncStatus.textContent = result?.ok
      ? "Up to date"
      : navigator.onLine === false
        ? "Waiting for connection"
        : "Sync will retry";
  } catch (error) {
    els.privacySyncStatus.textContent = "Sync will retry";
    console.warn("[Analytics] Manual sync will retry later.", error);
  } finally {
    els.syncAnalyticsNow.disabled = false;
  }
}

function currentRank(score) {
  return [...ranks].reverse().find(rank => score >= rank.min) || ranks[0];
}

function finalQuestFinaleKey(submission) {
  if (!submission) return "";
  return [
    FINAL_QUEST_ID,
    submission.completedAt || "",
    submission.mediaId || ""
  ].join(":");
}

function finalQuestFinaleIsEligible({
  questId,
  isNewCompletion,
  completedCount,
  completionKey,
  playedCompletionKey = finalQuestFinaleCompletionKey
}) {
  return (
    questId === FINAL_QUEST_ID &&
    isNewCompletion === true &&
    completedCount === boardItems.length &&
    Boolean(completionKey) &&
    completionKey !== playedCompletionKey
  );
}

function finalQuestFinaleEntries() {
  return boardItems
    .map((quest) => ({
      questId: quest.id,
      boardIndex: quest.boardIndex,
      boardColor: quest.boardColor,
      illustration: questIllustrationPath(quest.id),
      submission: completedSubmission(quest.id)
    }))
    .filter((entry) => Boolean(entry.submission));
}

async function playFinalQuestFinale(submission) {
  const completionKey = finalQuestFinaleKey(submission);
  const entries = finalQuestFinaleEntries();
  const { score, completed } = getTotals();

  if (!finalQuestFinaleIsEligible({
    questId: FINAL_QUEST_ID,
    isNewCompletion: true,
    completedCount: completed,
    completionKey
  })) {
    return { played: false, reason: "not-eligible" };
  }

  finalQuestFinaleCompletionKey = completionKey;

  if (!finalQuestFinale?.play || entries.length !== boardItems.length) {
    console.warn(
      "[Finale] Animation is unavailable or the completed board is incomplete; showing the Final Summary directly."
    );
    return { played: false, reason: "unavailable" };
  }

  const finalRank = currentRank(score);
  const eligibleRankTitles = ranks
    .filter((rank) => rank.min <= score)
    .map((rank) => rank.title);

  const result = await finalQuestFinale.play({
    completionKey,
    entries,
    finalRankTitle: finalRank.title,
    rankTitles: eligibleRankTitles,
    summaryWrapper: els.modalWrapper,
    summaryClose: els.close
  });
  return result;
}

function rankProgressForScore(score) {
  const rankIndex = ranks.indexOf(currentRank(score));
  const rank = ranks[rankIndex];
  const nextRank = ranks[rankIndex + 1] || null;

  if (!nextRank) {
    return {
      percentage: 100,
      pointsToNext: null
    };
  }

  const span = nextRank.min - rank.min;
  const percentage = ((score - rank.min) / span) * 100;

  return {
    percentage: Math.max(0, Math.min(100, percentage)),
    pointsToNext: Math.max(0, nextRank.min - score)
  };
}

function finalQuestCompleted() {
  return questIsCompleted(FINAL_QUEST_ID);
}

function renderRankTitle(title) {
  const lineBreakIndex = title.lastIndexOf(" ");
  const lines = lineBreakIndex === -1
    ? [title, "\u00a0"]
    : [title.slice(0, lineBreakIndex), title.slice(lineBreakIndex + 1)];

  const lineElements = lines.map(line => {
    const span = document.createElement("span");
    span.textContent = line;
    return span;
  });

  els.rankTitle.replaceChildren(
    lineElements[0],
    document.createTextNode(" "),
    lineElements[1]
  );
}

function renderProgress() {
  const { score, completed } = getTotals();
  const rank = currentRank(score);
  const rankProgress = rankProgressForScore(score);
  els.score.textContent = score;
  renderRankTitle(rank.title);
  els.rankBlurb.textContent = rank.blurb;
  els.completedCount.textContent = `${completed} / ${window.BOARD_ORDER.length} completed`;

  if (rankProgress.pointsToNext === null) {
    els.progressFill.style.width = "100%";
    els.nextRankText.textContent = "Top rank reached";
  } else {
    els.progressFill.style.width = `${rankProgress.percentage}%`;
    els.nextRankText.textContent = `${rankProgress.pointsToNext} pts to next rank`;
  }
}

function renderScoringRulesCopy() {
  document.querySelectorAll("[data-points-per-friend]").forEach((element) => {
    element.textContent = FRIEND_SCORING.pointsPerFriend;
  });
  document.querySelectorAll("[data-max-friends]").forEach((element) => {
    element.textContent = FRIEND_SCORING.maxFriends;
  });
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

  const baseMaximum = activeQuest.basePoints;

  const basePoints =
    savedSubmission || activeMediaId
      ? baseMaximum
      : 0;

  const friendPoints = includesFriends ? friendPointsFor(friendCount) : 0;

  const questBonuses = Array.isArray(activeQuest.bonuses)
    ? activeQuest.bonuses
    : [];

  const bonusMaximum = questBonuses.reduce(
  (total, bonus) => total + getBonusPoints(activeQuest, bonus.id),
  0
  );

const bonusEarned = questBonuses.reduce(
  (total, bonus) =>
    selectedBonusIds.includes(bonus.id)
      ? total + getBonusPoints(activeQuest, bonus.id)
      : total,
  0
  );

  const maximumPoints =
    baseMaximum +
    (includesFriends ? MAX_FRIEND_REWARD : 0) +
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
      `<span><b>Friends</b> ${rewardValue(friendPoints, MAX_FRIEND_REWARD)}</span>`
    );
  }

  if (questBonuses.length > 0) {
    details.push(
      `<span><b>Bonus</b> ${rewardValue(bonusEarned, bonusMaximum)}</span>`
   );
  }

  els.rewardTitle.textContent = "Rewards";

  els.rewardTotal.innerHTML = rewardValue(currentPoints, maximumPoints, true);
  els.rewardDetails.innerHTML =
    details.join('<span class="reward-separator">•</span>');
}

function setAdventureDateError(message = "") {
  els.adventureDate.setCustomValidity(message);
  els.adventureDate.setAttribute("aria-invalid", String(Boolean(message)));
  els.adventureDateControl.classList.toggle("is-invalid", Boolean(message));
  els.adventureDateError.textContent = message;
  els.adventureDateError.hidden = !message;
}

function syncAdventureDateDisplay() {
  els.adventureDateDisplay.textContent = formatAdventureDate(
    els.adventureDate.value
  );
}

function validateAdventureDateInput({ focus = false } = {}) {
  const value = els.adventureDate.value;
  const today = localCalendarDate();
  els.adventureDate.max = today;

  let message = "";
  if (!value || !isValidLocalCalendarDate(value)) {
    message = "Choose a valid date.";
  } else if (value > today) {
    message = "Adventure dates can't be in the future.";
  }

  setAdventureDateError(message);
  if (message && focus) {
    els.adventureDate.reportValidity();
    els.adventureDate.focus({ preventScroll: true });
    els.adventureDate.scrollIntoView({ block: "nearest" });
  }
  return message ? null : value;
}

function draftAdventureDate() {
  const selectedDate = els.adventureDate.value;
  if (isSelectableAdventureDate(selectedDate)) return selectedDate;

  const savedSubmission = completedSubmission(activeQuest?.id);
  return adventureDateForEditableRecord(
    state.drafts[activeQuest?.id] || savedSubmission,
    savedSubmission
  );
}

function renderFriendControls() {
  els.friendCount.textContent = friendCount;
  els.decrementFriends.disabled = friendCount <= 0;
  els.incrementFriends.disabled = friendCount >= FRIEND_SCORING.maxFriends;
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
          <span class="bonus-point-value">+${bonus.points} ${bonus.points === 1 ? "pt" : "pts"}</span>
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

  const earnedBonusIds = new Set(selectedBonusIdsFrom(entry.submission));

const bonusHtml = quest.bonuses
  .filter((bonus) => earnedBonusIds.has(bonus.id))
  .map((bonus) => renderStoryMarkup(quest.bonusMemories[bonus.id]))
  .filter(Boolean);

const reflectionHtml =
  bonusHtml.length === 0
    ? renderStoryMarkup(quest.reflection)
    : "";

return {
  html: [baseHtml, reflectionHtml, ...bonusHtml].filter(Boolean).join(" "),
  kind: hasLocationToken && location ? "location" : null,
  completedAt: entry.submission.completedAt || ""
};
}

function storyIconName(story) {
  return storyIcons[story.kind] || "";
}

function buildFinalSummary() {
  const completedEntries = completedStandardQuestEntries();

  const completedCount =
    completedEntries.length + (finalQuestCompleted() ? 1 : 0);

  const friendCount = completedEntries.reduce(
    (total, { submission }) =>
      total + normalizeFriendCount(submission.friends),
    0
  );

  const bonusCount = completedEntries.reduce(
    (total, { quest, submission }) =>
      total + canonicalSelectedBonusIds(quest, submission).length,
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
      <div class="adventure-complete-header">
        <div class="adventure-complete-hero" aria-hidden="true">
          <img
            class="adventure-complete-illustration"
            src="assets/illustrations/icons/birthday-selfie.png"
            alt=""
          />
          <img
            class="adventure-complete-stamp"
            src="assets/illustrations/overlays/completed-stamp-256.png"
            alt=""
          />
        </div>
      </div>

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
        <button class="primary-button" type="button" data-final-action="create-keepsake">Create Your Memory Keepsake</button>
        <button class="secondary-button" type="button" data-final-action="view-journal">View Your Summer Story</button>
        <button class="adventure-text-button" type="button" data-final-action="view-board">Back to Board</button>
      </div>
    </div>
  `;
  els.finalCompleteHeading.hidden = false;
  els.sheet.setAttribute("aria-labelledby", "finalCompleteHeading");
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
  els.desc.textContent = "Answer the trivia question to unlock the final mission.";
  els.saveQuest.hidden = true;
  els.remove.hidden = true;
}

function updateSaveQuestAction(
  existing = completedSubmission(activeQuest?.id),
  finalQuest = isFinalQuest(activeQuest)
) {
  const hasSavedMemory = Boolean(existing);
  const shouldViewJournal = hasSavedMemory && !questHasUnsavedChanges;

  els.saveQuest.dataset.action = shouldViewJournal
    ? "view-journal"
    : "save";

  const nextLabel = shouldViewJournal
    ? "View Summer Journal"
    : hasSavedMemory
      ? "Save Changes"
      : finalQuest
        ? "Complete Final Quest"
        : "Save Memory";

  if (els.saveQuest.textContent !== nextLabel) {
    els.saveQuest.textContent = nextLabel;

    els.saveQuest.animate(
      [
        { transform: "scale(.98)", opacity: .92 },
        { transform: "scale(1)", opacity: 1 }
      ],
      {
        duration: 160,
        easing: "ease-out"
      }
    );
  }
}

function markQuestAsChanged() {
  if (!activeQuest) return;

  questHasUnsavedChanges = true;
  updateSaveQuestAction();
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

  updateSaveQuestAction(existing, finalQuest);
  
  els.saveQuest.disabled = false;
  els.saveQuest.hidden = false;
  els.remove.hidden = finalQuest || !existing;
}

function orderedQuests() {
  return boardItems;
}

function renderQuestTitle(title) {
  const cardTitleLines = {
    "SHOWTIME!": ["SHOW", "TIME!"],
    "Pup-arazzi": ["Pup-", "arazzi"],
    "Off the Map": ["Off", "the Map"],
  };

  return (cardTitleLines[title] || title.split(/\s+/))
    .map(line => `<span class="quest-title-word">${line}</span>`)
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
  const savedSubmission = completedSubmission(activeQuest.id);
  const restorePreviousDraft = () => {
    if (previousDraft) state.drafts[activeQuest.id] = previousDraft;
    else delete state.drafts[activeQuest.id];
  };

  if (savedSubmission && !questHasUnsavedChanges) {
    return true;
  }

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
    adventureDate: draftAdventureDate(),
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

function draftDiffersFromSavedMemory(draft, saved) {
  if (!draft || !saved) return false;

  const draftBonuses = [...selectedBonusIdsFrom(draft)].sort();
  const savedBonuses = [...selectedBonusIdsFrom(saved)].sort();

  return (
    (draft.mediaId || "") !== (saved.mediaId || "") ||
    adventureDateForEditableRecord(draft, saved) !==
      adventureDateForSubmission(saved) ||
    normalizeFriendCount(draft.friends) !== normalizeFriendCount(saved.friends) ||
    String(draft.location || "").trim() !== String(saved.location || "").trim() ||
    String(draft.caption || "").trim() !== String(saved.caption || "").trim() ||
    JSON.stringify(draftBonuses) !== JSON.stringify(savedBonuses)
  );
}

function renderQuest(quest, announce = false) {
  activeQuest = quest;
  els.finalCompleteHeading.hidden = true;
  els.sheet.setAttribute("aria-labelledby", "sheetTitle");

  const existing = completedSubmission(quest.id);
  const draft = state.drafts[quest.id] || existing;

  questHasUnsavedChanges = draftDiffersFromSavedMemory(
    draft,
    existing
  );
  
  activeMediaId = draft?.mediaId || null;
  activeMediaType = draft?.mediaType || null;
  friendCount = normalizeFriendCount(draft?.friends);
  selectedBonusIds = selectedBonusIdsFrom(draft);
  const today = localCalendarDate();
  els.adventureDate.max = today;
  els.adventureDate.value = adventureDateForEditableRecord(
    draft,
    existing,
    today
  );
  syncAdventureDateDisplay();
  setAdventureDateError();
  const meta = window.QUEST_CATEGORIES[quest.category];
  const quests = orderedQuests();
  const questIndex = quests.findIndex(item => item.id === quest.id);

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
  els.questPosition.textContent = `${questIndex + 1} / ${quests.length}`;

  if (isFinalQuest(quest)) {
    renderFinalQuest(quest, existing, draft);
    renderMediaPreview(null, null);
    if (!existing && draft?.finalUnlocked) {
      renderFriendControls();
      els.location.value = draft?.location || "";
      els.caption.value = draft?.caption || "";
      autosizeCaption();
      renderBonusOptions();
      loadMediaPreviewForRecord(draft, quest.id);
    }
  } else {
    renderStandardQuest(existing, false);
    renderFriendControls();
    els.location.value = draft?.location || "";
    els.caption.value = draft?.caption || "";
    autosizeCaption();
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
  resetQuestSwipeVisuals({ removeAnimation: true });
  renderQuest(quest);
  els.backdrop.hidden = false;
  els.modalWrapper.hidden = false;
  els.sheet.hidden = false;
  autosizeCaption();
  questViewportBaselineHeight = questVisualViewport().height;
  document.body.classList.add("sheet-open");
  requestAnimationFrame(() => els.close.focus());
}

function closeSheet(preserveDraft = true) {
  if (saveInProgress) return;
  const focusTarget = sheetTrigger;
  sheetTrigger = null;
  captionViewportActive = false;
  window.clearTimeout(captionViewportReleaseTimer);
  window.clearTimeout(captionPositionTimer);
  els.modalWrapper.classList.remove("is-caption-editing");
  els.modalWrapper.style.removeProperty("--quest-visual-viewport-height");
  els.modalWrapper.style.removeProperty("--quest-visual-viewport-top");
  if (preserveDraft) captureDraft();
  mediaPreviewRequest += 1;
  renderMediaPreview(null, null);
  els.sheet.hidden = true;
  resetQuestSwipeVisuals({ removeAnimation: true });
  questViewportBaselineHeight = 0;
  els.modalWrapper.hidden = true;
  els.backdrop.hidden = true;
  document.body.classList.remove("sheet-open");
  els.mediaInput.value = "";
  focusTarget?.focus({ preventScroll: true });
}

function isRunningStandalone() {
  const installedDisplayModes = [
    "standalone",
    "fullscreen",
    "minimal-ui",
    "window-controls-overlay"
  ];
  return navigator.standalone === true || installedDisplayModes.some(
    mode => window.matchMedia(`(display-mode: ${mode})`).matches
  );
}

function detectedHomeScreenPlatform() {
  const platform = navigator.userAgentData?.platform || navigator.platform || "";
  const agent = `${platform} ${navigator.userAgent}`.toLowerCase();
  const isIPadOS = agent.includes("mac") && navigator.maxTouchPoints > 1;

  if (agent.includes("android")) return "android";
  if (/iphone|ipad|ipod/.test(agent) || isIPadOS || agent.includes("mac")) return "iphone";
  if (/chrome|chromium|crios|edg/.test(agent)) return "android";
  return "iphone";
}

function setHomeScreenPlatform(platform, moveFocus = false) {
  const nextPlatform = platform === "android" ? "android" : "iphone";
  const tabs = Array.from(els.platformTabs.querySelectorAll("[role='tab']"));

  tabs.forEach(tab => {
    const selected = tab.dataset.platform === nextPlatform;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
    if (selected && moveFocus) tab.focus();
  });
  els.platformPanels.forEach(panel => {
    panel.hidden = panel.id !== `${nextPlatform}Instructions`;
  });
}

function openHomeScreenHelp(event) {
  event?.preventDefault();
  if (isRunningStandalone()) return;
  homeScreenSheetTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  els.homeScreenModalWrapper.hidden = false;
  els.homeScreenSheet.hidden = false;
  document.body.classList.add("info-modal-open");
  requestAnimationFrame(() => els.closeHomeScreenSheet.focus());
}

function closeHomeScreenHelp() {
  const focusTarget = homeScreenSheetTrigger;
  homeScreenSheetTrigger = null;
  els.homeScreenSheet.hidden = true;
  els.homeScreenModalWrapper.hidden = true;
  document.body.classList.remove("info-modal-open");
  focusTarget?.focus({ preventScroll: true });
}

function resetContactStatus() {
  els.contactStatus.textContent = "";
  els.contactStatus.classList.remove("is-error", "is-success");
  els.contactEmailError.hidden = true;
  els.contactEmailError.textContent = "";
  els.contactEmail.removeAttribute("aria-invalid");
  els.contactMessageError.hidden = true;
  els.contactMessageError.textContent = "";
  els.contactMessage.removeAttribute("aria-invalid");
  els.contactDone.hidden = true;
  els.sendContact.hidden = false;
  els.sendContact.disabled = false;
  els.sendContact.textContent = "Send Feedback";
}

function openPrivacyModal(event) {
  event?.preventDefault();
  analyticsSync?.trackPrivacyOpened?.();
  privacyDialogTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : els.openPrivacyModal;
  els.privacyModal.hidden = false;
  document.body.classList.add("info-modal-open");
  requestAnimationFrame(() => els.closePrivacyModal.focus({ preventScroll: true }));
}

function closePrivacyModal({ restoreFocus = true } = {}) {
  const wasOpen = !els.privacyModal.hidden;
  const focusTarget = privacyDialogTrigger;
  privacyDialogTrigger = null;
  els.privacyModal.hidden = true;
  document.body.classList.remove("info-modal-open");

  if (wasOpen && restoreFocus && focusTarget?.isConnected) {
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
  return focusTarget;
}

function openContactModal(event) {
  event?.preventDefault();
  contactDialogTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : els.openContactModal;
  resetContactStatus();
  els.contactModal.hidden = false;
  document.body.classList.add("info-modal-open");
  requestAnimationFrame(() => els.contactMessage.focus({ preventScroll: true }));
}

function closeContactModal({ restoreFocus = true } = {}) {
  if (contactSubmitInProgress) return;
  const wasOpen = !els.contactModal.hidden;
  const focusTarget = contactDialogTrigger;
  contactDialogTrigger = null;
  els.contactModal.hidden = true;
  document.body.classList.remove("info-modal-open");

  if (wasOpen && restoreFocus && focusTarget?.isConnected) {
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
}

function contactMetadata() {
  const userAgentData = navigator.userAgentData;
  return {
    app_version: window.SUMMER_QUEST_BUILD?.version || "unknown",
    user_agent_summary: userAgentData?.brands
      ?.map(brand => `${brand.brand} ${brand.version}`)
      .join(", ") || navigator.userAgent || "unknown",
    platform: userAgentData?.platform || navigator.platform || "unknown",
    viewport: `${window.innerWidth}x${window.innerHeight}`,
    language: navigator.language || "unknown",
    standalone_pwa: isRunningStandalone() ? "yes" : "no",
    online_status: navigator.onLine ? "online" : "offline",
    submitted_at: new Date().toISOString()
  };
}

function validateContactForm() {
  let valid = true;
  const email = els.contactEmail.value.trim();
  const message = els.contactMessage.value.trim();

  els.contactEmailError.hidden = true;
  els.contactEmailError.textContent = "";
  els.contactEmail.removeAttribute("aria-invalid");
  if (email && !els.contactEmail.validity.valid) {
    valid = false;
    els.contactEmailError.textContent = "Enter a valid email address or leave it blank.";
    els.contactEmailError.hidden = false;
    els.contactEmail.setAttribute("aria-invalid", "true");
  }

  els.contactMessageError.hidden = true;
  els.contactMessageError.textContent = "";
  els.contactMessage.removeAttribute("aria-invalid");
  if (!message) {
    valid = false;
    els.contactMessageError.textContent = "Add a message before sending.";
    els.contactMessageError.hidden = false;
    els.contactMessage.setAttribute("aria-invalid", "true");
  }

  return valid;
}

function setContactStatus(message, type = "") {
  els.contactStatus.textContent = message;
  els.contactStatus.classList.toggle("is-error", type === "error");
  els.contactStatus.classList.toggle("is-success", type === "success");
}

async function submitContactForm(event) {
  event.preventDefault();
  if (contactSubmitInProgress) return;
  resetContactStatus();
  if (!validateContactForm()) return;

  if (els.contactHoneypot.value.trim()) {
    setContactStatus("Thanks for helping improve Summer Quest!", "success");
    els.contactDone.hidden = false;
    els.sendContact.hidden = true;
    return;
  }

  if (!navigator.onLine) {
    setContactStatus("You’re offline. Reconnect to send your message.", "error");
    return;
  }

  if (!CONTACT_FORM_ENDPOINT || CONTACT_FORM_ENDPOINT.includes("PASTE_FORMSPREE_ENDPOINT_HERE")) {
    setContactStatus("Contact form setup is missing. Add the Formspree endpoint before sending.", "error");
    return;
  }

  contactSubmitInProgress = true;
  els.sendContact.disabled = true;
  els.sendContact.textContent = "Sending…";
  els.contactModal.querySelector("[role='dialog']")?.setAttribute("aria-busy", "true");

  const formData = new FormData();
  formData.set("name", els.contactName.value.trim());
  formData.set("email", els.contactEmail.value.trim());
  formData.set("message", els.contactMessage.value.trim());
  formData.set("_subject", "Summer Quest feedback");
  Object.entries(contactMetadata()).forEach(([key, value]) => {
    formData.set(`metadata_${key}`, value);
  });

  try {
    const response = await fetch(CONTACT_FORM_ENDPOINT, {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData
    });
    if (!response.ok) throw new Error(`Formspree responded with ${response.status}`);
    analyticsSync?.trackFeedbackSubmitted?.();
    els.contactForm.reset();
    setContactStatus("Thanks for helping improve Summer Quest!", "success");
    els.contactDone.hidden = false;
    els.sendContact.hidden = true;
    requestAnimationFrame(() => els.contactDone.focus({ preventScroll: true }));
  } catch (error) {
    console.warn("[Contact form] Submission failed.", error);
    setContactStatus("Your message couldn’t be sent. Please check your connection and try again.", "error");
    els.sendContact.disabled = false;
    els.sendContact.textContent = "Send Feedback";
  } finally {
    contactSubmitInProgress = false;
    els.contactModal.querySelector("[role='dialog']")?.removeAttribute("aria-busy");
  }
}

function closeRemoveConfirmation({ restoreFocus = true } = {}) {
  if (removeInProgress) return;
  const wasOpen = !els.removeMemoryModal.hidden;
  const focusTarget = removeDialogTrigger;
  removeDialogTrigger = null;
  els.removeMemoryModal.hidden = true;
  els.removeMemoryError.hidden = true;
  els.removeMemoryError.textContent = "";
  document.body.classList.remove("confirmation-open");
  syncQuestModalInert();

  if (wasOpen && restoreFocus && focusTarget?.isConnected) {
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
}

function openRemoveConfirmation() {
  if (!activeQuest || saveInProgress || removeInProgress) return;
  removeDialogTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : els.remove;
  els.removeMemoryError.hidden = true;
  els.removeMemoryError.textContent = "";
  els.confirmRemoveMemory.disabled = false;
  els.confirmRemoveMemory.textContent = "Remove Memory";
  els.keepMemory.disabled = false;
  els.removeMemoryModal.hidden = false;
  document.body.classList.add("confirmation-open");
  syncQuestModalInert();
  requestAnimationFrame(() => els.keepMemory.focus({ preventScroll: true }));
}

function desktopNoticeSessionShown() {
  try {
    return sessionStorage.getItem(DESKTOP_NOTICE_SESSION_KEY) === "true";
  } catch {
    return desktopNoticeShownThisDocument;
  }
}

function markDesktopNoticeSessionShown() {
  desktopNoticeShownThisDocument = true;
  try {
    sessionStorage.setItem(DESKTOP_NOTICE_SESSION_KEY, "true");
  } catch {
    // The in-memory flag still prevents repeated notices when storage is blocked.
  }
}

function desktopNoticeConditions({
  width = window.innerWidth,
  height = window.innerHeight,
  finePointer = window.matchMedia("(pointer: fine)").matches,
  hover = window.matchMedia("(hover: hover)").matches
} = {}) {
  return (
    width >= DESKTOP_NOTICE_MIN_WIDTH &&
    height >= DESKTOP_NOTICE_MIN_HEIGHT &&
    finePointer &&
    hover
  );
}

function anotherDialogIsOpen() {
  return (
    !els.removeMemoryModal.hidden ||
    !els.cropModal.hidden ||
    !els.privacyModal.hidden ||
    !els.contactModal.hidden ||
    !els.homeScreenSheet.hidden ||
    !els.sheet.hidden
  );
}

function closeDesktopNotice({ restoreFocus = true } = {}) {
  const wasOpen = !els.desktopNoticeModal.hidden;
  const focusTarget = desktopNoticeTrigger;
  desktopNoticeTrigger = null;
  els.desktopNoticeModal.hidden = true;
  document.body.classList.remove("desktop-notice-open");
  syncQuestModalInert();

  if (wasOpen && restoreFocus && focusTarget?.isConnected) {
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
}

function openDesktopNotice() {
  if (
    desktopNoticeSessionShown() ||
    anotherDialogIsOpen() ||
    document.body.dataset.page === "story" ||
    document.body.dataset.page === "keepsake" ||
    !desktopNoticeConditions()
  ) return false;

  desktopNoticeTrigger = document.activeElement instanceof HTMLElement
    ? document.activeElement
    : null;
  markDesktopNoticeSessionShown();
  els.desktopNoticeModal.hidden = false;
  document.body.classList.add("desktop-notice-open");
  syncQuestModalInert();
  requestAnimationFrame(() => {
    els.continueOnDesktop.focus({ preventScroll: true });
  });
  return true;
}

function reevaluateDesktopNotice() {
  const shouldRemainOpen =
    desktopNoticeConditions() &&
    document.body.dataset.page !== "story" &&
    document.body.dataset.page !== "keepsake";

  if (!els.desktopNoticeModal.hidden && !shouldRemainOpen) {
    closeDesktopNotice();
    return;
  }
  if (els.desktopNoticeModal.hidden) openDesktopNotice();
}

function activeModalContext() {
  if (!els.contactModal.hidden) {
    return {
      wrapper: els.contactModal,
      close: closeContactModal,
      isQuest: false
    };
  }
  if (!els.privacyModal.hidden) {
    return {
      wrapper: els.privacyModal,
      close: closePrivacyModal,
      isQuest: false
    };
  }
  if (!els.desktopNoticeModal.hidden) {
    return {
      wrapper: els.desktopNoticeModal,
      close: closeDesktopNotice,
      isQuest: false
    };
  }
  if (!els.removeMemoryModal.hidden) {
    return {
      wrapper: els.removeMemoryModal,
      close: closeRemoveConfirmation,
      isQuest: false
    };
  }
  if (!els.cropModal.hidden) {
    return {
      wrapper: els.cropModal,
      close: cancelCropper,
      isQuest: false
    };
  }
  if (!els.homeScreenSheet.hidden) {
    return {
      wrapper: els.homeScreenModalWrapper,
      close: closeHomeScreenHelp,
      isQuest: false
    };
  }
  if (!els.sheet.hidden) {
    return {
      wrapper: els.modalWrapper,
      close: closeSheet,
      isQuest: true
    };
  }
  return null;
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

function closeCropper({
  clearInput = false,
  restoreFocus = true
} = {}) {
  const wasOpen = !els.cropModal.hidden;
  const focusTarget = cropTrigger;
  cropTrigger = null;

  cropper?.destroy();
  cropper = null;

  if (cropSourceUrl) {
    URL.revokeObjectURL(cropSourceUrl);
    cropSourceUrl = "";
  }

  pendingCropFile = null;
  els.cropImage.removeAttribute("src");
  els.cropModal.hidden = true;
  document.body.classList.remove("crop-open");
  syncQuestModalInert();

  if (clearInput) {
    els.mediaInput.value = "";
  }

  if (wasOpen && restoreFocus && focusTarget?.isConnected) {
    requestAnimationFrame(() => focusTarget.focus({ preventScroll: true }));
  }
}

function openCropper(file, trigger = els.mediaInput) {
  if (!file?.type.startsWith("image/")) return;

  closeCropper({ restoreFocus: false });
  cropTrigger = trigger instanceof HTMLElement ? trigger : els.mediaInput;

  pendingCropFile = file;
  cropSourceUrl = URL.createObjectURL(file);
  els.cropImage.src = cropSourceUrl;
  els.cropModal.hidden = false;
  document.body.classList.add("crop-open");
  syncQuestModalInert();
  requestAnimationFrame(() => els.closeCropModal.focus({ preventScroll: true }));

  els.cropImage.onload = () => {
    cropper = new Cropper(els.cropImage, {
      aspectRatio: 1,
      viewMode: 1,
      dragMode: "move",
      autoCropArea: 1,
      responsive: true,
      background: false,
      guides: false,
      center: false,
      movable: true,
      zoomable: true,
      scalable: false,
      rotatable: false,
      toggleDragModeOnDblclick: false
    });
  };
}

function cancelCropper() {
  closeCropper({ clearInput: true });
}

els.cancelCrop.addEventListener("click", cancelCropper);
els.closeCropModal.addEventListener("click", cancelCropper);

els.cropModal.addEventListener("click", (event) => {
  if (event.target === els.cropModal) {
    cancelCropper();
  }
});

function getCroppedImageBlob() {
  return new Promise((resolve, reject) => {
    const rejectCompression = (message, cause) => {
      const error = new Error(message, cause ? { cause } : undefined);
      error.code = "compression-failure";
      reject(error);
    };

    if (!cropper) {
      rejectCompression("Cropper is not ready.");
      return;
    }

    const canvas = cropper.getCroppedCanvas({
      width: mediaStore.imageSettings.longestEdge,
      height: mediaStore.imageSettings.longestEdge,
      imageSmoothingEnabled: true,
      imageSmoothingQuality: "high"
    });

    if (!canvas) {
      rejectCompression("The cropped image could not be created.");
      return;
    }

    // This is the crop path's only lossy encoding step: Cropper supplies the
    // final square pixels, which are stored at the intended JPEG quality.
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          rejectCompression("The cropped image could not be exported.");
        }
      },
      "image/jpeg",
      mediaStore.imageSettings.jpegQuality
    );
  });
}

els.confirmCrop.addEventListener("click", async () => {
  if (!cropper || !pendingCropFile || !activeQuest) return;

  const selectionRequest = ++mediaPreviewRequest;
  const questId = activeQuest.id;
  const existingMediaId = completedSubmission(questId)?.mediaId || null;
  const priorDraftMediaId = state.drafts[questId]?.mediaId || null;
  const previousMediaRecord =
    state.drafts[questId] || completedSubmission(questId);

  let newMediaId = null;

  els.confirmCrop.disabled = true;
  els.confirmCrop.textContent = "Saving…";

  try {
    const blob = await getCroppedImageBlob();

    const mediaId = mediaStore.createMediaId();
    newMediaId = mediaId;

    await mediaStore.put(mediaId, blob);

    if (
      selectionRequest !== mediaPreviewRequest ||
      activeQuest?.id !== questId
    ) {
      await mediaStore.remove(mediaId);
      return;
    }

    activeMediaId = mediaId;
    activeMediaType = blob.type || "image/jpeg";
    markQuestAsChanged();

    renderMediaPreview(blob, activeMediaType, {
      animate: Boolean(previousMediaRecord?.mediaId || previousMediaRecord?.dataUrl)
    });
    renderRewardPreview();

    const draftSaved = captureDraft();

    if (!draftSaved) {
      activeMediaId = previousMediaRecord?.mediaId || null;
      activeMediaType = previousMediaRecord?.mediaType || null;

      await mediaStore.remove(mediaId);

      if (previousMediaRecord?.mediaId || previousMediaRecord?.dataUrl) {
        await loadMediaPreviewForRecord(previousMediaRecord, questId);
      } else {
        renderMediaPreview(null, null);
      }

      window.alert(
        "The browser couldn't save this photo's quest details. The new photo wasn't kept, and your existing memory is unchanged. Please try again."
      );

      els.mediaInput.value = "";
      return;
    }

    if (
      priorDraftMediaId &&
      priorDraftMediaId !== existingMediaId &&
      priorDraftMediaId !== mediaId
    ) {
      try {
        await mediaStore.remove(priorDraftMediaId);
      } catch (error) {
        console.warn(
          "[Media storage] Replaced draft cleanup will be retried on startup.",
          error
        );
      }
    }

    closeCropper({ clearInput: true });
  } catch (error) {
    if (newMediaId && newMediaId !== activeMediaId) {
      try {
        await mediaStore.remove(newMediaId);
      } catch (cleanupError) {
        console.warn(
          "[Media storage] Failed crop cleanup will be retried on startup.",
          cleanupError
        );
      }
    }

    reportMediaError(
      error,
      error?.code === "compression-failure" ? "compress" : "save"
    );
  } finally {
    els.confirmCrop.disabled = false;
    els.confirmCrop.textContent = "Use Photo";
  }
});

function mediaReplacementButton(className, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.dataset.replaceMedia = "";
  button.setAttribute("aria-label", label);
  return button;
}

function mediaPreviewMarkup(blob, mediaType) {
  const isVideo = mediaType?.startsWith("video/");
  const media = document.createElement(isVideo ? "video" : "img");
  activePreviewUrl = URL.createObjectURL(blob);
  media.src = activePreviewUrl;
  media.className = "media-preview-element";

  if (isVideo) {
    media.controls = true;
    els.mediaPreview.appendChild(media);
  } else {
    const imageButton = mediaReplacementButton(
      "media-preview-image-button",
      "Replace photo"
    );
    imageButton.appendChild(media);
    els.mediaPreview.appendChild(imageButton);
  }

  const cameraButton = mediaReplacementButton(
    "media-edit-button",
    isVideo ? "Replace video" : "Replace photo"
  );
  cameraButton.innerHTML = `
    <span class="material-symbols-outlined" aria-hidden="true">photo_camera</span>
  `;
  els.mediaPreview.appendChild(cameraButton);
}

function renderMediaPreview(
  blob,
  mediaType,
  { animate = false, pending = false } = {}
) {
  const renderRequest = ++mediaRenderRequest;
  const shouldAnimate =
    animate &&
    !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hasVisibleMedia = Boolean(
    els.mediaPreview.querySelector(".media-preview-element")
  );

  const applyPreview = () => {
    if (renderRequest !== mediaRenderRequest) return;
    if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
    activePreviewUrl = "";
    els.mediaPreview.innerHTML = "";

    const hasMedia = Boolean(blob || pending);
    els.mediaUpload.hidden = hasMedia;
    els.mediaPreview.hidden = !hasMedia;
    els.mediaPreview.classList.toggle("is-loading", !blob && pending);
    els.mediaInput.tabIndex = hasMedia ? -1 : 0;
    if (hasMedia) {
      els.mediaInput.setAttribute("aria-hidden", "true");
    } else {
      els.mediaInput.removeAttribute("aria-hidden");
    }

    if (!blob) {
      delete els.mediaPreview.dataset.mediaType;
      return;
    }

    if (mediaType) els.mediaPreview.dataset.mediaType = mediaType;
    mediaPreviewMarkup(blob, mediaType);

    if (shouldAnimate) {
      els.mediaPreview.animate(
        [{ opacity: 0 }, { opacity: 1 }],
        { duration: 120, easing: "ease-out" }
      );
    }
  };

  if (shouldAnimate && blob && hasVisibleMedia) {
    const fadeOut = els.mediaPreview.animate(
      [{ opacity: 1 }, { opacity: 0 }],
      { duration: 100, easing: "ease-in" }
    );
    fadeOut.finished.then(applyPreview).catch(applyPreview);
    return;
  }

  applyPreview();
}

async function loadMediaPreviewForRecord(record, questId) {
  const requestId = ++mediaPreviewRequest;
  if (!record?.mediaId && !record?.dataUrl) {
    renderMediaPreview(null, null);
    return;
  }

  renderMediaPreview(null, record.mediaType, { pending: true });

  try {
    const blob = await mediaStore.blobFor(record);
    if (!blob) {
      const error = new Error("The media record is missing from IndexedDB.");
      error.code = "storage-failure";
      throw error;
    }
    if (requestId !== mediaPreviewRequest || activeQuest?.id !== questId) return;
    activeMediaType = record.mediaType || blob.type;
    renderMediaPreview(blob, activeMediaType);
  } catch (error) {
    if (requestId !== mediaPreviewRequest || activeQuest?.id !== questId) return;
    reportMediaError(error, "load");
  }
}

function openMediaPicker(trigger) {
  if (!activeQuest || saveInProgress) return;
  mediaPickerTrigger = trigger instanceof HTMLElement ? trigger : null;
  els.mediaInput.value = "";
  els.mediaInput.click();
}

els.mediaPreview.addEventListener("click", (event) => {
  const trigger = event.target.closest("[data-replace-media]");
  if (!trigger) return;
  openMediaPicker(trigger);
});

els.mediaInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) {
    mediaPickerTrigger = null;
    return;
  }
  const pickerTrigger = mediaPickerTrigger || event.currentTarget;
  mediaPickerTrigger = null;
  if (file.type.startsWith("image/")) {
    openCropper(file, pickerTrigger);
    return;
  }

  const selectionRequest = ++mediaPreviewRequest;
  const questId = activeQuest?.id;
  const existingMediaId = completedSubmission(questId)?.mediaId || null;
  const priorDraftMediaId = state.drafts[questId]?.mediaId || null;
  const previousMediaRecord = state.drafts[questId] || completedSubmission(questId);
  let newMediaId = null;

  try {
    const blob = file;
    const mediaId = mediaStore.createMediaId();
    newMediaId = mediaId;
    await mediaStore.put(mediaId, blob);
    if (selectionRequest !== mediaPreviewRequest || activeQuest?.id !== questId) {
      await mediaStore.remove(mediaId);
      return;
    }

    activeMediaId = mediaId;
    activeMediaType = blob.type || file.type;
    renderMediaPreview(blob, activeMediaType, {
      animate: Boolean(previousMediaRecord?.mediaId || previousMediaRecord?.dataUrl)
    });
    renderRewardPreview();
    const draftSaved = captureDraft();

    if (!draftSaved) {
      activeMediaId = previousMediaRecord?.mediaId || null;
      activeMediaType = previousMediaRecord?.mediaType || null;
      await mediaStore.remove(mediaId);
      if (previousMediaRecord?.mediaId || previousMediaRecord?.dataUrl) {
        await loadMediaPreviewForRecord(previousMediaRecord, questId);
      } else {
        renderMediaPreview(null, null);
      }
      window.alert("The browser couldn't save this photo's quest details. The new photo wasn't kept, and your existing memory is unchanged. Please try again.");
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
    els.mediaInput.value = "";
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
  friendCount = normalizeFriendCount(friendCount + 1);
  renderFriendControls();
  markQuestAsChanged();
  captureDraft();
});

els.decrementFriends.addEventListener("click", () => {
  friendCount = Math.max(0, friendCount - 1);
  renderFriendControls();
  markQuestAsChanged();
  captureDraft();
});

els.bonusField.addEventListener("change", (event) => {
  const input = event.target.closest(".bonus-option-input");
  if (!input) return;
  markQuestAsChanged();
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
els.rewardDisclosure.addEventListener("click", () => {
  const expanded = !els.rewardPreview.classList.contains("expanded");
  els.rewardPreview.classList.toggle("expanded", expanded);
  els.rewardDisclosure.setAttribute("aria-expanded", String(expanded));
});
function handleQuestInputChange() {
  markQuestAsChanged();
  captureDraft();
}

els.location.addEventListener("input", handleQuestInputChange);
els.adventureDate.addEventListener("input", () => {
  syncAdventureDateDisplay();
  validateAdventureDateInput();
  handleQuestInputChange();
});
els.adventureDate.addEventListener("change", syncAdventureDateDisplay);
els.caption.addEventListener("input", () => {
  autosizeCaption();
  if (document.activeElement === els.caption) queueCaptionPosition();
  handleQuestInputChange();
});
els.missionCodeInput.addEventListener("input", handleQuestInputChange);
els.form.addEventListener("focusin", (event) => {
  if (event.target.matches("input[type='text'], textarea")) {
    beginCaptionEditing();
  }
});
els.form.addEventListener("focusout", (event) => {
  if (event.target.matches("input[type='text'], textarea")) {
    finishCaptionEditing();
  }
});
window.visualViewport?.addEventListener("resize", handleCaptionViewportChange);
window.visualViewport?.addEventListener("scroll", handleCaptionViewportChange);
window.addEventListener("orientationchange", () => {
  window.setTimeout(() => {
    autosizeCaption();
    handleCaptionViewportChange();
    if (!els.sheet.hidden && !questFormControlIsFocused()) {
      questViewportBaselineHeight = questVisualViewport().height;
    }
  }, 250);
});
els.previousQuest.addEventListener("click", () => navigateQuest(-1));
els.nextQuest.addEventListener("click", () => navigateQuest(1));
els.desktopPreviousQuest.addEventListener("click", () => navigateQuest(-1));
els.desktopNextQuest.addEventListener("click", () => navigateQuest(1));

els.saveQuest.addEventListener("click", (event) => {
  if (els.saveQuest.dataset.action !== "view-journal") return;

  event.preventDefault();

  window.pendingStoryQuestId = activeQuest?.id || null;
  
  closeSheet();
  els.viewBoard.click();
});

els.briefingToggle.addEventListener("click", () => {
  setBriefingCollapsed(!els.briefing.classList.contains("collapsed"));
});

els.homeScreenHelpLink.addEventListener("click", openHomeScreenHelp);
els.platformTabs.addEventListener("click", (event) => {
  const tab = event.target.closest("[data-platform]");
  if (tab) setHomeScreenPlatform(tab.dataset.platform);
});
els.platformTabs.addEventListener("keydown", (event) => {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  const platform = event.currentTarget.querySelector("[aria-selected='true']")?.dataset.platform;
  setHomeScreenPlatform(platform === "iphone" ? "android" : "iphone", true);
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
    window.alert("The browser couldn't reset the saved quest details. Nothing was removed. Please try again.");
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

  if (action === "create-keepsake") {
    closeSheet(false);
    els.saveBoard.click();
    return;
  }

  if (action === "view-journal") {
    closeSheet(false);
    els.viewBoard.click();
    return;
  }

  if (action === "view-board") {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    closeSheet(false);
    requestAnimationFrame(() => {
      els.board.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    });
    return;
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

  const adventureDate = validateAdventureDateInput({ focus: true });
  if (!adventureDate) return;

  friendCount = finalQuest ? 0 : normalizeFriendCount(friendCount);

  if (!activeMediaId) {
    alert("Add a photo or video first.");
    return;
  }
  saveInProgress = true;
  const wasCompletedBefore = questIsCompleted(activeQuest.id);
  const isNewCompletion = !wasCompletedBefore;
  const totalsBeforeSave = getTotals();
  const completionStage =
    isNewCompletion && !finalQuest
      ? beginCompletionFocus()
      : null;
  els.saveQuest.disabled = true;
  els.saveQuest.textContent = "Saving…";
  const mediaType = activeMediaType || completedSubmission(activeQuest.id)?.mediaType || "image/jpeg";
  const questId = activeQuest.id;
  
  const submittedMediaId =
  activeMediaId ||
  state.submissions[questId]?.mediaId ||
  state.drafts[questId]?.mediaId ||
  null;
  
  const previousSubmission = state.submissions[questId] || null;
  const previousDraft = state.drafts[questId] || null;
  
  const nextSubmission = {
    questId: activeQuest.id,
    completed: true,
    mediaId: submittedMediaId ||
             previousSubmission?.mediaId ||
             previousDraft?.mediaId,
    mediaType,
    adventureDate,
    friends: finalQuest ? 0 : friendCount,
    location: els.location.value.trim(),
    caption: els.caption.value.trim(),
    selectedBonusIds: (activeQuest.bonuses || [])
      .filter((bonus) => selectedBonusIds.includes(bonus.id))
      .map((bonus) => bonus.id),
    ...(finalQuest ? {
      final: true,
      finalUnlocked: true,
      gateAnswer: previousDraft?.gateAnswer || ""
    } : {}),
    completedAt:
    previousSubmission?.completedAt ||
    new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submissionVersion: (Number(previousSubmission?.submissionVersion) || 0) + 1
  };

  try {
    const storedBlob = await mediaStore.get(submittedMediaId);
      if (!storedBlob) {
      throw new Error("The selected media is missing from device storage.");
      }
    state.submissions[questId] = nextSubmission;
    delete state.drafts[questId];
    save();
    analyticsSync?.trackQuestSaved({
      questId,
      submission: nextSubmission,
      previousCompletedCount: totalsBeforeSave.completed,
      wasCompletedBefore
    });
      } 
    catch (error) {
    if (previousSubmission) state.submissions[questId] = previousSubmission;
    else delete state.submissions[questId];
    if (previousDraft) state.drafts[questId] = previousDraft;
    reportMediaError(error, "save");
    saveInProgress = false;
    if (completionStage) clearCompletionStage();
    els.saveQuest.disabled = false;
    els.saveQuest.textContent = previousSubmission
      ? "Save Changes"
      : finalQuest
        ? "Complete Final Quest"
        : "Complete Quest";
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
  questHasUnsavedChanges = false;
  renderQuest(activeQuest);

  els.announcement.textContent =
    `${activeQuest.title} completed. ${questPoints(nextSubmission, questId)} points earned.`;

  try {
    const shouldPlayFinale = finalQuestFinaleIsEligible({
      questId,
      isNewCompletion,
      completedCount: getTotals().completed,
      completionKey: finalQuestFinaleKey(nextSubmission)
    });

    if (shouldPlayFinale) {
      await playFinalQuestFinale(nextSubmission);
    } else if (completionStage) {
      await playCompletionCelebration(completionStage);
    }
  } finally {
    saveInProgress = false;
    els.saveQuest.disabled = false;
  }

  if (isNewCompletion && !finalQuest) {
    window.pendingStoryQuestId = questId;

    closeSheet(false);

    requestAnimationFrame(() => {
      els.viewBoard.click();
    });
  }
});

async function removeActiveMemory() {
  if (!activeQuest || saveInProgress || removeInProgress) return;
  const questId = activeQuest.id;
  const removedSubmission = state.submissions[questId] || null;
  const removedDraft = state.drafts[questId] || null;
  const mediaIds = new Set([
    removedSubmission?.mediaId,
    removedDraft?.mediaId
  ].filter(Boolean));

  removeInProgress = true;
  els.confirmRemoveMemory.disabled = true;
  els.confirmRemoveMemory.textContent = "Removing…";
  els.keepMemory.disabled = true;
  els.removeMemoryError.hidden = true;
  els.removeMemoryError.textContent = "";
  els.removeMemoryModal.querySelector("[role='dialog']")
    ?.setAttribute("aria-busy", "true");

  const mediaBackups = new Map();

  try {
    for (const mediaId of mediaIds) {
      const blob = await mediaStore.get(mediaId);
      if (blob) mediaBackups.set(mediaId, blob);
    }

    for (const mediaId of mediaIds) {
      await mediaStore.remove(mediaId);
    }

    delete state.submissions[questId];
    delete state.drafts[questId];
    save();
    analyticsSync?.reconcileQuestState?.({ reason: "quest_removed" });
    removeInProgress = false;
    closeRemoveConfirmation({ restoreFocus: false });
    activeMediaId = null;
    activeMediaType = null;
    mediaPreviewRequest += 1;
    renderMediaPreview(null, null);
    renderGrid();
    renderProgress();
    questHasUnsavedChanges = false;
    closeSheet(false);
  } catch (error) {
    if (removedSubmission) state.submissions[questId] = removedSubmission;
    else delete state.submissions[questId];
    if (removedDraft) state.drafts[questId] = removedDraft;
    else delete state.drafts[questId];

    let rollbackSucceeded = true;
    try {
      await Promise.all(Array.from(
        mediaBackups,
        ([mediaId, blob]) => mediaStore.put(mediaId, blob)
      ));
    } catch (restoreError) {
      rollbackSucceeded = false;
      console.error("[Media storage] Memory removal rollback failed.", restoreError);
    }

    console.error("[Media storage] Memory removal failed.", error);
    els.removeMemoryError.textContent = rollbackSucceeded
      ? "We couldn't remove this memory. Your saved memory is still available. Please try again."
      : "We couldn't finish removing this memory or restore its photo. Reload the app before trying again.";
    els.removeMemoryError.hidden = false;
    removeInProgress = false;
    els.confirmRemoveMemory.disabled = false;
    els.confirmRemoveMemory.textContent = "Remove Memory";
    els.keepMemory.disabled = false;
    requestAnimationFrame(() => els.confirmRemoveMemory.focus({ preventScroll: true }));
  } finally {
    els.removeMemoryModal.querySelector("[role='dialog']")
      ?.removeAttribute("aria-busy");
  }
}

els.remove.addEventListener("click", openRemoveConfirmation);
els.keepMemory.addEventListener("click", closeRemoveConfirmation);
els.confirmRemoveMemory.addEventListener("click", removeActiveMemory);
els.removeMemoryModal.addEventListener("click", (event) => {
  if (event.target === els.removeMemoryModal) {
    closeRemoveConfirmation();
  }
});
els.continueOnDesktop.addEventListener("click", closeDesktopNotice);
els.desktopNoticeModal.addEventListener("click", (event) => {
  if (event.target === els.desktopNoticeModal) {
    closeDesktopNotice();
  }
});
els.openPrivacyModal.addEventListener("click", openPrivacyModal);
els.closePrivacyModal.addEventListener("click", closePrivacyModal);
els.confirmPrivacyModal.addEventListener("click", closePrivacyModal);
els.privacySharingToggle.addEventListener("change", updatePrivacySharingPreference);
els.syncAnalyticsNow.addEventListener("click", syncAnonymousDataNow);
els.privacyModal.addEventListener("click", (event) => {
  if (event.target === els.privacyModal) closePrivacyModal();
});
els.openContactModal.addEventListener("click", openContactModal);
els.closeContactModal.addEventListener("click", closeContactModal);
els.contactDone.addEventListener("click", closeContactModal);
els.contactForm.addEventListener("submit", submitContactForm);
els.contactModal.addEventListener("click", (event) => {
  if (event.target === els.contactModal) closeContactModal();
});
els.footerInstallApp.addEventListener("click", (event) => {
  if (isRunningStandalone()) return;
  openHomeScreenHelp(event);
});

els.sheet.addEventListener("pointerdown", beginQuestSwipe);
els.sheet.addEventListener("pointermove", moveQuestSwipe);
els.sheet.addEventListener("pointerup", endQuestSwipe);
els.sheet.addEventListener("pointercancel", cancelQuestSwipe);
els.close.addEventListener("click", closeSheet);
els.closeHomeScreenSheet.addEventListener("click", closeHomeScreenHelp);
els.confirmHomeScreenHelp.addEventListener("click", () => {
  closeHomeScreenHelp();
});
els.homeScreenModalWrapper.addEventListener("click", (event) => {
  if (event.target === els.homeScreenModalWrapper) closeHomeScreenHelp();
});
els.backdrop.addEventListener("click", () => {
  closeSheet();
});

document.addEventListener("keydown", (event) => {
  const modal = activeModalContext();
  if (!modal || event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopImmediatePropagation();
    modal.close();
    return;
  }
  if (event.key === "Tab") {
    const focusable = Array.from(modal.wrapper.querySelectorAll(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])"
    )).filter(element => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!modal.wrapper.contains(document.activeElement)) {
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
  if (!modal.isQuest) return;
  const formControl = event.target.closest("input, textarea, select, [contenteditable='true']");
  if (formControl || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  navigateQuest(event.key === "ArrowLeft" ? -1 : 1);
});

window.addEventListener("pagehide", () => {
  if (activePreviewUrl) URL.revokeObjectURL(activePreviewUrl);
});
window.addEventListener("resize", () => {
  window.clearTimeout(desktopNoticeResizeTimer);
  desktopNoticeResizeTimer = window.setTimeout(reevaluateDesktopNotice, 240);
});
document.addEventListener("summerquest:pagechange", reevaluateDesktopNotice);

async function initializeApp() {
  initializeAnalyticsSync();
  const runningStandalone = isRunningStandalone();
  els.homeScreenHelpItem.hidden = runningStandalone;
  els.footerInstallItem.hidden = runningStandalone;
  setHomeScreenPlatform(detectedHomeScreenPlatform());

  mediaStore.requestPersistence().then(status => {
    console.info("[Media storage] Persistence status.", status);
  });

  let mediaReady = true;
  try {
    await migrateLegacyMediaState();
  } catch (error) {
    mediaReady = false;
    reportMediaError(error, "save");
  }

  if (mediaReady) {
    try {
      const removedCount = await mediaStore.removeUnreferenced(referencedMediaIds());
      if (removedCount) {
        console.info(`[Media storage] Removed ${removedCount} unreferenced media record(s).`);
      }
    } catch (error) {
      reportMediaError(error, "save");
    }
  }

  renderScoringRulesCopy();
  renderGrid();
  renderProgress();
  initBriefing();
  requestAnimationFrame(reevaluateDesktopNotice);
}

if (new URLSearchParams(window.location.search).has("release-critical-validation")) {
  window.SummerQuestTestHooks = Object.freeze({
    scoring: Object.freeze({
      migrationVersion: QUEST_DATA_MIGRATION_VERSION,
      pointsPerFriend: FRIEND_SCORING.pointsPerFriend,
      maxFriends: FRIEND_SCORING.maxFriends,
      maxFriendReward: MAX_FRIEND_REWARD,
      normalizeFriendCount,
      friendPointsFor,
      questPoints,
      totalsForSubmissions,
      rankForScore: currentRank,
      rankProgressForScore
    }),
    migrations: Object.freeze({
      version: QUEST_DATA_MIGRATION_VERSION,
      migrateSavedState
    }),
    storage: Object.freeze({
      referencedMediaIds: () => Array.from(referencedMediaIds()),
      audit: () => mediaStore.audit(referencedMediaIds()),
      estimate: mediaStore.estimateStorage,
      lastFailure: mediaStore.lastFailure
    }),
    dates: Object.freeze({
      localCalendarDate,
      parseLocalCalendarDate,
      isValidLocalCalendarDate,
      isSelectableAdventureDate,
      formatAdventureDate,
      adventureDateForSubmission,
      adventureDateForEditableRecord
    })
  });
}
if (new URLSearchParams(window.location.search).has("interaction-accessibility-validation")) {
  window.SummerQuestInteractionTestHooks = Object.freeze({
    openCropper,
    closeCropper,
    autosizeCaption,
    positionCaptionForKeyboard,
    syncCaptionViewport
  });
}
if (new URLSearchParams(window.location.search).has("desktop-mobile-validation")) {
  window.SummerQuestDesktopMobileTestHooks = Object.freeze({
    desktopNoticeConditions,
    openDesktopNotice,
    closeDesktopNotice,
    reevaluateDesktopNotice,
    resetDesktopNotice() {
      closeDesktopNotice({ restoreFocus: false });
      desktopNoticeShownThisDocument = false;
      try {
        sessionStorage.removeItem(DESKTOP_NOTICE_SESSION_KEY);
      } catch {
        // The in-memory reset is sufficient when storage is unavailable.
      }
    },
    positionFocusedControlForKeyboard: positionCaptionForKeyboard,
    syncFocusedControlViewport: syncCaptionViewport
  });
}
if (new URLSearchParams(window.location.search).has("finale-validation")) {
  window.SummerQuestFinaleTestHooks = Object.freeze({
    timing: finalQuestFinale?.timing,
    completionOrder: (entries) =>
      finalQuestFinale?.completionOrder(entries) || [],
    isEligible: finalQuestFinaleIsEligible,
    finaleEntries: finalQuestFinaleEntries,
    async replay() {
      const submission = completedSubmission(FINAL_QUEST_ID);
      if (!submission) return { played: false, reason: "final-quest-incomplete" };

      const finalQuest = boardItems.find((quest) => quest.id === FINAL_QUEST_ID);
      if (els.sheet.hidden) openSheet(finalQuest);
      else renderQuest(finalQuest);

      finalQuestFinaleCompletionKey = "";
      finalQuestFinale?.resetReplayGuardForDevelopment();
      return playFinalQuestFinale(submission);
    }
  });
}

initializeApp();
