/**
 * Deploy as a Google Apps Script Web App.
 * Script Properties required:
 *   SPREADSHEET_ID = ID of the destination Google Spreadsheet
 *   WEBHOOK_SECRET = same secret as GOOGLE_SHEETS_WEBHOOK_SECRET in Next.js
 */
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const props = PropertiesService.getScriptProperties();
    const expected = props.getProperty('WEBHOOK_SECRET');
    const spreadsheetId = props.getProperty('SPREADSHEET_ID');
    if (!expected || !spreadsheetId || body.secret !== expected) {
      return json({ ok: false, error: 'unauthorized' });
    }
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName('ผลสอบ') || spreadsheet.insertSheet('ผลสอบ');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['เวลาส่งข้อสอบ (UTC)', 'ชุดข้อสอบ', 'ชื่อ', 'นามสกุล', 'รหัสนักศึกษา', 'คะแนนที่ได้', 'คะแนนเต็ม', 'เปอร์เซ็นต์', 'Attempt ID', 'รายละเอียดคำตอบ (JSON)']);
      sheet.setFrozenRows(1);
    }
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // Avoid duplicate rows if the caller retries the same request.
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const ids = sheet.getRange(2, 9, lastRow - 1, 1).getDisplayValues().flat();
        if (ids.includes(String(body.attemptId))) return json({ ok: true, duplicate: true });
      }
      const detail = JSON.stringify(Array.isArray(body.answers) ? body.answers : []);
      sheet.appendRow([
        safeCell(body.submittedAt), safeCell(body.quizTitle), safeCell(body.firstName),
        safeCell(body.lastName), safeCell(body.studentId), Number(body.score || 0),
        Number(body.total || 0), Number(body.percentage || 0), String(body.attemptId || ''), detail
      ]);
    } finally {
      lock.releaseLock();
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}
function safeCell(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@\t\r]/.test(text) ? "'" + text : text;
}
function json(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
