# Anonymous Product-Research Data Collection

Summer Quest remains local-first. Quest progress is saved locally before any anonymous research data is queued, and failed remote syncs never block the board, journal, photos, scoring, or final quest.

## Existing Storage Structure Discovered

- Quest metadata is stored in `localStorage` under `nyc-summer-quest-mvp-v1`.
- Saved submissions live at `state.submissions[questId]`; drafts live at `state.drafts[questId]`.
- Photos and videos are stored separately in IndexedDB database `nyc-summer-quest-media`, object store `media`, as `{ mediaId, blob }`.
- Saved quest records use the current structure `{ questId, completed, mediaId, mediaType, adventureDate, friends, location, caption, selectedBonusIds, completedAt }`.
- Final quest records also include `{ final, finalUnlocked, gateAnswer }`.
- Completed quests are records where `completed === true`.
- User-entered quest completion dates are stored as local calendar strings in `adventureDate`.
- `completedAt` is the original local record creation timestamp and is preserved on edits.
- Friend count is stored in `friends` and normalized to 0-5.
- Bonus selections are stored as `selectedBonusIds`; legacy `selectedBonuses` are migrated to canonical IDs.
- Scores are recalculated from `data/quests.js`: `basePoints + friendPoints + selected bonus points`; final quest friend points are always 0.
- Photos are represented only by `mediaId` and `mediaType`; captions are in `caption`; reflection text comes from quest definitions, not saved user input.
- Submissions are created/edited in the quest form submit handler in `data/app.js`, removed in `removeActiveMemory()`, and all progress is reset through the reset-board handler.
- The service worker caches same-origin GET app-shell assets only. It does not cache analytics POST requests or Supabase responses.

## Client Configuration

Edit the configuration block in `index.html` after creating the Edge Function:

```html
<script>
  window.SUMMER_QUEST_ANALYTICS_CONFIG = {
    enabled: true,
    endpointUrl: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/summer-quest-analytics",
    supabaseAnonKey: "YOUR_SUPABASE_PUBLIC_ANON_KEY"
  };
</script>
```

Never place a Supabase service-role key in client-side files.

## Supabase SQL

```sql
create table if not exists public.installations (
  installation_id uuid primary key,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  app_version text,
  consent_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quest_submissions (
  installation_id uuid not null references public.installations(installation_id),
  quest_id text not null,
  quest_title text not null,
  completion_status text not null check (completion_status in ('completed', 'incomplete', 'deleted')),
  completed_at timestamptz,
  friends_count integer not null default 0,
  selected_bonus_ids text[] not null default '{}',
  base_points integer not null default 0,
  friend_points integer not null default 0,
  bonus_points integer not null default 0,
  quest_total_points integer not null default 0,
  running_total_points integer not null default 0,
  has_photo boolean not null default false,
  has_caption boolean not null default false,
  has_reflection boolean not null default false,
  submission_version text not null,
  app_version text,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  last_synced_at timestamptz,
  primary key (installation_id, quest_id)
);

create table if not exists public.analytics_events (
  event_id uuid primary key,
  installation_id uuid not null references public.installations(installation_id),
  event_type text not null check (event_type in ('first_quest_completed', 'final_quest_completed', 'summary_snapshot')),
  quest_id text,
  occurred_at timestamptz not null,
  event_source text not null check (event_source in ('historical_import', 'realtime')),
  completed_quest_count integer not null default 0,
  total_points integer not null default 0,
  app_version text,
  all_available_quests_completed boolean,
  received_at timestamptz not null default now()
);

create table if not exists public.summary_snapshots (
  installation_id uuid not null references public.installations(installation_id),
  snapshot_version text not null,
  snapshot_date timestamptz not null,
  completed_quest_count integer not null default 0,
  total_available_quests integer not null default 0,
  total_points integer not null default 0,
  first_completion_date timestamptz,
  latest_completion_date timestamptz,
  total_friends_counted integer not null default 0,
  quests_with_friends integer not null default 0,
  solo_quests integer not null default 0,
  quests_with_bonus_points integer not null default 0,
  quests_with_photos integer not null default 0,
  quests_with_captions integer not null default 0,
  quests_with_reflections integer not null default 0,
  final_quest_completed boolean not null default false,
  completed_quest_ids text[] not null default '{}',
  app_version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (installation_id, snapshot_version)
);

alter table public.installations enable row level security;
alter table public.quest_submissions enable row level security;
alter table public.analytics_events enable row level security;
alter table public.summary_snapshots enable row level security;
```

Do not add public `select`, `insert`, `update`, or `delete` policies for `anon`. The browser should call only the Edge Function. Read access for analysis should happen in the Supabase dashboard, SQL editor, or a private service environment.

## Edge Function

Create `supabase/functions/summer-quest-analytics/index.ts`:

