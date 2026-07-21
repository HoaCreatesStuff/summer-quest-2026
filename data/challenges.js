// Canonical quest content. Loaded as a classic script by index.html.
window.QUESTS = [
  {
    id: 1,
    position: 1,
    category: "experience",
    color: "A",
    title: "Golden Hour",
    description: "Catch the city glowing at sunset.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 2,
    position: 2,
    category: "challenge",
    color: "C",
    title: "Judgmental Pigeon",
    description: "Look for the most judgmental pigeon.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 3,
    position: 3,
    category: "experience",
    color: "A",
    title: "Street Fashion",
    description: "Spot a look you love, or wear one yourself.",
    basePoints: 5,
    bonus: "If the outfit is monochromatic (all one color).",
    bonusPoints: 2
  },
  {
    id: 4,
    position: 4,
    category: "community",
    color: "B",
    title: "Free Event",
    description: "Meet new people at a local free event.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 5,
    position: 5,
    category: "experience",
    color: "A",
    title: "Waterfront Wonders",
    description: "Wander along a river, harbor, beach, ferry, pier, or waterfront park.",
    basePoints: 5,
    bonus: "If you spend the day at the beach or ride a ferry.",
    bonusPoints: 2
  },
  {
    id: 6,
    position: 6,
    category: "challenge",
    color: "C",
    title: "Dance Party",
    description: "Nobody's looking. Go dance!",
    basePoints: 5,
    bonus: null
  },
  {
    id: 7,
    position: 7,
    category: "experience",
    color: "A",
    title: "SHOWTIME!",
    description: "Cheer on a talented street or subway performer.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 8,
    position: 8,
    category: "community",
    color: "B",
    title: "Random Kindness",
    description: "Brighten someone's day with an unexpected act of kindness.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 9,
    position: 9,
    category: "experience",
    color: "A",
    title: "Favorite Art",
    description: "Admire a work of art you can't stop thinking about.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 10,
    position: 10,
    category: "challenge",
    color: "C",
    title: "DIY Craft",
    description: "Make something with your hands. Beautiful, weird, or both.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 11,
    position: 11,
    category: "experience",
    color: "A",
    title: "Hidden Bookstore",
    description: "Discover a bookstore that feels like a secret.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 12,
    position: 12,
    category: "challenge",
    color: "C",
    title: "Pup-arazzi",
    description: "Collect selfies with five dogs. Ask the humans first.",
    basePoints: 5,
    bonus: "If all five dogs are different breeds, or one is rocking an adorable outfit.",
    bonusPoints: 2
  },
  {
    id: 13,
    position: 13,
    category: "experience",
    color: "A",
    title: "Iconic Skyline",
    description: "Take in a dramatic view from your favorite vantage point.",
    basePoints: 5,
    bonus: "If you capture the skyline after dark.",
    bonusPoints: 2
  },
  {
    id: 14,
    position: 14,
    category: "community",
    color: "B",
    title: "Kindness Notes",
    description: "Leave a kind note for a stranger to discover.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 15,
    position: 15,
    category: "experience",
    color: "A",
    title: "Farmers Market",
    description: "Browse a farmers market and capture your favorite find.",
    basePoints: 5,
    bonus: "If you buy something fresh from the market.",
    bonusPoints: 2
  },
  {
    id: 16,
    position: 16,
    category: "challenge",
    color: "C",
    title: "Get Sweaty",
    description: "Do something that gets your heart pumping.",
    basePoints: 5,
    bonus: "If you try a fitness class you've never taken before.",
    bonusPoints: 2
  },
  {
    id: 17,
    position: 17,
    category: "experience",
    color: "A",
    title: "Street Mural",
    description: "Stop for a mural worth admiring.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 18,
    position: 18,
    category: "community",
    color: "B",
    title: "Group Stoop",
    description: "Gather on a classic stoop for a group photo.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 19,
    position: 19,
    category: "experience",
    color: "A",
    title: "Favorite Hideaway",
    description: "Share a quiet corner you love.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 20,
    position: 20,
    category: "challenge",
    color: "C",
    title: "Cinema Moment",
    description: "Recreate an iconic movie scene.",
    basePoints: 5,
    bonus: "If the scene is related to NYC in some way.",
    bonusPoints: 2
  },
  {
    id: 21,
    position: 21,
    category: "community",
    color: "B",
    title: "Park Picnic",
    description: "Pack something delicious and enjoy a picnic in the park.",
    basePoints: 5,
    bonus: "If you bring homemade food.",
    bonusPoints: 2
  },
  {
    id: 22,
    position: 22,
    category: "community",
    color: "B",
    title: "Birthday Selfie",
    description: "Grab a selfie with Hoa and Erika.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 23,
    position: 23,
    category: "experience",
    color: "A",
    title: "Animal Statue",
    description: "Pet an animal statue.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 24,
    position: 24,
    category: "challenge",
    color: "C",
    title: "Human Pyramid",
    description: "Build a human pyramid. Stability is optional.",
    basePoints: 5,
    bonus: null
  },
  {
    id: 25,
    position: 25,
    category: "final",
    color: "D",
    title: "Celebrate Together!",
    description: "Come hang out with us at the party! We'd love to celebrate together before you take on your Final Challenge.",
    missionCode: "summer26",
    triviaQuestions: [
      {
        prompt: "How did the birthday girls meet?",
        acceptedAnswers: ["Reddit", "online"]
      },
      {
        prompt: "How many days apart are their birthdays?",
        acceptedAnswers: ["4", "four", "735"]
      }
    ],
    basePoints: 0,
    bonus: null,
    final: true
  }
];
