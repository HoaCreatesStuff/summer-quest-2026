(() => {
  const ANALYTICS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw2it44r4HHcnJ67HgbkLZHBpfN4QeRTH3w1OK-kWaxy6nf_P-nfgV9XCVXGpq82PQ2/exec";
  const ANALYTICS_SECRET = "sq_8Fz3mQ7pL2xN9vK4cR6tY1wX5bD8eM";

  const INSTALLATION_ID_KEY = "summerQuestInstallationId";
  const SHARING_PREFERENCE_KEY = "summerQuestAnonymousSharingEnabled";
  const DEVELOPER_MODE_KEY = "summerQuestDeveloperMode";
  const DEVELOPER_PARAM = "developer";
  const DEDUPE_KEY = "summerQuestAnalyticsDedupe";
  const EVIDENCE_KEY = "summerQuestAnalyticsEvidenceV1";
  const BACKFILL_KEY = "summerQuestAnalyticsBackfillV1";
  const BACKFILL_VERSION = "1.0";
  const FETCH_TIMEOUT_MS = 2500;
  const BACKFILL_START_DELAY_MS = 500;
  const BACKFILL_BETWEEN_EVENTS_MS = 120;
  const DEBUG_PARAM = "summer-quest-analytics-debug";
  const PRODUCTION_PROTOCOL = "https:";
  const PRODUCTION_HOSTNAME = "hoacreatesstuff.github.io";
  const PRODUCTION_PATH_PREFIX = "/summer-quest-2026";

  const EVENT_FEATURES = Object.freeze({
    app_first_opened: "app",
    app_opened: "app",
    app_installed: "app",
    quest_completed: "gameplay",
    first_quest_completed: "gameplay",
    adventure_completed: "gameplay",
    journal_first_opened: "journal",
    journal_opened: "journal",
    keepsake_first_opened: "keepsake",
    keepsake_generated: "keepsake",
    privacy_opened: "privacy",
    feedback_submitted: "feedback"
  });
  const PERSISTENT_DEDUPE_KEYS = new Set([
    "app_first_opened",
    "app_installed",
    "first_quest_completed",
    "adventure_completed",
    "journal_first_opened",
    "keepsake_first_opened",
    "privacy_opened",
    "historical_adventure_completed"
  ]);
  const PERSISTENT_DEDUPE_PREFIXES = Object.freeze([
    "quest_completed:",
    "historical:",
    "historical_quest_completed:"
  ]);

  const debugMode = new URLSearchParams(window.location.search).has(DEBUG_PARAM);
  const sessionId = `SESSION-${randomHex(6)}`;
  const sessionEvents = new Set();

  let context = null;
  let initialized = false;
  let statusListeners = [];
  let historicalBackfillScheduled = false;
  let sessionDeveloperMode = null;

  function randomHex(length) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, length)
      .toUpperCase();
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function readStorage(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function readJson(key, fallback) {
    try {
      const raw = readStorage(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      return writeStorage(key, JSON.stringify(value));
    } catch {
      return false;
    }
  }

  function developerModeOverride() {
    if (sessionDeveloperMode !== null) return sessionDeveloperMode;
    const storedValue = readStorage(DEVELOPER_MODE_KEY);
    if (storedValue === "true") return true;
    if (storedValue === "false") return false;
    return null;
  }

  function applyDeveloperModeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requestedValue = params.get(DEVELOPER_PARAM);
    if (requestedValue !== "true" && requestedValue !== "false") return;

    sessionDeveloperMode = requestedValue === "true";
    writeStorage(DEVELOPER_MODE_KEY, requestedValue);
    params.delete(DEVELOPER_PARAM);

    const query = params.toString();
    const pathname = window.location.pathname || "/";
    const hash = window.location.hash || "";
    const cleanedUrl = `${pathname}${query ? `?${query}` : ""}${hash}`;
    try {
      window.history.replaceState(window.history.state, "", cleanedUrl);
    } catch {
      // Developer Mode still applies when URL cleanup is unavailable.
    }
  }

  function appVersion() {
    return (
      context?.appVersion ||
      window.SUMMER_QUEST_BUILD?.version ||
      document.querySelector("meta[name='application-version']")?.content ||
      "unknown"
    );
  }

  function displayMode() {
    const modes = ["fullscreen", "standalone", "minimal-ui", "window-controls-overlay", "browser"];
    if (navigator.standalone === true) return "standalone";
    return modes.find(mode => window.matchMedia?.(`(display-mode: ${mode})`)?.matches) || "browser";
  }

  function platform() {
    return navigator.userAgentData?.platform || navigator.platform || "unknown";
  }

  function runtimeEnvironment() {
    const developerMode = developerModeOverride();
    if (developerMode !== null) {
      return developerMode
        ? { environment: "development", is_test: true }
        : { environment: "beta", is_test: false };
    }

    const pathname = window.location.pathname || "/";
    const isProduction =
      window.location.protocol === PRODUCTION_PROTOCOL &&
      window.location.hostname === PRODUCTION_HOSTNAME &&
      (pathname === PRODUCTION_PATH_PREFIX ||
        pathname.startsWith(`${PRODUCTION_PATH_PREFIX}/`));

    return isProduction
      ? { environment: "beta", is_test: false }
      : { environment: "development", is_test: true };
  }

  function isSharingEnabled() {
    return readStorage(SHARING_PREFERENCE_KEY) !== "false";
  }

  function persistSharingPreference(enabled) {
    writeStorage(SHARING_PREFERENCE_KEY, enabled ? "true" : "false");
  }

  function getInstallationId({ create = false } = {}) {
    let id = readStorage(INSTALLATION_ID_KEY);
    if (!id && create) {
      id = `SQ-${randomHex(8)}`;
      if (!writeStorage(INSTALLATION_ID_KEY, id)) return "";
    }
    return id || "";
  }

  function getDedupe() {
    const dedupe = readJson(DEDUPE_KEY, {});
    return dedupe && typeof dedupe === "object" && !Array.isArray(dedupe) ? dedupe : {};
  }

  function hasSent(dedupeKey) {
    return Boolean(dedupeKey && getDedupe()[dedupeKey]);
  }

  function markSent(dedupeKey, timestamp = nowIso()) {
    if (!dedupeKey) return false;
    return writeJson(DEDUPE_KEY, {
      ...getDedupe(),
      [dedupeKey]: timestamp
    });
  }

  function removeObsoleteDedupe() {
    const dedupe = getDedupe();
    let changed = false;
    Object.keys(dedupe).forEach(key => {
      const allowed = PERSISTENT_DEDUPE_KEYS.has(key) ||
        PERSISTENT_DEDUPE_PREFIXES.some(prefix => key.startsWith(prefix));
      if (!allowed) {
        delete dedupe[key];
        changed = true;
      }
    });
    if (changed) writeJson(DEDUPE_KEY, dedupe);
  }

  function getEvidence() {
    const evidence = readJson(EVIDENCE_KEY, {});
    return evidence && typeof evidence === "object" && !Array.isArray(evidence)
      ? evidence
      : {};
  }

  function recordEvidence(eventName, source) {
    const evidence = getEvidence();
    if (evidence[eventName]) return evidence[eventName];
    const item = { timestamp: nowIso(), source };
    writeJson(EVIDENCE_KEY, { ...evidence, [eventName]: item });
    return item;
  }

  function migrateLegacyEvidence() {
    if (readStorage(SHARING_PREFERENCE_KEY) !== null) {
      recordEvidence("privacy_opened", "sharing_preference");
    }
  }

  function commonPayload(eventName, {
    historical = false,
    source,
    timestamp = nowIso()
  } = {}) {
    const feature = EVENT_FEATURES[eventName];
    if (!feature || !source) return null;

    const installationId = getInstallationId({ create: true });
    if (!installationId) return null;

    return {
      secret: ANALYTICS_SECRET,
      installationId,
      sessionId,
      eventName,
      timestamp,
      build: appVersion(),
      platform: platform(),
      displayMode: displayMode(),
      language: navigator.language || "unknown",
      historical: Boolean(historical),
      feature,
      source,
      ...runtimeEnvironment()
    };
  }

  function invokeFailureHandler(handler) {
    try {
      handler?.();
    } catch {
      // Debug callbacks must never affect gameplay.
    }
  }

  function sendLive(payload, { onFailure } = {}) {
    if (!payload || !isSharingEnabled() || navigator.onLine === false) return false;

    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      invokeFailureHandler(onFailure);
      return false;
    }

    let beaconAccepted = false;
    try {
      if (typeof navigator.sendBeacon === "function") {
        const beaconBody = new Blob([body], { type: "text/plain;charset=UTF-8" });
        beaconAccepted = navigator.sendBeacon(ANALYTICS_ENDPOINT, beaconBody) === true;
      }
    } catch {
      beaconAccepted = false;
    }
    if (beaconAccepted) return true;

    try {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        signal: controller.signal
      })
        .catch(() => invokeFailureHandler(onFailure))
        .finally(() => window.clearTimeout(timeout));
      return true;
    } catch {
      invokeFailureHandler(onFailure);
      return false;
    }
  }

  async function sendHistorical(payload) {
    if (!payload || !isSharingEnabled() || navigator.onLine === false) return false;

    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      return false;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      await fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        mode: "no-cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        signal: controller.signal
      });
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function trackLive(eventName, details = {}, {
    source,
    dedupeKey = "",
    sessionKey = "",
    additionalDedupeKeys = [],
    onFailure
  } = {}) {
    if (!isSharingEnabled() || navigator.onLine === false) return false;
    if (dedupeKey && hasSent(dedupeKey)) return false;
    if (sessionKey && sessionEvents.has(sessionKey)) return false;

    const common = commonPayload(eventName, { historical: false, source });
    if (!common) return false;
    const initiated = sendLive({ ...details, ...common }, { onFailure });
    if (!initiated) return false;

    [dedupeKey, ...additionalDedupeKeys]
      .filter(Boolean)
      .forEach(key => markSent(key));
    if (sessionKey) sessionEvents.add(sessionKey);
    notifyStatus();
    return true;
  }

  function validQuestId(questId) {
    return Boolean(questId && context?.quests?.[questId]);
  }

  function completedEntries() {
    const submissions = context?.getState?.().submissions || {};
    return (context?.boardOrder || [])
      .map(questId => ({ questId, submission: submissions[questId] }))
      .filter(({ questId, submission }) => validQuestId(questId) && submission?.completed === true);
  }

  function firstCompletedEntry(entries = completedEntries()) {
    return [...entries].sort((left, right) => {
      const leftTime = Date.parse(left.submission?.completedAt || "");
      const rightTime = Date.parse(right.submission?.completedAt || "");
      if (Number.isNaN(leftTime)) return 1;
      if (Number.isNaN(rightTime)) return -1;
      return leftTime - rightTime;
    })[0] || null;
  }

  function totalFriends(entries = completedEntries()) {
    return entries.reduce((sum, { questId, submission }) => {
      if (context?.isFinalQuest?.(questId)) return sum;
      return sum + context.normalizeFriendCount(submission?.friends);
    }, 0);
  }

  function completedAt(submission, { fallbackToNow = false } = {}) {
    const timestamp = Date.parse(submission?.completedAt || "");
    if (!Number.isNaN(timestamp)) return new Date(timestamp).toISOString();
    return fallbackToNow ? nowIso() : null;
  }

  function bonusIds(questId, submission) {
    const quest = context?.quests?.[questId];
    const selected = context?.canonicalSelectedBonusIds?.(quest, submission) || [];
    return selected.filter(bonusId => typeof bonusId === "string" && bonusId);
  }

  function questCompletionDetails(questId, submission, { historical }) {
    const quest = context?.quests?.[questId];
    if (!quest || !submission?.completed) return null;

    const selectedBonusIds = bonusIds(questId, submission);
    return {
      questId,
      questTitle: quest.title,
      completedAt: completedAt(submission, { fallbackToNow: !historical }),
      adventureDate: submission.adventureDate || null,
      points: context?.questPoints?.(submission, questId) || 0,
      friendCount: context?.isFinalQuest?.(questId)
        ? 0
        : context.normalizeFriendCount(submission?.friends),
      bonusEarned: selectedBonusIds.length > 0,
      bonusCount: selectedBonusIds.length,
      bonusIds: selectedBonusIds
    };
  }

  function adventureCompletionDetails(entries, finalEntry) {
    const totals = context.totalsForSubmissions(context.getState().submissions);
    return {
      totalCompletedQuests: totals.completed,
      totalPoints: totals.score,
      totalFriends: totalFriends(entries),
      finalRank: context.rankForScore?.(totals.score)?.title || null,
      completedAt: completedAt(finalEntry.submission, { fallbackToNow: true })
    };
  }

  function historicalKey(eventName, suffix = "") {
    if (eventName === "quest_completed") {
      return `historical_quest_completed:${suffix}`;
    }
    if (eventName === "adventure_completed") {
      return "historical_adventure_completed";
    }
    return `historical:${eventName}${suffix ? `:${suffix}` : ""}`;
  }

  function delay(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  async function backfillEvent(eventName, details, {
    source,
    progressKey,
    canonicalKey = "",
    timestamp
  }) {
    if (hasSent(progressKey)) return true;
    if (canonicalKey && hasSent(canonicalKey)) {
      markSent(progressKey);
      return true;
    }
    if (!isSharingEnabled() || navigator.onLine === false) return false;

    const common = commonPayload(eventName, {
      historical: true,
      source,
      timestamp: timestamp || nowIso()
    });
    if (!common) return false;
    const sent = await sendHistorical({ ...details, ...common });
    if (!sent) return false;

    markSent(progressKey);
    if (canonicalKey) markSent(canonicalKey);
    notifyStatus();
    await delay(BACKFILL_BETWEEN_EVENTS_MS);
    return true;
  }

  function hasHistoricalEvidence() {
    return Object.keys(getEvidence()).length > 0 || completedEntries().length > 0;
  }

  function isExistingInstallation() {
    return Boolean(
      getInstallationId() ||
      context?.hadStoredAppState ||
      hasHistoricalEvidence() ||
      displayMode() !== "browser"
    );
  }

  function backfillComplete() {
    return readStorage(BACKFILL_KEY) === BACKFILL_VERSION;
  }

  async function backfillHistoricalEvents() {
    if (backfillComplete()) return true;
    if (!isSharingEnabled() || navigator.onLine === false) return false;
    if (!getInstallationId({ create: true })) return false;

    const evidence = getEvidence();
    const entries = completedEntries();
    const firstEntry = firstCompletedEntry(entries);
    const finalEntry = entries.find(({ questId }) => context?.isFinalQuest?.(questId));
    const tasks = [];

    tasks.push(() => backfillEvent("app_first_opened", {}, {
      source: "existing_installation",
      progressKey: historicalKey("app_first_opened"),
      canonicalKey: "app_first_opened"
    }));

    if (evidence.app_installed || hasSent("app_installed") || displayMode() !== "browser") {
      tasks.push(() => backfillEvent("app_installed", {}, {
        source: evidence.app_installed?.source || "standalone_detection",
        progressKey: historicalKey("app_installed"),
        canonicalKey: "app_installed",
        timestamp: evidence.app_installed?.timestamp
      }));
    }

    entries.forEach(({ questId, submission }) => {
      tasks.push(() => backfillEvent(
        "quest_completed",
        questCompletionDetails(questId, submission, { historical: true }),
        {
          source: "saved_state",
          progressKey: historicalKey("quest_completed", questId),
          canonicalKey: `quest_completed:${questId}`,
          timestamp: completedAt(submission)
        }
      ));
    });

    if (firstEntry) {
      tasks.push(() => backfillEvent(
        "first_quest_completed",
        questCompletionDetails(firstEntry.questId, firstEntry.submission, { historical: true }),
        {
          source: "saved_state",
          progressKey: historicalKey("first_quest_completed"),
          canonicalKey: "first_quest_completed",
          timestamp: completedAt(firstEntry.submission)
        }
      ));
    }

    if (finalEntry) {
      tasks.push(() => backfillEvent(
        "adventure_completed",
        adventureCompletionDetails(entries, finalEntry),
        {
          source: "saved_state",
          progressKey: historicalKey("adventure_completed"),
          canonicalKey: "adventure_completed",
          timestamp: completedAt(finalEntry.submission)
        }
      ));
    }

    [
      ["journal_first_opened", "journal_first_opened"],
      ["keepsake_first_opened", "keepsake_first_opened"],
      ["keepsake_generated", "keepsake_generated"],
      ["privacy_opened", "privacy_opened"],
      ["feedback_submitted", "feedback_submitted"]
    ].forEach(([eventName, evidenceName]) => {
      const item = evidence[evidenceName];
      if (!item) return;
      const repeatable = eventName === "keepsake_generated" || eventName === "feedback_submitted";
      tasks.push(() => backfillEvent(eventName, {}, {
        source: item.source || "stored_evidence",
        progressKey: historicalKey(eventName),
        canonicalKey: repeatable ? "" : eventName,
        timestamp: item.timestamp
      }));
    });

    for (const task of tasks) {
      if (!(await task())) return false;
    }

    return writeStorage(BACKFILL_KEY, BACKFILL_VERSION);
  }

  function scheduleHistoricalBackfill() {
    if (backfillComplete() || historicalBackfillScheduled) return false;
    if (!isSharingEnabled() || navigator.onLine === false) return false;
    if (!getInstallationId({ create: true })) return false;

    historicalBackfillScheduled = true;
    window.setTimeout(() => {
      backfillHistoricalEvents().catch(() => {
        // Unmarked events retry on a future online launch.
      });
    }, BACKFILL_START_DELAY_MS);
    return true;
  }

  function debugQuestCompletion(message, questId) {
    if (!debugMode) return;
    console.info(message, { questId });
  }

  function debugState() {
    return {
      endpointConfigured: Boolean(ANALYTICS_ENDPOINT),
      installationId: readStorage(INSTALLATION_ID_KEY) || null,
      sessionId,
      sharingEnabled: isSharingEnabled(),
      backfillComplete: backfillComplete(),
      dedupe: getDedupe(),
      evidence: getEvidence()
    };
  }

  function notifyStatus() {
    const status = debugState();
    statusListeners.forEach(listener => {
      try {
        listener(status);
      } catch {
        // Analytics observers must never affect gameplay.
      }
    });
  }

  function startSessionAnalytics() {
    if (!isSharingEnabled() || navigator.onLine === false) return false;

    if (!isExistingInstallation()) {
      const firstOpened = trackLive("app_first_opened", {}, {
        source: "app_init",
        dedupeKey: "app_first_opened",
        additionalDedupeKeys: [historicalKey("app_first_opened")]
      });
      if (firstOpened) writeStorage(BACKFILL_KEY, BACKFILL_VERSION);
    } else {
      scheduleHistoricalBackfill();
    }

    return trackLive("app_opened", {}, {
      source: "app_init",
      sessionKey: "app_opened"
    });
  }

  function setSharingEnabled(enabled) {
    const sharingEnabled = Boolean(enabled);
    persistSharingPreference(sharingEnabled);
    notifyStatus();
    if (sharingEnabled) startSessionAnalytics();
  }

  function init(nextContext) {
    context = nextContext;
    removeObsoleteDedupe();
    migrateLegacyEvidence();

    if (!initialized) {
      initialized = true;
      window.addEventListener("appinstalled", () => {
        api.trackAppInstalled("browser_install_event");
      });
    }

    startSessionAnalytics();
    if (debugMode) {
      window.SummerQuestAnalyticsDebug = Object.freeze({
        state: debugState,
        backfill: backfillHistoricalEvents
      });
      console.info("[Summer Quest analytics] Debug hooks available at window.SummerQuestAnalyticsDebug.");
    }
    notifyStatus();
    return api;
  }

  const api = {
    init,
    isSharingEnabled,
    setSharingEnabled,
    onStatusChange(listener) {
      statusListeners.push(listener);
      return () => {
        statusListeners = statusListeners.filter(candidate => candidate !== listener);
      };
    },
    trackAppInstalled(source = "browser_install_event") {
      const evidence = recordEvidence("app_installed", source);
      return trackLive("app_installed", {}, {
        source,
        dedupeKey: "app_installed",
        additionalDedupeKeys: [historicalKey("app_installed")]
      }) || Boolean(evidence && hasSent("app_installed"));
    },
    trackJournalOpened() {
      recordEvidence("journal_first_opened", "journal_navigation");
      trackLive("journal_first_opened", {}, {
        source: "journal_navigation",
        dedupeKey: "journal_first_opened",
        additionalDedupeKeys: [historicalKey("journal_first_opened")]
      });
      return trackLive("journal_opened", {}, {
        source: "journal_navigation",
        sessionKey: "journal_opened"
      });
    },
    trackKeepsakeOpened() {
      recordEvidence("keepsake_first_opened", "keepsake_navigation");
      return trackLive("keepsake_first_opened", {}, {
        source: "keepsake_navigation",
        dedupeKey: "keepsake_first_opened",
        additionalDedupeKeys: [historicalKey("keepsake_first_opened")]
      });
    },
    trackKeepsakeGenerated() {
      recordEvidence("keepsake_generated", "keepsake_generation");
      return trackLive("keepsake_generated", {}, {
        source: "keepsake_generation",
        additionalDedupeKeys: [historicalKey("keepsake_generated")]
      });
    },
    trackPrivacyOpened() {
      recordEvidence("privacy_opened", "privacy_dialog");
      return trackLive("privacy_opened", {}, {
        source: "privacy_dialog",
        dedupeKey: "privacy_opened",
        additionalDedupeKeys: [historicalKey("privacy_opened")]
      });
    },
    trackFeedbackSubmitted() {
      recordEvidence("feedback_submitted", "formspree_success");
      return trackLive("feedback_submitted", {}, {
        source: "formspree_success",
        additionalDedupeKeys: [historicalKey("feedback_submitted")]
      });
    },
    trackQuestSaved({
      questId,
      submission,
      previousCompletedCount = 0,
      wasCompletedBefore = false
    } = {}) {
      if (wasCompletedBefore) {
        debugQuestCompletion("[Analytics] quest_completed skipped: already completed", questId);
        return false;
      }

      const details = questCompletionDetails(questId, submission, { historical: false });
      if (!details) return false;

      const dedupeKey = `quest_completed:${questId}`;
      if (hasSent(dedupeKey)) {
        debugQuestCompletion("[Analytics] quest_completed skipped: already completed", questId);
        return false;
      }
      if (!isSharingEnabled()) {
        debugQuestCompletion("[Analytics] quest_completed skipped: sharing off", questId);
        return false;
      }
      if (navigator.onLine === false) {
        debugQuestCompletion("[Analytics] quest_completed failed", questId);
        return false;
      }

      const entries = completedEntries();
      debugQuestCompletion("[Analytics] quest_completed prepared", questId);
      const initiated = trackLive("quest_completed", details, {
        source: "quest_save",
        dedupeKey,
        additionalDedupeKeys: [historicalKey("quest_completed", questId)],
        onFailure: () => debugQuestCompletion("[Analytics] quest_completed failed", questId)
      });
      if (!initiated) {
        debugQuestCompletion("[Analytics] quest_completed failed", questId);
        return false;
      }
      debugQuestCompletion("[Analytics] quest_completed sent", questId);

      if (previousCompletedCount === 0 && entries.length === 1) {
        trackLive("first_quest_completed", details, {
          source: "quest_save",
          dedupeKey: "first_quest_completed",
          additionalDedupeKeys: [historicalKey("first_quest_completed")]
        });
      }

      if (context?.isFinalQuest?.(questId)) {
        const finalEntry = entries.find(entry => entry.questId === questId) || {
          questId,
          submission
        };
        trackLive("adventure_completed", adventureCompletionDetails(entries, finalEntry), {
          source: "quest_save",
          dedupeKey: "adventure_completed",
          additionalDedupeKeys: [historicalKey("adventure_completed")]
        });
      }

      return true;
    },
    debugState
  };

  applyDeveloperModeFromUrl();
  window.SummerQuestAnalytics = api;
})();
