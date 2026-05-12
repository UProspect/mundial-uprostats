// ══════════════════════════════════════════════════════════════════
// UProStats — Mundial 2026 · Google Apps Script
// ══════════════════════════════════════════════════════════════════

const SHEET_NAME = 'Predicciones';

const COLUMNS = [
  'Fecha','Nombre','Email','Género','Teléfono','Modo',
  'Campeón','Subcampeón','Tercer Lugar',
  'Grupos','Ronda 32','Octavos','Cuartos','Semis',
];

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) {
      sheet = ss.insertSheet(SHEET_NAME);
      sheet.appendRow(COLUMNS);
      const hdr = sheet.getRange(1, 1, 1, COLUMNS.length);
      hdr.setBackground('#001F3F');
      hdr.setFontColor('#ffffff');
      hdr.setFontWeight('bold');
      hdr.setFontSize(10);
      sheet.setFrozenRows(1);
    }

    // ── EMAIL DEDUP: only save first submission per email ──
    const lastRow = sheet.getLastRow();
    if (lastRow > 1 && data.email) {
      const emails = sheet.getRange(2, 3, lastRow - 1, 1).getValues().flat();
      if (emails.map(e => String(e).toLowerCase()).includes(data.email.toLowerCase())) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 'duplicate', message: 'Email ya registrado' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    const fecha = data.fecha
      ? new Date(data.fecha).toLocaleString('es-ES', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
      : new Date().toLocaleString('es-ES');

    sheet.appendRow([
      fecha,
      data.nombre     || '',
      data.email      || '',
      data.genero     || '',
      data.tel        || '',
      data.modo       || '',
      data.campeon    || '',
      data.subcampeon || '',
      data.tercer     || '',
      data.grupos     || '',
      data.r32        || '',
      data.r16        || '',
      data.cuartos    || '',
      data.semis      || '',
    ]);

    // Alternate row colors
    const newRow = sheet.getLastRow();
    if (newRow % 2 === 0) {
      sheet.getRange(newRow, 1, 1, COLUMNS.length).setBackground('#f8fafc');
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', row: newRow }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Run manually to test
function testInsert() {
  const testData = {
    postData: {
      contents: JSON.stringify({
        nombre: 'Juan Prueba', email: 'juan@test.com', genero: 'masculino',
        tel: '+1 555 000 0000', fecha: new Date().toISOString(), modo: 'ranking',
        campeon: 'Argentina', subcampeon: 'Brasil', tercer: 'Francia',
        grupos: 'Grupo A: México, Sudáfrica', r32: '', r16: '', cuartos: '', semis: '',
      })
    }
  };
  Logger.log(doPost(testData).getContent());
}
