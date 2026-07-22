/**
 * =====================================================
 * Code.gs
 * Einstiegspunkt der Web-App
 * GPS Tour App V1.0
 * =====================================================
 */

let db;
let tourManager;
let geofence;
let sheetManager;
let positionManager;


function doGet() {

  return HtmlService
    .createTemplateFromFile("Index")
    .evaluate()
    .setTitle("GPS Tour App Flotte Lehni")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

}

/**
 * HTML-Dateien einbinden
 */
function include(filename) {

  return HtmlService
    .createHtmlOutputFromFile(filename)
    .getContent();

}

/**
 * Initialisierung (wird bei jedem Request genutzt)
 */
function init() {

  database = new Database();
  sheetManager = new SheetManager(database);
  tourManager = new TourManager(database);
  geofenceManager = new GeofenceManager(sheetManager);

  positionManager = new PositionManager(
    tourManager,
    geofenceManager,
    sheetManager
  );

}
/**
 * fülle den Dropdown Haltestelle
 */
function getTourStops(tour) {

  init();

  const stops = database.getTour(tour);

  return stops.map(stop => {

    let sollzeit = "";

    if (stop.sollzeit instanceof Date) {

      sollzeit = Utilities.formatDate(
        stop.sollzeit,
        Session.getScriptTimeZone(),
        "HH:mm"
      );

    } else if (stop.sollzeit) {

      sollzeit = String(stop.sollzeit);

    }

    return {
      reihenfolge: stop.reihenfolge,
      zielID: stop.zielID,
      zielName: stop.zielName || "Unbekannte Haltestelle",
      sollzeit: sollzeit
    };

  });

}
/**
 * 🚀 Tour starten
 */
function startTour(fahrer, tour, startIndex) {

  init();

  tourManager.load(tour);

  startIndex = Number(startIndex || 1);
  tourManager.setIndex(startIndex - 1);

  const currentStop = tourManager.nextStop();
  const progress = tourManager.progress();
  const totalStops = tourManager.stops ? tourManager.stops.length : 0;



  sheetManager.saveTourStatus({
    fahrer: fahrer,
    tour: tour,
    status: "Aktiv",
    startzeit: new Date(),
    endzeit: "",
    aktuellerStop: currentStop ? currentStop.ziel : "",
    stopIndex: progress.current,
    gesamtStops: totalStops,
    fortschritt: progress.percent,
    latitude: "",
    longitude: "",
    speed: "",
    altitude: "",
    heading: ""
  });

  sheetManager.saveLog(
    "START",
    fahrer,
    tour,
    "",
    "Tour gestartet"
  );
   return {
    ok: true,
    tour: tour,
    firstStop: currentStop ? {
        tour: currentStop.tour,
        reihenfolge: currentStop.reihenfolge,
        ziel: currentStop.ziel,
        sollzeit: currentStop.sollzeit ? String(currentStop.sollzeit) : "",
        info: currentStop.info || ""
      } : null
    };
}

/**
 * 📍 GPS Daten empfangen
 */
function sendGPS(data) {

  if (!data) {
    throw new Error("sendGPS wurde ohne GPS-Daten aufgerufen.");
  }
  if (data.latitude === undefined || data.longitude === undefined
  ) {
    throw new Error(
      "GPS-Daten unvollständig: latitude/longitude fehlen."
    );
  }

   init();

  const status = sheetManager.getTourStatus(data.fahrer, data.tour);

  tourManager.load(data.tour);

  if (status && status.stopIndex) {
    tourManager.setIndex(Number(status.stopIndex) - 1);
  }

  return positionManager.process(data);

}

/***********************************************
 * 📊 Status der Tour abrufen
 */
