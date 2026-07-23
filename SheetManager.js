/***********************************
 * SheetManager.gs 
 *  
 * schreibt Daten
 * aktualisiert Daten
 * darf intern lesen, wenn es zum Schreiben notwendig ist
 * liefert keine fachlichen
 * Daten an andere Klassen
*/

class SheetManager {

  constructor(database) {
    this.db = database;
  }


  /**
   * Generische Append-Funktion
   */
  append(sheetName, values) {

    const sheet = this.db.sheet(sheetName);

    sheet.appendRow(values);

  }

  /**
   * Position speichern
   */
  savePosition(data) {

    this.append(CONFIG.SHEETS.POSITIONEN, [
      new Date(),
      data.fahrer,
      data.tour,
      data.zielID || "",
      data.latitude,
      data.longitude,
      data.accuracy || "",
      data.speed || "",
      data.altitude || "",
      data.heading || "",
      data.entfernung || "",
      data.status || ""
    ]);

  }

  /**
   * Log speichern
   */
  saveLog(type, fahrer, tour, ziel, message = "") {

    this.append(CONFIG.SHEETS.LOG, [
      new Date(),
      type,
      fahrer,
      tour,
      ziel,
      message
    ]);

  }

/**
 * Tourstatus-Zeile suchen
 */
findTourStatusRow(fahrer, tour) {

  const sheet = this.db.sheet(CONFIG.SHEETS.TOURSTATUS);
  const data = sheet.getDataRange().getValues();

  for (let i = data.length - 1; i >= 1; i--) {

    if (
      String(data[i][0]).trim() === String(fahrer).trim() &&
      String(data[i][1]).trim() === String(tour).trim() &&
      String(data[i][2]).trim() !== "Beendet"
    ) {
      return i + 1;
    }

  }

  return null;

}
/**
 * Tourstatus speichern / aktualisieren
 */
saveTourStatus(data) {

console.log("saveTourStatus DATA", JSON.stringify(data));

  const sheet = this.db.sheet(CONFIG.SHEETS.TOURSTATUS);

  const row = this.findTourStatusRow(data.fahrer, data.tour);

  const now = new Date();

  if (!row) {

    sheet.appendRow([
      data.fahrer,
      data.tour,
      data.status || "Aktiv",
      data.startzeit || now,
      data.endzeit || "",
      data.aktuellerStop || "",
      data.stopIndex || 1,
      data.gesamtStops || 0,
      data.fortschritt || 0,
      data.latitude || "",
      data.longitude || "",
      data.speed || "",
      data.altitude || "",
      data.heading || "",
      now
    ]);

    return;
  }

  // vorhandene Zeile aktualisieren, aber alte Werte behalten
  const old = sheet.getRange(row, 1, 1, 15).getValues()[0];

  const values = [
    data.fahrer || old[0],
    data.tour || old[1],
    data.status || old[2],
    data.startzeit || old[3],
    data.endzeit || old[4],
    data.aktuellerStop || old[5],
    data.stopIndex || old[6],
    data.gesamtStops || old[7],
    data.fortschritt !== undefined ? data.fortschritt : old[8],
    data.latitude || old[9],
    data.longitude || old[10],
    data.speed || old[11],
    data.altitude || old[12],
    data.heading || old[13],
    now
  ];

  sheet.getRange(row, 1, 1, 15).setValues([values]);

}
/**
 * Fahrgastbuchungen speichern
 */
saveBookings(data) {

  const sheet =
    this.db.sheet(CONFIG.SHEETS.BUCHUNGANZ);

  const bookings =
    Array.isArray(data.bookings)
      ? data.bookings
      : [];

  const rows = [];

  bookings.forEach(function(item) {

    const erwachsen =
      Number(item.erwachsen || 0);

    const kind =
      Number(item.kind || 0);

    if (erwachsen <= 0 && kind <= 0) {
      return;
    }

    rows.push([
      data.fahrer,
      data.tour,
      data.zielID,
      Number(data.stopIndex || 0),
      Number(item.id),
      erwachsen,
      kind,
      new Date()
    ]);

  });

  if (rows.length === 0) {
    return 0;
  }

  const firstRow =
    sheet.getLastRow() + 1;

  sheet
    .getRange(
      firstRow,
      1,
      rows.length,
      8
    )
    .setValues(rows);

  return rows.length;

}

}
