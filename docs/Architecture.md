# Architecture

> **Summer Quest 2026**\
> Living technical blueprint for the MVP and future releases.

------------------------------------------------------------------------

# Tech Stack (MVP)

-   HTML5
-   CSS3
-   Vanilla JavaScript
-   LocalStorage
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
│   ├── challenges.js
│   └── rankConfig.js
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

## Challenge

``` js
{
  id: "nyc-sunset",
  title: "NYC Sunset",
  description: "...",
  final: false
}
```

## Submission

``` js
{
  challengeId: "nyc-sunset",
  mediaType: "image/jpeg",
  dataUrl: "...",
  friends: 2,
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

Current MVP stores:

-   Completed quests
-   Uploaded media (compressed)
-   Friend counts
-   Total score
-   Current rank

Storage key:

``` text
nyc-summer-quest-mvp-v1
```

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
