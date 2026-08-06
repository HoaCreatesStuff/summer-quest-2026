#!/usr/bin/env python3
"""Generate and validate the date-based Summer Quest release build.

Builds use MMDDNN: local month, local day, and a two-digit release sequence.
The build declarations in version.js and sw.js are generated together so the
worker source changes for every release and can invalidate an installed PWA.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
VERSION_FILE = ROOT / "version.js"
WORKER_FILE = ROOT / "sw.js"
BUILD_PATTERN = re.compile(r"^(\d{2})(\d{2})(\d{2})$")
VERSION_DECLARATION = re.compile(r'^const BUILD_VERSION = "(\d+)";$', re.MULTILINE)
WORKER_DECLARATION = re.compile(
    r'^const GENERATED_WORKER_VERSION = "(\d+)";$', re.MULTILINE
)
CACHE_DECLARATION = re.compile(
    r'^const CACHE_NAME = "(summer-quest-app-(\d+))";$', re.MULTILINE
)


class ReleaseBuildError(RuntimeError):
    """A release source is invalid or cannot safely be generated."""


def parse_build(value: str, label: str) -> tuple[int, int, int]:
    match = BUILD_PATTERN.fullmatch(value)
    if not match:
        raise ReleaseBuildError(f"{label} must be exactly six digits (MMDDNN), got {value!r}.")
    month, day, sequence = map(int, match.groups())
    if sequence < 1:
        raise ReleaseBuildError(f"{label} must have a release sequence from 01 to 99, got {value!r}.")
    try:
        dt.date(2000, month, day)
    except ValueError as error:
        raise ReleaseBuildError(f"{label} has an invalid calendar date: {value!r}.") from error
    return month, day, sequence


def one_match(pattern: re.Pattern[str], source: str, label: str) -> re.Match[str]:
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise ReleaseBuildError(f"{label} must contain exactly one generated declaration.")
    return matches[0]


def read_current_build() -> str:
    source = VERSION_FILE.read_text(encoding="utf-8")
    build = one_match(VERSION_DECLARATION, source, "version.js").group(1)
    parse_build(build, "Current build")
    return build


def history_builds() -> set[str]:
    """Return builds previously committed in version.js, across every local ref."""
    try:
        revisions = subprocess.run(
            ["git", "rev-list", "--all"], cwd=ROOT, text=True, capture_output=True, check=True
        ).stdout.splitlines()
    except (OSError, subprocess.CalledProcessError) as error:
        raise ReleaseBuildError("Unable to inspect Git history for previously released builds.") from error

    builds: set[str] = set()
    for revision in revisions:
        result = subprocess.run(
            ["git", "show", f"{revision}:version.js"],
            cwd=ROOT,
            text=True,
            capture_output=True,
        )
        if result.returncode:
            continue
        match = VERSION_DECLARATION.search(result.stdout)
        if match:
            builds.add(match.group(1))
    return builds


def next_build(current: str, today: dt.date, used_builds: set[str]) -> str:
    parse_build(current, "Current build")
    prefix = today.strftime("%m%d")
    sequence = int(current[4:]) + 1 if current.startswith(prefix) else 1
    while sequence <= 99:
        candidate = f"{prefix}{sequence:02d}"
        if candidate not in used_builds:
            return candidate
        sequence += 1
    raise ReleaseBuildError(f"All 99 release build numbers for {today.isoformat()} are already used.")


def generated_version_source(source: str, build: str) -> str:
    match = one_match(VERSION_DECLARATION, source, "version.js")
    return source[: match.start(1)] + build + source[match.end(1) :]


def generated_worker_source(source: str, build: str) -> str:
    worker_match = one_match(WORKER_DECLARATION, source, "sw.js")
    cache_match = one_match(CACHE_DECLARATION, source, "sw.js")
    replacements = [
        (worker_match.start(1), worker_match.end(1), build),
        (cache_match.start(1), cache_match.end(1), f"summer-quest-app-{build}"),
    ]
    for start, end, value in reversed(replacements):
        source = source[:start] + value + source[end:]
    return source


def validate_sources(version_source: str, worker_source: str, expected_build: str) -> None:
    version = one_match(VERSION_DECLARATION, version_source, "version.js").group(1)
    worker = one_match(WORKER_DECLARATION, worker_source, "sw.js").group(1)
    cache_match = one_match(CACHE_DECLARATION, worker_source, "sw.js")
    cache_name, cache_build = cache_match.group(1), cache_match.group(2)
    parse_build(version, "version.js build")
    parse_build(worker, "sw.js build")
    parse_build(cache_build, "sw.js cache build")
    if version != expected_build or worker != expected_build:
        raise ReleaseBuildError("version.js and sw.js disagree with the generated build.")
    if cache_build != expected_build or cache_name != f"summer-quest-app-{expected_build}":
        raise ReleaseBuildError("The service-worker cache name does not match the generated build.")
    if worker_source.count(expected_build) != 2:
        raise ReleaseBuildError("The service worker has stale or missing generated build references.")
    stale_worker_builds = set(re.findall(r"\b\d{6}\b", worker_source)) - {expected_build}
    if stale_worker_builds:
        raise ReleaseBuildError(
            "Stale build references remain in sw.js: " + ", ".join(sorted(stale_worker_builds))
        )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing files.")
    parser.add_argument("--date", help="Use YYYY-MM-DD instead of the local date (for deterministic QA only).")
    args = parser.parse_args()

    try:
        today = dt.date.fromisoformat(args.date) if args.date else dt.date.today()
        current = read_current_build()
        used_builds = history_builds() | {current}
        build = next_build(current, today, used_builds)
        version_source = VERSION_FILE.read_text(encoding="utf-8")
        worker_source = WORKER_FILE.read_text(encoding="utf-8")
        # A release never repairs a hand-edited mismatch silently. Stop before
        # writing so a stale source cannot be promoted as a new release.
        validate_sources(version_source, worker_source, current)
        next_version_source = generated_version_source(version_source, build)
        next_worker_source = generated_worker_source(worker_source, build)
        validate_sources(next_version_source, next_worker_source, build)
        if worker_source == next_worker_source:
            raise ReleaseBuildError("The new service worker would be byte-for-byte unchanged.")
        changes = [
            path.name
            for path, before, after in (
                (VERSION_FILE, version_source, next_version_source),
                (WORKER_FILE, worker_source, next_worker_source),
            )
            if before != after
        ]
        if not changes:
            raise ReleaseBuildError("No generated release files would change.")
        print(f"Current build: {current}")
        print(f"Current date: {today.isoformat()} (local)")
        print(f"Next build: {build}")
        print("Files that would change: " + ", ".join(changes))
        if args.dry_run:
            return 0
        VERSION_FILE.write_text(next_version_source, encoding="utf-8")
        WORKER_FILE.write_text(next_worker_source, encoding="utf-8")
        print(f"Generated cache name: summer-quest-app-{build}")
        return 0
    except (OSError, ValueError, ReleaseBuildError) as error:
        print(f"release:build failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
