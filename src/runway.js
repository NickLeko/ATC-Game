(function attachRunway(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};

  class Runway {
    constructor(definition) {
      Object.assign(this, definition);
      this.reset();
    }

    reset() {
      this.occupiedById = null;
      this.mode = null;
      this.reservedArrivalId = null;
      this.cooldownUntil = 0;
      this.lastReleaseAt = 0;
    }

    getQueuePosition(index, spacing) {
      return {
        x: this.queueOrigin.x + this.queueVector.x * spacing * index,
        y: this.queueOrigin.y + this.queueVector.y * spacing * index,
      };
    }

    getArrivalStackPoint(offset) {
      return {
        x: this.approachHoldBase.x + offset.x,
        y: this.approachHoldBase.y + offset.y,
      };
    }

    isOccupiedByOther(aircraftId) {
      return this.occupiedById !== null && this.occupiedById !== aircraftId;
    }

    isReservedByOther(aircraftId) {
      return this.reservedArrivalId !== null && this.reservedArrivalId !== aircraftId;
    }

    canReserveArrival(aircraftId, now) {
      return !this.isOccupiedByOther(aircraftId) && !this.isReservedByOther(aircraftId) && now >= this.cooldownUntil;
    }

    canUseForDeparture(aircraftId, now) {
      return !this.isOccupiedByOther(aircraftId) && !this.isReservedByOther(aircraftId) && now >= this.cooldownUntil;
    }

    reserveArrival(aircraftId) {
      this.reservedArrivalId = aircraftId;
    }

    clearReservation(aircraftId) {
      if (this.reservedArrivalId === aircraftId) {
        this.reservedArrivalId = null;
      }
    }

    occupy(aircraftId, mode) {
      this.occupiedById = aircraftId;
      this.mode = mode;
      if (mode === "landing") {
        this.reservedArrivalId = aircraftId;
      }
    }

    release(aircraftId, now, cooldownSeconds) {
      if (aircraftId === null || this.occupiedById === aircraftId) {
        this.occupiedById = null;
        this.mode = null;
        this.cooldownUntil = Math.max(this.cooldownUntil, now + cooldownSeconds);
        this.lastReleaseAt = now;
      }

      if (aircraftId === null || this.reservedArrivalId === aircraftId) {
        this.reservedArrivalId = null;
      }
    }

    describeStatus(now) {
      if (this.occupiedById !== null) {
        if (this.mode === "landing") {
          return "Arrival on runway";
        }
        if (this.mode === "takeoff") {
          return "Departure rolling";
        }
        if (this.mode === "lined_up") {
          return "Line up and wait";
        }
        return "Occupied";
      }

      if (this.reservedArrivalId !== null) {
        return "Arrival committed";
      }

      if (now < this.cooldownUntil) {
        return "Runway resetting";
      }

      return "Available";
    }
  }

  AirportTower.Runway = Runway;
}(window));
