// DEPRECATED BACKUP: no longer loaded by index.html.
// Canonical quest content now lives in quests.js and questOrder.js.

window.QUESTS = [
  {
    id: 1,
    position: 1,
    category: "experience",
    title: "Golden Hour",
    icon: "wb_twilight",
    description: "Catch the city glowing at sunset.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 2,
    position: 2,
    category: "challenge",
    title: "Judgy Pigeon",
    icon: "flutter_dash",
    description: "Look for the most judgmental pigeon.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 3,
    position: 3,
    category: "experience",
    title: "Street Fashion",
    icon: "checkroom",
    description: "Spot a look you love, or wear one yourself.",
    basePoints: 5,
    bonuses: [
      {
        id: "monochromatic-look",
        label: "The spotted outfit is monochromatic (all one color).",
        points: 2
      },
      {
        id: "quester-fashionable-look",
        label: "The fashionable outfit is yours.",
        points: 2
      }
    ]
  },

  {
    id: 4,
    position: 4,
    category: "community",
    title: "Free Event",
    icon: "festival",
    description: "Meet new people at a local free event.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 5,
    position: 5,
    category: "experience",
    title: "Water Wonders",
    icon: "waves",
    description: "Wander along a river, beach, ferry, pier, or waterfront park.",
    basePoints: 5,
    bonuses: [
      {
        id: "beach-day",
        label: "Spend the day at the beach.",
        points: 2
      },
      {
        id: "ferry-ride",
        label: "Ride a ferry.",
        points: 2
      }
    ]
  },

  {
    id: 6,
    position: 6,
    category: "challenge",
    title: "Dance Party",
    icon: "music_cast",
    description: "Nobody's looking. Go dance!",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 7,
    position: 7,
    category: "experience",
    title: "SHOWTIME!",
    icon: "theater_comedy",
    description: "Cheer on a talented street or subway performer.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 8,
    position: 8,
    category: "community",
    title: "Random Kindness",
    icon: "volunteer_activism",
    description: "Brighten someone's day with an unexpected act of kindness.",
    basePoints: 10,
    bonuses: []
  },

  {
    id: 9,
    position: 9,
    category: "experience",
    title: "Favorite Art",
    icon: "imagesmode",
    description: "Admire a work of art you can't stop thinking about.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 10,
    position: 10,
    category: "challenge",
    title: "DIY Craft",
    icon: "palette",
    description: "Make something with your hands. Beautiful, weird, or both.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 11,
    position: 11,
    category: "experience",
    title: "Hidden Books",
    icon: "menu_book",
    description: "Discover a bookstore that feels like a secret.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 12,
    position: 12,
    category: "challenge",
    title: "Pup-arazzi",
    icon: "pets",
    description: "Round up at least three dogs for one selfie.",
    basePoints: 5,
    bonuses: [
      {
        id: "five-different-breeds",
        label: "All dogs are different breeds.",
        points: 2
      },
      {
        id: "dog-outfit",
        label: "One dog is rocking an adorable outfit.",
        points: 2
      }
    ]
  },
  
    {
    id: 13,
    position: 13,
    category: "experience",
    title: "Iconic Skyline",
    icon: "location_city",
    description: "Find your favorite NYC skyline view.",
    basePoints: 5,
    bonuses: [
      {
        id: "after-dark",
        label: "Capture the skyline after dark.",
        points: 2
      }
    ]
  },

  {
    id: 14,
    position: 14,
    category: "community",
    title: "Kindness Notes",
    description: "Leave an encouraging note for a stranger to find.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 15,
    position: 15,
    category: "experience",
    title: "Farmers Market",
    icon: "shopping_basket",
    description: "Visit a local farmers market.",
    basePoints: 5,
    bonuses: [
      {
        id: "fresh-purchase",
        label: "Buy something fresh from the market.",
        points: 2
      }
    ]
  },

  {
    id: 16,
    position: 16,
    category: "challenge",
    title: "Get Sweaty",
    icon: "fitness_center",
    description: "Do something active outdoors or try a fitness class.",
    basePoints: 5,
    bonuses: [
      {
        id: "new-fitness-activity",
        label: "Try a fitness class or activity you've never done before.",
        points: 2
      }
    ]
  },

  {
    id: 17,
    position: 17,
    category: "experience",
    title: "Street Mural",
    icon: "brush",
    description: "Find a mural that catches your eye.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 18,
    position: 18,
    category: "community",
    title: "Group Stoop",
    icon: "stairs",
    description: "Gather your friends for a classic NYC stoop photo.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 19,
    position: 19,
    category: "experience",
    title: "Hideaway",
    icon: "park",
    description: "Escape the crowds and find your favorite quiet spot.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 20,
    position: 20,
    category: "challenge",
    title: "Cinema Moment",
    icon: "movie",
    description: "Recreate a scene from your favorite movie or TV show.",
    basePoints: 5,
    bonuses: [
      {
        id: "nyc-related-scene",
        label: "The scene is related to NYC in some way.",
        points: 2
      }
    ]
  },

  {
    id: 21,
    position: 21,
    category: "experience",
    title: "Park Picnic",
    icon: "lunch_dining",
    description: "Enjoy a picnic in one of NYC's parks.",
    basePoints: 5,
    bonuses: [
      {
        id: "homemade-food",
        label: "Bring homemade food.",
        points: 2
      }
    ]
  },

  {
    id: 22,
    position: 22,
    category: "community",
    title: "Birthday Selfie",
    icon: "photo_camera",
    description: "Snap a selfie with the birthday girls.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 23,
    position: 23,
    category: "experience",
    title: "Animal Statue",
    icon: "statue",
    description: "Find an animal statue somewhere in the city.",
    basePoints: 5,
    bonuses: []
  },

  {
    id: 24,
    position: 24,
    category: "challenge",
    title: "Human Pyramid",
    icon: "group_work",
    description: "Build a human pyramid with your teammates.",
    basePoints: 5,
    bonuses: []
  },
  
      {
    id: 25,
    position: 25,
    category: "final",
    title: "Celebrate Together",
    icon: "celebration",
    description: "Come hang out with us at the party! We'd love to celebrate together before you take on the Final Challenge.",
    basePoints: 0,
    bonuses: [],

    final: true,
    missionCode: "summer26",

    triviaQuestions: [
      {prompt: "How did the birthday girls meet?",
        acceptedAnswers: ["reddit", "online"]
      },
      {prompt: "How many days apart are their birthdays?",
        acceptedAnswers: ["4", "four", "735"]
      }
    ]
  }
];
