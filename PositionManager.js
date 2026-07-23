/********************************************************************
 * PositionManager
 *
 * Aufgabe:
 *  - verarbeitet eingehende GPS-Daten
 *  - berechnet Entfernung zum aktuellen Ziel
 *  - ruft GeofenceManager auf
 *  - speichert ausgewählte Positionen
 *
 ********************************************************************/
class PositionManager {

  constructor(database,tourManager, geofenceManager, sheetManager) {

    this.db = database;
    this.tour = tourManager;
    this.geofence = geofenceManager;
    this.sheet = sheetManager;

  }

 /**
  * Hauptfunktion: wird bei jedem GPS-Update aufgerufen
  * bearbeitet : nach TourManger Änderungen 23.07.2026 13:17
* */
process(gpsData) {

  if (
    !gpsData ||
    !Util.isValidGPS(
      gpsData.latitude,
      gpsData.longitude
    )
  ) {

    return {
      ok: false,
      saved: false,
      reason: "INVALID_GPS"
    };

  }

  /*
   * 1. Aktuellen Tourstatus lesen.
   *
   * Der TourStatus ist die führende Quelle dafür,
   * welcher Halt momentan angefahren wird.
   */
  const statusBefore =
    this.db.getTourStatus(
      gpsData.fahrer,
      gpsData.tour
    );

  if (!statusBefore) {

    return {
      ok: false,
      saved: false,
      reason: "NO_TOUR_STATUS"
    };

  }

  const zielIDBefore =
    String(
      statusBefore.aktuellerStop || ""
    ).trim();

  if (!zielIDBefore) {

    return {
      ok: false,
      saved: false,
      reason: "NO_CURRENT_STOP"
    };

  }

  /*
   * 2. TourManager auf den gespeicherten Stand bringen.
   *
   * load() setzt den Index zunächst auf 0.
   * Deshalb muss anschließend der gespeicherte
   * StopIndex wiederhergestellt werden.
   */
  this.tour.load(gpsData.tour);

  if (statusBefore.stopIndex) {

    this.tour.setIndex(
      Number(statusBefore.stopIndex) - 1
    );

  }

  /*
   * Fahrplandaten des aktuell anstehenden Halts.
   */
  const tourStop =
    this.tour.nextStop();

  /*
   * Zielkoordinaten und Zielname aus Zielorte lesen.
   */
  const zielDataBefore =
    this.db.getZiel(zielIDBefore);

  if (!zielDataBefore) {

    return {
      ok: false,
      saved: false,
      reason: "TARGET_NOT_FOUND",
      zielID: zielIDBefore
    };

  }

  /*
   * Eindeutiges Zielobjekt für den Geofence.
   *
   * zielID   = Z044
   * zielName = Name der Haltestelle
   * ziel     = weiterhin die Ziel-ID, damit vorhandener
   *            Code kompatibel bleibt
   */
  const stop = {

    ...(tourStop || {}),
    ...(zielDataBefore || {}),

    ziel: zielIDBefore,
    zielID: zielIDBefore,

    zielName:
      zielDataBefore.zielName ||
      zielDataBefore.ziel ||
      zielIDBefore

  };

  /*
   * 3. Entfernung zum derzeit angefahrenen Ziel.
   */
  let dist = null;

  if (
    Number.isFinite(Number(stop.lat)) &&
    Number.isFinite(Number(stop.lng))
  ) {

    dist = Util.distance(
      gpsData.latitude,
      gpsData.longitude,
      Number(stop.lat),
      Number(stop.lng)
    );

  }

  /*
   * 4. Geofence bei jedem GPS-Punkt prüfen.
   */
  const geofenceEvent =
    this.geofence.check(
      gpsData.fahrer,
      gpsData.tour,
      gpsData,
      stop,
      this.tour
    ) || "";

  /*
   * ANKUNFT / ABFAHRT haben Vorrang.
   */
  const positionStatus =
    geofenceEvent ||
    gpsData.status ||
    "OK";

  /*
   * 5. Tourstatus nach der Geofence-Prüfung erneut lesen.
   *
   * Bei ABFAHRT kann der Geofence bereits auf den
   * nächsten Halt umgeschaltet haben.
   */
  const statusAfter =
    this.db.getTourStatus(
      gpsData.fahrer,
      gpsData.tour
    );

  const zielIDAfter =
    statusAfter &&
    statusAfter.aktuellerStop
      ? String(statusAfter.aktuellerStop).trim()
      : zielIDBefore;

  /*
   * Die gespeicherte Position soll zur aktuell
   * nächsten Haltestelle gehören.
   */
  let saveDistance = dist;

  if (
    zielIDAfter &&
    zielIDAfter !== zielIDBefore
  ) {

    const zielDataAfter =
      this.db.getZiel(zielIDAfter);

    if (
      zielDataAfter &&
      Number.isFinite(Number(zielDataAfter.lat)) &&
      Number.isFinite(Number(zielDataAfter.lng))
    ) {

      saveDistance = Util.distance(
        gpsData.latitude,
        gpsData.longitude,
        Number(zielDataAfter.lat),
        Number(zielDataAfter.lng)
      );

    }

  }

  /*
   * 6. Entscheiden, ob der GPS-Punkt gespeichert wird.
   */
  const saveDecision =
    this.shouldSavePosition(
      gpsData,
      positionStatus
    );

  if (saveDecision.save) {

    this.sheet.savePosition({

      fahrer: gpsData.fahrer,
      tour: gpsData.tour,

      // Eindeutig: Hier steht immer eine Ziel-ID wie Z044.
      zielID: zielIDAfter,

      latitude: gpsData.latitude,
      longitude: gpsData.longitude,
      accuracy: gpsData.accuracy,
      speed: gpsData.speed,
      altitude: gpsData.altitude,
      heading: gpsData.heading,

      entfernung: saveDistance,
      status: positionStatus

    });

    this.rememberSavedPosition(
      gpsData,
      positionStatus
    );

  }

  return {

    ok: true,
    saved: saveDecision.save,
    reason: saveDecision.reason,

    geofenceEvent: geofenceEvent,

    zielID: zielIDAfter,
    entfernung: saveDistance

  };

}
  /**
   * Entscheidet, ob eine Position gespeichert werden soll.
   */
  shouldSavePosition(gpsData, status) {

    const last = this.getLastSavedPosition(
      gpsData.fahrer,
      gpsData.tour
    );

    // Erster GPS-Punkt wird immer gespeichert
    if (!last) {

      return {
        save: true,
        reason: "FIRST_POSITION"
      };

    }

    const now = Date.now();

    const elapsed =
      now - Number(last.time || 0);

    // Entfernung seit der letzten gespeicherten Position
    const movedDistance = Util.distance(
      Number(last.latitude),
      Number(last.longitude),
      gpsData.latitude,
      gpsData.longitude
    );

    const currentSpeed =
      Number(gpsData.speed || 0);

    const currentMoving =
      currentSpeed >= CONFIG.GPS.MOVING_SPEED;

    const previousMoving =
      Boolean(last.moving);

    // Statusänderung, z. B. ANKUNFT oder ABFAHRT
    if (
      status === "ANKUNFT" ||
      status === "ABFAHRT" ||
      status !== last.status
    ) {

      return {
        save: true,
        reason: "STATUS_CHANGED"
      };

    }

    // Wechsel zwischen Stillstand und Fahrt
    if (currentMoving !== previousMoving) {

      return {
        save: true,
        reason: "MOVEMENT_CHANGED"
      };

    }

    // Ausreichende Strecke zurückgelegt
    if (
      movedDistance >= CONFIG.GPS.SAVE_DISTANCE
    ) {

      return {
        save: true,
        reason: "DISTANCE"
      };

    }

    // Maximale Zeit seit letzter Speicherung erreicht
    if (
      elapsed >= CONFIG.GPS.SAVE_INTERVAL
    ) {

      return {
        save: true,
        reason: "TIME"
      };

    }

    return {
      save: false,
      reason: "SKIPPED"
    };

  }

