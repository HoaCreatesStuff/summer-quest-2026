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
  const BACKFILL_STATE_KEY = "summerQuestAnalyticsBackfillStateV2";
  const BACKFILL_VERSION = "1.0";
  const FIRST_OPENED_AT_KEY = "summerQuestFirstOpenedAt";
  const FEATURE_FIRST_OPEN_KEY = "summerQuestFeatureFirstOpenedV1";
  const FIRST_OPEN_MIGRATION_KEY = "summerQuestFirstOpenMigrationV1";
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
    keepsake_opened: "keepsake",
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
  const FIRST_OPEN_EVENTS = Object.freeze([
    "app_first_opened",
    "journal_first_opened",
    "keepsake_first_opened"
  ]);

  const debugMode = new URLSearchParams(window.location.search).has(DEBUG_PARAM);
  const sessionId = `SESSION-${randomHex(6)}`;
  const sessionEvents = new Set();

  let context = null;
  let initialized = false;
  let statusListeners = [];
  let historicalBackfillScheduled = false;
  let sessionDeveloperMode = null;
  let receiverRepairStats = {
    duplicateFirstOpenEventsDetected: 0,
    incorrectRowsRepaired: 0
  };

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

  function validIso(value) {
    const timestamp = Date.parse(value || "");
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  function localDateToIso(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T12:00:00.000`);
    return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
  }

  function earliestIso(values) {
    return values
      .map(validIso)
      .filter(Boolean)
      .sort((left, right) => Date.parse(left) - Date.parse(right))[0] || null;
  }

  function savedQuestEntries() {
    const submissions = context?.getState?.().submissions || {};
    return Object.entries(submissions)
      .filter(([, submission]) => submission && typeof submission === "object")
      .map(([questId, submission]) => ({ questId, submission }));
  }

  function savedQuestRecordCount() {
    return savedQuestEntries().length;
  }

  function completedQuestRecordCount() {
    return completedEntries().length;
  }

  function normalizedHistoricalQuestRecords(entries = completedEntries()) {
    return entries
      .map(({ questId, submission }) => ({
        questId,
        details: questCompletionDetails(questId, submission, { historical: true }),
        timestamp: completedAt(submission)
      }))
      .filter(record => record.details && record.timestamp);
  }

  function normalizedHistoricalRecordCount() {
    return normalizedHistoricalQuestRecords().length;
  }

  function persistedFirstOpenedAt() {
    return validIso(readStorage(FIRST_OPENED_AT_KEY));
  }

  function getFeatureFirstOpenState() {
    const state = readJson(FEATURE_FIRST_OPEN_KEY, {});
    return state && typeof state === "object" && !Array.isArray(state) ? state : {};
  }

  function writeFeatureFirstOpen(eventName, resolved) {
    if (!eventName || !resolved?.timestamp) return false;
    const existingState = getFeatureFirstOpenState();
    const existing = existingState[eventName];
    const existingTimestamp = validIso(existing?.timestamp);
    if (existingTimestamp && Date.parse(existingTimestamp) <= Date.parse(resolved.timestamp)) {
      return true;
    }
    return writeJson(FEATURE_FIRST_OPEN_KEY, {
      ...existingState,
      [eventName]: {
        timestamp: resolved.timestamp,
        source: resolved.source,
        historicalStatus: resolved.historicalStatus || "exact",
        timestampPrecision: resolved.timestampPrecision || "exact",
        evidenceUsed: resolved.evidenceUsed || "direct",
        firstObservedByAnalyticsAt: resolved.firstObservedByAnalyticsAt || null
      }
    });
  }

  function dedupeTimestamp(key) {
    return validIso(getDedupe()[key]);
  }

  function resolveFirstOpenedAt() {
    const persisted = persistedFirstOpenedAt();
    if (persisted) {
      return { timestamp: persisted, source: "persisted_first_open", exactTimeKnown: true };
    }

    const storedAppTimestamp = earliestIso([getEvidence().app_installed?.timestamp]);
    if (storedAppTimestamp) {
      return { timestamp: storedAppTimestamp, source: "stored_app_timestamp", exactTimeKnown: true };
    }

    const questCreatedTimestamp = earliestIso(savedQuestEntries().map(({ submission }) => submission.completedAt));
    if (questCreatedTimestamp) {
      return { timestamp: questCreatedTimestamp, source: "quest_record_created_at", exactTimeKnown: true };
    }

    const questDateTimestamp = earliestIso(
      completedEntries().map(({ submission }) => localDateToIso(submission.adventureDate))
    );
    if (questDateTimestamp) {
      return { timestamp: questDateTimestamp, source: "quest_completion_date", exactTimeKnown: false };
    }

    return { timestamp: nowIso(), source: "current_timestamp", exactTimeKnown: true };
  }

  function persistFirstOpenedAt(resolved) {
    if (!resolved?.timestamp) return false;
    const existing = persistedFirstOpenedAt();
    if (existing && Date.parse(existing) <= Date.parse(resolved.timestamp)) return true;
    writeFeatureFirstOpen("app_first_opened", {
      ...resolved,
      historicalStatus: "exact",
      timestampPrecision: resolved.exactTimeKnown ? "exact" : "estimated",
      evidenceUsed: resolved.source
    });
    return writeStorage(FIRST_OPENED_AT_KEY, resolved.timestamp);
  }

  function storedFeatureFirstOpen(eventName) {
    const stored = getFeatureFirstOpenState()[eventName];
    const timestamp = validIso(stored?.timestamp);
    if (!timestamp) return null;
    return {
      timestamp,
      source: stored.source || "persisted_feature_first_open",
      historicalStatus: stored.historicalStatus || "exact",
      timestampPrecision: stored.timestampPrecision || "exact",
      evidenceUsed: stored.evidenceUsed || "persisted_feature_first_open",
      firstObservedByAnalyticsAt: stored.firstObservedByAnalyticsAt || null
    };
  }

  function evidenceFirstOpen(eventName, evidenceName, fallbackSource) {
    const stored = storedFeatureFirstOpen(eventName);
    if (stored) return stored;

    const evidence = getEvidence()[evidenceName];
    const evidenceTimestamp = validIso(evidence?.timestamp);
    if (evidenceTimestamp) {
      return {
        timestamp: evidenceTimestamp,
        source: evidence.source || fallbackSource,
        historicalStatus: "exact",
        timestampPrecision: "exact",
        evidenceUsed: evidenceName,
        firstObservedByAnalyticsAt: evidenceTimestamp
      };
    }

    const sentTimestamp = dedupeTimestamp(eventName);
    if (sentTimestamp) {
      return {
        timestamp: sentTimestamp,
        source: "analytics_dedupe",
        historicalStatus: "exact",
        timestampPrecision: "exact",
        evidenceUsed: "analytics_dedupe",
        firstObservedByAnalyticsAt: sentTimestamp
      };
    }

    return null;
  }

  function resolveJournalFirstOpened() {
    return evidenceFirstOpen(
      "journal_first_opened",
      "journal_first_opened",
      "journal_navigation"
    );
  }

  function resolveKeepsakeFirstOpened() {
    const direct = evidenceFirstOpen(
      "keepsake_first_opened",
      "keepsake_first_opened",
      "keepsake_navigation"
    );
    if (direct) return direct;

    const generated = getEvidence().keepsake_generated;
    const generatedTimestamp = validIso(generated?.timestamp);
    if (generatedTimestamp) {
      return {
        timestamp: generatedTimestamp,
        source: "historical_import",
        historicalStatus: "inferred",
        timestampPrecision: "estimated",
        evidenceUsed: "keepsake_generated",
        firstObservedByAnalyticsAt: generatedTimestamp
      };
    }

    return null;
  }

  function resolveFeatureFirstOpen(eventName) {
    if (eventName === "app_first_opened") {
      const resolved = resolveFirstOpenedAt();
      return {
        timestamp: resolved.timestamp,
        source: resolved.source === "current_timestamp" ? "realtime" : "historical_import",
        historicalStatus: resolved.source === "current_timestamp" ? "exact" : "reconstructed",
        timestampPrecision: resolved.exactTimeKnown ? "exact" : "estimated",
        evidenceUsed: resolved.source,
        firstObservedByAnalyticsAt: null
      };
    }
    if (eventName === "journal_first_opened") return resolveJournalFirstOpened();
    if (eventName === "keepsake_first_opened") return resolveKeepsakeFirstOpened();
    return null;
  }

  function getFirstOpenMigrationState() {
    const state = readJson(FIRST_OPEN_MIGRATION_KEY, null);
    if (!state || typeof state !== "object" || state.version !== BACKFILL_VERSION) {
      return {
        version: BACKFILL_VERSION,
        status: "pending",
        eventsQueued: 0,
        eventsSynced: 0,
        duplicateFirstOpenEventsDetected: 0,
        incorrectRowsRepaired: 0,
        lastAttemptAt: null,
        lastError: null
      };
    }
    return state;
  }

  function writeFirstOpenMigrationState(patch) {
    return writeJson(FIRST_OPEN_MIGRATION_KEY, {
      ...getFirstOpenMigrationState(),
      ...patch,
      version: BACKFILL_VERSION
    });
  }

  function firstOpenMigrationPending() {
    const status = getFirstOpenMigrationState().status;
    return status === "pending" || status === "resolving" || status === "failed";
  }

  function blankBackfillState() {
    return {
      version: BACKFILL_VERSION,
      status: "not_started",
      legacyComplete: readStorage(BACKFILL_KEY) === BACKFILL_VERSION,
      savedQuestRecordCount: 0,
      completedQuestCount: 0,
      normalizedHistoricalRecordCount: 0,
      recordsQueued: 0,
      recordsUploaded: 0,
      lastAttemptAt: null,
      lastError: null,
      failureStage: null,
      failureReason: null,
      completed: false,
      completedAt: null
    };
  }

  function zeroRecordsBackfillState(patch = {}) {
    return writeBackfillState({
      status: "no_records",
      recordsQueued: 0,
      recordsUploaded: 0,
      completed: false,
      completedAt: null,
      ...patch
    });
  }

  function getBackfillState() {
    const stored = readJson(BACKFILL_STATE_KEY, null);
    if (!stored || typeof stored !== "object" || stored.version !== BACKFILL_VERSION) {
      return blankBackfillState();
    }
    return { ...blankBackfillState(), ...stored };
  }

  function writeBackfillState(patch) {
    const nextState = { ...getBackfillState(), ...patch, version: BACKFILL_VERSION };
    writeJson(BACKFILL_STATE_KEY, nextState);
    notifyStatus();
    return nextState;
  }

  function migrationLog(message, details = {}) {
    if (!debugMode && !runtimeEnvironment().is_test && developerModeOverride() !== true) return;
    console.info(`[Summer Quest analytics] ${message}`, details);
  }

  function migrationFailed(stage, reason, patch = {}) {
    migrationLog("Migration completed: false", { failureStage: stage, failureReason: reason });
    return writeBackfillState({
      status: "failed",
      lastError: reason,
      failureStage: stage,
      failureReason: reason,
      ...patch
    });
  }

  function stableEventKey(eventName, details = {}, common = {}) {
    const installationId = common.installationId || getInstallationId({ create: true });
    if (!installationId) return "";
    if (eventName === "quest_completed" && details.questId) {
      return `${installationId}:quest_completed:${details.questId}`;
    }
    if (eventName === "app_opened") {
      return `${installationId}:app_opened:${common.sessionId || sessionId}`;
    }
    if (eventName === "journal_opened" || eventName === "keepsake_opened") {
      return `${installationId}:${eventName}:${common.sessionId || sessionId}`;
    }
    if (eventName === "keepsake_generated" || eventName === "feedback_submitted") {
      return `${installationId}:${eventName}:${common.timestamp || nowIso()}`;
    }
    return `${installationId}:${eventName}`;
  }

  function analyticsPayload(eventName, details, common) {
    return {
      ...details,
      ...common,
      eventKey: stableEventKey(eventName, details, common)
    };
  }

  function firstOpenDetails(resolved) {
    if (!resolved) return {};
    return {
      historicalStatus: resolved.historicalStatus || null,
      timestampPrecision: resolved.timestampPrecision || null,
      evidenceUsed: resolved.evidenceUsed || null,
      firstObservedByAnalyticsAt: resolved.firstObservedByAnalyticsAt || null
    };
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
      const response = await fetch(ANALYTICS_ENDPOINT, {
        method: "POST",
        mode: "cors",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body,
        signal: controller.signal
      });
      if (!response.ok) return false;
      const result = await response.json().catch(() => null);
      if (result?.ok === true) {
        receiverRepairStats = {
          duplicateFirstOpenEventsDetected:
            receiverRepairStats.duplicateFirstOpenEventsDetected +
            (Number(result.duplicateFirstOpenEventsDetected) || 0),
          incorrectRowsRepaired:
            receiverRepairStats.incorrectRowsRepaired +
            (Number(result.incorrectRowsRepaired) || 0)
        };
      }
      return result?.ok === true;
    } catch (error) {
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
    const initiated = sendLive(analyticsPayload(eventName, details, common), { onFailure });
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
      const leftTime = Date.parse(completedAt(left.submission) || "");
      const rightTime = Date.parse(completedAt(right.submission) || "");
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
    const localDateTimestamp = localDateToIso(submission?.adventureDate);
    if (localDateTimestamp) return localDateTimestamp;
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
    timestamp,
    forceUpload = false
  }) {
    if (hasSent(progressKey) && !forceUpload) return true;
    if (canonicalKey && hasSent(canonicalKey) && !forceUpload) {
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
    const sent = await sendHistorical(analyticsPayload(eventName, details, common));
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

  function hasBackfillableHistory() {
    return Boolean(
      context?.hadStoredAppState ||
      hasHistoricalEvidence() ||
      readStorage(BACKFILL_KEY) === BACKFILL_VERSION
    );
  }

  function backfillComplete() {
    const state = getBackfillState();
    return state.version === BACKFILL_VERSION && state.status === "completed" && state.completed === true;
  }

  async function backfillHistoricalEvents() {
    if (backfillComplete()) return true;
    if (!isSharingEnabled()) {
      migrationFailed("preflight", "anonymous_sharing_disabled");
      return false;
    }
    if (navigator.onLine === false) {
      migrationFailed("preflight", "offline");
      return false;
    }
    if (!getInstallationId({ create: true })) {
      migrationFailed("preflight", "missing_installation_id");
      return false;
    }

    const evidence = getEvidence();
    const entries = completedEntries();
    const firstEntry = firstCompletedEntry(entries);
    const finalEntry = entries.find(({ questId }) => context?.isFinalQuest?.(questId));
    const normalizedQuestRecords = normalizedHistoricalQuestRecords(entries);
    const savedCount = savedQuestRecordCount();
    const completedCount = entries.length;
    const normalizedCount = normalizedQuestRecords.length;
    const firstOpened = resolveFirstOpenedAt();
    const featureFirstOpenTasks = FIRST_OPEN_EVENTS
      .map(eventName => ({ eventName, resolved: resolveFeatureFirstOpen(eventName) }))
      .filter(({ resolved }) => Boolean(resolved?.timestamp));
    const tasks = [];
    const attemptAt = nowIso();

    receiverRepairStats = {
      duplicateFirstOpenEventsDetected: 0,
      incorrectRowsRepaired: 0
    };
    persistFirstOpenedAt(firstOpened);
    writeFirstOpenMigrationState({
      status: "resolving",
      eventsQueued: 0,
      eventsSynced: 0,
      lastAttemptAt: attemptAt,
      lastError: null
    });
    migrationLog("Historical migration started", { attemptAt });
    migrationLog("Saved quest records found", { count: savedCount });
    migrationLog("Completed quest records found", { count: completedCount });
    migrationLog("Normalized records created", { count: normalizedCount });

    writeBackfillState({
      status: "queued",
      legacyComplete: readStorage(BACKFILL_KEY) === BACKFILL_VERSION,
      savedQuestRecordCount: savedCount,
      completedQuestCount: completedCount,
      normalizedHistoricalRecordCount: normalizedCount,
      recordsQueued: 0,
      recordsUploaded: 0,
      lastAttemptAt: attemptAt,
      lastError: null,
      failureStage: null,
      failureReason: null,
      completed: false,
      completedAt: null
    });

    if (completedCount > 0 && normalizedCount === 0) {
      migrationFailed("normalization", "completed_records_could_not_be_normalized", {
        savedQuestRecordCount: savedCount,
        completedQuestCount: completedCount,
        normalizedHistoricalRecordCount: normalizedCount
      });
      return false;
    }

    if (savedCount === 0 && Object.keys(evidence).length === 0 && !hasSent("app_installed")) {
      migrationLog("Records queued", { count: 0 });
      migrationLog("Records uploaded", { count: 0 });
      migrationLog("Migration completed: false", {
        failureStage: "discovery",
        failureReason: "no_saved_records"
      });
      zeroRecordsBackfillState({
        lastError: "no_saved_records",
        failureStage: "discovery",
        failureReason: "no_saved_records"
      });
      writeFirstOpenMigrationState({
        status: "no_records",
        eventsQueued: 0,
        eventsSynced: 0,
        lastError: "no_saved_records"
      });
      return false;
    }

    featureFirstOpenTasks.forEach(({ eventName, resolved }) => {
      tasks.push(async () => {
        const uploaded = await backfillEvent(eventName, firstOpenDetails(resolved), {
          source: resolved.source,
          progressKey: historicalKey(eventName),
          canonicalKey: eventName,
          timestamp: resolved.timestamp,
          forceUpload: resolved.source === "historical_import" || resolved.historicalStatus === "inferred"
        });
        if (uploaded) writeFeatureFirstOpen(eventName, resolved);
        return uploaded;
      });
    });

    if (evidence.app_installed || hasSent("app_installed") || displayMode() !== "browser") {
      tasks.push(() => backfillEvent("app_installed", {}, {
        source: evidence.app_installed?.source || "standalone_detection",
        progressKey: historicalKey("app_installed"),
        canonicalKey: "app_installed",
        timestamp: evidence.app_installed?.timestamp
      }));
    }

    normalizedQuestRecords.forEach(({ questId, details, timestamp }) => {
      tasks.push(() => backfillEvent(
        "quest_completed",
        details,
        {
          source: "saved_state",
          progressKey: historicalKey("quest_completed", questId),
          canonicalKey: `quest_completed:${questId}`,
          timestamp
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
      if (eventName === "journal_first_opened" || eventName === "keepsake_first_opened") return;
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

    migrationLog("Records queued", { count: tasks.length });
    writeBackfillState({ recordsQueued: tasks.length });
    writeFirstOpenMigrationState({ eventsQueued: featureFirstOpenTasks.length });

    let uploadedCount = 0;
    let firstOpenSyncedCount = 0;
    for (const task of tasks) {
      const uploaded = await task();
      if (!uploaded) {
        migrationFailed("upload", "receiver_confirmation_failed", {
          status: uploadedCount > 0 ? "partially_synced" : "failed",
          recordsUploaded: uploadedCount
        });
        writeFirstOpenMigrationState({
          status: firstOpenSyncedCount > 0 ? "partially_synced" : "failed",
          eventsSynced: firstOpenSyncedCount,
          lastError: "receiver_confirmation_failed"
        });
        return false;
      }
      uploadedCount += 1;
      firstOpenSyncedCount = FIRST_OPEN_EVENTS.filter(eventName =>
        hasSent(historicalKey(eventName)) || hasSent(eventName)
      ).length;
      migrationLog("Records uploaded", { count: uploadedCount });
      writeBackfillState({
        status: uploadedCount < tasks.length ? "partially_synced" : "queued",
        recordsUploaded: uploadedCount
      });
      writeFirstOpenMigrationState({
        status: uploadedCount < tasks.length ? "resolving" : "completed",
        eventsSynced: firstOpenSyncedCount,
        duplicateFirstOpenEventsDetected: receiverRepairStats.duplicateFirstOpenEventsDetected,
        incorrectRowsRepaired: receiverRepairStats.incorrectRowsRepaired
      });
    }

    migrationLog("Migration completed: true", { recordsUploaded: uploadedCount });
    writeStorage(BACKFILL_KEY, BACKFILL_VERSION);
    writeBackfillState({
      status: "completed",
      recordsUploaded: uploadedCount,
      completed: true,
      completedAt: nowIso(),
      lastError: null,
      failureStage: null,
      failureReason: null
    });
    writeFirstOpenMigrationState({
      status: "completed",
      eventsSynced: firstOpenSyncedCount,
      duplicateFirstOpenEventsDetected: receiverRepairStats.duplicateFirstOpenEventsDetected,
      incorrectRowsRepaired: receiverRepairStats.incorrectRowsRepaired,
      lastError: null
    });
    return true;
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
    const backfillState = getBackfillState();
    return {
      endpointConfigured: Boolean(ANALYTICS_ENDPOINT),
      installationId: readStorage(INSTALLATION_ID_KEY) || null,
      sessionId,
      sharingEnabled: isSharingEnabled(),
      backfillComplete: backfillComplete(),
      historicalMigration: backfillState,
      dedupe: getDedupe(),
      evidence: getEvidence()
    };
  }

  function serviceWorkerVersion(worker, timeoutMs = 1200) {
    if (!worker || typeof MessageChannel === "undefined") {
      return Promise.resolve(null);
    }

    return new Promise(resolve => {
      const channel = new MessageChannel();
      let settled = false;
      const finish = version => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeout);
        channel.port1.close();
        resolve(version || null);
      };
      const timeout = window.setTimeout(() => finish(null), timeoutMs);
      channel.port1.onmessage = event => finish(event.data?.version);

      try {
        worker.postMessage(
          { type: "SUMMER_QUEST_GET_VERSION" },
          [channel.port2]
        );
      } catch {
        finish(null);
      }
    });
  }

  async function developerReport() {
    const environment = runtimeEnvironment();
    const controller = navigator.serviceWorker?.controller || null;
    const workerVersion = await serviceWorkerVersion(controller);
    const backfillState = getBackfillState();
    const firstOpenMigration = getFirstOpenMigrationState();
    const resolvedFirstOpened = resolveFirstOpenedAt();
    const appFirstOpen = resolveFeatureFirstOpen("app_first_opened");
    const journalFirstOpen = resolveFeatureFirstOpen("journal_first_opened");
    const keepsakeFirstOpen = resolveFeatureFirstOpen("keepsake_first_opened");

    return {
      consentState: isSharingEnabled() ? "anonymous_sharing_enabled" : "anonymous_sharing_disabled",
      developerMode: developerModeOverride() === true ? "enabled" : "disabled",
      analyticsEnvironment: environment.environment,
      isTest: environment.is_test,
      installationId: readStorage(INSTALLATION_ID_KEY) || null,
      historicalMigrationState: backfillState.status,
      historicalMigrationVersion: backfillState.version,
      firstOpenMigrationState: firstOpenMigration.status,
      savedQuestRecordCount: savedQuestRecordCount(),
      completedQuestCount: completedQuestRecordCount(),
      normalizedHistoricalRecordCount: normalizedHistoricalRecordCount(),
      pendingAnalyticsQueueCount: 0,
      lastMigrationAttempt: backfillState.lastAttemptAt,
      lastMigrationError: backfillState.lastError,
      persistedFirstOpenTimestamp: persistedFirstOpenedAt(),
      resolvedFirstOpenTimestamp: resolvedFirstOpened.timestamp,
      firstOpenEventSource: resolvedFirstOpened.source,
      firstOpenExactTimeKnown: resolvedFirstOpened.exactTimeKnown,
      appFirstOpenedAlreadySynced: hasSent("app_first_opened"),
      appFirstOpenResolvedTimestamp: appFirstOpen?.timestamp || null,
      appFirstOpenSource: appFirstOpen?.source || null,
      journalFirstOpenResolvedTimestamp: journalFirstOpen?.timestamp || null,
      journalFirstOpenSource: journalFirstOpen?.source || "unresolved",
      journalHistoricalEvidenceUsed: journalFirstOpen?.evidenceUsed || "none",
      keepsakeFirstOpenResolvedTimestamp: keepsakeFirstOpen?.timestamp || null,
      keepsakeFirstOpenSource: keepsakeFirstOpen?.source || "unresolved",
      keepsakeHistoricalEvidenceUsed: keepsakeFirstOpen?.evidenceUsed || "none",
      firstOpenEventsQueued: firstOpenMigration.eventsQueued || 0,
      firstOpenEventsSynced: firstOpenMigration.eventsSynced || 0,
      duplicateFirstOpenEventsDetected: firstOpenMigration.duplicateFirstOpenEventsDetected || 0,
      incorrectRowsRepaired: firstOpenMigration.incorrectRowsRepaired || 0,
      currentPathname: window.location.pathname,
      serviceWorkerVersion: workerVersion || "unavailable",
      controllingServiceWorkerState: controller?.state || "none",
      appVersion: appVersion(),
      cacheVersion: workerVersion ? `summer-quest-app-${workerVersion}` : "unavailable"
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

    const firstOpened = resolveFirstOpenedAt();
    persistFirstOpenedAt(firstOpened);

    if (hasBackfillableHistory()) {
      scheduleHistoricalBackfill();
    } else if (!hasSent("app_first_opened")) {
      trackLive("app_first_opened", {}, {
        source: "realtime",
        dedupeKey: "app_first_opened",
        additionalDedupeKeys: [historicalKey("app_first_opened")]
      });
    }

    return trackLive("app_opened", {}, {
      source: "app_init",
      sessionKey: "app_opened"
    });
  }

  function trackFeatureFirstOpened(eventName, source) {
    if (hasSent(eventName)) return false;

    if (hasBackfillableHistory() && firstOpenMigrationPending()) {
      scheduleHistoricalBackfill();
      return false;
    }

    const resolved = resolveFeatureFirstOpen(eventName);
    if (resolved?.timestamp && resolved.source !== "realtime") {
      scheduleHistoricalBackfill();
      return false;
    }

    const realtime = {
      timestamp: nowIso(),
      source: "realtime",
      historicalStatus: "exact",
      timestampPrecision: "exact",
      evidenceUsed: source,
      firstObservedByAnalyticsAt: nowIso()
    };
    const sent = trackLive(eventName, firstOpenDetails(realtime), {
      source: "realtime",
      dedupeKey: eventName,
      additionalDedupeKeys: [historicalKey(eventName)]
    });
    if (sent) writeFeatureFirstOpen(eventName, realtime);
    return sent;
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
      window.addEventListener("online", () => {
        historicalBackfillScheduled = false;
        startSessionAnalytics();
      });
    }

    startSessionAnalytics();
    if (debugMode || runtimeEnvironment().is_test) {
      window.SummerQuestAnalyticsDebug = Object.freeze({
        state: debugState,
        backfill: backfillHistoricalEvents,
        report: developerReport
      });
      console.info(
        "[Summer Quest analytics] Debug hooks available at window.SummerQuestAnalyticsDebug."
      );
      developerReport()
        .then(report => console.info("[Summer Quest developer]", report))
        .catch(() => {
          // Debug reporting must never affect gameplay.
        });
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
      const firstOpenDeferred = !hasSent("journal_first_opened") &&
        hasBackfillableHistory() &&
        firstOpenMigrationPending();
      trackFeatureFirstOpened("journal_first_opened", "journal_navigation");
      if (!firstOpenDeferred) recordEvidence("journal_first_opened", "journal_navigation");
      return trackLive("journal_opened", {}, {
        source: "journal_navigation",
        sessionKey: "journal_opened"
      });
    },
    trackKeepsakeOpened() {
      const firstOpenDeferred = !hasSent("keepsake_first_opened") &&
        hasBackfillableHistory() &&
        firstOpenMigrationPending();
      trackFeatureFirstOpened("keepsake_first_opened", "keepsake_navigation");
      if (!firstOpenDeferred) recordEvidence("keepsake_first_opened", "keepsake_navigation");
      return trackLive("keepsake_opened", {}, {
        source: "keepsake_navigation",
        sessionKey: "keepsake_opened"
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