function getStatus(fahrer, tour) {

  try {

    init();

    const status =
      sheetManager.getTourStatus(fahrer, tour);

    tourManager.load(tour);

    if (status && status.stopIndex) {
      tourManager.setIndex(
        Number(status.stopIndex) - 1
      );
    }

    const stop =
      tourManager.nextStop();

    const progress =
      tourManager.progress();

    const ziel =
      stop
        ? database.getZiel(stop.ziel)
        : null;

    return {
      ok: true,
      tour: tour,

      tourStatus: status
        ? String(status.status || "").trim()
        : "",

      stopCount:
        tourManager.stops.length,

      currentStop: stop ? {
        tour: stop.tour,
        reihenfolge: stop.reihenfolge,
        zielID: stop.ziel,

        sollzeit: stop.sollzeit
          ? Utilities.formatDate(
              new Date(stop.sollzeit),
              Session.getScriptTimeZone(),
              "HH:mm"
            )
          : "",

        info:
          stop.info || "",

        zielName:
          ziel
            ? ziel.ziel
            : "",

        istLetzterStop:
          tourManager.isFinished()

      } : null,

      progress: progress
    };

  } catch (err) {

    console.log(
      "getStatus FEHLER",
      err.message
    );

    return {
      ok: false,
      error: err.message
    };

  }

}

/**
 * 🧭 komplette Tour laden (für UI)
 */
function getTourData(tour) {

  init();

  return tourManager.stops;

}
/** 
 * Prüfe ob Faherer noch eine Tour offen hat
 */
function getActiveTourForFahrer(fahrer) {
  init();
  return sheetManager.getActiveTourForFahrer(fahrer);
}
function getFahrer() {
  const db = new Database();
  return db.getFahrer();
}

function getTouren() {
  const db = new Database();
  return db.getTouren();
}


function getZiel(name) {
  init();
  return database.getZiel(name);
}

/**
 * Toure und beenden
 */
function finishTour(fahrer, tour) {

  init();

  const stop = tourManager.nextStop();
  const progress = tourManager.progress();
  const totalStops = tourManager.stops ? tourManager.stops.length : 0;

  sheetManager.saveLog(
    "ENDE",
    fahrer,
    tour,
    stop ? stop.ziel : "",
    "Tour abgeschlossen"
  );

  sheetManager.saveTourStatus({

    fahrer: fahrer,
    tour: tour,
    status: "Beendet",
    startzeit: "",
    endzeit: new Date(),
    aktuellerStop: stop ? stop.ziel : "",
    stopIndex: progress ? progress.current : 0,
    gesamtStops: totalStops,
    fortschritt: progress ? progress.percent : 100,
    latitude: "",
    longitude: "",
    speed: "",
    altitude: "",
    heading: ""

  });

  return {
    ok: true,
    message: "Tour erfolgreich beendet"
  };

}
/**************************************
 * Hilfsfunktion um Werte aus Config.gs zuholen.
 */
function getConfig() {

  return {
    gps: {
      interval: CONFIG.GPS.INTERVAL,
      highAccuracy: CONFIG.GPS.HIGH_ACCURACY,
      timeout: CONFIG.GPS.TIMEOUT,
      maximumAge: CONFIG.GPS.MAXIMUM_AGE
    }
  };

}
/**************************************
 * Bearbeite den Ankunft Manueller IM_ZIEL Prozess
 */
function confirmManualArrival(fahrer, tour) {

  init();

  const status = sheetManager.getTourStatus(fahrer, tour);

  tourManager.load(tour);

  if (status && status.stopIndex) {
    tourManager.setIndex(Number(status.stopIndex) - 1);
  }

  const stop = tourManager.nextStop();

  if (!stop) {
    throw new Error("Kein aktueller Stop vorhanden.");
  }

  const ziel = database.getZiel(stop.ziel);

  sheetManager.saveLog(
    "ANKUNFT_MANUELL",
    fahrer,
    tour,
    stop.ziel,
    "Ankunft manuell bestätigt: " +
      (ziel ? ziel.ziel : stop.ziel)
  );

  sheetManager.saveTourStatus({
    fahrer: fahrer,
    tour: tour,
    status: "IM_ZIEL_MANUELL",
    aktuellerStop: stop.ziel,
    stopIndex: tourManager.progress().current,
    gesamtStops: tourManager.progress().total,
    fortschritt: tourManager.progress().percent
  });

  return {
    ok: true,
    status: "IM_ZIEL_MANUELL",
    currentStop: {
      zielID: stop.ziel,
      stopIndex: tourManager.progress().current,
      info: stop.info || ""
  }};
  
}
/**********************************+
 * Gemeinsame Weiterfahrt für manuellen und automatischen Modus
 *
 * mode:
 *   "MANUELL"
 *   "AUTO"
 */
