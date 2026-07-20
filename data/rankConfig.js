// Summer Quest 2026 rank configuration
// Keep rank thresholds and copy here so game logic stays separate from content.

window.RANKS = [
  {
    id: "summer-rookie",
    title: "Summer Rookie",
    minPoints: 0,
    maxPoints: 29,
    nextRankAt: 30,
    blurb: "Every adventure starts somewhere."
  },
  {
    id: "neighborhood-explorer",
    title: "Neighborhood Explorer",
    minPoints: 30,
    maxPoints: 59,
    nextRankAt: 60,
    blurb: "Your summer is officially in full swing."
  },
  {
    id: "city-adventurer",
    title: "City Adventurer",
    minPoints: 60,
    maxPoints: 89,
    nextRankAt: 90,
    blurb: "You're seeing more of NYC than most locals do."
  },
  {
    id: "nyc-insider",
    title: "NYC Insider",
    minPoints: 90,
    maxPoints: 119,
    nextRankAt: 120,
    blurb: "You've earned serious local bragging rights."
  },
  {
    id: "summer-legend",
    title: "Summer Legend",
    minPoints: 120,
    maxPoints: Number.POSITIVE_INFINITY,
    nextRankAt: null,
    blurb: "You've conquered our New York summer."
  }
];