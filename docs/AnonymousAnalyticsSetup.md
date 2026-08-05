# Anonymous Gameplay Analytics

Summer Quest sends anonymous gameplay events to the deployed Google Apps Script endpoint in `data/analytics.js`. The endpoint and shared secret are centralized as `ANALYTICS_ENDPOINT` and `ANALYTICS_SECRET`; do not add page-level analytics config or hardcode the endpoint elsewhere.

## Privacy Boundary

Analytics events may include gameplay fields such as quest IDs, quest titles, completion dates, points, friend counts, bonus points, ranks, display mode, language, build, a random installation ID, and a per-launch session ID.

Analytics events must never include photos, captions, reflections, names, precise locations, contact-form contents, image metadata, browser fingerprints, user agent strings, email addresses, or viewport dimensions.

## Local Identifiers

- `summerQuestInstallationId`: random `SQ-XXXXXXXX` ID generated only when analytics first runs.
- `SESSION-XXXXXX`: in-memory per-launch ID generated on page load and never persisted.
- `summerQuestAnalyticsDedupe`: local event dedupe flags for one-time events.
- `summerQuestAnonymousSharingEnabled`: Privacy switch preference; missing means sharing is on.

The installation ID is removed by a full board reset through `SummerQuestAnalytics.trackBoardReset()`.

## Reliability Model

Analytics is fire-and-forget:

- `navigator.sendBeacon()` is attempted first.
- `fetch()` with `mode: "no-cors"`, `keepalive`, and a short abort timeout is the fallback.
- Offline events are skipped.
- Live events are not queued, retried, or backfilled later.
- Failures are silent and must never affect gameplay, saving, navigation, animations, journal, keepsake, contact, or finale behavior.

Historical quest completions are the sole exception to the no-retry rule. On an
online launch with sharing enabled, previously saved completed quests are sent
sequentially and marked only after the fetch resolves. Private memory fields are
never included.

## Event Coverage

Lifecycle:

- `app_opened`
- `mission_briefing_completed`
- `app_installed`

Quest:

- `quest_opened`, once per quest per installation
- `quest_completed`, once per quest per installation
- `first_quest_completed`, once per installation
- `adventure_completed`, once after the final quest is newly completed

Feature usage:

- `journal_opened`
- `keepsake_opened`
- `keepsake_generated`
- `privacy_opened`
- `contact_opened`
- `install_help_opened`
- `feedback_submitted`
- `finale_animation_started`
- `finale_animation_completed`

Previously completed quests are imported once per installation with
`historical: true`. New successful completions use `historical: false`.

## Google Apps Script Receiver

The receiver source is maintained in `google-apps-script/analytics/Code.gs`.
Set the Apps Script property `ANALYTICS_SECRET` to the client secret and,
optionally, `ANALYTICS_SHEET_NAME` to the destination tab name. Deploy a new web
app version after receiver changes. Missing columns are appended to the header;
existing data rows are not changed.
