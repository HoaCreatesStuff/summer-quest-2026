# Summer Quest Analytics Spec v1.0

Summer Quest sends anonymous gameplay events to the Google Apps Script endpoint
configured only in `data/analytics.js`. The client exposes explicit methods for
the events in this document; arbitrary event names are not accepted.

## Privacy Boundary

Every payload contains `installationId`, `sessionId`, `eventName`, `eventKey`,
`timestamp`, `build`, `platform`, `displayMode`, `language`, `historical`,
`feature`, and `source`. Runtime classification also adds `environment` and
`is_test` without using browser storage or a manual toggle.

Quest payloads also contain `questId`, `questTitle`, `adventureDate`, `points`,
`friendCount`, `bonusEarned`, `bonusCount`, and `bonusIds`. Adventure completion
contains `totalCompletedQuests`, `totalPoints`, `totalFriends`, and `finalRank`.

Current quest state is also reconciled as a batch. Each normalized record uses
`installationId + ":" + questId` as its stable `recordKey` and contains only
completion status, update timestamps, point components, friend count,
selected bonus IDs, media-presence booleans, and submission version. It never
includes memory content or a board-order cumulative score.

Quest Records always use `source: "state_sync"`: they are current-state rows,
not lifecycle events. Older rows may retain their pre-fix reconciliation-trigger
source until a legitimate state update rewrites them. Lifecycle provenance belongs
to append-only Events.

Quest Record timestamps have distinct meanings:

- `First Completed At` is the first successful in-app completion timestamp for
  that quest. It is retained through edits, deletion, and recompletion.
- `Adventure Date` is the player-selected real-world activity date.
- `Updated At` is the last local mutation of the current submission/tombstone.
- `Event Timestamp` is the reconciliation request time.

For older saved submissions, `First Completed At` is reconstructed only from a
persisted `firstCompletedAt` or legacy `completedAt`. If neither exists, it is
left blank rather than inferring false precision from Adventure Date or Updated
At. The next normal reconciliation can fill Adventure Date from saved state.

Payload construction must never read or send photos, captions, reflections,
names, location names, precise locations, blob URLs, keepsake images, feedback
contents, email addresses, image metadata, user agent strings, or viewport data.

## Event Contract

| Event | Trigger | Dedupe | Historical |
| --- | --- | --- | --- |
| `app_first_opened` | First analytics-enabled launch | Installation | Yes |
| `app_opened` | Analytics-enabled app initialization | Session | No |
| `app_installed` | Successful browser `appinstalled` event | Installation | Yes |
| `quest_completed` | Incomplete quest is committed after a successful save | Quest + installation | Yes |
| `quest_removed` | A saved quest is removed after successful local persistence | None | No |
| `first_quest_completed` | First successful quest completion | Installation | Yes |
| `adventure_completed` | Successful final-quest completion | Installation | Yes |
| `journal_first_opened` | First Journal navigation | Installation | Yes |
| `journal_opened` | First Journal navigation in a session | Session | No |
| `keepsake_first_opened` | First Keepsake navigation | Installation | Yes |
| `keepsake_opened` | First Keepsake navigation in a session | Session | No |
| `keepsake_generated` | Every successful PNG generation | None | Yes, once if evidence exists |
| `privacy_opened` | First Privacy dialog opening | Installation | Yes |
| `feedback_submitted` | Every successful Formspree response | None | Yes, once if evidence exists |

No other analytics events are permitted.

## Local State

- `summerQuestInstallationId`: random `SQ-XXXXXXXX` installation ID.
- `SESSION-XXXXXX`: in-memory ID created for a cold launch or after 30 minutes
  in the background. Brief foreground returns keep the existing session.
- `summerQuestAnalyticsDedupe`: installation and historical progress markers.
- `summerQuestAnalyticsEvidenceV1`: anonymous timestamps for recoverable feature history.
- `summerQuestAnalyticsBackfillV1`: completed marker for migration v1.1. Older
  values are repairable and never suppress the confirmed migration.
- `summerQuestAnalyticsBackfillStateV2`: current historical migration state,
  including `not_started`, `queued`, `partially_synced`, `completed`, `failed`,
  or `no_records`.
- `summerQuestFirstOpenedAt`: resolved local first-open timestamp.
- `summerQuestFeatureFirstOpenedV1`: resolved feature first-open timestamps for
  app, Journal, and Keepsake, plus source/evidence metadata.
- `summerQuestFirstOpenMigrationV1`: first-open migration state and receiver
  repair counters.