  /**
   * Schlüssel für den GPS-Zwischenspeicher.
   */
  getPositionCacheKey(fahrer, tour) {

    return (
      "GPS_" +
      String(fahrer).trim() +
      "_" +
      String(tour).trim()
    );

  }

  /**
   * Zuletzt gespeicherte Position lesen.
   */
  getLastSavedPosition(fahrer, tour) {

    const cache = CacheService.getScriptCache();

    const value = cache.get(
      this.getPositionCacheKey(fahrer, tour)
    );

    if (!value) {
      return null;
    }

    try {

      return JSON.parse(value);

    } catch (error) {

      return null;

    }

  }

  /**
   * Gespeicherte Position für die nächste Prüfung merken.
   */
  rememberSavedPosition(gpsData, status) {

    const speed = Number(gpsData.speed || 0);

    const data = {

      time: Date.now(),

      latitude: gpsData.latitude,
      longitude: gpsData.longitude,

      speed: speed,

      moving:
        speed >= CONFIG.GPS.MOVING_SPEED,

      status: status

    };

    const cache = CacheService.getScriptCache();

    /*
     * Cache bleibt maximal sechs Stunden erhalten.
     * Falls er früher gelöscht wird, wird einfach der nächste
     * GPS-Punkt wieder gespeichert.
     */
    cache.put(
      this.getPositionCacheKey(
        gpsData.fahrer,
        gpsData.tour
      ),
      JSON.stringify(data),
      21600
    );

  }

}