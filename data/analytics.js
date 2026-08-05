(() => {
  const CONSENT_VERSION = "2026-08-product-research-v1";
  const HISTORICAL_IMPORT_VERSION = "2026-08-anonymous-v1";
  const FINAL_SUMMARY_SYNC_VERSION = "2026-08-17-v1";
  const FINAL_SUMMARY_START_DATE = "2026-08-17";
  const INSTALLATION_ID_KEY = "summerQuestInstallationId";
  const CONSENT_KEY = "summerQuestAnalyticsConsent";
  const PROMPT_STATE_KEY = "summerQuestAnalyticsPromptState";
  const HISTORICAL_IMPORT_KEY = "summerQuestHistoricalImportVersion";
  const FINAL_SUMMARY_SYNC_KEY = "summerQuestFinalSummarySyncVersion";
  const QUEUE_KEY = "summerQuestAnalyticsQueue";
  const META_KEY = "summerQuestAnalyticsMeta";
  const MILESTONES_KEY = "summerQuestAnalyticsMilestones";
  const MAX_QUEUE_ITEMS = 200;
  const MAX_ATTEMPTS = 8;
  const DEBUG_PARAM = "summer-quest-analytics-debug";
  const debugMode = new URLSearchParams(window.location.search).has(DEBUG_PARAM);

  const defaultConfig = Object.freeze({
    enabled: false,
    endpointUrl: "",
    supabaseAnonKey: ""
  });

  const config = Object.freeze({
    ...defaultConfig,
    ...(window.SUMMER_QUEST_ANALYTICS_CONFIG || {}),
    ...(debugMode ? { enabled: true } : {})
  });

  let context = null;
  let syncing = false;
  let statusListeners = [];
  let consentPrompt = null;
  let statusControl = null;
  let promptedThisSession = false;
  let consentPromptContext = null;

  function nowIso() {
    return new Date().toISOString();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
      console.warn("[Summer Quest analytics] Local analytics data could not be read.", { key, error });
      return fallback;
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function appVersion() {
    return (
      context?.appVersion ||
      window.SUMMER_QUEST_BUILD?.version ||
      document.querySelector("meta[name='application-version']")?.content ||
      "unknown"
    );
  }

  function hasTransportConfig() {
    return Boolean(config.enabled && config.endpointUrl && config.supabaseAnonKey);
  }

  function getConsent() {
    const stored = readJson(CONSENT_KEY, null);
    return {
      status: stored?.status === "granted"
        ? "granted"
        : stored?.status === "declined"
          ? "declined"
          : stored?.status === "postponed"
            ? "postponed"
            : stored?.status === "prompts_complete"
              ? "prompts_complete"
          : "unanswered",
      version: stored?.version || null,
      answeredAt: stored?.answeredAt || null
    };
  }

  function hasConsent() {
    const consent = getConsent();
    return consent.status === "granted" && consent.version === CONSENT_VERSION;
  }

  function getPromptState() {
    const stored = readJson(PROMPT_STATE_KEY, {});
    return {
      automaticPromptCount: Number.isFinite(stored?.automaticPromptCount)
        ? stored.automaticPromptCount
        : 0,
      postponedCount: Number.isFinite(stored?.postponedCount)
        ? stored.postponedCount
        : 0,
      automaticPromptsComplete: stored?.automaticPromptsComplete === true,
      lastPromptReason: stored?.lastPromptReason || null,
      lastPromptedAt: stored?.lastPromptedAt || null
    };
  }

  function setPromptState(patch) {
    writeJson(PROMPT_STATE_KEY, {
      ...getPromptState(),
      ...patch
    });
  }

  function getInstallationId({ create = false } = {}) {
    let id = localStorage.getItem(INSTALLATION_ID_KEY);
    if (!id && create) {
      id = crypto.randomUUID();
      localStorage.setItem(INSTALLATION_ID_KEY, id);
    }
    return id || "";
  }

  function getQueue() {
    const queue = readJson(QUEUE_KEY, []);
    return Array.isArray(queue) ? queue.filter(item => item && typeof item === "object") : [];
  }

  function setQueue(queue) {
    const trimmed = queue
      .slice(-MAX_QUEUE_ITEMS)
      .filter(item => item && typeof item === "object");
    writeJson(QUEUE_KEY, trimmed);
    notifyStatus();
  }

  function getMeta() {
    return readJson(META_KEY, {});
  }

  function setMeta(patch) {
    writeJson(META_KEY, { ...getMeta(), ...patch });
    notifyStatus();
  }

  function getMilestones() {
    return readJson(MILESTONES_KEY, {});
  }

  function setMilestones(next) {
    writeJson(MILESTONES_KEY, next);
  }

  function localDateToIso(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    return `${value}T12:00:00.000Z`;
  }

  function localCalendarDate(date = new Date()) {
    return [
      String(date.getFullYear()).padStart(4, "0"),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function completedAtFor(submission) {
    return (
      localDateToIso(submission?.adventureDate) ||
      (Number.isNaN(Date.parse(submission?.completedAt || ""))
        ? null
        : new Date(submission.completedAt).toISOString())
    );
  }

  function validQuestId(questId) {
    return Boolean(questId && context?.quests?.[questId]);
  }

  function bonusPointsFor(quest, selectedBonusIds) {
    return selectedBonusIds.reduce((total, bonusId) => {
      const bonus = quest.bonuses?.find(candidate => candidate.id === bonusId);
      return total + (Number.isFinite(bonus?.points) ? bonus.points : 0);
    }, 0);
  }

  function anonymousSubmissionRecord(questId, submission, status = "completed") {
    if (!validQuestId(questId)) return null;
    const quest = context.quests[questId];
    const installationId = getInstallationId({ create: true });
    const selectedBonusIds = context.canonicalSelectedBonusIds
      ? context.canonicalSelectedBonusIds(quest, submission)
      : [];
    const friendsCount = context.normalizeFriendCount(submission?.friends);
    const friendPoints = context.isFinalQuest(questId)
      ? 0
      : context.friendPointsFor(friendsCount);
    const basePoints = status === "completed" ? quest.basePoints : 0;
    const bonusPoints = status === "completed" ? bonusPointsFor(quest, selectedBonusIds) : 0;
    const questTotalPoints = status === "completed"
      ? context.questPoints(submission, questId)
      : 0;

    return {
      installation_id: installationId,
      quest_id: questId,
      quest_title: quest.title,
      completion_status: status,
      completed_at: status === "completed" ? completedAtFor(submission) : null,
      friends_count: status === "completed" ? friendsCount : 0,
      selected_bonus_ids: status === "completed" ? selectedBonusIds : [],
      base_points: basePoints,
      friend_points: status === "completed" ? friendPoints : 0,
      bonus_points: bonusPoints,
      quest_total_points: questTotalPoints,
      running_total_points: context.totalsForSubmissions(context.getState().submissions).score,
      has_photo: Boolean(submission?.mediaId),
      has_caption: Boolean(String(submission?.caption || "").trim()),
      has_reflection: Boolean(quest.reflection),
      submission_version: [
        status,
        submission?.completedAt || "",
        submission?.adventureDate || "",
        friendsCount,
        selectedBonusIds.join(","),
        Boolean(submission?.mediaId),
        Boolean(String(submission?.caption || "").trim())
      ].join("|"),
      app_version: appVersion(),
      created_at: Number.isNaN(Date.parse(submission?.completedAt || ""))
        ? nowIso()
        : new Date(submission.completedAt).toISOString(),
      updated_at: nowIso(),
      last_synced_at: null
    };
  }

  function completedEntries() {
    const submissions = context.getState().submissions || {};
    return context.boardOrder
      .map(questId => ({ questId, submission: submissions[questId] }))
      .filter(({ questId, submission }) => validQuestId(questId) && submission?.completed === true);
  }

  function totalPoints() {
    return context.totalsForSubmissions(context.getState().submissions).score;
  }

  function earliestCompletionDate(entries = completedEntries()) {
    return entries
      .map(({ submission }) => completedAtFor(submission))
      .filter(Boolean)
      .sort()[0] || null;
  }

  function latestCompletionDate(entries = completedEntries()) {
    return entries
      .map(({ submission }) => completedAtFor(submission))
      .filter(Boolean)
      .sort()
      .at(-1) || null;
  }

  function snapshotPayload() {
    const entries = completedEntries();
    const finalEntry = entries.find(({ questId }) => context.isFinalQuest(questId));
    const totalFriends = entries.reduce(
      (sum, { questId, submission }) =>
        sum + (context.isFinalQuest(questId) ? 0 : context.normalizeFriendCount(submission.friends)),
      0
    );

    return {
      installation_id: getInstallationId({ create: true }),
      snapshot_version: FINAL_SUMMARY_SYNC_VERSION,
      snapshot_date: nowIso(),
      completed_quest_count: entries.length,
      total_available_quests: context.boardOrder.length,
      total_points: totalPoints(),
      first_completion_date: earliestCompletionDate(entries),
      latest_completion_date: latestCompletionDate(entries),
      total_friends_counted: totalFriends,
      quests_with_friends: entries.filter(
        ({ questId, submission }) =>
          !context.isFinalQuest(questId) && context.normalizeFriendCount(submission.friends) > 0
      ).length,
      solo_quests: entries.filter(
        ({ questId, submission }) =>
          context.isFinalQuest(questId) || context.normalizeFriendCount(submission.friends) === 0
      ).length,
      quests_with_bonus_points: entries.filter(
        ({ questId, submission }) =>
          context.canonicalSelectedBonusIds(context.quests[questId], submission).length > 0
      ).length,
      quests_with_photos: entries.filter(({ submission }) => Boolean(submission.mediaId)).length,
      quests_with_captions: entries.filter(({ submission }) => Boolean(String(submission.caption || "").trim())).length,
      quests_with_reflections: entries.filter(({ questId }) => Boolean(context.quests[questId].reflection)).length,
      final_quest_completed: Boolean(finalEntry),
      completed_quest_ids: entries.map(({ questId }) => questId),
      app_version: appVersion()
    };
  }

  function eventPayload(type, source, details = {}) {
    const milestones = getMilestones();
    const existing = milestones[type] || {};
    const eventId = existing.event_id || crypto.randomUUID();
    milestones[type] = {
      ...existing,
      event_id: eventId,
      event_type: type,
      event_source: source
    };
    setMilestones(milestones);

    return {
      event_id: eventId,
      installation_id: getInstallationId({ create: true }),
      event_type: type,
      quest_id: details.questId || null,
      occurred_at: details.occurredAt || nowIso(),
      event_source: source,
      completed_quest_count: completedEntries().length,
      total_points: totalPoints(),
      app_version: appVersion(),
      all_available_quests_completed: details.allAvailableQuestsCompleted ?? null
    };
  }

  function validateQueueItem(kind, payload) {
    if (!hasConsent()) return false;
    if (!payload || typeof payload !== "object") return false;
    if (!payload.installation_id) return false;
    if (kind === "quest_submission") {
      return validQuestId(payload.quest_id) &&
        ["completed", "incomplete", "deleted"].includes(payload.completion_status);
    }
    if (kind === "analytics_event") {
      return Boolean(payload.event_id && payload.event_type && payload.occurred_at);
    }
    if (kind === "summary_snapshot") {
      return payload.snapshot_version === FINAL_SUMMARY_SYNC_VERSION;
    }
    if (kind === "installation") {
      return Boolean(payload.first_seen_at && payload.last_seen_at);
    }
    return false;
  }

  function enqueue(kind, payload, dedupeKey) {
    if (!validateQueueItem(kind, payload)) return false;
    const id = dedupeKey || `${kind}:${crypto.randomUUID()}`;
    const queue = getQueue().filter(item => item.dedupeKey !== id);
    queue.push({
      id: crypto.randomUUID(),
      dedupeKey: id,
      kind,
      payload,
      createdAt: nowIso(),
      attempts: 0,
      nextAttemptAt: null,
      lastError: null
    });
    setQueue(queue);
    scheduleSync("enqueue");
    return true;
  }

  function queueInstallationSeen() {
    const installationId = getInstallationId({ create: true });
    const consent = getConsent();
    enqueue("installation", {
      installation_id: installationId,
      first_seen_at: getMeta().firstSeenAt || nowIso(),
      last_seen_at: nowIso(),
      app_version: appVersion(),
      consent_version: consent.version || CONSENT_VERSION
    }, "installation:seen");
    if (!getMeta().firstSeenAt) setMeta({ firstSeenAt: nowIso() });
  }

  function queueQuestStatus(questId, submission, status) {
    const record = anonymousSubmissionRecord(questId, submission || { questId }, status);
    if (record) enqueue("quest_submission", record, `quest:${questId}`);
  }

  function queueFirstQuestMilestone(source, entries = completedEntries()) {
    if (!entries.length) return;
    const milestones = getMilestones();
    if (milestones.first_quest_completed?.sentAt) return;
    const first = [...entries].sort((left, right) =>
      String(completedAtFor(left.submission) || "").localeCompare(completedAtFor(right.submission) || "")
    )[0];
    enqueue("analytics_event", eventPayload("first_quest_completed", source, {
      questId: first.questId,
      occurredAt: completedAtFor(first.submission)
    }), "event:first_quest_completed");
  }

  function queueFinalQuestMilestone(source) {
    const finalQuestId = context.finalQuestId;
    const submission = context.getState().submissions?.[finalQuestId];
    if (!submission?.completed) return;
    enqueue("analytics_event", eventPayload("final_quest_completed", source, {
      questId: finalQuestId,
      occurredAt: completedAtFor(submission),
      allAvailableQuestsCompleted: completedEntries().length === context.boardOrder.length
    }), "event:final_quest_completed");
  }

  function queueSummarySnapshot() {
    enqueue("summary_snapshot", snapshotPayload(), `summary:${FINAL_SUMMARY_SYNC_VERSION}`);
  }

  function shouldQueueFinalSummary() {
    return localCalendarDate() >= FINAL_SUMMARY_START_DATE &&
      localStorage.getItem(FINAL_SUMMARY_SYNC_KEY) !== FINAL_SUMMARY_SYNC_VERSION;
  }

  function enqueueHistoricalImport() {
    if (!hasConsent()) return;
    if (localStorage.getItem(HISTORICAL_IMPORT_KEY) === HISTORICAL_IMPORT_VERSION) return;
    queueInstallationSeen();
    const entries = completedEntries();
    entries.forEach(({ questId, submission }) => {
      queueQuestStatus(questId, submission, "completed");
    });
    queueFirstQuestMilestone("historical_import", entries);
    queueFinalQuestMilestone("historical_import");
    if (shouldQueueFinalSummary()) queueSummarySnapshot();
    setMeta({ pendingHistoricalImport: HISTORICAL_IMPORT_VERSION });
  }

  function nextDelayMs(attempts) {
    return Math.min(30 * 60 * 1000, Math.pow(2, attempts) * 1500);
  }

  async function sendItem(item) {
    const response = await fetch(config.endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.supabaseAnonKey}`,
        "apikey": config.supabaseAnonKey
      },
      body: JSON.stringify({
        kind: item.kind,
        payload: item.payload
      })
    });
    if (!response.ok) {
      throw new Error(`Analytics endpoint returned ${response.status}.`);
    }
  }

  async function syncQueue(reason = "manual") {
    if (!hasConsent() || !hasTransportConfig() || syncing) {
      notifyStatus();
      return { synced: 0, remaining: getQueue().length };
    }
    if (navigator.onLine === false) return { synced: 0, remaining: getQueue().length };

    syncing = true;
    notifyStatus();
    let synced = 0;
    let queue = getQueue();
    const now = Date.now();

    for (const item of queue) {
      if (Date.parse(item.nextAttemptAt || "") > now) continue;
      try {
        await sendItem(item);
        synced += 1;
        queue = queue.filter(candidate => candidate.id !== item.id);
        setQueue(queue);
        setMeta({ lastSuccessfulSyncAt: nowIso(), lastSyncReason: reason, lastSyncError: null });
        if (item.kind === "summary_snapshot") {
          localStorage.setItem(FINAL_SUMMARY_SYNC_KEY, FINAL_SUMMARY_SYNC_VERSION);
        }
        if (item.kind === "analytics_event") {
          const milestones = getMilestones();
          const eventType = item.payload?.event_type;
          if (eventType && milestones[eventType]) {
            milestones[eventType] = {
              ...milestones[eventType],
              sentAt: nowIso()
            };
            setMilestones(milestones);
          }
        }
      } catch (error) {
        const attempts = Number(item.attempts || 0) + 1;
        item.attempts = attempts;
        item.lastError = error?.message || "Sync failed";
        item.nextAttemptAt = attempts >= MAX_ATTEMPTS
          ? null
          : new Date(Date.now() + nextDelayMs(attempts)).toISOString();
        setMeta({ lastSyncError: item.lastError });
        if (attempts >= MAX_ATTEMPTS) {
          console.warn("[Summer Quest analytics] Queue item reached retry limit.", {
            kind: item.kind,
            dedupeKey: item.dedupeKey
          });
        }
        break;
      }
    }

    const historicalQueued = getMeta().pendingHistoricalImport === HISTORICAL_IMPORT_VERSION;
    if (historicalQueued && getQueue().every(item => item.kind !== "quest_submission")) {
      localStorage.setItem(HISTORICAL_IMPORT_KEY, HISTORICAL_IMPORT_VERSION);
      setMeta({ pendingHistoricalImport: null });
    }

    syncing = false;
    notifyStatus();
    return { synced, remaining: getQueue().length };
  }

  function scheduleSync(reason) {
    window.setTimeout(() => syncQueue(reason), 250);
  }

  function completedQuestCount() {
    return completedEntries().length;
  }

  function consentAllowsAutomaticPrompt() {
    const consent = getConsent();
    const promptState = getPromptState();
    return (
      config.enabled &&
      !hasConsent() &&
      consent.status !== "declined" &&
      consent.status !== "prompts_complete" &&
      promptState.automaticPromptsComplete !== true &&
      promptedThisSession !== true
    );
  }

  function automaticPromptIsDue(reason, details = {}) {
    if (!consentAllowsAutomaticPrompt()) return false;
    const consent = getConsent();
    const promptState = getPromptState();
    const count = completedQuestCount();

    if (
      reason === "existing-user-launch" &&
      consent.status === "unanswered" &&
      promptState.automaticPromptCount === 0
    ) {
      return count > 0;
    }

    if (
      reason === "first-quest-completed" &&
      consent.status === "unanswered" &&
      promptState.automaticPromptCount === 0
    ) {
      return details.previousCompletedCount === 0 && count === 1;
    }

    if (
      reason === "three-quest-reminder" &&
      consent.status === "postponed" &&
      promptState.postponedCount === 1 &&
      promptState.automaticPromptCount === 1
    ) {
      return details.isNewCompletion === true && count >= 3;
    }

    return false;
  }

  function showConsentPromptIfDue(reason, details = {}) {
    if (!consentPrompt || !automaticPromptIsDue(reason, details)) return false;
    if (!openConsentPrompt({ mode: "automatic" })) return false;
    const promptState = getPromptState();
    promptedThisSession = true;
    setPromptState({
      automaticPromptCount: promptState.automaticPromptCount + 1,
      lastPromptReason: reason,
      lastPromptedAt: nowIso()
    });
    return true;
  }

  function setConsent(status) {
    writeJson(CONSENT_KEY, {
      status,
      version: CONSENT_VERSION,
      answeredAt: nowIso()
    });
    if (status === "granted") {
      getInstallationId({ create: true });
      enqueueHistoricalImport();
      scheduleSync("consent");
    }
    renderStatusControl();
    notifyStatus();
  }

  function postponeConsentPrompt() {
    const promptState = getPromptState();
    const postponedCount = promptState.postponedCount + 1;
    const automaticPromptsComplete = postponedCount >= 2;
    writeJson(CONSENT_KEY, {
      status: automaticPromptsComplete ? "prompts_complete" : "postponed",
      version: CONSENT_VERSION,
      answeredAt: nowIso()
    });
    setPromptState({
      postponedCount,
      automaticPromptsComplete
    });
    renderStatusControl();
    notifyStatus();
  }

  function openConsentPrompt({
    mode = "automatic",
    targetEnabled = true,
    returnFocus = document.activeElement
  } = {}) {
    if (!consentPrompt || !consentPrompt.hidden) return false;
    if (
      mode === "automatic" &&
      document.body.matches(
        ".sheet-open, .crop-open, .confirmation-open, .desktop-notice-open, .info-modal-open"
      )
    ) {
      return false;
    }
    consentPromptContext = {
      mode,
      targetEnabled: Boolean(targetEnabled),
      returnFocus: returnFocus instanceof HTMLElement ? returnFocus : null
    };
    consentPrompt.hidden = false;
    document.body.classList.add("confirmation-open");
    requestAnimationFrame(() => {
      consentPrompt.querySelector("[data-analytics-consent='grant']")
        ?.focus({ preventScroll: true });
    });
    return true;
  }

  function hideConsentPrompt({ restoreFocus = true } = {}) {
    if (!consentPrompt) return;
    const wasOpen = !consentPrompt.hidden;
    const returnFocus = consentPromptContext?.returnFocus;
    consentPrompt.hidden = true;
    consentPromptContext = null;
    document.body.classList.remove("confirmation-open");
    if (wasOpen && restoreFocus && returnFocus?.isConnected) {
      requestAnimationFrame(() => returnFocus.focus({ preventScroll: true }));
    }
  }

  function requestConsentChange(enabled, { returnFocus } = {}) {
    const targetEnabled = Boolean(enabled);
    if (targetEnabled === hasConsent()) return false;
    return openConsentPrompt({
      mode: "preference-change",
      targetEnabled,
      returnFocus
    });
  }

  function renderStatusControl() {
    if (!statusControl) return;
    if (!config.enabled) {
      statusControl.innerHTML = `
        <div class="privacy-sync-status">
          <p><strong>Anonymous data sharing:</strong> Off</p>
        </div>
      `;
      return;
    }
    const consent = getConsent();
    const meta = getMeta();
    const queueLength = getQueue().length;
    const on = consent.status === "granted";
    const transportReady = hasTransportConfig();
    statusControl.innerHTML = `
      <div class="privacy-sync-status">
        <p><strong>Anonymous data sharing:</strong> ${on ? "On" : "Off"}</p>
        <p><strong>Last sync:</strong> ${meta.lastSuccessfulSyncAt ? new Date(meta.lastSuccessfulSyncAt).toLocaleString() : "Not yet"}</p>
        <p><strong>Waiting to sync:</strong> ${queueLength}</p>
        ${transportReady ? "" : "<p><strong>Sync setup:</strong> Needed</p>"}
      </div>
      <div class="privacy-sync-actions">
        <button id="analyticsToggleConsent" class="secondary-button" type="button">
          ${on ? "Turn Off Sharing" : "Enable Anonymous Analytics"}
        </button>
        <button id="analyticsSyncNow" class="secondary-button" type="button" ${on && transportReady ? "" : "disabled"}>
          Sync Now
        </button>
        <button id="analyticsShareSummary" class="secondary-button" type="button" ${on && transportReady && summaryIsAvailable() ? "" : "disabled"}>
          Share My Summer Summary
        </button>
      </div>
    `;
    statusControl.querySelector("#analyticsToggleConsent")?.addEventListener("click", () => {
      setConsent(on ? "declined" : "granted");
    });
    statusControl.querySelector("#analyticsSyncNow")?.addEventListener("click", () => {
      enqueueHistoricalImport();
      if (shouldQueueFinalSummary()) queueSummarySnapshot();
      syncQueue("manual");
    });
    statusControl.querySelector("#analyticsShareSummary")?.addEventListener("click", () => {
      queueSummarySnapshot();
      syncQueue("summary-manual");
    });
  }

  function summaryIsAvailable() {
    return localCalendarDate() >= FINAL_SUMMARY_START_DATE ||
      Boolean(context?.getState().submissions?.[context.finalQuestId]?.completed);
  }

  function notifyStatus() {
    renderStatusControl();
    const status = debugState();
    statusListeners.forEach(listener => listener(status));
  }

  function handleVisibilityOrOnline(reason) {
    if (!hasConsent()) return;
    if (shouldQueueFinalSummary()) queueSummarySnapshot();
    enqueueHistoricalImport();
    scheduleSync(reason);
  }

  function initUi() {
    consentPrompt = document.querySelector("#analyticsConsentModal");
    statusControl = document.querySelector("#analyticsStatusControl");
    consentPrompt?.querySelector("[data-analytics-consent='grant']")
      ?.addEventListener("click", () => {
        const nextStatus = consentPromptContext?.mode === "preference-change"
          ? (consentPromptContext.targetEnabled ? "granted" : "declined")
          : "granted";
        setConsent(nextStatus);
        hideConsentPrompt();
      });
    consentPrompt?.querySelector("[data-analytics-consent='postpone']")
      ?.addEventListener("click", () => {
        if (consentPromptContext?.mode !== "preference-change") {
          postponeConsentPrompt();
        }
        hideConsentPrompt();
      });
    consentPrompt?.addEventListener("click", event => {
      if (event.target === consentPrompt) hideConsentPrompt();
    });
    renderStatusControl();
    window.setTimeout(() => {
      showConsentPromptIfDue("existing-user-launch");
    }, 700);
  }

  function debugState() {
    return {
      enabled: hasTransportConfig(),
      installationId: localStorage.getItem(INSTALLATION_ID_KEY) || null,
      consent: getConsent(),
      historicalMigrationStatus: localStorage.getItem(HISTORICAL_IMPORT_KEY) || getMeta().pendingHistoricalImport || "not-complete",
      queueLength: getQueue().length,
      lastSuccessfulSync: getMeta().lastSuccessfulSyncAt || null,
      promptState: getPromptState(),
      currentQuestRecords: context
        ? completedEntries().map(({ questId, submission }) =>
            anonymousSubmissionRecord(questId, submission, "completed"))
        : [],
      milestoneEvents: getMilestones(),
      finalSummaryStatus: localStorage.getItem(FINAL_SUMMARY_SYNC_KEY) || "not-complete"
    };
  }

  function init(nextContext) {
    context = nextContext;
    initUi();
    window.addEventListener("online", () => handleVisibilityOrOnline("online"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleVisibilityOrOnline("visible");
    });
    if (hasConsent()) handleVisibilityOrOnline("launch");
    if (debugMode) {
      window.SummerQuestAnalyticsDebug = Object.freeze({
        state: debugState,
        syncNow: () => syncQueue("debug"),
        queueSummary: queueSummarySnapshot,
        clearQueue: () => setQueue([])
      });
      console.info("[Summer Quest analytics] Debug hooks available at window.SummerQuestAnalyticsDebug.");
    }
    return api;
  }

  const api = {
    init,
    hasConsent,
    requestConsentChange,
    cancelConsentDialog: hideConsentPrompt,
    setConsentEnabled(enabled) {
      setConsent(enabled ? "granted" : "declined");
    },
    onStatusChange(listener) {
      statusListeners.push(listener);
      return () => {
        statusListeners = statusListeners.filter(candidate => candidate !== listener);
      };
    },
    trackQuestSaved({ questId, submission, previousCompletedCount = 0, isNewCompletion = false } = {}) {
      if (!hasConsent()) return;
      queueInstallationSeen();
      queueQuestStatus(questId, submission, "completed");
      const currentCompletedCount = completedEntries().length;
      if (previousCompletedCount === 0 && currentCompletedCount === 1) {
        queueFirstQuestMilestone("realtime");
      }
      if (context.isFinalQuest(questId)) {
        queueFinalQuestMilestone("realtime");
        queueSummarySnapshot();
      }
      if (shouldQueueFinalSummary()) queueSummarySnapshot();
    },
    maybePromptAfterQuestCompletion({
      previousCompletedCount = 0,
      isNewCompletion = false
    } = {}) {
      if (!isNewCompletion) return false;
      if (previousCompletedCount === 0) {
        return showConsentPromptIfDue("first-quest-completed", {
          previousCompletedCount,
          isNewCompletion
        });
      }
      return showConsentPromptIfDue("three-quest-reminder", {
        previousCompletedCount,
        isNewCompletion
      });
    },
    trackQuestRemoved({ questId, submission } = {}) {
      if (!hasConsent()) return;
      queueInstallationSeen();
      queueQuestStatus(questId, submission, "deleted");
      if (shouldQueueFinalSummary()) queueSummarySnapshot();
    },
    trackBoardReset(submissions = {}) {
      if (!hasConsent()) return;
      Object.entries(submissions).forEach(([questId, submission]) => {
        if (submission?.completed === true) queueQuestStatus(questId, submission, "deleted");
      });
      queueSummarySnapshot();
    },
    syncNow: () => syncQueue("manual"),
    queueSummarySnapshot,
    debugState
  };

  window.SummerQuestAnalytics = api;
})();