- `summerQuestQuestReconciliationV1`: confirmed hashes and retry state for the
  recurring quest-state projection. A record is confirmed only after a readable
  receiver `{ "ok": true }` response. Reconciliation metadata v1 is safely
  replaced once by v2 so installations affected during the initial receiver
  rollout resend their current quest records; no quest progress or memories are
  altered.
- `summerQuestAnonymousSharingEnabled`: privacy preference; missing means enabled.

A board reset does not reset analytics identity or dedupe state.

## Quest-State Reconciliation

Every eligible app launch, post-load foreground return (after a five-minute
cooldown), successful quest save or edit, incomplete state, removal, reset,
pending reconnect, and manual **Sync Now** action compares normalized local
quest state with receiver-confirmed hashes. It is never tied to routine UI
activity.

The receiver materializes these records in `Quest Records` (or `Quest Records
Testing` for explicit `is_test: true` payloads). It inserts a missing Record Key,
updates a changed record in place, and does no write for an unchanged record.
Incomplete and deleted records remain represented by status, so a previous
completion cannot remain counted after local state changes. The response reports
`inserted`, `updated`, and `unchanged` counts.

Confirmed local hashes allow unchanged records to be skipped. App launch and
manual sync can still perform a full receiver comparison, and missing or
uncertain local sync metadata causes all current records to be sent. Offline and
failed attempts remain pending and retry on reconnect or a future launch. The
client never marks a hash confirmed without readable receiver acknowledgment.
Deletion tombstones persist their mutation timestamp and incremented submission
version locally at removal/reset time, so retries and restarts cannot replace it.
They also retain First Completed At and Adventure Date.

Session events such as `app_opened`, `journal_opened`, and `keepsake_opened`
remain append-only in `Events`. Stable one-time first-open keys still upsert.

## One-Time Event Repair

An existing installation with no completed v1.1 migration state performs one
sequential, non-blocking backfill while sharing is enabled and the browser is
online. It repairs only one-time installation, first-open, first-completion, and
feature evidence events; quest records are handled by recurring reconciliation.
Each successful event receives its own
progress marker. The completed state is written only after every applicable event
receives a readable `{ "ok": true }` response from the receiver. A legacy
`summerQuestAnalyticsBackfillV1` marker, completed migration object, or dedupe
entry is treated as repairable and does not suppress a v1.1 rerun. Stable event
keys make every confirmed retry an idempotent receiver upsert. Partial retries
skip only progress keys confirmed by a readable response during migration v1.1;
legacy live-event dedupe markers are never treated as receiver confirmation.

The historical `app_first_opened` timestamp is resolved in this order:
persisted first-open timestamp, earliest stored app timestamp, earliest quest
record timestamp, earliest completed quest date at local midday, then the
current timestamp only when there is no historical app data. Reconstructed
first-open events use `source: "historical_import"`; genuinely new first-open
events use `source: "realtime"`.

Journal and Keepsake first-open events are resolved separately from current
screen opens. Journal first-open can be reconstructed only from stored Journal
navigation evidence or an existing Journal first-open dedupe marker; completed
quests prove journal content exists but do not prove the Journal screen was
opened. Keepsake first-open can be reconstructed from stored Keepsake navigation
evidence, or inferred from stored `keepsake_generated` evidence with
`historicalStatus: "inferred"`. Normal
`journal_opened` and `keepsake_opened` events always use current session time.

Offline and failed uploads do not complete one-time event repair. Unmarked work
retries on a future online launch. Session events are never backfilled.

Feature activity from releases that never saved local evidence cannot be
reconstructed. The client does not infer such activity or upload invented rows.

## Transport

Live events attempt `navigator.sendBeacon()` once, followed by one `fetch()`
fallback only when the beacon is rejected. Historical events use sequential
confirmed `fetch()` calls so progress is marked only after the receiver returns
`{ "ok": true }`. Quest reconciliation also uses confirmed CORS `fetch()` and
retains pending state after any unreadable or failed response. Analytics failures
never interrupt gameplay or persistence.

## Runtime Environment

Only `https://hoacreatesstuff.github.io/summer-quest-2026/` and paths beneath it
are production. Those payloads use `environment: "beta"` and `is_test: false`.
Every other runtime, including localhost, `127.0.0.1`, local development server
ports, preview deployments, and alternate hosts, defaults to
`environment: "development"` and `is_test: true`.

Opening the app with `?developer=true` stores Developer Mode in the current
browser or installed PWA and overrides analytics to `environment:
"development"` and `is_test: true`. Opening it with `?developer=false` stores
the disabled state and overrides analytics to `environment: "beta"` and
`is_test: false`. The setting remains until one of those URLs changes it.

