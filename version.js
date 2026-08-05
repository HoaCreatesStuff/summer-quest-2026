const BUILD_VERSION = "08055";

function assetUrl(path) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}v=${encodeURIComponent(BUILD_VERSION)}`;
}

function renderBuildVersion(root = globalThis.document) {
  if (!root) return;

  root.querySelectorAll("[data-build-version]").forEach(element => {
    element.textContent = BUILD_VERSION;
  });

  const versionMeta = root.querySelector('meta[name="application-version"]');
  if (versionMeta) versionMeta.content = BUILD_VERSION;
}

globalThis.SUMMER_QUEST_BUILD = Object.freeze({
  version: BUILD_VERSION,
  assetUrl,
  render: renderBuildVersion
});

if (typeof document !== "undefined") {
  renderBuildVersion();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderBuildVersion(), {
      once: true
    });
  }
}
