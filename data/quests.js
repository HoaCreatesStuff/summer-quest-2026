// Summer Quest canonical quest content
// Quest order is maintained separately.
// Stable quest IDs are the object keys.
// Icons use Google Material Symbols Outlined names.

window.QUEST_CATEGORIES = {
  "experience-nyc": {
    label: "Experience NYC",
    className: "category-experience",
    colorVar: "--category-experience"
  },
  community: {
    label: "Community",
    className: "category-community",
    colorVar: "--category-community"
  },
  challenges: {
    label: "Challenges",
    className: "category-challenges",
    colorVar: "--category-challenges"
  }
};

window.QUEST_ILLUSTRATIONS = {
  "ny-eats": "assets/illustrations/icons/ny-eats.png",
  "bodega-cat": "assets/illustrations/icons/bodega-cat.png",
  "street-style": "assets/illustrations/icons/street-fashion.png",
  "random-kindness": "assets/illustrations/icons/random-kindness.png",
  "city-freebies": "assets/illustrations/icons/city-freebies.png",
  "water-wonders": "assets/illustrations/icons/waterfront-wonders.png",
  "street-mural": "assets/illustrations/icons/street-mural.png",
  "subway-romance": "assets/illustrations/icons/subway-romance.png",
  "time-capsule": "assets/illustrations/icons/time-capsule.png",
  "animal-statue": "assets/illustrations/icons/animal-statue.png",
  "showtime": "assets/illustrations/icons/showtime.png",
  "park-picnic": "assets/illustrations/icons/park-picnic.png",
  "golden-hour": "assets/illustrations/icons/golden-hour.png",
  "hidden-gems": "assets/illustrations/icons/hidden-gems.png",
  "art-walk": "assets/illustrations/icons/favorite-art.png",
  "get-sweaty": "assets/illustrations/icons/get-sweaty.png",
  "nyc-spirit": "assets/illustrations/icons/nyc-spirit.png",
  "pup-arazzi": "assets/illustrations/icons/pup-arazzi.png",
  "live-events": "assets/illustrations/icons/live-events.png",
  "cinema-moment": "assets/illustrations/icons/cinema-moment.png",
  "off-the-map": "assets/illustrations/icons/off-the-map.png",
  "diy-craft": "assets/illustrations/icons/diy-craft.png",
  "human-pyramid": "assets/illustrations/icons/human-pyramid.png",
  "open-market": "assets/illustrations/icons/open-market.png",
  "celebrate": "assets/illustrations/icons/celebrate-together.png"
};

