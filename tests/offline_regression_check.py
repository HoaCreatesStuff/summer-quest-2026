#!/usr/bin/env python3
"""Verify that Summer Quest's runtime is self-contained and fully precached."""

from __future__ import annotations

import json
import re
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parent.parent
RUNTIME_FILES = [
    "index.html",
    "style.css",
    "manifest.json",
    "sw.js",
    "version.js",
    "data/iconFonts.js",
    "data/pwa.js",
    "data/quests.js",
    "data/boardConfig.js",
    "data/mediaStorage.js",
    "data/finale.js",
    "data/app.js",
    "data/journal.js",
]
FONT_FILES = [
    "assets/fonts/Montserrat-Variable.woff2",
    "assets/fonts/LibreBaskerville-Variable.woff2",
    "assets/fonts/LibreBaskerville-Italic-Variable.woff2",
    "assets/fonts/Caveat-Variable.woff2",
    "assets/fonts/MaterialSymbolsOutlined.woff2",
    "assets/fonts/MaterialSymbolsRounded.woff2",
]
FORBIDDEN_EXTERNAL_ASSET_PATTERNS = [
    re.compile(r"fonts\.googleapis\.com", re.I),
    re.compile(r"fonts\.gstatic\.com", re.I),
    re.compile(r"cdn\.jsdelivr\.net", re.I),
    re.compile(r"<script[^>]+src=[\"']https?://", re.I),
    re.compile(
        r"<link(?=[^>]+rel=[\"']stylesheet[\"'])"
        r"(?=[^>]+href=[\"']https?://)[^>]*>",
        re.I,
    ),
    re.compile(r"url\(\s*[\"']?https?://", re.I),
]


def local_asset(path_value: str) -> str:
    return f"./{path_value.removeprefix('./')}"


def main() -> int:
    failures: list[str] = []
    sources: dict[str, str] = {}

    for relative_path in RUNTIME_FILES:
        absolute_path = PROJECT_ROOT / relative_path
        if not absolute_path.exists():
            failures.append(f"Missing runtime file: {relative_path}")
            sources[relative_path] = ""
        else:
            sources[relative_path] = absolute_path.read_text(encoding="utf-8")

    for relative_path, source in sources.items():
        for pattern in FORBIDDEN_EXTERNAL_ASSET_PATTERNS:
            if pattern.search(source):
                failures.append(
                    f"External runtime asset reference in {relative_path}: "
                    f"{pattern.pattern}"
                )

    worker_source = sources["sw.js"]
    precached_paths = set(re.findall(r"""["'](\./[^"']+)["']""", worker_source))
    app_shell_match = re.search(
        r"const APP_SHELL_URLS = \[(.*?)\];", worker_source, re.DOTALL
    )
    app_shell_paths = set(
        re.findall(r"""["'](\./[^"']+)["']""", app_shell_match.group(1))
        if app_shell_match
        else []
    )
    if not app_shell_match:
        failures.append("Unable to find APP_SHELL_URLS in sw.js")

    index_paths = {
        local_asset(match)
        for match in re.findall(
            r"""(?:src|href)=["']((?:\./)?(?:assets|data)/[^"'?#]+|"""
            r"""(?:\./)?(?:style|version|manifest)\.[^"'?#]+)["']""",
            sources["index.html"],
        )
    }
    css_paths = set(
        re.findall(
            r"""url\(["']?(\./assets/[^"')?#]+)["']?\)""",
            sources["style.css"],
        )
    )
    javascript_paths: set[str] = set()
    for relative_path in ("data/quests.js", "data/app.js"):
        javascript_paths.update(
            local_asset(match)
            for match in re.findall(
                r"""["'](assets/[^"']+\.(?:png|jpe?g|webp|gif|svg|ico))["']""",
                sources[relative_path],
                re.I,
            )
        )

    required_local_assets = {
        "./index.html",
        *index_paths,
        *css_paths,
        *javascript_paths,
    }

    for asset_path in sorted(required_local_assets):
        disk_path = PROJECT_ROOT / asset_path.removeprefix("./")
        if not disk_path.exists():
            failures.append(f"Missing local asset: {asset_path}")
        if asset_path not in precached_paths:
            failures.append(f"Asset is not precached: {asset_path}")

    for asset_path in sorted(app_shell_paths):
        disk_path = PROJECT_ROOT / asset_path.removeprefix("./")
        if not disk_path.exists():
            failures.append(f"App-shell asset is missing locally: {asset_path}")

    for font_file in FONT_FILES:
        font_path = PROJECT_ROOT / font_file
        if not font_path.exists():
            failures.append(f"Missing local WOFF2 font: {font_file}")
        elif font_path.read_bytes()[:4] != b"wOF2":
            failures.append(f"Invalid WOFF2 font signature: {font_file}")

    if failures:
        print(json.dumps({"status": "FAIL", "failures": failures}, indent=2))
        return 1

    print(
        json.dumps(
            {
                "status": "PASS",
                "runtimeFiles": len(RUNTIME_FILES),
                "requiredLocalAssets": len(required_local_assets),
                "precachedAssets": len(precached_paths),
                "localWoff2Fonts": len(FONT_FILES),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