function confirmDeparture(fahrer, tour, mode) {

  init();

  const departureMode =
    String(mode || "MANUELL")
      .trim()
      .toUpperCase();

  const isAuto =
    departureMode === "AUTO";

  // Aktuellen Tourstatus lesen
  const status =
    sheetManager.getTourStatus(
      fahrer,
      tour
    );

  // Tour laden
  tourManager.load(tour);

  // Gespeicherten StopIndex wiederherstellen
  if (status && status.stopIndex) {

    tourManager.setIndex(
      Number(status.stopIndex) - 1
    );

  }

  // Bisherigen Stop holen
  const oldStop =
    tourManager.nextStop();

  if (!oldStop) {
    throw new Error(
      "Kein aktueller Stop vorhanden."
    );
  }

  const oldZiel =
    database.getZiel(oldStop.ziel);

  const oldZielName =
    oldZiel && oldZiel.ziel
      ? oldZiel.ziel
      : oldStop.ziel;

  /*
   * Nur die manuelle Abfahrt wird hier protokolliert.
   *
   * Die automatische Abfahrt wurde bereits beim
   * Geofence-Ereignis als ABFAHRT protokolliert.
   */
  if (!isAuto) {

    sheetManager.saveLog(
      "ABFAHRT_MANUELL",
      fahrer,
      tour,
      oldStop.ziel,
      "Haltestelle manuell verlassen: " +
        oldZielName
    );

  }

  // Zum nächsten Stop wechseln
  const nextStop =
    tourManager.advanceToNextStop();

  const progress =
    tourManager.progress();

  /**
   * Kein weiterer Stop vorhanden:
   * Tourende wurde erreicht.
   */
  if (!nextStop) {

    sheetManager.saveTourStatus({
      fahrer: fahrer,
      tour: tour,
      status: "TOURENDE_ERREICHT",
      aktuellerStop: oldStop.ziel,
      stopIndex: progress.current,
      gesamtStops: progress.total,
      fortschritt: 100
    });

    sheetManager.saveLog(
      "TOURENDE",
      fahrer,
      tour,
      oldStop.ziel,
      isAuto
        ? "Letzte Haltestelle automatisch verlassen"
        : "Letzte Haltestelle manuell verlassen"
    );

    return {
      ok: true,
      tourEnd: true,
      mode: departureMode,
      message:
        "Die letzte Haltestelle wurde verlassen. " +
        "Die Tour wird jetzt beendet."
    };

  }

  // Daten des nächsten Zieles laden
  const nextZiel =
    database.getZiel(nextStop.ziel);

  // Tourstatus auf nächsten Stop aktualisieren
  sheetManager.saveTourStatus({
    fahrer: fahrer,
    tour: tour,
    status: "Aktiv",
    aktuellerStop: nextStop.ziel,
    stopIndex: progress.current,
    gesamtStops: progress.total,
    fortschritt: progress.percent
  });

  // Sauberes Browser-Objekt zurückgeben
  return {
    ok: true,
    tourEnd: false,
    mode: departureMode,

    currentStop: {
      tour: nextStop.tour,
      reihenfolge: nextStop.reihenfolge,
      zielID: nextStop.ziel,

      zielName:
        nextZiel
          ? nextZiel.ziel
          : "",

      sollzeit:
        nextStop.sollzeit
          ? Utilities.formatDate(
              new Date(nextStop.sollzeit),
              Session.getScriptTimeZone(),
              "HH:mm"
            )
          : "",

      info:
        nextStop.info || "",

      istLetzterStop:
        tourManager.isFinished()
    },

    progress: progress
  };


}


