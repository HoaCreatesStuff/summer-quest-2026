window.STORY_TEMPLATES = {
  Q01: {
    weight: 100,
    withLocation: "You watched the city go to bed from <strong>{location}</strong>.",
    withoutLocation: "You watched the city glow as the sun went down."
  },

  Q02: {
    weight: 50,
    default: "You slowed down and appreciated a peaceful moment in the city."
  },

  Q03: {
    weight: 70,
    withLocation: "You found style inspiration in <strong>{location}</strong>.",
    withoutLocation: "You found style inspiration while exploring NYC."
  },

  Q04: {
    weight: 60,
    withLocation: "You discovered that some of NYC's best experiences are free at <strong>{location}</strong>.",
    withoutLocation: "You discovered that some of NYC's best experiences are free."
  },

  Q05: {
    weight: 90,
    withLocation: "You spent time by the water at <strong>{location}</strong>.",
    withoutLocation: "You enjoyed one of NYC's beautiful waterfronts."
  },

  Q06: {
    weight: 60,
    default: "You danced like nobody was watching."
  },

  Q07: {
    weight: 55,
    theme: "live-music",
    default: "You stopped to enjoy music that made the city come alive."
  },

  Q08: {
    weight: 95,
    theme: "kindness",
    default: "You made someone's day a little brighter."
  },

  Q09: {
    weight: 70,
    withLocation: "You discovered art worth stopping for at <strong>{location}</strong>.",
    withoutLocation: "You discovered art worth stopping for."
  },

  Q10: {
    weight: 50,
    default: "You made something with your own creativity."
  },

  Q11: {
    weight: 70,
    withLocation: "You uncovered a hidden literary gem at <strong>{location}</strong>.",
    withoutLocation: "You uncovered a hidden literary gem."
  },

  Q12: {
    weight: 40,
    default: "You met some very good dogs along the way."
  },

  Q13: {
    weight: 100,
    withLocation: "You took in an unforgettable NYC skyline from <strong>{location}</strong>.",
    withoutLocation: "You admired one of New York City's iconic skylines."
  },

  Q14: {
    weight: 60,
    theme: "kindness",
    default: "You left a kind note to brighten someone's day."
  },

  Q15: {
    weight: 60,
    withLocation: "You picked up something fresh at <strong>{location}</strong>.",
    withoutLocation: "You explored one of NYC's local farmers markets."
  },

  Q16: {
    weight: 55,
    default: "You challenged yourself to get moving."
  },

  Q17: {
    weight: 55,
    theme: "live-music",
    default: "You paused to enjoy music that made the city feel alive."
  },

  Q18: {
    weight: 90,
    default: "You somehow convinced your teammates to build a human pyramid."
  },

  Q19: {
    weight: 65,
    withLocation: "You found a place you'll want to come back to: <strong>{location}</strong>.",
    withoutLocation: "You found a place you'll want to come back to."
  },

  Q20: {
    weight: 75,
    default: "You found a scene worthy of the big screen."
  },

  Q21: {
    weight: 60,
    default: "You enjoyed a relaxing picnic in the city."
  },

  Q22: {
    weight: 50,
    default: "You captured a memory worth keeping."
  },

  Q23: {
    weight: 55,
    default: "You treated yourself to something delicious."
  },

  Q24: {
    weight: 80,
    default: "You experienced New York City through new eyes."
  },

  Q25: {
    weight: 0
  },

  summary: {
    friendsSingular:
      "<strong>{friendCount}</strong> person joined your adventures across NYC.",

    friends:
      "<strong>{friendCount}</strong> people joined your adventures across NYC.",

    bonusesSingular:
      "You went above and beyond <strong>{bonusCount}</strong> time.",

    bonuses:
      "You went above and beyond <strong>{bonusCount}</strong> times.",

    completed:
      "You completed <strong>{completedCount}</strong> NYC adventures.",

    favoriteCaption:
      "\"{caption}\""
  }
};
