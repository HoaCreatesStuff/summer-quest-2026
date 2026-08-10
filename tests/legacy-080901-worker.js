// Test-only stand-in for the installed 080901 worker.  It gives the PWA
// validation page a real older controller before the current worker replaces
// it, without touching production storage or app logic.
const LEGACY_VERSION = "080901";
const LEGACY_CACHE = "summer-quest-app-080901";

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(LEGACY_CACHE);
    await cache.put("./legacy-shell", new Response("080901 shell"));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", event => {
  if (event.data?.type !== "SUMMER_QUEST_GET_VERSION") return;
  const message = { type: "SUMMER_QUEST_SW_VERSION", version: LEGACY_VERSION };
  if (event.ports?.[0]) event.ports[0].postMessage(message);
  else event.source?.postMessage(message);
});
