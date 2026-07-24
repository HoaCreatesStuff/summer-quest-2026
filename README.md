# NYC Summer Quest MVP

Open `index.html` in a browser.

## Included
- Libre Baskerville + Montserrat
- 2-column mobile quest board
- Bottom-sheet quest details
- Photo/video selection
- Friend-count scoring: 5 points + 2 per friend
- Rank progression
- Browser persistence with localStorage metadata and IndexedDB media
- Editable/removable submissions
- Two-stage Final Quest with Mission Code and independently scored trivia

## Local media storage
Uploaded images are resized to a maximum 1400 px edge, encoded as JPEG at
approximately 0.75 quality, and stored as Blobs in the
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

`data/challenges.js` and `data/storyTemplates.js` are retained only as deprecated
backups and are not loaded by the app.
