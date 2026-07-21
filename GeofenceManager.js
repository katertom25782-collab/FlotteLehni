/********************************************************************
 * GeofenceManager
 *
 * Aufgabe:
 *  - prüft Eintritt in den Zielradius
 *  - schreibt ANKUNFT / ABFAHRT
 *  - aktiviert den nächsten Stop
 *
 ********************************************************************/
class GeofenceManager {

  constructor(sheetManager) {

    this.sheet = sheetManager;

  }

  /**
   * Prüft Eintritt / Austritt des Zielradius
   */
  check(fahrer, tour, gps, ziel, tourManager) {

    if (!ziel) {
      return "";
    }

    // Mehrfachaufrufe verhindern
    const lock = LockService.getScriptLock();

    if (!lock.tryLock(5000)) {
      return "";
    }

    try {

      const inside = Util.inRadius(
        gps.latitude,
        gps.longitude,
        ziel.lat,
        ziel.lng,
        ziel.radius
      );

      // Tourstatus IMMER nach Erhalt des Locks lesen
      const status = this.sheet.getTourStatus(fahrer, tour);

      const statusText = status
        ? String(status.status || "").trim()
        : "";

      // Manuelle Ankunft sperrt automatische Verarbeitung
      if (statusText === "IM_ZIEL_MANUELL") {
        return "";
      }

      const previousInside =
        statusText === "IM_ZIEL";

      // Eintritt
      if (!previousInside && inside) {

        this.onEntry(
          fahrer,
          tour,
          ziel
        );

        return "ANKUNFT";

      }

      // Austritt
      if (previousInside && !inside) {

        return this.onExit(
          fahrer,
          tour,
          ziel,
          tourManager
        ) || "ABFAHRT";

      }

      return "";

    } finally {

      lock.releaseLock();

    }

  }

  /**
   * Fahrzeug erreicht Haltestelle
   */
  onEntry(fahrer, tour, ziel) {

    this.sheet.saveLog(
      "ANKUNFT",
      fahrer,
      tour,
      ziel.zielID,
      "Haltestelle erreicht: " + ziel.zielName
    );

    this.sheet.saveTourStatus({
      fahrer: fahrer,
      tour: tour,
      status: "IM_ZIEL"
    });

  }

  /**
   * Fahrzeug verlässt Haltestelle
   */
  onExit(fahrer, tour, ziel, tourManager) {

    this.sheet.saveLog(
      "ABFAHRT",
      fahrer,
      tour,
      ziel.zielID,
      "Haltestelle verlassen: " + ziel.zielName
    );

    const nextStop = tourManager.nextStop();
    const progress = tourManager.progress();

    // Letzte Haltestelle erreicht
    if (!nextStop) {

      this.sheet.saveTourStatus({
        fahrer: fahrer,
        tour: tour,
        status: "TOURENDE_ERREICHT",
        aktuellerStop: ziel.zielID,
        stopIndex: progress.current,
        gesamtStops: progress.total,
        fortschritt: 100
      });

      this.sheet.saveLog(
        "TOURENDE",
        fahrer,
        tour,
        ziel.zielID,
        "Letzte Haltestelle verlassen"
      );

      return "TOURENDE";

    }

    this.sheet.saveTourStatus({

      fahrer: fahrer,
      tour: tour,

      status: "Aktiv",

      aktuellerStop: nextStop.ziel,

      stopIndex: progress.current,
      gesamtStops: progress.total,
      fortschritt: progress.percent

    });

    return "ABFAHRT";

  }

}