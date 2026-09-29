/**
 * BlueBite sync trigger. Pings the backend whenever a worker edits the sheet, so the app updates in about
 * a second instead of waiting for the 5s poll. The backend also polls, so a missed ping only delays sync.
 *
 * Setup (Extensions > Apps Script, paste this file):
 *   1. Project Settings > Script properties, add:
 *        WEBHOOK_URL    e.g. https://your-backend.example.com/api/sheets/webhook
 *        WEBHOOK_SECRET the same value as SHEETS_WEBHOOK_SECRET on the backend
 *   2. Run installTriggers() once and accept the permission prompt.
 *
 * Note: onEdit does NOT fire for changes made through the Sheets API, which is fine: the backend already
 * knows about its own writes. onEdit also does not fire for row deletes/inserts, so onChange is installed too.
 */

function notifyBackend(e) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('WEBHOOK_URL');
  var secret = props.getProperty('WEBHOOK_SECRET');
  if (!url || !secret) return;

  // Throttle to one ping per second; the backend coalesces refreshes anyway.
  var cache = CacheService.getScriptCache();
  if (cache.get('recent-ping')) return;
  cache.put('recent-ping', '1', 1);

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'x-webhook-secret': secret },
    payload: '{}',
    muteHttpExceptions: true,
  });
}

function installTriggers() {
  var ss = SpreadsheetApp.getActive();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'notifyBackend') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('notifyBackend').forSpreadsheet(ss).onEdit().create();
  ScriptApp.newTrigger('notifyBackend').forSpreadsheet(ss).onChange().create();
}