```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const allowedKinds = new Set([
  "installation",
  "quest_submission",
  "analytics_event",
  "summary_snapshot"
]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  const { kind, payload } = await request.json().catch(() => ({}));
  if (!allowedKinds.has(kind) || !payload?.installation_id) {
    return new Response("Invalid payload", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const installation = {
    installation_id: payload.installation_id,
    first_seen_at: payload.first_seen_at || payload.created_at || new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    app_version: payload.app_version || null,
    consent_version: payload.consent_version || null,
    updated_at: new Date().toISOString()
  };

  const installationResult = await supabase
    .from("installations")
    .upsert(installation, { onConflict: "installation_id" });
  if (installationResult.error) {
    return new Response(installationResult.error.message, { status: 500, headers: corsHeaders });
  }

  let result;
  if (kind === "quest_submission") {
    result = await supabase.from("quest_submissions").upsert({
      ...payload,
      last_synced_at: new Date().toISOString()
    }, { onConflict: "installation_id,quest_id" });
  } else if (kind === "analytics_event") {
    result = await supabase.from("analytics_events").upsert(payload, { onConflict: "event_id" });
  } else if (kind === "summary_snapshot") {
    result = await supabase.from("summary_snapshots").upsert({
      ...payload,
      updated_at: new Date().toISOString()
    }, { onConflict: "installation_id,snapshot_version" });
  } else {
    result = { error: null };
  }

  if (result.error) {
    return new Response(result.error.message, { status: 500, headers: corsHeaders });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
});
```

Set Edge Function secrets:

```sh
supabase secrets set SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="YOUR_SERVICE_ROLE_KEY"
```

Deploy:

```sh
supabase functions deploy summer-quest-analytics
```

## Security Model

The browser receives only the public anon key and can only call the ingestion function. The service-role key stays in Supabase Edge Function secrets. RLS is enabled and no public table policies are defined, so the deployed app cannot read the analytics dataset, query other installations, update arbitrary rows directly, or delete data. Installation IDs identify browser installations, not verified people.

## Data Dictionary

- `installation_id`: random `crypto.randomUUID()` stored locally as `summerQuestInstallationId`.
- `quest_id`, `quest_title`: canonical values from `data/quests.js`.
- `completion_status`: `completed`, `incomplete`, or `deleted`; current app removal/reset queues `deleted`.
- `completed_at`: user-entered `adventureDate` converted to UTC noon, falling back to legacy `completedAt`.
- `friends_count`: normalized `friends`, capped at 5.
- `selected_bonus_ids`: canonical selected bonus IDs only.
- `base_points`, `friend_points`, `bonus_points`, `quest_total_points`, `running_total_points`: recalculated from current quest definitions.
- `has_photo`, `has_caption`, `has_reflection`: booleans only; no media or written text is uploaded.
- `submission_version`: anonymous version fingerprint for idempotent edits.
- `event_source`: `historical_import` for reconstructed milestones, `realtime` for new app actions.
- `snapshot_version`: final summary schema/version key for idempotent snapshot upserts.
- `app_version`: `window.SUMMER_QUEST_BUILD.version`.

## Portfolio Privacy Explanation

Summer Quest asks for anonymous product-research consent only after a player has completed a quest, or on launch for existing players who already have completed quests saved locally. The prompt is a short creator message from Hoa, and "Maybe later" postpones the choice without uploading data. A second automatic reminder can appear after the player reaches three total completed quests, but only in a later session; after a second "Maybe later," automatic prompts stop. Players can still enable anonymous analytics later from Settings & About.

Summer Quest collects anonymous product-research data only after opt-in consent. The data describes how the game is used, such as completed quest IDs, completion dates, points, friend counts, and whether optional features like photos or captions were used. It does not upload photos, captions, reflections, names, email addresses, precise locations, browser fingerprints, or contact information. The anonymous installation ID represents one browser installation and should not be treated as a verified unique person.

## Retroactive Limits

The app can reconstruct completed quest IDs, dates, friend counts, selected bonuses, point totals, and media/caption presence from saved local records. It cannot reconstruct exact edit history, deleted quests from before this analytics release, declined users' behavior, data from other browsers/devices, or any events that happened after local storage was cleared.

## QA Checklist

- Existing board still loads 25 quests from `data/quests.js`.
- Existing local submissions remain in `nyc-summer-quest-mvp-v1`.
- IndexedDB media remains in `nyc-summer-quest-media`.
- Brand-new players do not see the consent prompt on first launch, onboarding, or How to Play.
- The first automatic prompt appears only after a successful first quest completion and completion celebration.
- Existing players with completed quests and no prior prompt see the consent prompt on next launch.
- "Maybe later" closes immediately, queues no data, and suppresses further prompts for the same session.
- A second automatic reminder appears after three total completed quests in a later session.
- After a second "Maybe later," no third automatic prompt appears.
- Manual opt-in remains available in Settings & About.
- Consent opt-in queues installation, historical submissions, reconstructed first/final milestones, and summary when eligible.
- Historical import uses upserts keyed by `installation_id + quest_id`.
- Edits update the same quest submission record.
- Memory removal and board reset queue `deleted` records after the local save succeeds.
- First quest completion works offline because records stay in `summerQuestAnalyticsQueue`.
- Final quest ID is `party-time`, matching the current `data/quests.js` source of truth.
- Final summary is queued on or after August 17, 2026, and when the final quest is completed.
- Repeated retries use stable queue dedupe keys and Supabase upsert constraints.
- Service worker still caches same-origin GET app assets only.
- Debug hooks are available only with `?summer-quest-analytics-debug=1`.
