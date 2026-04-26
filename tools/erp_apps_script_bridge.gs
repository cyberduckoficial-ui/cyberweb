/**
 * CYBERDUCK -> Apps Script -> ERP bridge
 *
 * This Web App receives accounting movements from cyberweb and optionally forwards
 * them to an ERP REST API. Deploy as Web App (Execute as: Me, Access: Anyone with link)
 * and use the generated URL as `endpoint` in `cyberduck.startAccountingSyncBridge(...)`.
 */

const BRIDGE_CONFIG = {
  SHARED_API_KEY: '', // same value used in cyberduck upsertAccountingSyncBridgeConfig({ apiKey })
  ERP_API_URL: '',
  ERP_API_KEY: '',
  LOG_SHEET_NAME: 'accounting_sync_log'
};

/**
 * Web App endpoint.
 */
function doPost(e) {
  try {
    const body = parseBody_(e);
    validatePayload_(body);

    const movement = body.movement;
    const erpResult = sendMovementToErp_(movement);
    logMovement_(movement, erpResult, body.source || 'cyberweb');

    return jsonResponse_({
      ok: true,
      externalReference: erpResult.externalReference,
      erpResponse: erpResult.raw || null
    });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: String(error && error.message ? error.message : error)
    });
  }
}

function parseBody_(e) {
  if (!e || !e.postData || !e.postData.contents) {
    throw new Error('Request body is required');
  }

  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_error) {
    throw new Error('Invalid JSON body');
  }

  return body;
}

function validatePayload_(body) {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid payload');
  }

  if (!body.movement || typeof body.movement !== 'object') {
    throw new Error('movement is required');
  }

  const movementType = String(body.movement.movementType || '').trim().toUpperCase();
  if (!['SALE', 'INVENTORY_OUT', 'COGS'].includes(movementType)) {
    throw new Error('Unsupported movementType');
  }

  if (BRIDGE_CONFIG.SHARED_API_KEY) {
    const apiKey = String(body.apiKey || '').trim();
    if (!apiKey || apiKey !== BRIDGE_CONFIG.SHARED_API_KEY) {
      throw new Error('Unauthorized');
    }
  }
}

function sendMovementToErp_(movement) {
  if (!BRIDGE_CONFIG.ERP_API_URL) {
    return {
      externalReference: `AS-${movement.syncId || Utilities.getUuid()}`,
      raw: {
        mode: 'mock',
        message: 'ERP_API_URL not configured; movement accepted and logged only.'
      }
    };
  }

  const headers = {
    'Content-Type': 'application/json'
  };

  if (BRIDGE_CONFIG.ERP_API_KEY) {
    headers.Authorization = `Bearer ${BRIDGE_CONFIG.ERP_API_KEY}`;
  }

  const response = UrlFetchApp.fetch(BRIDGE_CONFIG.ERP_API_URL, {
    method: 'post',
    headers,
    muteHttpExceptions: true,
    payload: JSON.stringify({ movement })
  });

  const status = response.getResponseCode();
  const content = response.getContentText() || '';
  let parsed = null;
  try {
    parsed = content ? JSON.parse(content) : null;
  } catch (_error) {
    parsed = { raw: content };
  }

  if (status < 200 || status >= 300) {
    throw new Error(`ERP rejected movement with status ${status}`);
  }

  const externalReference = String(
    (parsed && (parsed.externalReference || parsed.erpId || parsed.id))
    || `ERP-${movement.syncId || Utilities.getUuid()}`
  );

  return {
    externalReference,
    raw: parsed
  };
}

function logMovement_(movement, erpResult, source) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.create('CYBERDUCK_ACCOUNTING_SYNC');
  const sheet = spreadsheet.getSheetByName(BRIDGE_CONFIG.LOG_SHEET_NAME) || spreadsheet.insertSheet(BRIDGE_CONFIG.LOG_SHEET_NAME);

  if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      'timestamp',
      'source',
      'syncId',
      'movementType',
      'orderId',
      'entryId',
      'amountCOP',
      'externalReference',
      'rawResponse'
    ]);
  }

  const payload = movement.payload || {};
  sheet.appendRow([
    new Date(),
    source,
    movement.syncId || '',
    movement.movementType || '',
    movement.orderId || '',
    payload.entryId || payload.accountingEntryId || '',
    payload.amountCOP || '',
    erpResult.externalReference || '',
    JSON.stringify(erpResult.raw || {})
  ]);
}

function jsonResponse_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
