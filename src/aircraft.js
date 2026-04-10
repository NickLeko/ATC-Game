(function attachAircraft(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const { AIRCRAFT_PROFILES, STATE_LABELS, distance } = AirportTower;

  class Aircraft {
    constructor(data) {
      Object.assign(this, data);

      this.waitTime = 0;
      this.totalTime = 0;
      this.delayStage = 0;
      this.serviceRecorded = false;
      this.completed = false;
      this.queueIndex = null;
      this.queueTarget = null;
      this.takeoffStep = 0;
      this.landingStep = 0;
      this.goAroundStep = 0;
      this.orbitAngle = data.orbitAngle ?? Math.random() * Math.PI * 2;
      this.orbitRadius = data.orbitRadius ?? 20;
      this.holdRequested = data.holdRequested ?? false;
      this.holdCount = 0;
      this.goAroundCount = 0;
    }

    get profile() {
      return AIRCRAFT_PROFILES[this.speedProfile];
    }

    get displayRadius() {
      return this.kind === "arrival" ? 12 : 11;
    }

    isUrgent() {
      return this.urgency >= 0.74;
    }

    isAwaitingService() {
      return !["landing", "exiting_airport", "taking_off", "departed", "completed"].includes(this.state);
    }

    getStateLabel() {
      return STATE_LABELS[this.state] ?? this.state;
    }

    getTypeLabel() {
      return this.kind === "arrival" ? "Arrival" : "Departure";
    }

    getProfileLabel() {
      return this.profile.label;
    }

    update(delta, sim) {
      this.totalTime += delta;
      if (this.isAwaitingService()) {
        this.waitTime += delta;
      }

      if (this.kind === "arrival") {
        this.updateArrival(delta, sim);
        return;
      }

      this.updateDeparture(delta, sim);
    }

    updateArrival(delta, sim) {
      const runway = sim.getRunway(this.assignedRunwayId);

      if (this.state === "inbound") {
        if (this.moveToward(this.holdingAnchor, this.profile.cruise * 0.76, delta)) {
          this.state = "holding";
        }
        return;
      }

      if (this.state === "holding") {
        this.orbit(this.holdingAnchor, delta, this.orbitRadius, this.profile.orbitSpeed);
        if (runway && !this.holdRequested) {
          this.state = "approach";
        }
        return;
      }

      if (this.state === "approach") {
        if (!runway) {
          this.state = "holding";
          return;
        }

        const stackPoint = runway.getArrivalStackPoint(this.stackOffset);
        if (distance(this, stackPoint) > 18) {
          this.moveToward(stackPoint, this.profile.cruise, delta);
        } else {
          this.orbit(stackPoint, delta, this.orbitRadius * 0.72, this.profile.orbitSpeed + 0.2);
        }
        return;
      }

      if (this.state === "cleared_to_land") {
        if (!runway) {
          this.state = "holding";
          return;
        }

        this.moveToward(runway.touchdownPoint, this.profile.approach, delta);
        if (distance(this, runway.touchdownPoint) < 42 && runway.occupiedById !== this.id) {
          runway.occupy(this.id, "landing");
          this.state = "landing";
          this.landingStep = 0;
        }
        return;
      }

      if (this.state === "landing") {
        if (!runway) {
          return;
        }

        if (this.landingStep === 0) {
          if (this.moveToward(runway.rolloutPoint, this.profile.rollout, delta)) {
            this.landingStep = 1;
          }
          return;
        }

        if (this.moveToward(runway.exitPoint, this.profile.rollout * 0.94, delta)) {
          runway.release(this.id, sim.elapsed, sim.difficulty.runwayCooldown.arrival * this.profile.separation);
          this.state = "exiting_airport";
        }
        return;
      }

      if (this.state === "exiting_airport") {
        if (this.moveToward(this.exitTarget, this.profile.taxi, delta)) {
          this.state = "completed";
          this.completed = true;
          sim.onAircraftHandled(this, "arrival");
        }
        return;
      }

      if (this.state === "go_around") {
        const waypoint = runway ? runway.goAroundPoint : this.holdingAnchor;

        if (this.goAroundStep === 0) {
          if (this.moveToward(waypoint, this.profile.approach * 1.1, delta)) {
            this.goAroundStep = 1;
          }
          return;
        }

        if (this.moveToward(this.holdingAnchor, this.profile.cruise, delta)) {
          this.state = "holding";
          this.goAroundStep = 0;
        }
      }
    }

    updateDeparture(delta, sim) {
      const runway = sim.getRunway(this.assignedRunwayId);

      if (this.state === "at_gate") {
        if (runway && !this.holdRequested) {
          this.state = "taxi_ready";
        }
        return;
      }

      if (this.state === "taxi_ready") {
        if (!runway) {
          this.state = "at_gate";
          return;
        }

        if (this.holdRequested) {
          return;
        }

        if (this.queueTarget && this.moveToward(this.queueTarget, this.profile.taxi, delta)) {
          this.state = "queued";
        }
        return;
      }

      if (this.state === "queued") {
        if (!runway) {
          this.state = "at_gate";
          return;
        }

        if (this.queueTarget) {
          this.moveToward(this.queueTarget, this.profile.taxi, delta);
        }
        return;
      }

      if (this.state === "lined_up") {
        if (runway) {
          this.moveToward(runway.lineupPoint, this.profile.taxi * 0.9, delta);
        }
        return;
      }

      if (this.state === "taking_off") {
        if (!runway) {
          return;
        }

        if (this.takeoffStep === 0) {
          if (this.moveToward(runway.lineupPoint, this.profile.taxi * 1.1, delta)) {
            this.takeoffStep = 1;
          }
          return;
        }

        if (this.takeoffStep === 1) {
          if (this.moveToward(runway.takeoffEnd, this.profile.approach * 1.22, delta)) {
            runway.release(this.id, sim.elapsed, sim.difficulty.runwayCooldown.takeoff * this.profile.separation);
            this.state = "departed";
          }
          return;
        }

        return;
      }

      if (this.state === "departed") {
        if (this.moveToward(this.exitTarget, this.profile.cruise * 1.1, delta)) {
          this.state = "completed";
          this.completed = true;
          sim.onAircraftHandled(this, "departure");
        }
      }
    }

    moveToward(target, speed, delta) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const remaining = Math.hypot(dx, dy);

      if (remaining < 1) {
        this.x = target.x;
        this.y = target.y;
        return true;
      }

      const step = speed * delta;
      const ratio = Math.min(1, step / remaining);
      this.x += dx * ratio;
      this.y += dy * ratio;
      this.heading = Math.atan2(dy, dx);
      return ratio >= 1;
    }

    orbit(center, delta, radius, speed) {
      this.orbitAngle += delta * speed;
      this.x = center.x + Math.cos(this.orbitAngle) * radius;
      this.y = center.y + Math.sin(this.orbitAngle) * radius;
      this.heading = this.orbitAngle + Math.PI / 2;
    }
  }

  AirportTower.Aircraft = Aircraft;
}(window));