window.QUESTS = {
  "ny-eats": {
    category: "experience-nyc",
    icon: "restaurant",
    title: "NY Eats",
    description: "Grab a bite that's as iconic as the city itself.",
    basePoints: 5,
    bonuses: [
      { id: "waited-in-line", label: "Wait in line to get food." },
      { id: "nyc-classic", label: "Order an NYC classic." }
    ],
    story: "You got a proper taste of New York{locationSentence}.",
    reflection: "Some meals are worth the wait. This was one of them.",
    bonusMemories: {
      "waited-in-line": "The line was long, but the first bite made it worth it.",
      "nyc-classic": "Now you know why it's considered a New York classic."
    }
  },

  "bodega-cat": {
    category: "community",
    icon: "pets",
    title: "Bodega Cat",
    description: "Track down one of New York's legendary bodega cats.",
    basePoints: 5,
    bonuses: [
      { id: "pet-the-cat", label: "Pet the bodega cat." }
    ],
    story: "You met one of New York's fluffiest local celebrities{locationSentence}.",
    reflection: "Every bodega has someone in charge. This one just happened to purr.",
    bonusMemories: {
      "pet-the-cat": "Against all odds, you earned enough trust for a few scratches behind the ears."
    }
  },

  "street-style": {
    category: "challenges",
    icon: "checkroom",
    title: "Street Style",
    description: "Spot a look you love, or wear one yourself.",
    basePoints: 5,
    bonuses: [
      { id: "monochromatic-look", label: "Spot a monochromatic outfit." },
      { id: "self-model", label: "Be the fashion model." }
    ],
    story: "Wandering through the streets, you found style inspiration{locationSentence}.",
    reflection: "Every corner of New York has its own lookbook.",
    bonusMemories: {
      "monochromatic-look": "One monochromatic look stood out from the crowd.",
      "self-model": "Turns out, the best outfit you found was the one you were wearing."
    }
  },

  "random-kindness": {
    category: "community",
    icon: "volunteer_activism",
    title: "Random Kindness",
    description: "Brighten someone's day with an unexpected act of kindness.",
    basePoints: 10,
    bonuses: [],
    story: "You left the city a little kinder than you found it. Not every memorable moment comes with a photo. Some are simply the feeling that, for a brief moment, you made someone's day just a little brighter.",
    reflection: null,
    bonusMemories: {}
  },

  "city-freebies": {
    category: "community",
    icon: "festival",
    title: "City Freebies",
    description: "Take advantage of one of New York's many free events.",
    basePoints: 5,
    bonuses: [
      { id: "free-keepsake", label: "Bring home a free keepsake." }
    ],
    story: "You stumbled upon a free event{locationSentence}.",
    reflection: "A great day out doesn't have to come with a price tag.",
    bonusMemories: {
      "free-keepsake": "You even brought home a little reminder of the adventure."
    }
  },

  "water-wonders": {
    category: "experience-nyc",
    icon: "waves",
    title: "Water Wonders",
    description: "Spend some time wherever the city meets the water.",
    basePoints: 5,
    bonuses: [
      { id: "beach-day", label: "Spend the day at the beach." },
      { id: "on-the-water", label: "Do an activity on or in the water." },
      { id: "nyc-ferry", label: "Ride the NYC Ferry." }
    ],
    story: "You found a refreshing escape by the water{locationSentence}.",
    reflection: "A little time by the water was exactly what the day needed.",
    bonusMemories: {
      "beach-day": "After all, what says \"summer\" better than a day at the beach?",
      "on-the-water": "Everything looked a little different once your feet left the shore.",
      "nyc-ferry": "You saw the city from a different perspective. Turns out, changing your view changes more than the scenery."
    }
  },

  "street-mural": {
    category: "experience-nyc",
    icon: "palette",
    title: "Street Mural",
    description: "Find a piece of public art worth stopping for.",
    basePoints: 5,
    bonuses: [
      { id: "identify-artist", label: "Find out who created it and note it in the caption." }
    ],
    story: "You found art where others might have walked right past{locationSentence}.",
    reflection: "Even the busiest streets leave room for creativity.",
    bonusMemories: {
      "identify-artist": "Knowing who created it made you appreciate it even more."
    }
  },

  "subway-romance": {
    category: "challenges",
    icon: "train",
    title: "Subway Romance",
    description: "Romanticize the subway in a black-and-white photo.",
    basePoints: 5,
    bonuses: [],
    story: "You found beauty in one of New York's most ordinary places{locationSentence}. Even daily life looks different through the right lens.",
    reflection: null,
    bonusMemories: {}
  },

  "time-capsule": {
    category: "experience-nyc",
    icon: "hourglass",
    title: "Time Capsule",
    description: "Visit a museum and learn something new.",
    basePoints: 5,
    bonuses: [
      { id: "free-museum-day", label: "Visit on a free or pay-what-you-wish day." }
    ],
    story: "Curiosity led you into a world you hadn't explored before{locationSentence}.",
    reflection: "Sometimes the oldest stories feel the most relevant.",
    bonusMemories: {
      "free-museum-day": "Even better, the city picked up the tab for today's history lesson."
    }
  },

  "animal-statue": {
    category: "challenges",
    icon: "raven",
    title: "Animal Statue",
    description: "Pet an animal statue around the city.",
    basePoints: 5,
    bonuses: [
      { id: "older-than-you", label: "Find one older than you are." }
    ],
    story: "Among the city's chaos, you found one of its most patient residents{locationSentence}.",
    reflection: "How many people have walked past this creature without ever really seeing it?",
    bonusMemories: {
      "older-than-you": "Its quiet presence reminded you how much of your own story is unwritten."
    }
  },

  "showtime": {
    category: "community",
    icon: "music_note",
    title: "SHOWTIME!",
    description: "Show your support for a street or subway performer.",
    basePoints: 5,
    bonuses: [
      { id: "dodge-performance", label: "The performance required you to dodge." }
    ],
    story: "You looked up from the screen to enjoy a performance that made the city feel alive{locationSentence}.",
    reflection: "Talent doesn't wait for the perfect stage. Some stages just happen to be moving.",
    bonusMemories: {
      "dodge-performance": "And stay alive you did, thanks to some good reflexes."
    }
  },

  "park-picnic": {
    category: "community",
    icon: "park",
    title: "Park Picnic",
    description: "Pack a picnic and enjoy some time in one of New York's parks.",
    basePoints: 5,
    bonuses: [
      { id: "live-performance", label: "Catch a live performance." }
    ],
    story: "You borrowed one of New York's giant backyards for the afternoon{locationSentence}.",
    reflection: "The people-watching was included at no extra charge.",
    bonusMemories: {
      "live-performance": "The park came with its own soundtrack, and you had front-row seats to the show."
    }
  },

  "golden-hour": {
    category: "experience-nyc",
    icon: "wb_twilight",
    title: "Golden Hour",
    description: "Capture the magic of golden hour.",
    basePoints: 5,
    bonuses: [
      { id: "sunrise", label: "Catch the sunrise instead." },
      { id: "skyline", label: "Capture the skyline." }
    ],
    story: "For a few golden minutes, the city glowed{locationSentence}.",
    reflection: "Good things come to those who wait... and check sunset time.",
    bonusMemories: {
      "sunrise": "You woke up in the city that never sleeps to catch a star that never stops shining.",
      "skyline": "The city looked familiar, yet somehow brand new. Amazing what a little patience can reveal."
    }
  },

  "hidden-gems": {
    category: "experience-nyc",
    icon: "vpn_key",
    title: "Hidden Gems",
    description: "Seek out a local gem, like a secret garden, hidden bookstore, speakeasy, or tucked-away café.",
    basePoints: 5,
    bonuses: [
      { id: "secret-entry", label: "Enter through a password or hidden entrance." },
      { id: "quester-recommendation", label: "Visit a fellow quester's recommendation." }
    ],
    story: "You discovered a side of New York that likes to stay hidden{locationSentence}.",
    reflection: "One secret down, many more to uncover.",
    bonusMemories: {
      "secret-entry": "The secret mission began before you even walked through the door.",
      "quester-recommendation": "Safe to say, your fellow questers have pretty good taste."
    }
  },

  "art-walk": {
    category: "experience-nyc",
    icon: "gallery_thumbnail",
    title: "Art Walk",
    description: "Visit an art space and find a piece that speaks to you.",
    basePoints: 5,
    bonuses: [
      { id: "meet-artist", label: "Meet the artist." },
      { id: "interactive-art", label: "Experience interactive or digital art." }
    ],
    story: "One piece of art stopped you in your tracks{locationSentence}.",
    reflection: "Eventually, you left the space, but the impression stayed.",
    bonusMemories: {
      "meet-artist": "Then the artist stepped into the picture, too.",
      "interactive-art": "This time, you weren't just looking. You became part of the exhibit."
    }
  },

  "get-sweaty": {
    category: "challenges",
    icon: "fitness_center",
    title: "Get Sweaty",
    description: "Do something that gets your heart pumping.",
    basePoints: 5,
    bonuses: [
      { id: "new-fitness-activity", label: "Try something brand new." }
    ],
    story: "You put on your best athletic look and got your heart pumping{locationSentence}.",
    reflection: "It was a lot of sweat, minimal muscle gain, and just a sprinkle of pain.",
    bonusMemories: {
      "new-fitness-activity": "Your reward for trying something new? Discovering muscles you never knew you had."
    }
  },

  "nyc-spirit": {
    category: "community",
    icon: "campaign",
    title: "NYC Spirit",
    description: "Celebrate NYC at a local game, block party, parade, or community celebration.",
    basePoints: 5,
    bonuses: [
      { id: "ny-sports-team", label: "Cheer for a New York sports team." }
    ],
    story: "You joined a seasonal ritual that brought New Yorkers together{locationSentence}.",
    reflection: "For a little while, you weren't watching New York. You were part of it.",
    bonusMemories: {
      "ny-sports-team": "You discovered just how passionate New Yorkers are about sports."
    }
  },

  "pup-arazzi": {
    category: "community",
    icon: "sound_detection_dog_barking",
    title: "Pup-arazzi",
    description: "Round up at least three dogs for a group photo.",
    basePoints: 5,
    bonuses: [
      { id: "different-breeds", label: "Find three different dog breeds." },
      { id: "dog-outfit", label: "Find a dog wearing an adorable outfit." }
    ],
    story: "You met some very good dogs while exploring the streets of NYC{locationSentence}. Somehow, they happily live in tiny human shoeboxes and still wake up excited every day.",
    reflection: null,
    bonusMemories: {
      "different-breeds": "They all had different looks, and even more different personalities.",
      "dog-outfit": "One especially well-dressed pup completely stole the show."
    }
  },

  "live-events": {
    category: "experience-nyc",
    icon: "theater_comedy",
    title: "Live Events",
    description: "Catch a live performance or event.",
    basePoints: 5,
    bonuses: [
      { id: "audience-participation", label: "Join in the fun." },
      { id: "theater", label: "Attend a performance in a theater." }
    ],
    story: "You traded everyday life for a live performance{locationSentence}.",
    reflection: "No recording quite captures the joy of being present in a room full of people.",
    bonusMemories: {
      "audience-participation": "Apparently, quietly watching wasn't an option this time.",
      "theater": "As the curtain rose, New York somehow got even more dramatic."
    }
  },

  "cinema-moment": {
    category: "challenges",
    icon: "movie",
    title: "Cinema Moment",
    description: "Recreate a scene from your favorite movie or TV show.",
    basePoints: 5,
    bonuses: [
      { id: "new-york-scene", label: "Recreate a New York scene." }
    ],
    story: "You brought a movie scene to life{locationSentence}.",
    reflection: "Your acting skills deserved an Oscar. Or a Razzie. It's open for debate.",
    bonusMemories: {
      "new-york-scene": "Meanwhile, New York delivered a convincing performance as... New York."
    }
  },

  "off-the-map": {
    category: "challenges",
    icon: "map",
    title: "Off the Map",
    description: "Venture somewhere completely new to you. Even if it's New Jersey.",
    basePoints: 5,
    bonuses: [
      { id: "beyond-usual-bubble", label: "Escape the usual Manhattan–Brooklyn–Queens bubble." }
    ],
    story: "You wandered somewhere your routine never would have taken you{locationSentence}. Sometimes the biggest discoveries begin with a slightly different turn.",
    reflection: null,
    bonusMemories: {
      "beyond-usual-bubble": "You ventured beyond your usual bubble, wondering if you'd accidentally crossed state lines. Instead, you found more greenery than you were used to."
    }
  },

  "diy-craft": {
    category: "challenges",
    icon: "interests",
    title: "DIY Craft",
    description: "Make something with your hands. Beautiful, weird, or both.",
    basePoints: 5,
    bonuses: [
      { id: "first-time-craft", label: "Make something you've never made before." }
    ],
    story: "You turned a simple idea into something you could actually hold{locationSentence}.",
    reflection: "Perfection was never the point, creation was.",
    bonusMemories: {
      "first-time-craft": "You also unlocked a brand-new skill. Hobby material, maybe. Not career-changing just yet."
    }
  },

  "human-pyramid": {
    category: "challenges",
    icon: "diversity_3",
    title: "Human Pyramid",
    description: "Build a human pyramid.",
    basePoints: 5,
    bonuses: [],
    story: "Against your best judgment, you convinced your friends to build a human pyramid{locationSentence}.",
    reflection: "Trust was tested. Core strength was optional. Gravity was proven real.",
    bonusMemories: {}
  },

  "open-market": {
    category: "community",
    icon: "storefront",
    title: "Open Market",
    description: "Wander through a farmers market, street fair, or open-air market.",
    basePoints: 5,
    bonuses: [
      { id: "local-vendor-purchase", label: "Buy something from a local vendor." }
    ],
    story: "You wandered through a market full of local flavors and handmade goods{locationSentence}.",
    reflection: "Some people were sharpening their negotiation skills, others were hunting for vintage treasures. You were simply enjoying the bustling energy.",
    bonusMemories: {
      "local-vendor-purchase": "After a bit of browsing, you walked away with a little something that helped keep someone's passion alive."
    }
  },

  "celebrate": {
    category: "community",
    icon: "celebration",
    title: "Celebrate!",
    description: "Take a selfie with the birthday girls. If you couldn't make it, a selfie with our photo counts too!",
    basePoints: 5,
    bonuses: [
      { id: "attended-birthday-party", label: "Attend the birthday party." }
    ],
    story: "As Summer Quest came to an end, you realized it was never just about the birthdays. It was about stepping outside your comfort zone, making new memories, and experiencing the city together during its most glorious season.\n\nThank you for being a part of our summer. — Hoa & Erika",
    reflection: null,
    bonusMemories: {},
    final: true,
    missionCode: "summer26",
    triviaQuestions: [
      {
        prompt: "How did the birthday girls meet?",
        acceptedAnswers: ["reddit", "online"]
      },
      {
        prompt: "How many days apart are their birthdays?",
        acceptedAnswers: ["4", "four", "735"]
      }
    ]
  }
};
