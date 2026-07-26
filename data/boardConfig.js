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
  "party-time"
];

window.BOARD_COLORS = [
  "experience",
  "community",
  "challenges",
  "experience",
  "community",

  "challenges",
  "experience",
  "community",
  "challenges",
  "experience",

  "community",
  "challenges",
  "experience",
  "community",
  "challenges",

  "experience",
  "community",
  "challenges",
  "experience",
  "community",

  "challenges",
  "experience",
  "community",
  "challenges",
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

  const allowedColors = new Set(["experience", "community", "challenges", "final"]);
  const invalidColors = colors.filter((color) => !allowedColors.has(color));

  if (invalidColors.length) {
    console.error("Invalid board colors:", invalidColors);
  }
  if (order[24] !== "party-time") {
    console.error('The final board position must contain the stable quest ID "party-time".');
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
  const illustrations = window.QUEST_ILLUSTRATIONS || {};
  const isNonEmptyString = (value) =>
    typeof value === "string" && value.trim().length > 0;
  let isValid = true;

  const reportError = (...details) => {
    isValid = false;
    console.error(...details);
  };

  Object.entries(window.QUESTS).forEach(([questId, quest]) => {
    if (!quest || typeof quest !== "object" || Array.isArray(quest)) {
      reportError(`[Quest validation] ${questId} must be an object`);
      return;
    }

    requiredProperties.forEach((property) => {
      if (!Object.prototype.hasOwnProperty.call(quest, property)) {
        reportError(`[Quest validation] ${questId} is missing required property: ${property}`);
      }
    });

    if (!validCategories.has(quest.category)) {
      reportError(`[Quest validation] ${questId} has invalid category: ${quest.category}`);
    }
    ["icon", "title", "description", "story"].forEach((property) => {
      if (!isNonEmptyString(quest[property])) {
        reportError(`[Quest validation] ${questId}.${property} must be a non-empty string`);
      }
    });
    if (quest.reflection !== null && !isNonEmptyString(quest.reflection)) {
      reportError(`[Quest validation] ${questId}.reflection must be null or a non-empty string`);
    }
    if (!Number.isFinite(quest.basePoints) || quest.basePoints < 0) {
      reportError(`[Quest validation] ${questId}.basePoints must be a finite non-negative number`);
    }
    if (!Object.prototype.hasOwnProperty.call(illustrations, questId)) {
      reportError(`[Quest validation] ${questId} is missing an illustration mapping`);
    } else if (
      typeof illustrations[questId] !== "string" ||
      (illustrations[questId].length > 0 && !illustrations[questId].trim())
    ) {
      reportError(
        `[Quest validation] ${questId} illustration must be a path string or an explicitly blank string`
      );
    }
    if (!Array.isArray(quest.bonuses)) {
      reportError(`[Quest validation] ${questId}.bonuses must be an array`);
      return;
    }
    if (!quest.bonusMemories || typeof quest.bonusMemories !== "object" || Array.isArray(quest.bonusMemories)) {
      reportError(`[Quest validation] ${questId}.bonusMemories must be an object`);
      return;
    }

    const bonusIds = new Set();
    quest.bonuses.forEach((bonus) => {
      if (!isNonEmptyString(bonus?.id) || !isNonEmptyString(bonus?.label)) {
        reportError(`[Quest validation] ${questId} has a bonus missing a valid id or label`);
        return;
      }
      if (bonusIds.has(bonus.id)) {
        reportError(`[Quest validation] ${questId} has duplicate bonus ID: ${bonus.id}`);
      }
      bonusIds.add(bonus.id);
      if (!Number.isFinite(bonus.points) || bonus.points < 0) {
        reportError(
          `[Quest validation] ${questId} bonus ${bonus.id} points must be a finite non-negative number`
        );
      }

      const hasBonusMemory = Object.prototype.hasOwnProperty.call(
        quest.bonusMemories,
        bonus.id
      );
      if (!quest.final && !hasBonusMemory) {
        reportError(`[Quest validation] ${questId} bonus has no bonus memory: ${bonus.id}`);
      }
      if (hasBonusMemory && !isNonEmptyString(quest.bonusMemories[bonus.id])) {
        reportError(
          `[Quest validation] ${questId} bonus memory must be a non-empty string: ${bonus.id}`
        );
      }
    });

    Object.keys(quest.bonusMemories).forEach((bonusId) => {
      if (!bonusIds.has(bonusId)) {
        reportError(`[Quest validation] ${questId} bonus memory references an unknown bonus: ${bonusId}`);
      }
    });

    if (titles.has(quest.title)) {
      console.warn(
        `[Quest validation] Duplicate quest title "${quest.title}": ${titles.get(quest.title)}, ${questId}`
      );
    } else {
      titles.set(quest.title, questId);
    }

    if (quest.final) {
      if (!Array.isArray(quest.triviaQuestions) || quest.triviaQuestions.length === 0) {
        reportError(
          `[Quest validation] ${questId}.triviaQuestions must contain at least one Final Quest question`
        );
      } else {
        quest.triviaQuestions.forEach((question, questionIndex) => {
          const questionPath = `${questId}.triviaQuestions[${questionIndex}]`;
          if (!isNonEmptyString(question?.prompt)) {
            reportError(`[Quest validation] ${questionPath}.prompt must be a non-empty string`);
          }
          if (
            !Array.isArray(question?.acceptedAnswers) ||
            question.acceptedAnswers.length === 0
          ) {
            reportError(
              `[Quest validation] ${questionPath}.acceptedAnswers must contain at least one answer`
            );
          } else if (
            question.acceptedAnswers.some((answer) => !isNonEmptyString(answer))
          ) {
            reportError(
              `[Quest validation] ${questionPath}.acceptedAnswers must contain only non-empty strings`
            );
          }
        });
      }
    }
  });

  Object.keys(illustrations).forEach((questId) => {
    if (!window.QUESTS[questId]) {
      reportError(`[Quest validation] Illustration references unknown quest: ${questId}`);
    }
  });

  if (!window.QUESTS["party-time"]?.final) {
    reportError('[Quest validation] The "party-time" quest must be marked as the Final Quest');
  }

  const finalQuestIds = Object.entries(window.QUESTS)
    .filter(([, quest]) => quest?.final)
    .map(([questId]) => questId);
  if (finalQuestIds.length !== 1) {
    reportError(
      `[Quest validation] Exactly one quest must be marked final. Found: ${finalQuestIds.join(", ") || "none"}`
    );
  }

  return isValid;
};
