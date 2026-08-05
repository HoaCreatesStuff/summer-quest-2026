const ANALYTICS_HEADERS = Object.freeze([
  "Event Timestamp",
  "Event Name",
  "Installation ID",
  "Session ID",
  "Quest ID",
  "Quest Title",
  "Completed At",
  "Adventure Date",
  "Points",
  "Friend Count",
  "Bonus Earned",
  "Bonus Count",
  "Bonus IDs",
  "Build",
  "Platform",
  "Display Mode",
  "Language",
  "Historical",
  "Source",
  "Total Completed Quests",
  "Total Points",
  "Total Friends",
  "Final Rank"
]);

function doPost(event) {
  const lock = LockService.getScriptLock();
  try {
    const payload = JSON.parse(event?.postData?.contents || "{}");
    const properties = PropertiesService.getScriptProperties();
    const expectedSecret = properties.getProperty("ANALYTICS_SECRET");

    if (!expectedSecret || payload.secret !== expectedSecret) {
      return jsonResponse({ ok: false, error: "unauthorized" });
    }

    lock.waitLock(5000);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = properties.getProperty("ANALYTICS_SHEET_NAME") || "Analytics";
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    const headers = ensureAnalyticsHeaders(sheet);
    const values = analyticsValues(payload);
    const row = headers.map(header =>
      Object.prototype.hasOwnProperty.call(values, header) ? values[header] : ""
    );

    sheet.getRange(sheet.getLastRow() + 1, 1, 1, headers.length).setValues([row]);
    return jsonResponse({ ok: true });
  } catch (error) {
    return jsonResponse({ ok: false, error: "invalid_request" });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function ensureAnalyticsHeaders(sheet) {
  const lastColumn = sheet.getLastColumn();
  if (sheet.getLastRow() === 0 || lastColumn === 0) {
    sheet.getRange(1, 1, 1, ANALYTICS_HEADERS.length)
      .setValues([Array.from(ANALYTICS_HEADERS)]);
    return Array.from(ANALYTICS_HEADERS);
  }

  const existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  const missingHeaders = ANALYTICS_HEADERS.filter(
    header => !existingHeaders.includes(header)
  );
  if (missingHeaders.length) {
    sheet.getRange(1, lastColumn + 1, 1, missingHeaders.length)
      .setValues([missingHeaders]);
  }
  return [...existingHeaders, ...missingHeaders];
}

function analyticsValues(payload) {
  return {
    "Event Timestamp": cellValue(payload.timestamp),
    "Event Name": cellValue(payload.eventName),
    "Installation ID": cellValue(payload.installationId),
    "Session ID": cellValue(payload.sessionId),
    "Quest ID": cellValue(payload.questId),
    "Quest Title": cellValue(payload.questTitle),
    "Completed At": cellValue(payload.completedAt),
    "Adventure Date": cellValue(payload.adventureDate),
    "Points": cellValue(payload.points),
    "Friend Count": cellValue(payload.friendCount),
    "Bonus Earned": cellValue(payload.bonusEarned),
    "Bonus Count": cellValue(payload.bonusCount),
    "Bonus IDs": Array.isArray(payload.bonusIds) ? payload.bonusIds.join(",") : "",
    "Build": cellValue(payload.build),
    "Platform": cellValue(payload.platform),
    "Display Mode": cellValue(payload.displayMode),
    "Language": cellValue(payload.language),
    "Historical": payload.historical === true,
    "Source": cellValue(payload.source),
    "Total Completed Quests": cellValue(payload.totalCompletedQuests),
    "Total Points": cellValue(payload.totalPoints),
    "Total Friends": cellValue(payload.totalFriends),
    "Final Rank": cellValue(payload.finalRank)
  };
}

function cellValue(value) {
  return value === null || value === undefined ? "" : value;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
