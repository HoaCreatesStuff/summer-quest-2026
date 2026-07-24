// QUESTS:
// Canonical quest content keyed by stable quest ID.
//
// BOARD_ORDER:
// Determines which quest appears in each board position.
//
// BOARD_COLORS:
// Determines the fixed visual color of each board position.
// Colors do not move when quests are reordered.

window.BOARD_ORDER = [
  "ny-eats",
  "bodega-cat",
  "subway-romance",
  "water-wonders",
  "city-freebies",

  "animal-statue",
  "time-capsule",
  "park-picnic",
  "pup-arazzi",
  "hidden-gems",

  "showtime",
  "get-sweaty",
  "golden-hour",
  "art-walk",
  "street-style",

  "street-mural",
  "random-kindness",
  "diy-craft",
  "open-market",
  "live-events",

  "off-the-map",
  "cinema-moment",
  "nyc-spirit",
  "human-pyramid",
  "celebrate"
];

window.BOARD_COLORS = [
  "yellow",
  "green",
  "red",
  "yellow",
  "green",

  "red",
  "yellow",
  "green",
  "red",
  "yellow",

  "green",
  "red",
  "yellow",
  "green",
  "red",

  "yellow",
  "green",
  "red",
  "yellow",
  "green",

  "red",
  "yellow",
  "green",
  "red",
  "final"
];

window.validateBoardConfig = function validateBoardConfig() {
  const questIds = Object.keys(window.QUESTS);
  const order = window.BOARD_ORDER;
  const colors = window.BOARD_COLORS;
  const duplicates = order.filter((id, index) => order.indexOf(id) !== index);
  const unknownIds = order.filter((id) => !window.QUESTS[id]);
  const missingIds = questIds.filter((id) => !order.includes(id));

  if (order.length !== 25) {
    console.error(`BOARD_ORDER must contain 25 IDs. Found ${order.length}.`);
  }
  if (colors.length !== 25) {
    console.error(`BOARD_COLORS must contain 25 colors. Found ${colors.length}.`);
  }
  if (order.length !== colors.length) {
    console.error("BOARD_ORDER and BOARD_COLORS must have equal lengths.");
  }
  if (duplicates.length) {
    console.error("Duplicate quest IDs in BOARD_ORDER:", [...new Set(duplicates)]);
  }
  if (unknownIds.length) {
    console.error("Unknown quest IDs in BOARD_ORDER:", unknownIds);
  }
  if (missingIds.length) {
    console.error("Quest IDs missing from BOARD_ORDER:", missingIds);
  }

  const allowedColors = new Set(["yellow", "green", "red", "final"]);
  const invalidColors = colors.filter((color) => !allowedColors.has(color));

  if (invalidColors.length) {
    console.error("Invalid board colors:", invalidColors);
  }
  if (order[24] !== "celebrate") {
    console.error('The final board position must contain the stable quest ID "celebrate".');
  }
  if (colors[24] !== "final") {
    console.error('The final board position must use the "final" color.');
  }
};

window.validateQuestData = function validateQuestData() {
  const requiredProperties = [
    "category",
    "icon",
    "title",
    "description",
    "basePoints",
    "bonuses",
    "story",
    "reflection",
    "bonusMemories"
  ];
  const validCategories = new Set(Object.keys(window.QUEST_CATEGORIES || {}));
  const titles = new Map();

  Object.entries(window.QUESTS).forEach(([questId, quest]) => {
    requiredProperties.forEach((property) => {
      if (!Object.prototype.hasOwnProperty.call(quest, property)) {
        console.error(`[Quest validation] ${questId} is missing required property: ${property}`);
      }
    });

    if (!validCategories.has(quest.category)) {
      console.error(`[Quest validation] ${questId} has invalid category: ${quest.category}`);
    }
    if (!Array.isArray(quest.bonuses)) {
      console.error(`[Quest validation] ${questId}.bonuses must be an array`);
      return;
    }
    if (!quest.bonusMemories || typeof quest.bonusMemories !== "object" || Array.isArray(quest.bonusMemories)) {
      console.error(`[Quest validation] ${questId}.bonusMemories must be an object`);
      return;
    }

    const bonusIds = new Set();
    quest.bonuses.forEach((bonus) => {
      if (!bonus?.id || !bonus?.label) {
        console.error(`[Quest validation] ${questId} has a bonus missing an id or label`);
        return;
      }
      if (bonusIds.has(bonus.id)) {
        console.error(`[Quest validation] ${questId} has duplicate bonus ID: ${bonus.id}`);
      }
      bonusIds.add(bonus.id);

      if (questId !== "celebrate" && !Object.prototype.hasOwnProperty.call(quest.bonusMemories, bonus.id)) {
        console.warn(`[Quest validation] ${questId} bonus has no bonus memory: ${bonus.id}`);
      }
    });

    Object.keys(quest.bonusMemories).forEach((bonusId) => {
      if (!bonusIds.has(bonusId)) {
        console.error(`[Quest validation] ${questId} bonus memory references an unknown bonus: ${bonusId}`);
      }
    });

    if (titles.has(quest.title)) {
      console.warn(
        `[Quest validation] Duplicate quest title "${quest.title}": ${titles.get(quest.title)}, ${questId}`
      );
    } else {
      titles.set(quest.title, questId);
    }
  });
};
