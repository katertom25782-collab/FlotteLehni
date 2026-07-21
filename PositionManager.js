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

  constructor(tourManager, geofenceManager, sheetManager) {

    
    this.tour = tourManager;
    this.geofence = geofenceManager;
    this.sheet = sheetManager;

  }

 /**
  * Hauptfunktion: wird bei jedem GPS-Update aufgerufen
  */
 process(gpsData) {

    if (
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

    // 1. Nächsten anzufahrenden Stop holen
    const stop = this.tour.nextStop();

    // 2. Entfernung zum nächsten Stop berechnen
    let dist = null;

    if (stop) {

      dist = Util.distance(
        gpsData.latitude,
        gpsData.longitude,
        stop.lat,
        stop.lng
      );

    }

    // 3. Geofence bei jedem GPS-Punkt prüfen
    let geofenceEvent = "";

    if (stop) {

      geofenceEvent = this.geofence.check(
        gpsData.fahrer,
        gpsData.tour,
        gpsData,
        stop,
        this.tour
      ) || "";

    }
    

    /*
    * Status für die Position:
    * ANKUNFT / ABFAHRT haben Vorrang.
    * Sonst wird der normale GPS-Status verwendet.
    */
    const positionStatus =
      geofenceEvent ||
      gpsData.status ||
      "OK";

    // 4. Entscheiden, ob dieser GPS-Punkt gespeichert wird
    const saveDecision = this.shouldSavePosition(
      gpsData,
      positionStatus
    );

    if (saveDecision.save) {

      this.sheet.savePosition({

        fahrer: gpsData.fahrer,
        tour: gpsData.tour,

        // ziel enthält weiterhin die ZielID
        ziel: stop ? stop.ziel : "",

        latitude: gpsData.latitude,
        longitude: gpsData.longitude,
        accuracy: gpsData.accuracy,
        speed: gpsData.speed,
        altitude: gpsData.altitude,
        heading: gpsData.heading,

        entfernung: dist,
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
      entfernung: dist
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