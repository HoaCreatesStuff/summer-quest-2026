# NYC Summer Quest MVP

Open `index.html` in a browser.

## Included
- Libre Baskerville + Montserrat
- 5×5 mobile quest board
- Bottom-sheet quest details
- Square photo cropping and video selection
- Variable quest base points and per-quest bonuses from `data/quests.js`
- Friend scoring: 2 points per friend, up to 5 friends, on non-Final quests
- Rank progression
- Browser persistence with localStorage metadata and IndexedDB media
- Editable/removable submissions
- Summer Journal, story PDF, and memory keepsake
- Final Quest trivia gate followed by the `party-time` quest
- Versioned, fully precached PWA app shell with automatic update checks and a player-controlled restart

## Local media storage
Uploaded photos are cropped to 1400×1400 and encoded once as JPEG at
approximately 0.75 quality. Photos and videos are stored as Blobs in the
`nyc-summer-quest-media` IndexedDB database. localStorage contains only quest
metadata and media IDs. Startup removes unreferenced media records, and storage
failures retain their underlying browser exception plus a Storage API estimate
when available. Everything remains on the user's device; a future cloud version
can replace this layer with managed object storage. See
`docs/StorageAudit.md` for measured 25-photo capacity and lifecycle QA.

## PWA updates

`version.js` contains the public build version in `MMDDNN` format: month, day,
and the two-digit release number for that day. For example, releases on August
5 use `080501`, `080502`, and so on; the first release on August 6 is `080601`.
The service worker uses that version for its app-shell cache and removes only
obsolete `summer-quest-app-*` caches during activation. It never clears
localStorage or IndexedDB.

The app checks for a new worker on launch, focus, reconnect, page restore, and
every 30 minutes while it remains open. A downloaded update waits until the
player chooses **Restart**, preventing an automatic reload during gameplay.
The application shell, local WOFF2 fonts, Cropper.js, illustrations, icons,
home-screen help, and preview artwork use a cache-first strategy. Controlled app
navigations reuse the cache's canonical `index.html`, so query parameters do not
create shell variants or mix edge-cached HTML with another JavaScript build.
New service workers fetch a complete, versioned shell during installation; the
player then uses **Restart** to activate it without interrupting current
gameplay.

For each release:

1. Set the version in `version.js` to today's `MMDD` plus `01`, or increment
   `NN` when another release has already been made that day.
2. Confirm `sw.js` changes byte-for-byte so installed PWAs detect the release.
3. Run `tests/pwa-update-validation.html` with the other browser tests.

Run `python3 tests/offline_regression_check.py` before release to confirm that
runtime assets exist locally, are precached, and do not reference external font
or script/style CDNs.

## Files
- `index.html`
- `style.css`
- `version.js`
- `sw.js`
- `data/quests.js`
- `data/boardConfig.js`
- `data/mediaStorage.js`
- `data/app.js`
- `data/journal.js`
- `data/pwa.js`
- `tests/media-storage-validation.html`
- `tests/legacy-migration-validation.html`
- `tests/adventure-date-validation.html`
- `tests/release-critical-validation.html`
- `tests/interaction-accessibility-validation.html`
- `tests/desktop-mobile-validation.html`
- `tests/pwa-update-validation.html`
- `tests/offline_regression_check.py`

`data/quests.js` is the canonical source for quest content, base points,
bonuses, stories, and Final Quest configuration. `data/boardConfig.js` owns the
5×5 board order and fixed board-square colors.
