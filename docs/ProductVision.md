# Summer Quest 2026 --- Product Vision

> **Version:** 0.1 (MVP)\
> **Status:** In Development

------------------------------------------------------------------------

# Product Overview

**Summer Quest** is a mobile-first web app that turns the final weeks of
summer into a collaborative city-wide adventure.

Players complete creative real-world challenges, upload a selfie or
short video as proof, earn points, climb through seasonal ranks, and
gather at the end for one final birthday quest and the crowning of the
**Summer Quest Champion**.

Although the first edition is designed for **Hoa & Erika's 2026
Birthday**, the platform is intended to be reusable for future
birthdays, cities, seasons, and custom events.

------------------------------------------------------------------------

# Vision Statement

Create an experience that encourages people to:

-   Explore more of their city
-   Spend quality time with friends
-   Discover new places
-   Create lasting memories
-   End the summer with stories instead of regrets

The app should feel less like a checklist and more like a beautiful
memory book that slowly fills with adventures.

------------------------------------------------------------------------

# Design Principles

## The interface disappears as memories appear.

At the beginning, the app feels clean, spacious, and editorial.

As players complete quests, their own photos gradually become the visual
identity of the experience.

------------------------------------------------------------------------

## Delight through curiosity

Every interaction should encourage exploration.

The app should reward saying:

> "I've never been there before."

------------------------------------------------------------------------

## Mobile first

Designed primarily for phones.

Every major interaction should be comfortable with one hand.

Bottom sheets are preferred over modal dialogs.

------------------------------------------------------------------------

## Editorial over gamified

Summer Quest is **not** intended to feel like a mobile game.

Visual inspiration:

-   Summer field journal
-   Modern editorial magazine
-   Travel notebook
-   Museum guide

Avoid:

-   Cartoon aesthetics
-   Loud animations
-   Excessive badges
-   Overly playful UI

------------------------------------------------------------------------

# MVP Scope

## Included

-   25 challenge board
-   5×5 mobile board
-   Progress tracking
-   Rank progression
-   Bottom-sheet quest details
-   Photo upload
-   Video upload (prototype)
-   Friend bonus scoring
-   Local browser storage
-   Mission Briefing
-   Summer Journal and story PDF
-   Memory keepsake save/share
-   Responsive design

------------------------------------------------------------------------

## Not Included (Yet)

-   Accounts
-   Login
-   Cloud sync
-   Leaderboards
-   Notifications
-   Admin dashboard
-   Quest unlocking logic beyond the final quest
-   Social sharing

------------------------------------------------------------------------

# Game Mechanics

Each completed quest earns the base points and optional bonus points configured
for that quest in `data/quests.js`.

Friend bonus:

-   **+2 points** for every friend who joins a non-Final adventure, up to
    **5 friends**.

Ranks update automatically based on total score.

The `party-time` Final Quest is unlocked by its trivia gate and then completed
by saving its memory. The trivia answer does not score independently.

------------------------------------------------------------------------

# Current Rank Progression

1.  🌱 Summer Rookie --- 0–24 points
2.  🗺️ Neighborhood Explorer --- 25–59 points
3.  🚇 City Adventurer --- 60–99 points
4.  🌆 Local Insider --- 100–169 points
5.  🏆 NYC Champion --- 170–219 points
6.  ⭐ Social Legend --- 220+ points

------------------------------------------------------------------------

# Art Direction

**Theme**

70% Summer Field Journal\
30% Modern Editorial

Typography:

-   Libre Baskerville (headings)
-   Montserrat (UI)

Visual language:

-   Warm ivory background
-   Coral, marigold, and teal accents
-   Rounded cards
-   Soft offset shadows
-   Generous whitespace

------------------------------------------------------------------------

# Success Criteria

A successful MVP should allow someone to:

1.  Open the app.
2.  Read the Mission Briefing.
3.  Browse challenges.
4.  Upload proof of a completed quest.
5.  Earn points automatically.
6.  Watch their rank progress.
7.  Return later and see everything preserved.
8.  Review completed memories in the Summer Journal.
9.  Save or share a personalized memory keepsake.

No onboarding or explanation should be required.

------------------------------------------------------------------------

# Long-Term Vision

Summer Quest should become a reusable event platform that can support:

-   Birthday editions
-   Travel editions
-   City exploration
-   Holiday quests
-   Team-building events
-   Wedding weekends
-   Family reunions
-   Custom scavenger hunts

The engine remains the same; only the content changes.

------------------------------------------------------------------------

# North Star

> **Help people create memories worth keeping---not just boxes worth
> checking.**
