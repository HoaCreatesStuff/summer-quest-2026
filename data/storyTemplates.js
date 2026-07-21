// Journal story templates keyed by the exact quest titles in challenges.js.
// All journal copy lives here, including bonus memory continuations.

window.STORY_TEMPLATES = {
  "Golden Hour": {
    storyWithLocation:
      "You watched the city glow from <strong>{location}</strong>.",
    storyWithoutLocation:
      "You watched the city glow as the sun went down."
  },

  "Judgy Pigeon": {
    storyWithLocation:
      "You spotted NYC's judgiest pigeon at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found a pigeon with some serious attitude."
  },

  "Street Fashion": {
    storyWithLocation:
      "You found style inspiration in <strong>{location}</strong>.",
    storyWithoutLocation:
      "NYC reminded you that great style can be found around every corner.",
    bonusMemories: {
      "monochromatic-look":
        "One monochromatic look stood out from the crowd.",
      "quester-fashionable-look":
        "The best outfit you found was the one you were wearing."
    }
  },

  "Free Event": {
    storyWithLocation:
      "You stumbled upon a local free event at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You discovered that some of NYC's best experiences don't cost a thing."
  },

  "Water Wonders": {
    storyWithLocation:
      "You spent some time by the water at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found a refreshing escape by the water.",
    bonusMemories: {
      "beach-day":
        "A beach day made the adventure feel like a mini vacation.",
      "ferry-ride":
        "Seeing the city from the water gave you a whole new perspective on NYC."
    }
  },

  "Dance Party": {
    storyWithLocation:
      "You found music, laughter, and hopefully a few new dance moves at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You danced, laughed, and shared the good vibes with the people around you."
  },

  "SHOWTIME!": {
    storyWithLocation:
      "You cheered on talented performers at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You stopped to appreciate the artists who make NYC's streets and subways come alive."
  },

  "Random Kindness": {
    storyWithLocation:
      "You made someone's day a little brighter.",
    storyWithoutLocation:
      "You made someone's day a little brighter."
  },

  "Favorite Art": {
    storyWithLocation:
      "You discovered a piece worth stopping for at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found a work of art that stayed with you long after you walked away."
  },

  "DIY Craft": {
    storyWithLocation:
      "You turned a simple idea into something uniquely yours.",
    storyWithoutLocation:
      "You turned a simple idea into something uniquely yours."
  },

  "Hidden Books": {
    storyWithLocation:
      "You uncovered a hidden literary gem at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You stumbled upon a bookshop that felt like a secret."
  },

  "Pup-arazzi": {
    storyWithLocation:
      "You met some very good dogs while exploring the streets of NYC.",
    storyWithoutLocation:
      "You met some very good dogs while exploring the streets of NYC.",
    bonusMemories: {
      "five-different-breeds":
        "They all had different looks, and even more different personalities.",
      "dog-outfit":
        "One especially well-dressed pup completely stole the show."
    }
  },
  
  "Iconic Skyline": {
    storyWithLocation:
      "You admired NYC's iconic skyline from <strong>{location}</strong>.",
    storyWithoutLocation:
      "You paused to appreciate one of New York City's unforgettable skylines.",
    bonusMemories: {
      "after-dark":
        "As the city lights came to life, the view became even more magical."
    }
  },

  "Kindness Notes": {
    storyWithLocation:
      "You left a note that might brighten someone's day.",
    storyWithoutLocation:
      "You left a note that might brighten someone's day."
  },

  "Farmers Market": {
    storyWithLocation:
      "You explored the stalls at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You wandered through one of NYC's bustling farmers markets.",
    bonusMemories: {
      "fresh-purchase":
        "You even brought home something fresh to enjoy later."
    }
  },

  "Get Sweaty": {
    storyWithLocation:
      "You squeezed in a summer workout at <strong>{location}</strong>.",
    storyWithoutLocation:
      "A summer workout means a lot of sweat, minimal muscle gain, and a tiny sprinkle of pain.",
    bonusMemories: {
      "new-fitness-activity":
        "Stepping outside your comfort zone made the challenge even more rewarding."
    }
  },

  "Street Mural": {
    storyWithLocation:
      "You discovered colorful street art at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found a mural that made you stop and look."
  },

  "Group Stoop": {
    storyWithLocation:
      "You gathered on the steps at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found the perfect NYC stoop to hang out together."
  },

  "Hideaway": {
    storyWithLocation:
      "You found your own little hideaway at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found a peaceful corner of the city to slow down."
  },

  "Cinema Moment": {
    storyWithLocation:
      "You recreated a movie-worthy moment at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You brought a movie scene to life. ",
    bonusMemories: {
      "nyc-related-scene":
        "Your acting skills deserved an Oscar. Or a Razzie. It's open for debate."
    }
  },

  "Park Picnic": {
    storyWithLocation:
      "You enjoyed a picnic at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You slowed down for a relaxing picnic in the city.",
    bonusMemories: {
      "homemade-food":
        "Homemade food made the afternoon even more special."
    }
  },

  "Birthday Selfie": {
    storyWithLocation:
      "You captured a birthday memory with the birthday girls.",
    storyWithoutLocation:
      "You captured a birthday memory with the birthday girls."
  },

  "Animal Statue": {
    storyWithLocation:
      "You discovered an animal statue at <strong>{location}</strong>.",
    storyWithoutLocation:
      "You found one of NYC's quirky animal statues."
  },

  "Human Pyramid": {
    storyWithLocation:
      "You somehow convinced your teammates to build a human pyramid.",
    storyWithoutLocation:
      "You somehow convinced your teammates to build a human pyramid."
  },

  "Celebrate Together": {
    storyWithLocation:
      "Thank you for celebrating this summer with us. We hope these adventures brought you new memories, new stories, and made you fall in love with NYC all over again.",
    storyWithoutLocation:
      "Thank you for celebrating this summer with us. We hope these adventures brought you new memories, new stories, and made you fall in love with NYC all over again."
  },

  summary: {
    friendsSingular:
      "<strong>{friendCount}</strong> person joined your adventures across NYC.",

    friends:
      "<strong>{friendCount}</strong> people joined your adventures across NYC.",

    bonusesSingular:
      "You went above and beyond for <strong>{bonusCount}</strong> quest.",

    bonuses:
      "You went above and beyond for <strong>{bonusCount}</strong> quests.",

    completed:
      "You completed <strong>{completedCount}</strong> NYC adventures.",
  }
};

