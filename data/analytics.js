(() => {
  const ANALYTICS_ENDPOINT = "https://script.google.com/macros/s/AKfycbw2it44r4HHcnJ67HgbkLZHBpfN4QeRTH3w1OK-kWaxy6nf_P-nfgV9XCVXGpq82PQ2/exec";
  const ANALYTICS_SECRET = "sq_8Fz3mQ7pL2xN9vK4cR6tY1wX5bD8eM";

  const INSTALLATION_ID_KEY = "summerQuestInstallationId";
  const SHARING_PREFERENCE_KEY = "summerQuestAnonymousSharingEnabled";
  const DEDUPE_KEY = "summerQuestAnalyticsDedupe";
  const LEGACY_ANALYTICS_KEYS = Object.freeze([
    "summerQuestAnalyticsQueue",
    "summerQuestAnalyticsMeta",
    "summerQuestAnalyticsMilestones",
    "summerQuestHistoricalImportVersion",
    "summerQuestFinalSummarySyncVersion"
  ]);
  const FETCH_TIMEOUT_MS = 2500;
  const BACKFILL_START_DELAY_MS = 500;
  const BACKFILL_BETWEEN_EVENTS_MS = 120;
  const DEBUG_PARAM = "summer-quest-analytics-debug";

  const debugMode = new URLSearchParams(window.location.search).has(DEBUG_PARAM);
  const sessionId = `SESSION-${randomHex(6)}`;

  let context = null;
  let statusListeners = [];
  let historicalBackfillScheduled = false;

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

  function removeStorage(key) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Analytics storage must never affect gameplay.
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
      writeStorage(key, JSON.stringify(value));
    } catch {
      // Analytics storage must never affect gameplay.
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

  function markSent(dedupeKey) {
    if (!dedupeKey) return;
    writeJson(DEDUPE_KEY, {
      ...getDedupe(),
      [dedupeKey]: nowIso()
    });
  }

  function commonPayload(eventName) {
    const installationId = getInstallationId({ create: true });
    if (!installationId) return null;

    return {
      secret: ANALYTICS_SECRET,
      installationId,
      sessionId,
      eventName,
      timestamp: nowIso(),
      build: appVersion(),
      platform: platform(),
      displayMode: displayMode(),
      language: navigator.language || "unknown"
    };
  }

  function invokeFailureHandler(handler) {
    try {
      handler?.();
    } catch {
      // Debug callbacks must never affect gameplay.
    }
  }

  function send(payload, { onFailure } = {}) {
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

  function track(
    eventName,
    details = {},
    { dedupeKey = "", additionalDedupeKeys = [], onFailure } = {}
  ) {
    if (!isSharingEnabled()) return false;
    if (navigator.onLine === false) return false;
    if (dedupeKey && hasSent(dedupeKey)) return false;

    const payload = commonPayload(eventName);
    if (!payload) return false;
    const initiated = send({ ...details, ...payload }, { onFailure });
    if (!initiated) return false;

    [dedupeKey, ...additionalDedupeKeys].filter(Boolean).forEach(markSent);
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

  function totalFriends(entries = completedEntries()) {
    return entries.reduce((sum, { questId, submission }) => {
      if (context?.isFinalQuest?.(questId)) return sum;
      return sum + context.normalizeFriendCount(submission?.friends);
    }, 0);
  }

  function questDetails(questId) {
    const quest = context?.quests?.[questId];
    if (!quest) return null;
    return {
      questId,
      questTitle: quest.title
    };
  }

  function completedAt(submission, { fallbackToNow = false } = {}) {
    const completedAt = Date.parse(submission?.completedAt || "");
    if (!Number.isNaN(completedAt)) return new Date(completedAt).toISOString();
    return fallbackToNow ? nowIso() : null;
  }

  function bonusIds(questId, submission) {
    const quest = context?.quests?.[questId];
    const selected = context?.canonicalSelectedBonusIds?.(quest, submission) || [];
    return selected.filter(bonusId => typeof bonusId === "string" && bonusId);
  }

  function questCompletionDetails(questId, submission, { historical }) {
    const details = questDetails(questId);
    if (!details || !submission?.completed) return null;

    const selectedBonusIds = bonusIds(questId, submission);
    return {
      ...details,
      completedAt: completedAt(submission, { fallbackToNow: !historical }),
      adventureDate: submission.adventureDate || null,
      points: context?.questPoints?.(submission, questId) || 0,
      friendCount: context?.isFinalQuest?.(questId)
        ? 0
        : context.normalizeFriendCount(submission?.friends),
      bonusEarned: selectedBonusIds.length > 0,
      bonusCount: selectedBonusIds.length,
      bonusIds: selectedBonusIds,
      historical: Boolean(historical)
    };
  }

  function historicalQuestKey(questId) {
    return `historical_quest_completed:${questId}`;
  }

  function delay(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  async function backfillHistoricalQuestCompletions() {
    if (!isSharingEnabled() || navigator.onLine === false) return false;
    if (!getInstallationId({ create: true })) return false;

    const entries = completedEntries();
    for (const { questId, submission } of entries) {
      if (!isSharingEnabled() || navigator.onLine === false) break;

      const dedupeKey = historicalQuestKey(questId);
      if (hasSent(dedupeKey)) continue;

      const details = questCompletionDetails(questId, submission, {
        historical: true
      });
      const common = commonPayload("quest_completed");
      if (!details || !common) continue;

      const sent = await sendHistorical({ ...details, ...common });
      if (sent) {
        markSent(dedupeKey);
        markSent(`quest_completed:${questId}`);
        notifyStatus();
      }
      await delay(BACKFILL_BETWEEN_EVENTS_MS);
    }

    const finalEntry = entries.find(({ questId }) => context?.isFinalQuest?.(questId));
    const adventureDedupeKey = "historical_adventure_completed";
    if (
      finalEntry &&
      isSharingEnabled() &&
      navigator.onLine !== false &&
      !hasSent(adventureDedupeKey)
    ) {
      const totals = context.totalsForSubmissions(context.getState().submissions);
      const common = commonPayload("adventure_completed");
      if (common) {
        const sent = await sendHistorical({
          totalCompletedQuests: totals.completed,
          totalPoints: totals.score,
          totalFriends: totalFriends(entries),
          finalRank: context.rankForScore?.(totals.score)?.title || null,
          completedAt: completedAt(finalEntry.submission),
          historical: true,
          ...common
        });
        if (sent) {
          markSent(adventureDedupeKey);
          markSent("adventure_completed");
          notifyStatus();
        }
      }
    }
    return true;
  }

  function scheduleHistoricalBackfill() {
    if (historicalBackfillScheduled) return false;
    if (!isSharingEnabled() || navigator.onLine === false) return false;
    if (!getInstallationId({ create: true })) return false;

    historicalBackfillScheduled = true;
    window.setTimeout(() => {
      backfillHistoricalQuestCompletions().catch(() => {
        // A future online launch may retry any unmarked historical events.
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
      dedupe: getDedupe()
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

  function setSharingEnabled(enabled) {
    const sharingEnabled = Boolean(enabled);
    persistSharingPreference(sharingEnabled);
    notifyStatus();
    if (sharingEnabled) scheduleHistoricalBackfill();
  }

  function resetInstallation() {
    removeStorage(INSTALLATION_ID_KEY);
    removeStorage(DEDUPE_KEY);
    LEGACY_ANALYTICS_KEYS.forEach(removeStorage);
  }

  function init(nextContext) {
    context = nextContext;
    if (isSharingEnabled()) {
      track("app_opened");
      scheduleHistoricalBackfill();
    }
    window.addEventListener("appinstalled", () => {
      api.trackAppInstalled("native");
    });
    if (debugMode) {
      window.SummerQuestAnalyticsDebug = Object.freeze({
        state: debugState,
        track,
        resetInstallation
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
    resetInstallation,
    onStatusChange(listener) {
      statusListeners.push(listener);
      return () => {
        statusListeners = statusListeners.filter(candidate => candidate !== listener);
      };
    },
    trackFeature(eventName, details = {}, options = {}) {
      return track(eventName, details, options);
    },
    trackMissionBriefingCompleted() {
      return track("mission_briefing_completed", {}, {
        dedupeKey: "mission_briefing_completed"
      });
    },
    trackAppInstalled(source = "manual") {
      return track("app_installed", { source }, {
        dedupeKey: "app_installed"
      });
    },
    trackQuestOpened(questId) {
      const details = questDetails(questId);
      if (!details) return false;
      return track("quest_opened", details, {
        dedupeKey: `quest_opened:${questId}`
      });
    },
    trackQuestSaved({
      questId,
      submission,
      previousCompletedCount = 0,
      wasCompletedBefore = false
    } = {}) {
      if (wasCompletedBefore) {
        debugQuestCompletion(
          "[Analytics] quest_completed skipped: already completed",
          questId
        );
        return false;
      }

      const details = questCompletionDetails(questId, submission, {
        historical: false
      });
      if (!details) return false;

      const dedupeKey = `quest_completed:${questId}`;
      if (hasSent(dedupeKey)) {
        debugQuestCompletion(
          "[Analytics] quest_completed skipped: already completed",
          questId
        );
        return false;
      }
      if (!isSharingEnabled()) {
        debugQuestCompletion(
          "[Analytics] quest_completed skipped: sharing off",
          questId
        );
        return false;
      }
      if (navigator.onLine === false) {
        debugQuestCompletion("[Analytics] quest_completed failed", questId);
        return false;
      }

      const entries = completedEntries();
      debugQuestCompletion("[Analytics] quest_completed prepared", questId);
      const initiated = track("quest_completed", details, {
        dedupeKey,
        additionalDedupeKeys: [historicalQuestKey(questId)],
        onFailure: () => debugQuestCompletion(
          "[Analytics] quest_completed failed",
          questId
        )
      });
      if (!initiated) {
        debugQuestCompletion("[Analytics] quest_completed failed", questId);
        return false;
      }
      debugQuestCompletion("[Analytics] quest_completed sent", questId);

      if (previousCompletedCount === 0 && entries.length === 1) {
        track("first_quest_completed", { historical: false }, {
          dedupeKey: "first_quest_completed"
        });
      }

      if (context?.isFinalQuest?.(questId)) {
        const totals = context.totalsForSubmissions(context.getState().submissions);
        track("adventure_completed", {
          totalCompletedQuests: totals.completed,
          totalPoints: totals.score,
          totalFriends: totalFriends(entries),
          finalRank: context.rankForScore?.(totals.score)?.title || null,
          completedAt: completedAt(submission, { fallbackToNow: true }),
          historical: false
        }, {
          dedupeKey: "adventure_completed",
          additionalDedupeKeys: ["historical_adventure_completed"]
        });
      }

      return true;
    },
    trackHistoricalQuestCompletions() {
      return scheduleHistoricalBackfill();
    },
    trackQuestRemoved() {
      return false;
    },
    trackBoardReset() {
      resetInstallation();
      return false;
    },
    debugState
  };

  window.SummerQuestAnalytics = api;
})();
