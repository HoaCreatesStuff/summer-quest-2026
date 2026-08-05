importScripts("./version.js");

const WORKER_VERSION = self.SUMMER_QUEST_BUILD?.version || "unknown";
const CACHE_PREFIX = "summer-quest-app-";
const CACHE_NAME = `${CACHE_PREFIX}${WORKER_VERSION}`;
const APP_SHELL_URLS = [
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./version.js",
  "./data/iconFonts.js",
  "./data/pwa.js",
  "./data/quests.js",
  "./data/boardConfig.js",
  "./data/mediaStorage.js",
  "./data/finale.js",
  "./data/analytics.js",
  "./data/app.js",
  "./data/journal.js",
  "./assets/vendor/cropperjs/cropper.min.css",
  "./assets/vendor/cropperjs/cropper.min.js",
  "./assets/fonts/Montserrat-Variable.woff2",
  "./assets/fonts/LibreBaskerville-Variable.woff2",
  "./assets/fonts/LibreBaskerville-Italic-Variable.woff2",
  "./assets/fonts/Caveat-Variable.woff2",
  "./assets/fonts/MaterialSymbolsOutlined.woff2",
  "./assets/fonts/MaterialSymbolsRounded.woff2",
  "./assets/favicon/favicon.ico",
  "./assets/favicon/favicon-16x16.png",
  "./assets/favicon/favicon-32x32.png",
  "./assets/favicon/apple-touch-icon.png",
  "./assets/favicon/icon-192.png",
  "./assets/favicon/icon-512.png",
  "./assets/hero-park-clean.png",
  "./assets/hero-summer-journal.png",
  "./assets/link-preview.jpg",
  "./assets/home-screen-help/iphone-step-1.png",
  "./assets/home-screen-help/iphone-step-2.png",
  "./assets/home-screen-help/iphone-step-3.png",
  "./assets/home-screen-help/android-step-1.png",
  "./assets/home-screen-help/android-step-2.png",
  "./assets/home-screen-help/android-step-3.png",
  "./assets/illustrations/icon.png",
  "./assets/illustrations/overlays/completed-stamp-256.png",
  "./assets/illustrations/icons/animal-statue.png",
  "./assets/illustrations/icons/birthday-selfie.png",
  "./assets/illustrations/icons/bodega-cat.png",
  "./assets/illustrations/icons/celebrate-together.png",
  "./assets/illustrations/icons/cinema-moment.png",
  "./assets/illustrations/icons/city-freebies.png",
  "./assets/illustrations/icons/diy-craft.png",
  "./assets/illustrations/icons/favorite-art.png",
  "./assets/illustrations/icons/get-sweaty.png",
  "./assets/illustrations/icons/golden-hour.png",
  "./assets/illustrations/icons/hidden-gems.png",
  "./assets/illustrations/icons/human-pyramid.png",
  "./assets/illustrations/icons/live-events.png",
  "./assets/illustrations/icons/ny-eats.png",
  "./assets/illustrations/icons/nyc-spirit.png",
  "./assets/illustrations/icons/off-the-map.png",
  "./assets/illustrations/icons/open-market.png",
  "./assets/illustrations/icons/park-picnic.png",
  "./assets/illustrations/icons/pup-arazzi.png",
  "./assets/illustrations/icons/random-kindness.png",
  "./assets/illustrations/icons/showtime.png",
  "./assets/illustrations/icons/street-fashion.png",
  "./assets/illustrations/icons/street-mural.png",
  "./assets/illustrations/icons/subway-romance.png",
  "./assets/illustrations/icons/time-capsule.png",
  "./assets/illustrations/icons/waterfront-wonders.png"
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

async function cacheFirst(request, fallbackUrl) {
  const cached = await cachedFallback(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok && response.type === "basic") {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const fallback = await cachedFallback(request, fallbackUrl);
    if (fallback) return fallback;
    return new Response("", {
      status: 503,
      statusText: "Offline"
    });
  }
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
        version: WORKER_VERSION
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
    const message = {
      type: "SUMMER_QUEST_SW_VERSION",
      version: WORKER_VERSION
    };
    if (event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  }
});

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(cacheFirst(request, "./index.html"));
    return;
  }

  event.respondWith(cacheFirst(request));
});
