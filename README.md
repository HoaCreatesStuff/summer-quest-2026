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
- Versioned PWA app shell with automatic update checks and a player-controlled restart

## Local media storage
Uploaded photos are cropped to 1200×1200 and encoded once as JPEG at
approximately 0.75 quality. Photos and videos are stored as Blobs in the
`nyc-summer-quest-media` IndexedDB database. localStorage contains only quest
metadata and media IDs. Everything remains on the user's device; a future cloud
version can replace this layer with managed object storage.

## PWA updates

`version.js` contains the public build version. The service worker uses that
version for its app-shell cache and removes only obsolete
`summer-quest-app-*` caches during activation. It never clears localStorage or
IndexedDB.

The app checks for a new worker on launch, focus, reconnect, page restore, and
every 30 minutes while it remains open. A downloaded update waits until the
player chooses **Restart**, preventing an automatic reload during gameplay.
Navigation, JavaScript, CSS, and manifest requests use a network-first strategy;
the cached app shell is an offline fallback rather than a permanently stale
source.

For each release:

1. Update the version in `version.js`.
2. Update the matching `application-version`, local asset query strings, and
   manifest `start_url` build value in `index.html` and `manifest.json`.
3. Run `tests/pwa-update-validation.html` with the other browser tests.

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
- `tests/release-critical-validation.html`
- `tests/interaction-accessibility-validation.html`
- `tests/desktop-mobile-validation.html`
- `tests/pwa-update-validation.html`

`data/quests.js` is the canonical source for quest content, base points,
bonuses, stories, and Final Quest configuration. `data/boardConfig.js` owns the
5×5 board order and fixed board-square colors.
