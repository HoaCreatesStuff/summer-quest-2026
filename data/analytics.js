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
  const DEBUG_PARAM = "summer-quest-analytics-debug";

  const debugMode = new URLSearchParams(window.location.search).has(DEBUG_PARAM);
  const sessionId = `SESSION-${randomHex(6)}`;

  let context = null;
  let statusListeners = [];

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

  function send(payload) {
    if (!payload || !isSharingEnabled() || navigator.onLine === false) return;

    let body;
    try {
      body = JSON.stringify(payload);
    } catch {
      return;
    }
    try {
      if (navigator.sendBeacon) {
        const beaconBody = new Blob([body], { type: "text/plain;charset=UTF-8" });
        if (navigator.sendBeacon(ANALYTICS_ENDPOINT, beaconBody)) return;
      }
    } catch {
      // Fall through to fetch.
    }

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
        .catch(() => {})
        .finally(() => window.clearTimeout(timeout));
    } catch {
      // Silent by design.
    }
  }

  function track(eventName, details = {}, { dedupeKey = "" } = {}) {
    if (!isSharingEnabled()) return false;
    if (navigator.onLine === false) return false;
    if (dedupeKey && hasSent(dedupeKey)) return false;

    const payload = commonPayload(eventName);
    if (!payload) return false;
    if (dedupeKey) markSent(dedupeKey);
    send({ ...payload, ...details });
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

  function totalPoints() {
    return context?.totalsForSubmissions?.(context.getState().submissions).score || 0;
  }

  function questDetails(questId) {
    const quest = context?.quests?.[questId];
    if (!quest) return null;
    return {
      questId,
      questTitle: quest.title
    };
  }

  function completionTimestamp(submission) {
    const completedAt = Date.parse(submission?.completedAt || "");
    return Number.isNaN(completedAt) ? nowIso() : new Date(completedAt).toISOString();
  }

  function bonusEarned(questId, submission) {
    const quest = context?.quests?.[questId];
    const selected = context?.canonicalSelectedBonusIds?.(quest, submission) || [];
    return selected.reduce((total, bonusId) => {
      const bonus = quest?.bonuses?.find(candidate => candidate.id === bonusId);
      return total + (Number.isFinite(bonus?.points) ? bonus.points : 0);
    }, 0);
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
    persistSharingPreference(Boolean(enabled));
    notifyStatus();
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
    trackQuestSaved({ questId, submission, previousCompletedCount = 0, isNewCompletion = false } = {}) {
      const details = questDetails(questId);
      if (!details || !submission?.completed || !isNewCompletion) return false;

      const entries = completedEntries();
      const points = context?.questPoints?.(submission, questId) || 0;
      const friendCount = context?.isFinalQuest?.(questId)
        ? 0
        : context.normalizeFriendCount(submission?.friends);

      track("quest_completed", {
        ...details,
        completionTimestamp: completionTimestamp(submission),
        adventureDate: submission.adventureDate || null,
        points,
        friendCount,
        bonusEarned: bonusEarned(questId, submission)
      }, {
        dedupeKey: `quest_completed:${questId}`
      });

      if (previousCompletedCount === 0 && entries.length === 1) {
        track("first_quest_completed", {}, {
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
          completionTimestamp: completionTimestamp(submission)
        }, {
          dedupeKey: "adventure_completed"
        });
      }

      return true;
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