After a recognized value is stored, the app removes only the `developer`
parameter with `history.replaceState()`. It preserves the complete pathname,
including `/summer-quest-2026/`, along with any other query parameters and the
URL fragment.

When Developer Mode is enabled, the console exposes
`window.SummerQuestAnalyticsDebug.report()`. The asynchronous report contains
only operational state: sharing state, Developer Mode, analytics environment,
anonymous installation ID, historical migration state/version/counts, first-open
migration state, per-feature resolved first-open timestamps/sources/evidence,
receiver duplicate/repair counters, last migration attempt/error, persisted and
resolved first-open timestamps, first-open source, whether `app_first_opened` has
synced, pathname, app/cache/service-worker versions, controller state, and
pending analytics queue count. It never includes quest memories or media.

## Google Apps Script Receiver

The receiver is maintained in `google-apps-script/analytics/Code.gs`. The
Script Property `ANALYTICS_SECRET` should match the client secret. If that
property is missing, the receiver falls back to the client-compatible constant
so an incomplete deployment cannot disable all analytics. Optional properties
are `ANALYTICS_SPREADSHEET_ID`, `ANALYTICS_SHEET_NAME`,
`ANALYTICS_TEST_SHEET_NAME`, `ANALYTICS_QUEST_SHEET_NAME`, and
`ANALYTICS_QUEST_TEST_SHEET_NAME`. `ANALYTICS_DIAGNOSTICS=true` enables detailed error
responses and should be used only during receiver development.

Every JSON response includes `receiverVersion`, including readable errors, so a
client can persist the exact deployed receiver version and response status for
migration diagnostics.

Only payloads with the boolean `is_test: true` go to `Analytics Testing` (or
the configured test sheet). Every other payload goes to the single production
sheet, `Events` (or the configured production sheet). The receiver preserves
numeric build values with a matching zero-padded format so leading zeros are not
lost, including both legacy and current build conventions. It requires the
complete v11 header schema, including `Event Key`, `Feature`, `Source`, `Bonus
Count`, `Bonus IDs`, `Historical`, `Historical Status`, `Evidence Used`, `First
Observed By Analytics At`, `Superseded`, `Superseded By`, `Environment`, and
`Is Test`. Rows with the same `Event Key` are updated in place so historical
repair runs are idempotent.
Rows created before `Event Key` existed are matched by stable legacy identity,
such as installation plus `app_first_opened` or installation plus quest ID.
Duplicate stable first-open rows are marked superseded and point to the canonical
event key.

## Schema Migration v11

`doPost()` never changes sheet structure. Deploy receiver v11 before running
the migration so the older receiver cannot append retired headers again. Then
open the bound Apps Script project and run `previewAnalyticsSchemaMigrationToV11()`.
It validates `Events`, `Analytics Testing`, `Quest Records`, and `Quest Records
Testing`, reporting the exact retired columns it would remove. It stops without
changing anything if a sheet is missing, has no header row, has duplicate or
blank headers, has a row-width mismatch, or does not reduce to the exact v11
header set. A sheet with the complete known header set in a legacy order is a
valid migration candidate and is reported with `requiresReorder: true`.

After reviewing the preview and making a spreadsheet backup, run
`migrateAnalyticsSchemaToV11()`. It removes `Received At`, `Last Received At`,
`Completed At`, `Timestamp Precision`, and the Quest Records-only `Running Total
Points` by exact header name from right to left. It adds blank `First Completed
At` and `Adventure Date` columns only when migrating the known prior Quest
Records schema. Remaining cells shift with their own columns; no blank
placeholders are created otherwise. It fails validation when unexpected columns are present to prevent
accidental schema corruption, and only proceeds when the sheet matches the
expected header set. When the known headers are in a legacy order, it rewrites
the complete sheet into canonical v11 order by mapping each cell to its header
name, never by a raw column index. Preview reports include `columnsToRemove`,
`requiresReorder`, `currentHeaders`, `targetHeaders`, `validationPassed`, and
`errors`; migration reports also include `sheetName`, `columnsRemoved`,
`alreadyMigrated`, `finalHeaders`, and `rowCount`. A second run makes no changes
and reports the sheets as already migrated.

Until the migration has run successfully, the v11 receiver rejects a missing,
retired, or malformed schema with a readable error instead of changing it during
an analytics request. This brief retry window affects analytics only, never
gameplay or saved quest data.
