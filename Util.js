class Util {

  /**
   * Entfernung zwischen zwei GPS-Punkten (Haversine)
   */
  static distance(lat1, lon1, lat2, lon2) {

    const R = 6371000; // Erde in Metern

    const toRad = (deg) => deg * Math.PI / 180;

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;

  }

  /**
   * Prüft ob Punkt innerhalb Radius liegt
   */
  static inRadius(lat1, lon1, lat2, lon2, radius) {

    return this.distance(lat1, lon1, lat2, lon2) <= radius;

  }

  /**
   * Format Zeit (Date → HH:MM:SS)
   */
  static timeString(date = new Date()) {

    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "HH:mm:ss"
    );

  }

  /**
   * Safe Number
   */
  static num(value, fallback = 0) {

    const n = Number(value);

    return isNaN(n) ? fallback : n;

  }

  /**
   * GPS Validierung
   */
  static isValidGPS(lat, lng) {

    return (
      lat !== null &&
      lng !== null &&
      !isNaN(lat) &&
      !isNaN(lng) &&
      lat !== 0 &&
      lng !== 0
    );

  }

}