const ANALYTICS_HEADERS = Object.freeze([
  "Received At",
  "Event Timestamp",
  "Event Name",
  "Event Key",
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
  "Feature",
  "Source",
  "Historical Status",
  "Timestamp Precision",
  "Evidence Used",
  "First Observed By Analytics At",
  "Superseded",
  "Superseded By",
  "Environment",
  "Is Test",
  "Total Completed Quests",
  "Total Points",
  "Total Friends",
  "Final Rank"
]);
const RECEIVER_VERSION = "8";
const FALLBACK_ANALYTICS_SECRET = "sq_8Fz3mQ7pL2xN9vK4cR6tY1wX5bD8eM";
const DEFAULT_ANALYTICS_SHEET_NAME = "Events";
const DEFAULT_ANALYTICS_TEST_SHEET_NAME = "Analytics Testing";

function doPost(event) {
  const lock = LockService.getScriptLock();
  let payload = null;
  let properties = null;
  let stage = "request_parse";

  try {
    properties = PropertiesService.getScriptProperties();
    try {
      payload = JSON.parse(event?.postData?.contents || "{}");
    } catch (error) {
      return analyticsErrorResponse({
        code: "parse_error",
        stage,
        error,
        properties
      });
    }

    stage = "authorization";
    const authorization = analyticsExpectedSecret(properties);
    if (payload.secret !== authorization.secret) {
      return analyticsErrorResponse({
        code: "unauthorized",
        stage,
        payload,
        properties,
        details: {
          secretSource: authorization.source,
          missingProperties: authorization.missingProperties
        }
      });
    }

    stage = "payload_validation";
    const missingFields = analyticsMissingPayloadFields(payload);
    if (missingFields.length) {
      return analyticsErrorResponse({
        code: "invalid_payload",
        stage,
        payload,
        properties,
        details: { missingFields }
      });
    }

    stage = "lock";
    lock.waitLock(5000);
    stage = "spreadsheet_lookup";
    const spreadsheet = analyticsSpreadsheet(properties);
    const sheetName = analyticsSheetName(payload, properties);
    stage = "sheet_lookup";
    const sheet = spreadsheet.getSheetByName(sheetName) || spreadsheet.insertSheet(sheetName);
    if (!sheet) throw new Error(`Unable to open or create analytics sheet: ${sheetName}`);

    stage = "header_sync";
    const headers = ensureAnalyticsHeaders(sheet);
    const values = analyticsValues(payload);
    const row = headers.map(header =>
      Object.prototype.hasOwnProperty.call(values, header) ? values[header] : ""
    );
    const eventKey = analyticsEventKey(payload);
    const matchingRows = uniqueRows([
      ...findAnalyticsRowsByEventKey(sheet, headers, eventKey),
      ...findAnalyticsRowsByLegacyIdentity(sheet, headers, payload)
    ]);
    const existingRow = matchingRows[0] || 0;
    const duplicateRows = matchingRows.slice(1);

    if (existingRow) {
      stage = "row_update";
      const countsAsFirstOpenRepair = isStableFirstOpenEvent(payload);
      writeAnalyticsRow(sheet, existingRow, headers, row);
      markSupersededRows(sheet, headers, duplicateRows, eventKey);
      return jsonResponse({
        ok: true,
        action: "updated",
        sheet: sheetName,
        eventKey,
        duplicateFirstOpenEventsDetected: countsAsFirstOpenRepair ? duplicateRows.length : 0,
        incorrectRowsRepaired: countsAsFirstOpenRepair ? duplicateRows.length + 1 : 0
      });
    }

    stage = "row_insert";
    writeAnalyticsRow(sheet, sheet.getLastRow() + 1, headers, row);
    return jsonResponse({
      ok: true,
      action: "inserted",
      sheet: sheetName,
      eventKey,
      duplicateFirstOpenEventsDetected: 0,
      incorrectRowsRepaired: 0
    });
  } catch (error) {
    return analyticsErrorResponse({
      code: "receiver_exception",
      stage,
      error,
      payload,
      properties
    });
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function analyticsPayloadIsTest(payload) {
  return payload?.is_test === true;
}

function analyticsSheetName(payload, properties) {
  if (analyticsPayloadIsTest(payload)) {
    return properties.getProperty("ANALYTICS_TEST_SHEET_NAME") ||
      DEFAULT_ANALYTICS_TEST_SHEET_NAME;
  }
  return properties.getProperty("ANALYTICS_SHEET_NAME") ||
    DEFAULT_ANALYTICS_SHEET_NAME;
}

function analyticsExpectedSecret(properties) {
  const configuredSecret = properties.getProperty("ANALYTICS_SECRET");
  return configuredSecret
    ? {
        secret: configuredSecret,
        source: "script_property",
        missingProperties: []
      }
    : {
        secret: FALLBACK_ANALYTICS_SECRET,
        source: "fallback_constant",
        missingProperties: ["ANALYTICS_SECRET"]
      };
}

function analyticsMissingPayloadFields(payload) {
  return ["installationId", "eventName", "timestamp"].filter(field =>
    typeof payload?.[field] !== "string" || !payload[field].trim()
  );
}

function analyticsSpreadsheet(properties) {
  const spreadsheetId = properties.getProperty("ANALYTICS_SPREADSHEET_ID");
  if (spreadsheetId) return SpreadsheetApp.openById(spreadsheetId);

  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) {
    throw new Error(
      "No active spreadsheet. Bind the script to a Sheet or set ANALYTICS_SPREADSHEET_ID."
    );
  }
  return spreadsheet;
}

function analyticsDiagnosticsEnabled(payload, properties) {
  return payload?.is_test === true ||
    properties?.getProperty?.("ANALYTICS_DIAGNOSTICS") === "true";
}

function analyticsErrorResponse({
  code,
  stage,
  error = null,
  payload = null,
  properties = null,
  details = {}
}) {
  const message = error?.message || String(error || code);
  const diagnostics = { code, stage, message, ...details };
  console.error(`[Analytics receiver] ${JSON.stringify(diagnostics)}`);

  return jsonResponse(
    analyticsDiagnosticsEnabled(payload, properties)
      ? { ok: false, error: code, stage, message, ...details }
      : { ok: false, error: code }
  );
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

function writeAnalyticsRow(sheet, rowNumber, headers, values) {
  const buildColumn = headers.indexOf("Build") + 1;
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  if (buildColumn && values[buildColumn - 1] !== "") {
    const buildValue = String(values[buildColumn - 1]);
    const buildRange = sheet.getRange(rowNumber, buildColumn);
    if (/^\d+$/.test(buildValue)) {
      buildRange.setNumberFormat("0".repeat(buildValue.length)).setValue(Number(buildValue));
    } else {
      buildRange.setNumberFormat("@").setValue(`'${buildValue}`);
    }
  }
}

function analyticsValues(payload) {
  const eventKey = analyticsEventKey(payload);
  return {
    "Received At": new Date().toISOString(),
    "Event Timestamp": cellValue(payload.timestamp),
    "Event Name": cellValue(payload.eventName),
    "Event Key": cellValue(eventKey),
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
    "Feature": cellValue(payload.feature),
    "Source": cellValue(payload.source),
    "Historical Status": cellValue(payload.historicalStatus),
    "Timestamp Precision": cellValue(payload.timestampPrecision),
    "Evidence Used": cellValue(payload.evidenceUsed),
    "First Observed By Analytics At": cellValue(payload.firstObservedByAnalyticsAt),
    "Superseded": payload.superseded === true,
    "Superseded By": cellValue(payload.supersededBy),
    "Environment": cellValue(payload.environment),
    "Is Test": payload.is_test === true,
    "Total Completed Quests": cellValue(payload.totalCompletedQuests),
    "Total Points": cellValue(payload.totalPoints),
    "Total Friends": cellValue(payload.totalFriends),
    "Final Rank": cellValue(payload.finalRank)
  };
}

function analyticsEventKey(payload) {
  if (payload?.eventKey) return String(payload.eventKey);
  const installationId = payload?.installationId ? String(payload.installationId) : "";
  const eventName = payload?.eventName ? String(payload.eventName) : "";
  if (!installationId || !eventName) return "";
  if (eventName === "quest_completed" && payload?.questId) {
    return `${installationId}:quest_completed:${payload.questId}`;
  }
  if (eventName === "app_opened" || eventName === "journal_opened" || eventName === "keepsake_opened") {
    return `${installationId}:${eventName}:${payload.sessionId || payload.timestamp || ""}`;
  }
  if (eventName === "keepsake_generated" || eventName === "feedback_submitted") {
    return `${installationId}:${eventName}:${payload.timestamp || Utilities.getUuid()}`;
  }
  return `${installationId}:${eventName}`;
}

function isStableFirstOpenEvent(payload) {
  return [
    "app_first_opened",
    "journal_first_opened",
    "keepsake_first_opened"
  ].includes(String(payload?.eventName || ""));
}

function findAnalyticsRowsByEventKey(sheet, headers, eventKey) {
  if (!eventKey) return [];
  const keyColumn = headers.indexOf("Event Key") + 1;
  const lastRow = sheet.getLastRow();
  if (!keyColumn || lastRow < 2) return [];

  const keys = sheet.getRange(2, keyColumn, lastRow - 1, 1).getValues();
  const rows = [];
  for (let index = 0; index < keys.length; index += 1) {
    if (String(keys[index][0]) === eventKey) rows.push(index + 2);
  }
  return rows;
}

function findAnalyticsRowsByLegacyIdentity(sheet, headers, payload) {
  const eventName = payload?.eventName ? String(payload.eventName) : "";
  const installationId = payload?.installationId ? String(payload.installationId) : "";
  if (!eventName || !installationId) return [];

  const stableEvents = [
    "app_first_opened",
    "app_installed",
    "first_quest_completed",
    "adventure_completed",
    "journal_first_opened",
    "keepsake_first_opened",
    "privacy_opened"
  ];
  const isQuestCompletion = eventName === "quest_completed" && payload?.questId;
  if (!isQuestCompletion && !stableEvents.includes(eventName)) return [];

  const eventColumn = headers.indexOf("Event Name") + 1;
  const installationColumn = headers.indexOf("Installation ID") + 1;
  const questColumn = headers.indexOf("Quest ID") + 1;
  const lastRow = sheet.getLastRow();
  if (!eventColumn || !installationColumn || lastRow < 2) return [];

  const rowValues = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const rows = [];
  for (let index = 0; index < rowValues.length; index += 1) {
    const row = rowValues[index];
    const matchesEvent = String(row[eventColumn - 1]) === eventName;
    const matchesInstallation = String(row[installationColumn - 1]) === installationId;
    const matchesQuest = !isQuestCompletion || String(row[questColumn - 1]) === String(payload.questId);
    if (matchesEvent && matchesInstallation && matchesQuest) rows.push(index + 2);
  }
  return rows;
}

function uniqueRows(rows) {
  return [...new Set(rows)].sort((left, right) => left - right);
}

function markSupersededRows(sheet, headers, rows, eventKey) {
  if (!rows.length) return;
  const supersededColumn = headers.indexOf("Superseded") + 1;
  const supersededByColumn = headers.indexOf("Superseded By") + 1;
  if (!supersededColumn || !supersededByColumn) return;
  rows.forEach(row => {
    sheet.getRange(row, supersededColumn).setValue(true);
    sheet.getRange(row, supersededByColumn).setValue(eventKey);
  });
}

function cellValue(value) {
  return value === null || value === undefined ? "" : value;
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify({ ...value, receiverVersion: RECEIVER_VERSION }))
    .setMimeType(ContentService.MimeType.JSON);
}
