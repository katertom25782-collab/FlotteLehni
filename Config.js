const CONFIG = {

  // ===== Spreadsheet =====

  SPREADSHEET_ID:"1Gx6mpYWubhSXpVgvR4lLdcyvNCSOMvrM4yc6tNLYFgc",    
   USE_ACTIVE_SHEET: true,    // während der Entwicklung


  // ===== Tabellen =====

  SHEETS: {

    FAHRER: "Fahrer",

    TOUR: "FTable",

    ZIELE: "Fahrplandaten",

    POSITIONEN: "Positionen",

    TOURSTATUS: "Tourstatus",

    LOG: "Log",

    BUCHUNGEN: "Buchungen",

    BUCHUNGANZ: "BuchungAnz",

    EINSTELLUNGEN: "Einstellungen",

    TOURNAMEN: "TourNamen"

  },


  // ===== GPS =====

  GPS: {

    INTERVAL: 5000,
    HIGH_ACCURACY: true,
    TIMEOUT: 15000,
    MAXIMUM_AGE: 0,

    // Position spätestens alle 10 Sekunden speichern
    SAVE_INTERVAL: 5000,

    // Position speichern, wenn mindestens 25 Meter zurückgelegt wurden
    SAVE_DISTANCE: 25,

    // Ab dieser Geschwindigkeit gilt das Fahrzeug als fahrend
    // 1 m/s entspricht ungefähr 3,6 km/h
    MOVING_SPEED: 1
  },

  // ===== Maps =====

  MAP:{
    ZOOM:8  },
  // ===== Geofence =====

  GEOFENCE:{

    DEFAULT_RADIUS:50
  },
  // ===== Booking =====

  BOOKING: {

    FILTER_ENABLED: true,

    AUTO_SAVE: false,

    COLORS: true,

    SHOW_PRICECLASS: false
  },
  DEBUG: {

   ENABLED: true
  },
}