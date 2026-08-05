# Summer Quest Analytics Spec v1.0

Summer Quest sends anonymous gameplay events to the Google Apps Script endpoint
configured only in `data/analytics.js`. The client exposes explicit methods for
the events in this document; arbitrary event names are not accepted.

## Privacy Boundary

Every payload contains `installationId`, `sessionId`, `eventName`, `timestamp`,
`build`, `platform`, `displayMode`, `language`, `historical`, `feature`, and
`source`. Runtime classification also adds `environment` and `is_test` without
using browser storage or a manual toggle.

Quest payloads also contain `questId`, `questTitle`, `completedAt`,
`adventureDate`, `points`, `friendCount`, `bonusEarned`, `bonusCount`, and
`bonusIds`. Adventure completion contains `totalCompletedQuests`, `totalPoints`,
`totalFriends`, `finalRank`, and `completedAt`.

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
| `first_quest_completed` | First successful quest completion | Installation | Yes |
| `adventure_completed` | Successful final-quest completion | Installation | Yes |
| `journal_first_opened` | First Journal navigation | Installation | Yes |
| `journal_opened` | First Journal navigation in a session | Session | No |
| `keepsake_first_opened` | First Keepsake navigation | Installation | Yes |
| `keepsake_generated` | Every successful PNG generation | None | Yes, once if evidence exists |
| `privacy_opened` | First Privacy dialog opening | Installation | Yes |
| `feedback_submitted` | Every successful Formspree response | None | Yes, once if evidence exists |

No other analytics events are permitted.

## Local State

- `summerQuestInstallationId`: random `SQ-XXXXXXXX` installation ID.
- `SESSION-XXXXXX`: in-memory ID regenerated on every document launch.
- `summerQuestAnalyticsDedupe`: installation and historical progress markers.
- `summerQuestAnalyticsEvidenceV1`: anonymous timestamps for recoverable feature history.
- `summerQuestAnalyticsBackfillV1`: permanent completed marker for spec v1.0.
- `summerQuestAnonymousSharingEnabled`: privacy preference; missing means enabled.

A board reset does not reset analytics identity or dedupe state.

## Historical Backfill

An existing installation with no v1.0 completion marker performs one sequential,
non-blocking backfill while sharing is enabled and the browser is online. It
sends only events supported by saved quest state, current standalone detection,
or anonymous local evidence. Each successful event receives its own progress
marker. The permanent v1.0 marker is written only after every applicable event
succeeds or was already represented by a live event.

Offline and failed uploads do not complete the backfill. Unmarked work retries on
a future online launch. Session events (`app_opened`, `journal_opened`) are never
backfilled.

Feature activity from releases that never saved local evidence cannot be
reconstructed. The client does not infer such activity or upload invented rows.

## Transport

Live events attempt `navigator.sendBeacon()` once, followed by one `fetch()`
fallback only when the beacon is rejected. Historical events use sequential
`fetch()` calls so progress is marked only after each request resolves. Analytics
failures never interrupt gameplay or persistence.

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

## Google Apps Script Receiver

The receiver is maintained in `google-apps-script/analytics/Code.gs`. Set the
Script Property `ANALYTICS_SECRET` and optionally `ANALYTICS_SHEET_NAME` and
`ANALYTICS_TEST_SHEET_NAME`, then deploy a new web app version. Production rows
default to `Analytics`; development and unclassified rows default to
`Analytics Testing`. The receiver appends missing headers, including `Feature`,
`Source`, `Bonus Count`, `Bonus IDs`, `Historical`, `Environment`, and `Is Test`,
without changing existing data rows.
