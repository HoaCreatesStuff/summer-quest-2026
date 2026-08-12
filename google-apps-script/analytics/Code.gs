const ANALYTICS_HEADERS = Object.freeze([
  "Event Timestamp",
  "Event Name",
  "Event Key",
  "Installation ID",
  "Session ID",
  "Quest ID",
  "Quest Title",
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
const QUEST_RECORD_HEADERS = Object.freeze([
  "Record Key",
  "Installation ID",
  "Quest ID",
  "Quest Title",
  "Completion Status",
  "First Completed At",
  "Adventure Date",
  "Friends Count",
  "Selected Bonus IDs",
  "Base Points",
  "Friend Points",
  "Bonus Points",
  "Quest Total Points",
  "Has Photo",
  "Has Caption",
  "Submission Version",
  "Updated At",
  "Record Hash",
  "Event Timestamp",
  "Build",
  "Platform",
  "Display Mode",
  "Language",
  "Source",
  "Environment",
  "Is Test"
]);
const QUEST_RECORD_COMPARE_HEADERS = Object.freeze([
  "Completion Status",
  "First Completed At",
  "Adventure Date",
  "Friends Count",
  "Selected Bonus IDs",
  "Base Points",
  "Friend Points",
  "Bonus Points",
  "Quest Total Points",
  "Has Photo",
  "Has Caption",
  "Submission Version",
  "Updated At",
  "Record Hash"
]);
const RETIRED_ANALYTICS_HEADERS = Object.freeze([
  "Received At",
  "Last Received At",
  "Completed At",
  "Timestamp Precision"
]);
const RETIRED_QUEST_RECORD_HEADERS = Object.freeze([
  "Running Total Points",
  "Has Reflection"
]);
const RECEIVER_VERSION = "13";
const FALLBACK_ANALYTICS_SECRET = "sq_8Fz3mQ7pL2xN9vK4cR6tY1wX5bD8eM";
const DEFAULT_ANALYTICS_SHEET_NAME = "Events";
const DEFAULT_ANALYTICS_TEST_SHEET_NAME = "Analytics Testing";
const DEFAULT_QUEST_RECORD_SHEET_NAME = "Quest Records";
const DEFAULT_QUEST_RECORD_TEST_SHEET_NAME = "Quest Records Testing";
const SURVEY_RESPONSES_SHEET_NAME = "Survey Responses";
const INTERVIEW_CONTACTS_SHEET_NAME = "Interview Contacts";
const SURVEY_RESPONSE_HEADERS = Object.freeze([
  "Survey Response ID", "Installation ID", "Session ID", "Submission Timestamp",
  "Build", "Platform", "Q1", "Q2", "Q2 Follow-up", "Q3 selections", "Q3 Other",
  "Q4 selections", "Q4 Other", "Q5", "Q5 Other", "Q6", "Q7", "Q7 Other", "Q8",
  "Q9", "Q10 selections", "Q10 Other", "Q11 Interview Opt-In", "Q13 Additional Comments",
  "Journal Usage", "Journal Usage Other", "Journal Friction / Why Less Useful", "Keepsake Value"
]);
const INTERVIEW_CONTACT_HEADERS = Object.freeze([
  "Survey Response ID", "Name / Contact Info", "Submitted At"
]);
const ANALYTICS_SCHEMA_MIGRATION_SHEETS = Object.freeze([
  { name: DEFAULT_ANALYTICS_SHEET_NAME, headers: ANALYTICS_HEADERS },
  { name: DEFAULT_ANALYTICS_TEST_SHEET_NAME, headers: ANALYTICS_HEADERS },
  { name: DEFAULT_QUEST_RECORD_SHEET_NAME, headers: QUEST_RECORD_HEADERS },
  { name: DEFAULT_QUEST_RECORD_TEST_SHEET_NAME, headers: QUEST_RECORD_HEADERS }
]);

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

    if (payload.requestType === "survey_submission") {
      stage = "survey_validation";
      const surveyMissingFields = surveyMissingFields(payload);
      if (surveyMissingFields.length) {
        return analyticsErrorResponse({
          code: "invalid_survey_payload", stage, payload, properties,
          details: { missingFields: surveyMissingFields }
        });
      }
      stage = "lock";
      lock.waitLock(5000);
      stage = "spreadsheet_lookup";
      const surveySpreadsheet = analyticsSpreadsheet(properties);
      stage = "survey_sheet_setup";
      const surveySheet = surveySheetFor(surveySpreadsheet, SURVEY_RESPONSES_SHEET_NAME, SURVEY_RESPONSE_HEADERS);
      const contactSheet = surveySheetFor(surveySpreadsheet, INTERVIEW_CONTACTS_SHEET_NAME, INTERVIEW_CONTACT_HEADERS);
      stage = "survey_row_insert";
      const responseId = String(payload.surveyResponseId || "").trim();
      const existingSurveyRow = surveyRowByResponseId(surveySheet, responseId);
      const contact = String(payload.answers?.q12 || "").trim();
      if (!existingSurveyRow) surveySheet.appendRow(surveyResponseRow(payload, responseId));
      if (payload.answers?.q11 === "Yes" && contact && !surveyRowByResponseId(contactSheet, responseId)) {
        contactSheet.appendRow([responseId, contact, cellValue(payload.timestamp)]);
      }
      return jsonResponse({ ok: true, responseId, duplicate: Boolean(existingSurveyRow) });
    }

    if (payload.requestType === "quest_reconciliation") {
      stage = "reconciliation_validation";
      const reconciliationMissingFields = analyticsMissingReconciliationFields(payload);
      if (reconciliationMissingFields.length) {
        return analyticsErrorResponse({
          code: "invalid_reconciliation_payload",
          stage,
          payload,
          properties,
          details: { missingFields: reconciliationMissingFields }
        });
      }

      stage = "lock";
      lock.waitLock(5000);
      stage = "spreadsheet_lookup";
      const reconciliationSpreadsheet = analyticsSpreadsheet(properties);
      const reconciliationSheetName = questRecordSheetName(payload, properties);
      stage = "quest_record_sheet_lookup";
      const reconciliationSheet = reconciliationSpreadsheet.getSheetByName(reconciliationSheetName);
      if (!reconciliationSheet) {
        throw new Error(`Quest record sheet does not exist: ${reconciliationSheetName}`);
      }

      stage = "quest_record_schema_validation";
      const reconciliationHeaders = readReceiverHeaders(
        reconciliationSheet,
        QUEST_RECORD_HEADERS,
        reconciliationSheetName
      );
      stage = "quest_record_upsert";
      const result = reconcileQuestRecords(
        reconciliationSheet,
        reconciliationHeaders,
        payload
      );
      return jsonResponse({ ok: true, sheet: reconciliationSheetName, ...result });
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
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error(`Analytics sheet does not exist: ${sheetName}`);

    stage = "schema_validation";
    const headers = readReceiverHeaders(sheet, ANALYTICS_HEADERS, sheetName);
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

function questRecordSheetName(payload, properties) {
  if (analyticsPayloadIsTest(payload)) {
    return properties.getProperty("ANALYTICS_QUEST_TEST_SHEET_NAME") ||
      DEFAULT_QUEST_RECORD_TEST_SHEET_NAME;
  }
  return properties.getProperty("ANALYTICS_QUEST_SHEET_NAME") ||
    DEFAULT_QUEST_RECORD_SHEET_NAME;
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

function analyticsMissingReconciliationFields(payload) {
  const missing = ["installationId", "timestamp"].filter(field =>
    typeof payload?.[field] !== "string" || !payload[field].trim()
  );
  if (!Array.isArray(payload?.records)) missing.push("records");
  return missing;
}

function surveyRowByResponseId(sheet, responseId) {
  if (!responseId || sheet.getLastRow() < 2) return 0;
  const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  const index = ids.findIndex(row => String(row[0]) === responseId);
  return index < 0 ? 0 : index + 2;
}

function surveyMissingFields(payload) {
  const missing = ["installationId", "timestamp", "surveyResponseId"].filter(field =>
    typeof payload?.[field] !== "string" || !payload[field].trim()
  );
  if (!payload?.answers || typeof payload.answers !== "object" || Array.isArray(payload.answers)) {
    missing.push("answers");
  }
  return missing;
}

function surveySheetFor(spreadsheet, name, headers) {
  return ensureSurveySchemaSheet(spreadsheet, name, headers).sheet;
}

function inspectSurveySchemaSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name);
  const report = {
    sheetName: name,
    exists: Boolean(sheet),
    currentHeaders: [],
    targetHeaders: Array.from(headers),
    creationRequired: !sheet,
    columnsToAppend: [],
    rowCount: 0,
    frozenRows: sheet ? sheet.getFrozenRows() : 0,
    validationPassed: false,
    errors: []
  };
  if (!sheet) {
    report.validationPassed = true;
    return report;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  report.rowCount = lastRow;
  if (lastRow < 1 || lastColumn < 1) {
    report.errors.push("row 1 must contain headers");
    return report;
  }
  const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(value => String(value || "").trim());
  report.currentHeaders = currentHeaders;
  if (currentHeaders.some(header => !header)) report.errors.push("header row contains a blank header");
  if (new Set(currentHeaders).size !== currentHeaders.length) report.errors.push("header row contains duplicate headers");
  if (currentHeaders.length > headers.length ||
      currentHeaders.some((header, index) => header !== headers[index])) {
    report.errors.push("headers are incompatible, reordered, or unexpected");
    return report;
  }
  report.columnsToAppend = headers.slice(currentHeaders.length);
  report.validationPassed = report.errors.length === 0;
  return report;
}

function ensureSurveySchemaSheet(spreadsheet, name, headers) {
  const report = inspectSurveySchemaSheet(spreadsheet, name, headers);
  if (!report.validationPassed) {
    throw new Error(`Survey schema validation failed for ${name}: ${report.errors.join("; ")}`);
  }

  let sheet = spreadsheet.getSheetByName(name);
  if (report.creationRequired) {
    sheet = spreadsheet.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    return { ...inspectSurveySchemaSheet(spreadsheet, name, headers), sheet, action: "created" };
  }
  if (report.columnsToAppend.length) {
    sheet.getRange(1, report.currentHeaders.length + 1, 1, report.columnsToAppend.length)
      .setValues([report.columnsToAppend]);
    sheet.setFrozenRows(1);
    return { ...inspectSurveySchemaSheet(spreadsheet, name, headers), sheet, action: "columns_appended" };
  }
  if (sheet.getFrozenRows() < 1) {
    sheet.setFrozenRows(1);
    return { ...inspectSurveySchemaSheet(spreadsheet, name, headers), sheet, action: "header_frozen" };
  }
  return { ...inspectSurveySchemaSheet(spreadsheet, name, headers), sheet, action: "unchanged" };
}

function surveyAnswer(payload, key) {
  const value = payload.answers?.[key];
  return Array.isArray(value) ? JSON.stringify(value) : cellValue(value);
}

function surveyResponseRow(payload, responseId) {
  return [
    responseId, cellValue(payload.installationId), cellValue(payload.sessionId), cellValue(payload.timestamp),
    cellValue(payload.build), cellValue(payload.platform), surveyAnswer(payload, "q1"), surveyAnswer(payload, "q2"),
    surveyAnswer(payload, "q2FollowUp"), surveyAnswer(payload, "q3"), surveyAnswer(payload, "q3Other"),
    surveyAnswer(payload, "q4"), surveyAnswer(payload, "q4Other"), surveyAnswer(payload, "q5"),
    surveyAnswer(payload, "q5Other"), surveyAnswer(payload, "q6"), surveyAnswer(payload, "q7"),
    surveyAnswer(payload, "q7Other"), surveyAnswer(payload, "q8"), surveyAnswer(payload, "q9"),
    surveyAnswer(payload, "q10"), surveyAnswer(payload, "q10Other"), surveyAnswer(payload, "q11"),
    surveyAnswer(payload, "q13"), surveyAnswer(payload, "journalUsage"),
    surveyAnswer(payload, "journalUsageOther"), surveyAnswer(payload, "journalFriction"),
    surveyAnswer(payload, "keepsakeValue")
  ];
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

function readReceiverHeaders(sheet, expectedHeaders, sheetName) {
  const report = inspectAnalyticsSchemaSheet(sheet, sheetName, expectedHeaders);
  if (!report.validationPassed || report.columnsToRemove.length || report.requiresReorder) {
    const details = report.errors.length
      ? report.errors.join("; ")
      : report.columnsToRemove.length
        ? `retired columns must be removed with migrateAnalyticsSchemaToV12(): ${report.columnsToRemove.join(", ")}`
        : "legacy header order must be migrated with migrateAnalyticsSchemaToV12()";
    throw new Error(`Analytics schema validation failed for ${sheetName}: ${details}`);
  }
  return report.finalHeaders;
}

function previewAnalyticsSchemaMigrationToV12() {
  return runAnalyticsSchemaMigration(true);
}

function migrateAnalyticsSchemaToV12() {
  return runAnalyticsSchemaMigration(false);
}

function previewAnalyticsSchemaMigrationToV11() {
  return previewAnalyticsSchemaMigrationToV12();
}

function migrateAnalyticsSchemaToV11() {
  return migrateAnalyticsSchemaToV12();
}

// Retain the former entry points for operators who have them bookmarked; all
// now preview/migrate the v13 schema.
function previewAnalyticsSchemaMigrationToV10() {
  return previewAnalyticsSchemaMigrationToV12();
}

function migrateAnalyticsSchemaToV10() {
  return migrateAnalyticsSchemaToV12();
}

function runAnalyticsSchemaMigration(dryRun) {
  const properties = PropertiesService.getScriptProperties();
  const spreadsheet = analyticsSpreadsheet(properties);
  const spreadsheetReport = {
    name: spreadsheet.getName(),
    id: spreadsheet.getId(),
    sheetsPresentBeforeMigration: {
      events: Boolean(spreadsheet.getSheetByName(DEFAULT_ANALYTICS_SHEET_NAME)),
      analyticsTesting: Boolean(spreadsheet.getSheetByName(DEFAULT_ANALYTICS_TEST_SHEET_NAME)),
      questRecords: Boolean(spreadsheet.getSheetByName(DEFAULT_QUEST_RECORD_SHEET_NAME)),
      questRecordsTesting: Boolean(spreadsheet.getSheetByName(DEFAULT_QUEST_RECORD_TEST_SHEET_NAME)),
      surveyResponses: Boolean(spreadsheet.getSheetByName(SURVEY_RESPONSES_SHEET_NAME)),
      interviewContacts: Boolean(spreadsheet.getSheetByName(INTERVIEW_CONTACTS_SHEET_NAME))
    }
  };
  const analyticsReports = ANALYTICS_SCHEMA_MIGRATION_SHEETS.map(spec => {
    const sheet = spreadsheet.getSheetByName(spec.name);
    return inspectAnalyticsSchemaSheet(sheet, spec.name, spec.headers);
  });
  const surveyReports = [
    inspectSurveySchemaSheet(spreadsheet, SURVEY_RESPONSES_SHEET_NAME, SURVEY_RESPONSE_HEADERS),
    inspectSurveySchemaSheet(spreadsheet, INTERVIEW_CONTACTS_SHEET_NAME, INTERVIEW_CONTACT_HEADERS)
  ];
  const result = {
    receiverVersion: RECEIVER_VERSION,
    dryRun,
    spreadsheet: spreadsheetReport,
    analyticsAndQuestRecords: analyticsReports,
    surveyResponses: surveyReports[0],
    interviewContacts: surveyReports[1]
  };

  // Validate every target before changing any sheet structure. Missing survey
  // tabs are valid creation candidates; legacy analytics/quest sheets are not.
  if (analyticsReports.some(report => !report.validationPassed) ||
      surveyReports.some(report => !report.validationPassed)) {
    console.error(`[Analytics schema v13] ${JSON.stringify(result)}`);
    return result;
  }
  if (dryRun) {
    console.info(`[Analytics schema v13 preview] ${JSON.stringify(result)}`);
    return result;
  }

  result.analyticsAndQuestRecords = ANALYTICS_SCHEMA_MIGRATION_SHEETS.map(spec =>
    migrateAnalyticsSchemaSheet(
      spreadsheet.getSheetByName(spec.name),
      spec.name,
      spec.headers
    )
  );
  result.surveyResponses = surveyMigrationReport(
    ensureSurveySchemaSheet(spreadsheet, SURVEY_RESPONSES_SHEET_NAME, SURVEY_RESPONSE_HEADERS)
  );
  result.interviewContacts = surveyMigrationReport(
    ensureSurveySchemaSheet(spreadsheet, INTERVIEW_CONTACTS_SHEET_NAME, INTERVIEW_CONTACT_HEADERS)
  );
  result.spreadsheet.sheetsPresentAfterMigration = {
    surveyResponses: Boolean(spreadsheet.getSheetByName(SURVEY_RESPONSES_SHEET_NAME)),
    interviewContacts: Boolean(spreadsheet.getSheetByName(INTERVIEW_CONTACTS_SHEET_NAME))
  };
  console.info(`[Analytics schema v13] ${JSON.stringify(result)}`);
  return result;
}

function surveyMigrationReport(result) {
  const { sheet, ...report } = result;
  return report;
}

function migrateAnalyticsSchemaSheet(sheet, sheetName, expectedHeaders, dryRun = false) {
  const before = inspectAnalyticsSchemaSheet(sheet, sheetName, expectedHeaders);
  if (!before.validationPassed || dryRun || before.alreadyMigrated) return before;

  try {
    retiredSchemaColumns(sheet, expectedHeaders).forEach(column => sheet.deleteColumn(column.index));
    if (before.requiresReorder) rewriteAnalyticsSchemaSheet(sheet, expectedHeaders);
    const after = inspectAnalyticsSchemaSheet(sheet, sheetName, expectedHeaders);
    after.columnsToRemove = before.columnsToRemove;
    after.columnsRemoved = before.columnsToRemove;
    after.alreadyMigrated = false;
    return after;
  } catch (error) {
    before.validationPassed = false;
    before.errors.push(`migration failed: ${error?.message || error}`);
    return before;
  }
}

function inspectAnalyticsSchemaSheet(sheet, sheetName, expectedHeaders) {
  const report = {
    sheetName,
    columnsToRemove: [],
    columnsRemoved: [],
    alreadyMigrated: false,
    requiresReorder: false,
    currentHeaders: [],
    targetHeaders: Array.from(expectedHeaders),
    finalHeaders: [],
    rowCount: 0,
    validationPassed: false,
    errors: []
  };
  if (!sheet) {
    report.errors.push("sheet does not exist");
    return report;
  }

  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  report.rowCount = lastRow;
  if (lastRow < 1 || lastColumn < 1) {
    report.errors.push("row 1 must contain headers");
    return report;
  }

  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const headers = values[0].map(header => String(header || "").trim());
  report.currentHeaders = headers;
  report.columnsToRemove = retiredSchemaColumnsFromHeaders(headers, expectedHeaders)
    .map(column => column.header);
  report.columnsRemoved = report.columnsToRemove;
  const retiredHeaders = retiredHeadersForSchema(expectedHeaders);
  const remainingHeaders = headers.filter(header => !retiredHeaders.includes(header));
  report.finalHeaders = remainingHeaders;

  if (headers.some(header => !header)) report.errors.push("header row contains a blank header");
  if (new Set(headers).size !== headers.length) report.errors.push("header row contains duplicate headers");
  if (values.some(row => row.length !== headers.length)) {
    report.errors.push("one or more rows do not match the header width");
  }
  const unexpectedHeaders = remainingHeaders.filter(header => !expectedHeaders.includes(header));
  if (unexpectedHeaders.length) {
    report.errors.push(`unexpected headers are present: ${unexpectedHeaders.join(", ")}`);
  }
  const missingHeaders = expectedHeaders.filter(header => !remainingHeaders.includes(header));
  const migratableMissingHeaders = expectedHeaders === QUEST_RECORD_HEADERS
    ? ["First Completed At", "Adventure Date"]
    : [];
  const unsupportedMissingHeaders = missingHeaders.filter(header => !migratableMissingHeaders.includes(header));
  if (unsupportedMissingHeaders.length) {
    report.errors.push(`required headers are missing: ${unsupportedMissingHeaders.join(", ")}`);
  }
  report.requiresReorder = report.errors.length === 0 && !arraysEqual(remainingHeaders, expectedHeaders);
  report.alreadyMigrated = report.errors.length === 0 &&
    report.columnsToRemove.length === 0 && !report.requiresReorder;
  report.validationPassed = report.errors.length === 0;
  return report;
}

function rewriteAnalyticsSchemaSheet(sheet, expectedHeaders) {
  const lastRow = sheet.getLastRow();
  const lastColumn = sheet.getLastColumn();
  const values = sheet.getRange(1, 1, lastRow, lastColumn).getValues();
  const currentHeaders = values[0].map(header => String(header || "").trim());
  const columnByHeader = {};
  currentHeaders.forEach((header, index) => {
    if (Object.prototype.hasOwnProperty.call(columnByHeader, header)) {
      throw new Error(`header cannot be mapped unambiguously: ${header}`);
    }
    columnByHeader[header] = index;
  });
  const rewrittenValues = [Array.from(expectedHeaders), ...values.slice(1).map(row =>
    expectedHeaders.map(header => {
      if (Object.prototype.hasOwnProperty.call(columnByHeader, header)) {
        return row[columnByHeader[header]];
      }
      if (expectedHeaders === QUEST_RECORD_HEADERS &&
          ["First Completed At", "Adventure Date"].includes(header)) {
        return "";
      }
      throw new Error(`required header cannot be mapped: ${header}`);
    })
  )];
  sheet.getRange(1, 1, lastRow, expectedHeaders.length).setValues(rewrittenValues);
}

function retiredSchemaColumns(sheet, expectedHeaders) {
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0]
    .map(header => String(header || "").trim());
  return retiredSchemaColumnsFromHeaders(headers, expectedHeaders);
}

function retiredSchemaColumnsFromHeaders(headers, expectedHeaders) {
  const retiredHeaders = retiredHeadersForSchema(expectedHeaders);
  return headers
    .map((header, index) => retiredHeaders.includes(header)
      ? { header, index: index + 1 }
      : null)
    .filter(Boolean)
    .sort((left, right) => right.index - left.index);
}

function retiredHeadersForSchema(expectedHeaders) {
  return expectedHeaders === QUEST_RECORD_HEADERS
    ? [...RETIRED_ANALYTICS_HEADERS, ...RETIRED_QUEST_RECORD_HEADERS]
    : RETIRED_ANALYTICS_HEADERS;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function reconcileQuestRecords(sheet, headers, payload) {
  const recordKeyColumn = headers.indexOf("Record Key") + 1;
  if (!recordKeyColumn) throw new Error("Quest record sheet is missing Record Key.");

  const lastRow = sheet.getLastRow();
  const existingRows = lastRow >= 2
    ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues()
    : [];
  const rowByKey = {};
  existingRows.forEach((row, index) => {
    const key = String(row[recordKeyColumn - 1] || "");
    if (key && !rowByKey[key]) rowByKey[key] = { rowNumber: index + 2, values: row };
  });

  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  payload.records.forEach((record, index) => {
    if (!record || typeof record.questId !== "string" || !record.questId.trim()) {
      throw new Error(`Quest reconciliation record ${index} is missing questId.`);
    }
    const valuesByHeader = questRecordValues(payload, record);
    const key = valuesByHeader["Record Key"];
    const existing = rowByKey[key];
    if (!existing) {
      const values = headers.map(header =>
        Object.prototype.hasOwnProperty.call(valuesByHeader, header)
          ? valuesByHeader[header]
          : ""
      );
      const rowNumber = sheet.getLastRow() + 1;
      writeAnalyticsRow(sheet, rowNumber, headers, values);
      rowByKey[key] = { rowNumber, values };
      inserted += 1;
      return;
    }

    if (!questRecordChanged(headers, existing.values, valuesByHeader)) {
      unchanged += 1;
      return;
    }

    const values = headers.map(header =>
      Object.prototype.hasOwnProperty.call(valuesByHeader, header)
        ? valuesByHeader[header]
        : ""
    );
    writeAnalyticsRow(sheet, existing.rowNumber, headers, values);
    existing.values = values;
    updated += 1;
  });

  return { inserted, updated, unchanged };
}

function questRecordValues(payload, record) {
  const questId = String(record.questId).trim();
  const recordKey = `${String(payload.installationId)}:${questId}`;
  return {
    "Record Key": recordKey,
    "Installation ID": cellValue(payload.installationId),
    "Quest ID": questId,
    "Quest Title": cellValue(record.questTitle),
    "Completion Status": cellValue(record.completionStatus),
    "First Completed At": cellValue(record.firstCompletedAt),
    "Adventure Date": cellValue(record.adventureDate),
    "Friends Count": cellValue(record.friendsCount),
    "Selected Bonus IDs": Array.isArray(record.selectedBonusIds)
      ? record.selectedBonusIds.join(",")
      : cellValue(record.selectedBonusIds),
    "Base Points": cellValue(record.basePoints),
    "Friend Points": cellValue(record.friendPoints),
    "Bonus Points": cellValue(record.bonusPoints),
    "Quest Total Points": cellValue(record.questTotalPoints),
    "Has Photo": record.hasPhoto === true,
    "Has Caption": record.hasCaption === true,
    "Submission Version": cellValue(record.submissionVersion),
    "Updated At": cellValue(record.updatedAt),
    "Record Hash": cellValue(record.recordHash),
    "Event Timestamp": cellValue(payload.timestamp),
    "Build": cellValue(payload.build),
    "Platform": cellValue(payload.platform),
    "Display Mode": cellValue(payload.displayMode),
    "Language": cellValue(payload.language),
    "Source": cellValue(payload.source),
    "Environment": cellValue(payload.environment),
    "Is Test": payload.is_test === true
  };
}

function questRecordChanged(headers, existingValues, nextValues) {
  return QUEST_RECORD_COMPARE_HEADERS.some(header => {
    const column = headers.indexOf(header);
    const existing = column >= 0 ? existingValues[column] : "";
    return comparableCellValue(existing) !== comparableCellValue(nextValues[header]);
  });
}

function comparableCellValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === true) return "true";
  if (value === false) return "false";
  return value === null || value === undefined ? "" : String(value);
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
    "Event Timestamp": cellValue(payload.timestamp),
    "Event Name": cellValue(payload.eventName),
    "Event Key": cellValue(eventKey),
    "Installation ID": cellValue(payload.installationId),
    "Session ID": cellValue(payload.sessionId),
    "Quest ID": cellValue(payload.questId),
    "Quest Title": cellValue(payload.questTitle),
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
