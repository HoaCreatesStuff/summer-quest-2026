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
│   ├── Product Vision.md
│   ├── Design System.md
│   ├── Roadmap.md
│   ├── Copy Guide.md
│   └── Architecture.md
│
├── app.js
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

Stable IDs are the keys in `window.QUESTS`. Board and navigation order lives in
`window.BOARD_ORDER`, while fixed physical-square colors live independently in
`window.BOARD_COLORS`.

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
  basePoints: 5,
  selectedBonusIds: [],
  completedAt: "2026-08-05T18:30:00Z"
}
```

## Rank

``` js
{
  title: "NYC Insider",
  minPoints: 90,
  maxPoints: 119,
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

Images are compressed to JPEG Blobs at approximately 0.75 quality with a
maximum 1400 px edge. Preview, story, keepsake, and PDF rendering use temporary
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
├── Quest Grid
│     └── Quest Card
│
└── Bottom Sheet
      ├── Upload Widget
      ├── Friend Counter
      ├── Reward Preview
      └── Save Button
```

------------------------------------------------------------------------

# Scoring Rules

-   5 points per completed quest
-   +2 points for each friend joining that adventure
-   Rank updates automatically

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
-   Shared album

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
