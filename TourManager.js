class TourManager {

  constructor(database) {

    this.db = database;

    this.tour = null;
    this.stops = [];
    this.index = 0;

  }


  /**
   * Tour laden
   */
  load(tourName) {

    this.tour = tourName;
    this.stops = this.db.getTour(tourName);
    this.index = 0;

  }


  /**
   * Tourindex setzen
   */
  setIndex(index) {

    if (!this.stops || this.stops.length === 0) {
      this.index = 0;
      return;
    }

    index = Number(index);

    if (isNaN(index) || index < 0) {
      this.index = 0;
      return;
    }

    if (index >= this.stops.length) {
      this.index = this.stops.length - 1;
      return;
    }

    this.index = index;

  }


  /**
   * Letzter bereits angefahrener Halt
   *
   * Verändert den Index nicht.
   */
  lastStop() {

    if (this.index <= 0) {
      return null;
    }

    return this.stops[this.index - 1] || null;

  }


  /**
   * Nächster anzufahrender Halt
   *
   * Verändert den Index nicht.
   */
  nextStop() {

    return this.stops[this.index] || null;

  }


  /**
   * Zum nächsten Halt weiterschalten
   *
   * Verändert den Index.
   */
  advanceToNextStop() {

    if (this.index < this.stops.length - 1) {

      this.index++;

      return this.nextStop();

    }

    return null;

  }


  /**
   * Einen Halt zurückschalten
   *
   * Verändert den Index.
   */
  prevStop() {

    if (this.index > 0) {

      this.index--;

      return this.nextStop();

    }

    return null;

  }


  /*
   * Übergangsfunktionen für bestehenden Code
   *
   * Diese bleiben zunächst erhalten, damit vorhandene
   * Aufrufe nicht sofort geändert werden müssen.
   */


  /**
   * Alter Name für nextStop()
   */
//  currentStop() {
//
//    return this.nextStop();
//
//  }
//
//
//  /**
//   * Alter Name für lastStop()
//   */
//  previousStop() {
//
//    return this.lastStop();
//
//  }


  /**
   * Fortschritt berechnen
   */
  progress() {

    const total = this.stops.length;

    const current = total === 0
      ? 0
      : this.index + 1;

    return {

      current: current,
      total: total,

      percent: total === 0
        ? 0
        : Math.round((current / total) * 100)

    };

  }


  /**
   * Tour beendet?
   */
  isFinished() {

    if (!this.stops || this.stops.length === 0) {
      return false;
    }

    return this.index >= this.stops.length - 1;

  }

}