importScripts("./version.js");

const BUILD_VERSION = self.SUMMER_QUEST_BUILD?.version || "unknown";
const CACHE_PREFIX = "summer-quest-app-";
const CACHE_NAME = `${CACHE_PREFIX}${BUILD_VERSION}`;
const APP_SHELL_URLS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./version.js",
  "./data/pwa.js",
  "./data/quests.js",
  "./data/boardConfig.js",
  "./data/mediaStorage.js",
  "./data/finale.js",
  "./data/app.js",
  "./data/journal.js",
  "./assets/favicon/icon-192.png",
  "./assets/favicon/icon-512.png",
  "./assets/hero-park-clean.png",
  "./assets/hero-summer-journal.png"
];

async function fetchFresh(request) {
  return fetch(request, { cache: "no-store" });
}

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL_URLS.map(async url => {
    const request = new Request(url, { cache: "reload" });
    const response = await fetch(request);

    if (!response.ok) {
      throw new Error(`Unable to cache ${url}: ${response.status}`);
    }

    await cache.put(url, response);
  }));
}

async function deleteObsoleteAppCaches() {
  const cacheNames = await caches.keys();
  const obsoleteNames = cacheNames.filter(
    name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
  );

  await Promise.all(obsoleteNames.map(name => caches.delete(name)));
}

async function cachedFallback(request, fallbackUrl) {
  const cache = await caches.open(CACHE_NAME);
  const directMatch = await cache.match(request, { ignoreSearch: true });

  if (directMatch) return directMatch;
  if (fallbackUrl) return cache.match(fallbackUrl, { ignoreSearch: true });
  return null;
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetchFresh(request);

    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    const fallback = await cachedFallback(request, fallbackUrl);
    if (fallback) return fallback;
    throw error;
  }
}

async function cacheFirst(request) {
  const cached = await cachedFallback(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("install", event => {
  event.waitUntil(cacheAppShell());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    await deleteObsoleteAppCaches();
    await self.clients.claim();

    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach(client => {
      client.postMessage({
        type: "SUMMER_QUEST_SW_ACTIVATED",
        version: BUILD_VERSION
      });
    });
  })());
});

self.addEventListener("message", event => {
  if (event.data?.type === "SUMMER_QUEST_SKIP_WAITING") {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data?.type === "SUMMER_QUEST_GET_VERSION") {
    event.source?.postMessage({
      type: "SUMMER_QUEST_SW_VERSION",
      version: BUILD_VERSION
    });
  }
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, "./index.html"));
    return;
  }

  const freshDestinations = new Set(["script", "style", "manifest"]);
  const isVersionedData =
    url.pathname.endsWith("/version.js") ||
    url.pathname.endsWith(".json");

  if (freshDestinations.has(request.destination) || isVersionedData) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirst(request));
  }
});
