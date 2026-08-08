const BUILD_VERSION = "080801";
const BUILD_VERSION_PATTERN = /^(\d{2})(\d{2})(\d{2})$/;

function isValidBuildVersion(value) {
  const match = BUILD_VERSION_PATTERN.exec(String(value || ""));
  if (!match) return false;

  const month = Number(match[1]);
  const day = Number(match[2]);
  const release = Number(match[3]);
  if (release < 1) return false;

  const calendarDate = new Date(Date.UTC(2000, month - 1, day));
  return calendarDate.getUTCMonth() === month - 1 &&
    calendarDate.getUTCDate() === day;
}

function compareBuildVersions(left, right) {
  if (!isValidBuildVersion(left) || !isValidBuildVersion(right)) return null;
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

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
  isValid: isValidBuildVersion,
  compare: compareBuildVersions,
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
