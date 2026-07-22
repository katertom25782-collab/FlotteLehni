/**
 * ==========================================================
 * Database.gs
 *  Liest Daten aus Google Sheets
 *  Liefert fachliche Objekte zurück
 *  schreibt niemals Daten
 * ==========================================================
*/
class Database {

  constructor() {

    this.ss = CONFIG.USE_ACTIVE_SHEET
      ? SpreadsheetApp.getActiveSpreadsheet()
      : SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  }
 
  /**
   * Tabellenblatt holen
   */
  sheet(name) {
    const sheet = this.ss.getSheetByName(name);

    if (!sheet) {
      throw new Error("Tabellenblatt '" + name + "' wurde nicht gefunden.");
    }

    return sheet;
  }

  /**
   * Komplette Tabelle lesen
   */
  read(sheetName) {

    return this.sheet(sheetName)
      .getDataRange()
      .getValues();

  }

  /**
  * Fahrer laden
  */
  getFahrer() {

    const data = this.read(CONFIG.SHEETS.FAHRER);

    data.shift(); // Header entfernen 

    return data
      .filter(r => String(r[2]).trim().toLowerCase() === "ja")
      .map(r => ({
       id: String(r[0]).trim(),
       name: String(r[1]).trim()
      }))
      .filter(f => f.id !== "" && f.name !== "");
  }
  /**
   * Touren aus FTable laden
   */
  getTouren() {
    const ftableRows = this.read(CONFIG.SHEETS.TOUR);

    if (!ftableRows || ftableRows.length < 2) {
      return [];
    }

    ftableRows.shift();

    const vorhandeneTourIds = [
      ...new Set(
        ftableRows
          .map(row => String(row[0] || "").trim())
          .filter(Boolean)
      )
    ];

    const tourNamen = this.getTourNamen();

    return vorhandeneTourIds.map(tourId => {
      const eintrag = tourNamen.find(t => t.tourId === tourId);

      return {
        tourId: tourId,
        tourName: eintrag
          ? eintrag.tourName
          : tourId
      };
    });
  }
  getTourNamen() {
    const rows = this.read(CONFIG.SHEETS.TOURNAMEN);

    if (!rows || rows.length < 2) {
      return [];
    }

    rows.shift(); // Kopfzeile entfernen

    return rows
      .filter(row => row[0] && row[1])
      .map(row => ({
        tourId: String(row[0]).trim(),
        tourName: String(row[1]).trim()
      }));
  }
  /**
   * Tour laden mit Daten aus aus FTable und Fahrplan
   */
  getTour(tourName) {

    const data = this.read(CONFIG.SHEETS.TOUR);
    const ziele = this.getZieleMap();

    data.shift();

    return data
      .filter(r => String(r[0]).trim() === String(tourName).trim())
      .sort((a, b) => Number(a[1]) - Number(b[1]))
      .map(r => {

        const zielID = String(r[2]).trim();
        const ziel = ziele[zielID];

        if (!ziel) {
          throw new Error("Ziel '" + zielID + "' wurde in Fahrplandaten nicht gefunden.");
        }

        return {

          // ===== Tourdaten (FTable) =====
          tour: String(r[0]).trim(),
          reihenfolge: Number(r[1]),

          // Übergangsphase
          ziel: zielID,                 // bisheriger Feldname (enthält die ZielID)

          // neuer, eindeutiger Feldname
          zielID: zielID,

          sollzeit: r[3],
          info: String(r[4] || "").trim(),

          // ===== Stammdaten (ZIELE) =====
          zielName: ziel.zielName,
          lat: ziel.lat,
          lng: ziel.lng,
          radius: ziel.radius,

          // optional für spätere Verwendung
          zielInfo: ziel.info

        };

      });
  }


  /**
   * Zielinformationen laden
   */
  getZiel(zielID) {

  const data = this.read(CONFIG.SHEETS.ZIELE);

  data.shift();

  const row = data.find(r =>
    String(r[0]).trim() === String(zielID).trim()
  );

  if (!row) return null;

  return {

    zielID: String(row[0]).trim(),
    ziel: String(row[1]).trim(),
    lat: Number(row[2]),
    lng: Number(row[3]),
    radius: Number(row[4]),
    info: String(row[5] || "").trim()

  };

  }
  /**
   * Alle Ziele einmal laden und nach ZielID indizieren
   */
  getZieleMap() {

    const data = this.read(CONFIG.SHEETS.ZIELE);
    data.shift();

    const ziele = {};

    data.forEach(row => {

      const zielID = String(row[0]).trim();

      ziele[zielID] = {

        zielID: zielID,

        // alter Name (Kompatibilität)
        ziel: String(row[1] || "").trim(),

        // neuer Name
        zielName: String(row[1] || "").trim(),

        lat: Number(row[2]),
        lng: Number(row[3]),
        radius: Number(row[4]),

        // Haltestellen-Info
        info: String(row[5] || "").trim()

      };

    });

    return ziele;

  }

  /********************************
   * Buchungsmatrix laden
   * Buchungsarten und Preise laden
  */
  getBuchungen() {

    const data = this.read(
      CONFIG.SHEETS.BUCHUNGEN
    );

    data.shift(); // Überschrift entfernen

    return data
      .filter(function(row) {

        return String(row[0] || "").trim() !== "";

      })
      .map(function(row) {

        return {

          id: Number(row[0]),

          bezeichnung:
            String(row[1] || "").trim(),

          preisklasse:
            Number(row[2] || 0),

          preisAdult:
            Number(row[3] || 0),

          preisChild:
            Number(row[4] || 0)

        };

      });

  }


}