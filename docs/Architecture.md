# Architecture

> **Summer Quest 2026**\
> Living technical blueprint for the MVP and future releases.

------------------------------------------------------------------------

# Tech Stack (MVP)

-   HTML5
-   CSS3
-   Vanilla JavaScript
-   localStorage for lightweight metadata
-   IndexedDB for uploaded media Blobs
-   Mobile-first responsive design

No frameworks.

------------------------------------------------------------------------

# Folder Structure

``` text
/
├── assets/
│   ├── ui/
│   ├── illustrations/
│   └── icons/
│
├── data/
│   ├── quests.js
│   ├── boardConfig.js
│   ├── mediaStorage.js
│   ├── app.js
│   └── journal.js
│
├── docs/
│   ├── ProductVision.md
│   ├── DesignSystem.md
│   ├── Roadmap.md
│   ├── Copy_Guide.md
│   └── Architecture.md
│
├── style.css
├── index.html
└── README.md
```

------------------------------------------------------------------------

# Core Data Models

## Quest

``` js
{
  category: "experience-nyc",
  icon: "wb_twilight",
  title: "Golden Hour",
  description: "...",
  basePoints: 5,
  bonuses: [],
  story: "...",
  reflection: null,
  bonusMemories: {}
}
```

`data/quests.js` is the canonical source for quest content, base points,
bonuses, stories, and Final Quest configuration. Stable IDs are the keys in
`window.QUESTS`. Board and navigation order lives in `window.BOARD_ORDER`,
while fixed physical-square colors live independently in `window.BOARD_COLORS`
inside `data/boardConfig.js`.

## Submission

``` js
{
  questId: "golden-hour",
  completed: true,
  mediaId: "0e3e7d8f-...",
  mediaType: "image/jpeg",
  friends: 2,
  location: "Brooklyn Bridge Park",
  caption: "Golden hour with the crew",
  selectedBonusIds: [],
  completedAt: "2026-08-05T18:30:00Z"
}
```

## Rank

``` js
{
  title: "Local Insider",
  minPoints: 100,
  maxPoints: 169,
  blurb: "You've earned serious local bragging rights."
}
```

------------------------------------------------------------------------

# State

localStorage key `nyc-summer-quest-mvp-v1` stores:

-   Completed quests
-   Draft and submission metadata
-   IndexedDB media IDs
-   Friend counts
-   Final Quest state

Uploaded media is stored separately:

``` text
Database: nyc-summer-quest-media
Object store: media
Record: { mediaId, blob }
```

Photos selected through the quest form are cropped to 1200×1200 and encoded
once as JPEG Blobs at approximately 0.75 quality. Videos remain in their
selected format. Preview, journal, keepsake, and PDF rendering use temporary
`blob:` URLs that are revoked when no longer needed.

On startup, legacy `dataUrl` fields in submissions and drafts are converted to
Blobs, written to IndexedDB, replaced with `mediaId`, and removed from
localStorage. Unreferenced media records are cleaned up after migration.

------------------------------------------------------------------------

# Component Hierarchy

``` text
App
│
├── Hero
├── Progress Card
├── Mission Briefing
├── 5×5 Quest Grid
│     └── Quest Card
├── Bottom Sheet
      ├── Upload Widget
      ├── Friend Counter
      ├── Reward Preview
      ├── Crop Dialog
      ├── Removal Confirmation
      └── Save Button
├── Summer Journal
│     ├── Dated memory story
│     └── Story PDF export
└── Memory Keepsake
      ├── 5×5 photo board
      └── PNG save/share
```

------------------------------------------------------------------------

# Scoring Rules

-   Variable base points and bonus values come from `data/quests.js`
-   +2 points for each friend joining a non-Final quest, capped at 5 friends
-   Final Quest friend scoring is disabled
-   Rank thresholds are 0, 25, 60, 100, 170, and 220 points
-   Rank updates automatically

The Final Quest uses the stable ID `party-time`. Its trivia question is an
unlock gate and does not award points independently; the quest's configured
base and bonus values are scored when the final memory is saved.

------------------------------------------------------------------------

# Future Backend

## Supabase

Tables:

### players

-   id
-   display_name
-   avatar

### submissions

-   id
-   player_id
-   challenge_id
-   media_url
-   friends
-   completed_at

### challenges

-   id
-   title
-   description
-   is_final

### events

Allows future editions:

-   Summer Quest NYC
-   Berlin Quest
-   Holiday Quest
-   Birthday Quest

------------------------------------------------------------------------

# Coding Conventions

## HTML

-   Semantic elements
-   Accessible labels
-   Mobile-first

## CSS

-   Variables for colors
-   Component-first organization
-   No inline styles (except runtime image backgrounds)

## JavaScript

-   Small focused functions
-   Configuration separated from logic
-   No duplicated business rules

------------------------------------------------------------------------

# Future Milestones

## v0.2

-   Better animations
-   Illustration system

## v0.3

-   Cloud storage

## v0.4

-   Leaderboard
-   Host dashboard

## v1.0

-   Reusable event platform

------------------------------------------------------------------------

# Guiding Principle

> Build a reusable memory-making platform---not a one-off birthday
> website.

Every architectural decision should make it easier to reuse Summer Quest
for future cities, events, and years without rewriting the application.
