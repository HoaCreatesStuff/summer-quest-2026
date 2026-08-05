# Browser photo storage audit

Audit date: August 4, 2026

## Current pipeline

- Quest photos are cropped to 1400×1400 pixels and encoded once as JPEG at
  0.75 quality. This is the production upload path.
- The uncropped fallback preserves aspect ratio, caps the longest edge at 1400
  pixels, and encodes JPEG at 0.75 quality.
- Binary media is stored as Blob records in the
  `nyc-summer-quest-media` IndexedDB database and `media` object store.
- localStorage contains quest metadata and `mediaId` references, never new
  Base64 photo data. Legacy Base64 records are migrated once.
- Previews, the Summer Journal, the finale mosaic, and the keepsake use Blob
  object URLs. Their URLs are revoked when replaced, removed, or unloaded.

The capacity results do not justify another quality reduction. The production
1400×1400 / 0.75 output remains suitable for modal display and printable
keepsakes.

## Measured capacity

`tests/media-storage-validation.html` runs against the production IndexedDB
helper and performs a real reload between write and read phases.

| Profile | Average Blob | 25-photo total | Purpose |
| --- | ---: | ---: | --- |
| Bundled-image proxy | 68,708 bytes | 1,717,688 bytes (1.64 MiB) | Repeatable lower-detail visual sample |
| High-detail stress | 1,108,554 bytes | 27,713,854 bytes (26.43 MiB) | Conservative, deliberately hard-to-compress ceiling |

The repository does not contain an actual 25-photo recent-iPhone corpus, so the
first result must not be presented as an iPhone-camera average. Camera source
resolution is normalized by the crop; scene detail drives the final JPEG size.
For planning, the measured 26.43 MiB stress total is the safer bound. The final
run reported 30,313,431 bytes for the IndexedDB portion of origin usage after
that profile. Total origin usage was higher because it also included the PWA
app-shell cache and service-worker registration.

`navigator.storage.estimate()` was supported in the test browser. Its quota and
usage values are approximate browser estimates, so exact Blob totals come from
the IndexedDB records while estimate data is retained for diagnosis.

## Lifecycle findings

- New selection writes the Blob first, then saves its draft metadata. If the
  metadata write fails, the new Blob is removed and the previous draft is
  restored.
- Replacing a draft or completed submission deletes the obsolete Blob after
  the new reference is safely saved.
- Removing a memory backs up its Blobs, deletes them, then removes metadata. A
  failure restores the prior state and attempts to restore any deleted Blobs.
- IndexedDB writes are transactional. A failed write does not commit a partial
  record.
- Cleanup failures can temporarily leave an unreferenced Blob. Startup compares
  all IndexedDB keys with every media reference in saved state and removes such
  orphans in one transaction.
- Reset clears localStorage quest state and the IndexedDB media store. Startup
  retries orphan cleanup if the media clear was interrupted.

The automated lifecycle run verified 12 consecutive replacements with a
stable 25-record count, removed five submissions and observed reclaimed Blob
bytes, detected and removed one injected orphan, verified that a failed write
left no record, and confirmed reset returned the store to zero records.

## Failure diagnostics

Every IndexedDB transaction now records its operation, transaction stage,
browser exception name/message, and—on writes—the attempted Blob size plus a
`navigator.storage.estimate()` snapshot. Errors are classified as:

- `quota-exceeded` only for an actual `QuotaExceededError`
- `indexeddb-unavailable` for blocked/unavailable/security failures
- `transaction-aborted` for an actual abort
- `compression-failure` for crop or JPEG encoding failures
- `storage-failure` with the underlying browser exception retained for all
  other failures

Player-facing copy no longer recommends clearing history/cache, freeing device
storage, or deleting saved quests. It states what failed and preserves existing
memories whenever the rollback path guarantees that outcome.

The app also requests persistent storage when the browser supports the Storage
API. Browsers decide whether to grant it; denial is non-fatal and does not
change the interface.

## QA status

- PASS: 25-photo write and refresh restore
- PASS: 25-photo high-detail stress profile
- PASS: 12 repeated replacements with stable count and no orphans
- PASS: submission removal reclaims Blob bytes
- PASS: explicit orphan detection and automatic cleanup
- PASS: failed write leaves no partial record
- PASS: reset clears all Blob records
- PASS: legacy Base64 migration and cleanup
- PASS: Journal and keepsake render uploaded Blob URLs
- PASS: full 25-quest finale loads all locally stored images
- PASS: PWA update logic preserves localStorage and IndexedDB in the automated
  browser suite
- MANUAL DEVICE CHECK: Safari browser on iPhone/iPad
- MANUAL DEVICE CHECK: installed Home Screen web app

The in-app automated browser is not Safari and cannot emulate an installed iOS
Home Screen web app. Those last two checks require a physical Apple-device run.
WebKit documents Storage API support and modern origin quotas for both Safari
and Home Screen web apps:

- https://webkit.org/blog/14403/updates-to-storage-policy/
- https://webkit.org/blog/14445/webkit-features-in-safari-17-0/