/**
 * Bestehender Aufruf für die manuelle Weiterfahrt
 */
function confirmManualDeparture(fahrer, tour) {

  return confirmDeparture(
    fahrer,
    tour,
    "MANUELL"
  );

}

/**
 * Automatische Weiterfahrt nach Geofence-Abfahrt
 */
function confirmAutoDeparture(fahrer, tour) {

  return confirmDeparture(
    fahrer,
    tour,
    "AUTO"
  );

}



function getBookingRows() {

  init();

  return {   
    filterEnabled: CONFIG.BOOKING.FILTER_ENABLED,
    rows: database.getBuchungen()
  }
}

/**
 * Fahrgastbuchungen einer Haltestelle speichern
 */
function saveBookings( fahrer, tour, zielID, stopIndex, bookings ) {

  init();

  if (!tour) {
    throw new Error("Tour fehlt.");
  }

  if (!zielID) {
    throw new Error("ZielID fehlt.");
  }

  if (!Array.isArray(bookings)) {
    throw new Error("Buchungsdaten fehlen.");
  }

  const savedRows =
    sheetManager.saveBookings({
      fahrer: fahrer,
      tour: tour,
      zielID: zielID,
      stopIndex: Number(stopIndex || 0),
      bookings: bookings
    });

  return {
     ok: true,
     savedRows: savedRows
    };

  }

/****************************************
 * Buchungszusammenfassung erstellen
 *
 * mode:
 *   "TOUR" = aktuelle Tour des heutigen Tages
 *   "DAY"  = alle Touren des Fahrers heute
 */
  function getBookingSummary( fahrer, tour, mode ) {

  init();

  const sheet =
    database.sheet(
      CONFIG.SHEETS.BUCHUNGANZ
    );

  const rows =
    sheet.getDataRange().getValues();

  const bookingTypes =
    database.getBuchungen();

  /*
   * Buchungsarten nach ID indizieren.
   *
   * Beispiel:
   * bookingMap[120]
   */
  const bookingMap = {};

  bookingTypes.forEach(function(item) {

    bookingMap[Number(item.id)] = item;

  });

  const timezone =
    Session.getScriptTimeZone();

  const today =
    Utilities.formatDate(
      new Date(),
      timezone,
      "yyyy-MM-dd"
    );

  let totalAdult = 0;
  let totalChild = 0;
  let totalAmount = 0;

  const details = {};

  /*
   * Erwartete Struktur BuchungAnz:
   *
   * 0 Fahrer
   * 1 Tour
   * 2 ZielID
   * 3 StopIndex
   * 4 BuchungsID
   * 5 Erwachsen
   * 6 Kind
   * 7 Zeitstempel
   */
  for (let i = 1; i < rows.length; i++) {

    const row = rows[i];

    const rowFahrer =
      String(row[0] || "").trim();

    const rowTour =
      String(row[1] || "").trim();

    const bookingId =
      Number(row[4] || 0);

    const adult =
      Number(row[5] || 0);

    const child =
      Number(row[6] || 0);

    const timestamp =
      row[7];

    /*
     * Nur Buchungen des aktuellen Fahrers.
     */
    if (
      rowFahrer !== String(fahrer).trim()
    ) {
      continue;
    }

    /*
     * Ein gültiger Zeitstempel muss vorhanden sein.
     */
    if (!(timestamp instanceof Date)) {
      continue;
    }

    const rowDate =
      Utilities.formatDate(
        timestamp,
        timezone,
        "yyyy-MM-dd"
      );

    /*
     * Immer nur heutige Buchungen berücksichtigen.
     */
    if (rowDate !== today) {
      continue;
    }

    /*
     * Bei Tour-Summary zusätzlich
     * die Tournummer prüfen.
     */
    if (
      mode === "TOUR" &&
      rowTour !== String(tour).trim()
    ) {
      continue;
    }

    const bookingType =
      bookingMap[bookingId];

    /*
     * Unbekannte Buchungs-ID überspringen.
     */
    if (!bookingType) {
      continue;
    }

    const adultAmount =
      adult *
      Number(bookingType.preisAdult || 0);

    const childAmount =
      child *
      Number(bookingType.preisChild || 0);

    const amount =
      adultAmount + childAmount;

    totalAdult += adult;
    totalChild += child;
    totalAmount += amount;

    /*
     * Details nach Buchungs-ID sammeln.
     */
    if (!details[bookingId]) {

      details[bookingId] = {

        id: bookingId,

        bezeichnung:
          bookingType.bezeichnung,

        adult: 0,
        child: 0,
        amount: 0

      };

    }

    details[bookingId].adult += adult;
    details[bookingId].child += child;
    details[bookingId].amount += amount;

  }

  return {

    ok: true,

    mode: mode,

    fahrer: fahrer,
    tour: tour,

    adult: totalAdult,
    child: totalChild,

    amount: totalAmount,

    details:
      Object.values(details)

  };

} 

