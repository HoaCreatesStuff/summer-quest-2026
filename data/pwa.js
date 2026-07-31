(() => {
  const buildVersion =
    globalThis.SUMMER_QUEST_BUILD?.version || "unknown";
  const buildVersionElements = document.querySelectorAll("[data-build-version]");
  const updateNotice = document.querySelector("#pwaUpdateNotice");
  const updateButton = document.querySelector("#pwaUpdateButton");
  const updateStatus = document.querySelector("#pwaUpdateStatus");
  const workerUrl = `./sw.js?v=${encodeURIComponent(buildVersion)}`;
  const UPDATE_INTERVAL_MS = 30 * 60 * 1000;
  const MIN_CHECK_GAP_MS = 60 * 1000;

  let registration = null;
  let restartRequested = false;
  let lastUpdateCheck = 0;

  buildVersionElements.forEach(element => {
    element.textContent = buildVersion;
  });

  function setUpdateStatus(message) {
    if (updateStatus) updateStatus.textContent = message;
  }

  function showUpdateNotice() {
    if (!updateNotice) return;
    updateNotice.hidden = false;
    setUpdateStatus("A new build is ready to install.");
  }

  function hideUpdateNotice() {
    if (updateNotice) updateNotice.hidden = true;
  }

  function watchInstallingWorker(worker) {
    worker.addEventListener("statechange", () => {
      if (worker.state !== "installed") return;

      if (navigator.serviceWorker.controller) {
        showUpdateNotice();
      } else {
        setUpdateStatus("Updates check automatically.");
      }
    });
  }

  async function checkForUpdate({ force = false } = {}) {
    if (!registration) return;
    if (!navigator.onLine) {
      setUpdateStatus(`Build ${buildVersion} · Ready offline.`);
      return;
    }

    const now = Date.now();
    if (!force && now - lastUpdateCheck < MIN_CHECK_GAP_MS) return;
    lastUpdateCheck = now;

    try {
      await registration.update();
      if (registration.waiting) showUpdateNotice();
    } catch (error) {
      setUpdateStatus(`Build ${buildVersion} · Ready offline.`);
    }
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      setUpdateStatus("Automatic updates are unavailable in this browser.");
      return;
    }

    try {
      registration = await navigator.serviceWorker.register(workerUrl, {
        updateViaCache: "none"
      });

      setUpdateStatus(`Build ${buildVersion} · Updates check automatically.`);

      if (registration.waiting) showUpdateNotice();
      if (registration.installing) {
        watchInstallingWorker(registration.installing);
      }

      registration.addEventListener("updatefound", () => {
        if (registration.installing) {
          watchInstallingWorker(registration.installing);
        }
      });

      await checkForUpdate({ force: true });
    } catch (error) {
      console.error("[PWA update] Service worker registration failed.", error);
      setUpdateStatus(`Build ${buildVersion} · Automatic updates unavailable.`);
    }
  }

  updateButton?.addEventListener("click", async () => {
    if (!registration) return;

    if (!registration.waiting) {
      await checkForUpdate({ force: true });
    }

    if (!registration.waiting) {
      hideUpdateNotice();
      return;
    }

    restartRequested = true;
    updateButton.disabled = true;
    updateButton.textContent = "Restarting…";
    registration.waiting.postMessage({
      type: "SUMMER_QUEST_SKIP_WAITING"
    });
  });

  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (!restartRequested) return;
    restartRequested = false;
    window.location.reload();
  });

  window.addEventListener("online", () => {
    checkForUpdate();
  });

  window.addEventListener("focus", () => {
    checkForUpdate();
  });

  window.addEventListener("pageshow", () => {
    checkForUpdate();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      checkForUpdate();
    }
  });

  window.setInterval(() => {
    checkForUpdate();
  }, UPDATE_INTERVAL_MS);

  window.addEventListener("load", registerServiceWorker, { once: true });
})();
