(() => {
  const buildVersion = globalThis.SUMMER_QUEST_BUILD?.version || "unknown";
  const compareBuildVersions = globalThis.SUMMER_QUEST_BUILD?.compare;
  const buildVersionElements = document.querySelectorAll("[data-build-version]");
  const updateNotice = document.querySelector("#pwaUpdateNotice");
  const updateButton = document.querySelector("#pwaUpdateButton");
  const workerUrl = `./sw.js?v=${encodeURIComponent(buildVersion)}`;
  const UPDATE_INTERVAL_MS = 30 * 60 * 1000;
  const MIN_CHECK_GAP_MS = 60 * 1000;
  const LAST_ACTIVE_BUILD_KEY = "summerQuestLastActiveWorkerBuild";
  const PENDING_UPDATE_BUILD_KEY = "summerQuestPendingWorkerBuild";

  let registration = null;
  let announcedWorker = null;
  let announcedWorkerVersion = null;
  let restartInProgress = false;
  let isReloadingForUpdate = false;
  let lastUpdateCheck = 0;
  let updateCheckPromise = null;
  const watchedWorkers = new WeakSet();

  buildVersionElements.forEach(element => {
    element.textContent = buildVersion;
  });

  function readStorage(storage, key) {
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(storage, key, value) {
    if (!value) return;
    try {
      storage.setItem(key, value);
    } catch {
      // Worker-version deduplication still works in memory when storage is blocked.
    }
  }

  function removeStorage(storage, key) {
    try {
      storage.removeItem(key);
    } catch {
      // Nothing else is required when storage is blocked.
    }
  }

  function resetUpdateButton() {
    if (!updateButton) return;
    updateButton.disabled = false;
    updateButton.textContent = "Restart";
  }

  function hideUpdateNotice() {
    if (updateNotice) updateNotice.hidden = true;
  }

  function showUpdateNotice() {
    if (!updateNotice || restartInProgress || isReloadingForUpdate) return;
    updateNotice.hidden = false;
    resetUpdateButton();
  }

  function workerVersion(worker, timeoutMs = 1200) {
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
        resolve(version);
      };
      const timeout = window.setTimeout(() => finish(null), timeoutMs);

      channel.port1.onmessage = event => {
        finish(event.data?.version || null);
      };

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

  function rememberActiveBuild(version) {
    writeStorage(localStorage, LAST_ACTIVE_BUILD_KEY, version);
  }

  function buildsMatch(left, right) {
    const comparison = compareBuildVersions?.(left, right);
    return comparison === null || comparison === undefined
      ? left === right
      : comparison === 0;
  }

  async function syncActiveBuild() {
    const version = await workerVersion(navigator.serviceWorker?.controller);
    if (version) rememberActiveBuild(version);
    return version;
  }

  async function announceWaitingWorker(worker = registration?.waiting) {
    if (!worker || worker.state === "redundant") return false;
    if (!navigator.serviceWorker?.controller) return false;
    if (worker === navigator.serviceWorker?.controller) return false;

    const [waitingVersion, activeVersion] = await Promise.all([
      workerVersion(worker),
      syncActiveBuild()
    ]);
    const lastActiveVersion = readStorage(localStorage, LAST_ACTIVE_BUILD_KEY);

    if (
      waitingVersion &&
      (buildsMatch(waitingVersion, activeVersion) ||
        buildsMatch(waitingVersion, lastActiveVersion))
    ) {
      if (announcedWorker === worker) {
        announcedWorker = null;
        announcedWorkerVersion = null;
      }
      hideUpdateNotice();
      return false;
    }

    if (
      announcedWorker === worker &&
      (!waitingVersion || waitingVersion === announcedWorkerVersion)
    ) {
      showUpdateNotice();
      return true;
    }

    announcedWorker = worker;
    announcedWorkerVersion = waitingVersion;
    showUpdateNotice();
    return true;
  }

  function watchInstallingWorker(worker) {
    if (!worker || watchedWorkers.has(worker)) return;
    watchedWorkers.add(worker);

    const handleStateChange = () => {
      if (worker.state === "installed") {
        if (navigator.serviceWorker.controller) {
          announceWaitingWorker(registration?.waiting || worker);
        }
        return;
      }

      if (worker.state === "redundant" && announcedWorker === worker) {
        announcedWorker = null;
        announcedWorkerVersion = null;
        hideUpdateNotice();
        resetUpdateButton();
      }
    };

    worker.addEventListener("statechange", handleStateChange);
    handleStateChange();
  }

  async function checkForUpdate({ force = false } = {}) {
    if (!registration || !navigator.onLine) return false;
    if (updateCheckPromise) return updateCheckPromise;

    const now = Date.now();
    if (!force && now - lastUpdateCheck < MIN_CHECK_GAP_MS) return false;
    lastUpdateCheck = now;

    updateCheckPromise = registration.update()
      .then(async () => {
        if (registration.waiting) {
          await announceWaitingWorker(registration.waiting);
          return true;
        }
        return false;
      })
      .catch(error => {
        console.warn("[PWA update] Update check failed; the current build remains available.", error);
        return false;
      })
      .finally(() => {
        updateCheckPromise = null;
      });

    return updateCheckPromise;
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    try {
      registration = await navigator.serviceWorker.register(workerUrl, {
        updateViaCache: "none"
      });

      await syncActiveBuild();

      if (registration.installing) watchInstallingWorker(registration.installing);
      if (registration.waiting) await announceWaitingWorker(registration.waiting);

      registration.addEventListener("updatefound", () => {
        watchInstallingWorker(registration.installing);
      });

      if (!registration.waiting) {
        await checkForUpdate({ force: true });
      }
    } catch (error) {
      console.error("[PWA update] Service worker registration failed.", error);
    }
  }

  updateButton?.addEventListener("click", async () => {
    if (!registration || restartInProgress || isReloadingForUpdate) return;

    restartInProgress = true;
    updateButton.disabled = true;
    updateButton.textContent = "Restarting…";

    let waitingWorker = registration.waiting;
    if (!waitingWorker && navigator.onLine) {
      await checkForUpdate({ force: true });
      waitingWorker = registration.waiting;
    }

    if (!waitingWorker || waitingWorker.state !== "installed") {
      restartInProgress = false;
      hideUpdateNotice();
      resetUpdateButton();
      return;
    }

    const waitingVersion = await workerVersion(waitingWorker);
    writeStorage(sessionStorage, PENDING_UPDATE_BUILD_KEY, waitingVersion);

    try {
      waitingWorker.postMessage({
        type: "SUMMER_QUEST_SKIP_WAITING"
      });
    } catch (error) {
      restartInProgress = false;
      removeStorage(sessionStorage, PENDING_UPDATE_BUILD_KEY);
      showUpdateNotice();
      console.warn("[PWA update] Restart request failed; the update remains ready.", error);
    }
  });

  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (isReloadingForUpdate) return;

    hideUpdateNotice();
    announcedWorker = null;
    announcedWorkerVersion = null;

    if (!restartInProgress) {
      resetUpdateButton();
      syncActiveBuild();
      return;
    }

    isReloadingForUpdate = true;
    const pendingVersion = readStorage(sessionStorage, PENDING_UPDATE_BUILD_KEY);
    if (pendingVersion) rememberActiveBuild(pendingVersion);
    removeStorage(sessionStorage, PENDING_UPDATE_BUILD_KEY);
    window.location.reload();
  });

  navigator.serviceWorker?.addEventListener("message", event => {
    if (event.data?.type !== "SUMMER_QUEST_SW_ACTIVATED") return;
    const activeVersion = event.data.version || null;
    if (activeVersion) rememberActiveBuild(activeVersion);

    if (activeVersion && activeVersion === announcedWorkerVersion) {
      hideUpdateNotice();
    }
  });

  window.addEventListener("online", () => checkForUpdate());
  window.addEventListener("focus", () => checkForUpdate());
  window.addEventListener("pageshow", () => checkForUpdate());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
  window.setInterval(() => checkForUpdate(), UPDATE_INTERVAL_MS);

  hideUpdateNotice();
  resetUpdateButton();
  window.addEventListener("load", registerServiceWorker, { once: true });
})();