/************************************
 * Haltestellen aus wahl für freise Strecke
 */ 
function getNearestBookingStop(fahrer, tour, latitude, longitude) {

  init();

  // GPS prüfen
  if (
    latitude === undefined ||
    longitude === undefined ||
    isNaN(Number(latitude)) ||
    isNaN(Number(longitude))
  ) {
    throw new Error("Keine gültige GPS-Position vorhanden.");
  }

  // Tour laden
  tourManager.load(tour);

  // Aktuellen Status wiederherstellen
  const status = sheetManager.getTourStatus(fahrer, tour);

  if (status && status.stopIndex) {
    tourManager.index = Math.max(0, Number(status.stopIndex) - 1);
  }

  // Kandidaten
  const currentStop = tourManager.currentStop();
  const previousStop = tourManager.previousStop();

  const candidates = [];

  addCandidate(previousStop);
  addCandidate(currentStop);

  if (candidates.length === 0) {
    throw new Error("Keine Haltestelle gefunden.");
  }

  // Nächste Haltestelle bestimmen
  candidates.sort(function(a, b) {
    return a.distance - b.distance;
  });

  const nearest = candidates[0];

  return {

    ok: true,

    stopData: {

      tour: nearest.stop.tour,
      reihenfolge: nearest.stop.reihenfolge,

      zielID: nearest.ziel.zielID,
      zielName: nearest.ziel.ziel,

      sollzeit: nearest.stop.sollzeit,

      info: "ALLE",

      istLetzterStop: false,
      buchungsModus: "MANUELLE_BUCHUNG"

    },

    entfernung: Math.round(nearest.distance),

    vergleich: candidates.map(function(c) {

      return {

        zielID: c.ziel.zielID,
        zielName: c.ziel.ziel,
        reihenfolge: c.stop.reihenfolge,
        entfernung: Math.round(c.distance)

      };

    })

  };


  // -------------------------------------------------
  // Hilfsfunktion
  // -------------------------------------------------

  function addCandidate(stop) {

    if (!stop) return;

    const ziel = db.getZiel(stop.ziel);

    if (!ziel) return;

    candidates.push({

      stop: stop,
      ziel: ziel,

      distance: Util.distance(

        Number(latitude),
        Number(longitude),

        Number(ziel.lat),
        Number(ziel.lng)

      )

    });

  }

}




/*******************************************************
 * Test Funtionen
 */

function testGetStatus() {
  const result = getStatus("F001", "N001");
  Logger.log(JSON.stringify(result, null, 2));
}
function testGetTour() {
  init();

  const stops = db.getTour("N001");

  Logger.log(JSON.stringify(stops, null, 2));
  Logger.log("Anzahl Stops: " + stops.length);
}

function testGetZiel() {

  const ziel = getZiel("Z001");

  Logger.log(JSON.stringify(ziel, null, 2));

}