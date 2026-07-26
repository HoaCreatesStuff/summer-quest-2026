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

## Local media storage
Uploaded photos are cropped to 1200×1200 and encoded once as JPEG at
approximately 0.75 quality. Photos and videos are stored as Blobs in the
`nyc-summer-quest-media` IndexedDB database. localStorage contains only quest
metadata and media IDs. Everything remains on the user's device; a future cloud
version can replace this layer with managed object storage.

## Files
- `index.html`
- `style.css`
- `data/quests.js`
- `data/boardConfig.js`
- `data/mediaStorage.js`
- `data/app.js`
- `data/journal.js`
- `tests/media-storage-validation.html`
- `tests/legacy-migration-validation.html`
- `tests/release-critical-validation.html`
- `tests/interaction-accessibility-validation.html`

`data/quests.js` is the canonical source for quest content, base points,
bonuses, stories, and Final Quest configuration. `data/boardConfig.js` owns the
5×5 board order and fixed board-square colors.
