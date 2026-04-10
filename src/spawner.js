(function attachSpawner(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const {
    Aircraft,
    GAME_CONFIG,
    clamp,
    createFlightId,
    lerp,
    pick,
    randomRange,
  } = AirportTower;

  class Spawner {
    constructor(airport) {
      this.airport = airport;
      this.sequence = 0;
      this.gateCursor = 0;
      this.timeUntilSpawn = 5;
    }

    reset() {
      this.sequence = 0;
      this.gateCursor = 0;
      this.timeUntilSpawn = 5;
    }

    update(delta, game) {
      this.timeUntilSpawn -= delta;
      if (this.timeUntilSpawn > 0) {
        return;
      }

      if (game.timeRemaining < 12) {
        this.timeUntilSpawn = 2;
        return;
      }

      if (game.aircraft.length >= game.difficulty.maxActive) {
        this.timeUntilSpawn = 1.5;
        return;
      }

      const aircraft = this.createAircraft(game);
      game.addAircraft(aircraft);
      this.timeUntilSpawn = this.nextSpawnInterval(game);
    }

    nextSpawnInterval(game) {
      const progress = clamp(game.elapsed / game.roundLength, 0, 1);
      const min = lerp(game.difficulty.spawnInterval.opening[0], game.difficulty.spawnInterval.peak[0], progress);
      const max = lerp(game.difficulty.spawnInterval.opening[1], game.difficulty.spawnInterval.peak[1], progress);

      if (this.sequence < 2) {
        return randomRange(min + 2, max + 2.5);
      }

      return randomRange(min, max);
    }

    createAircraft(game) {
      const activeArrivals = game.aircraft.filter((aircraft) => aircraft.kind === "arrival").length;
      const activeDepartures = game.aircraft.filter((aircraft) => aircraft.kind === "departure").length;

      let spawnArrival = Math.random() < 0.54;
      if (activeArrivals - activeDepartures > 2) {
        spawnArrival = false;
      } else if (activeDepartures - activeArrivals > 1) {
        spawnArrival = true;
      }

      if (spawnArrival) {
        return this.createArrival(game);
      }

      return this.createDeparture(game);
    }

    createArrival(game) {
      const entry = pick(this.airport.arrivalEntries);
      const profile = this.rollProfile(game);
      const urgent = this.rollUrgency(game);
      const flightId = createFlightId(GAME_CONFIG.flightPrefixes, this.sequence);
      const runway = pick(this.airport.runways);
      const stackDrift = {
        x: randomRange(-20, 18),
        y: randomRange(-36, 36),
      };

      this.sequence += 1;

      return new Aircraft({
        id: `aircraft-${this.sequence}`,
        flightId,
        sequence: this.sequence,
        kind: "arrival",
        speedProfile: profile,
        urgency: urgent ? randomRange(0.78, 1) : randomRange(0.18, 0.52),
        state: "inbound",
        x: entry.spawn.x,
        y: entry.spawn.y,
        holdingAnchor: { ...entry.holding },
        stackOffset: stackDrift,
        orbitRadius: randomRange(18, 28),
        assignedRunwayId: null,
        exitTarget: { ...runway.arrivalExitTarget },
      });
    }

    createDeparture(game) {
      const gate = this.airport.gates[this.gateCursor % this.airport.gates.length];
      const urgent = this.rollUrgency(game, 0.7);
      const flightId = createFlightId(GAME_CONFIG.flightPrefixes, this.sequence);

      this.sequence += 1;
      this.gateCursor += 1;

      return new Aircraft({
        id: `aircraft-${this.sequence}`,
        flightId,
        sequence: this.sequence,
        kind: "departure",
        speedProfile: this.rollProfile(game),
        urgency: urgent ? randomRange(0.78, 1) : randomRange(0.12, 0.48),
        state: "at_gate",
        x: gate.x,
        y: gate.y,
        homeGate: { ...gate },
        holdingAnchor: { ...gate },
        stackOffset: { x: 0, y: 0 },
        orbitRadius: 0,
        assignedRunwayId: null,
        exitTarget: { x: gate.x, y: gate.y },
      });
    }

    rollProfile(game) {
      const heavyChance = game.difficulty.heavyChance;
      const roll = Math.random();
      if (roll < heavyChance) {
        return "heavy";
      }
      if (roll > 0.78) {
        return "fast";
      }
      return "standard";
    }

    rollUrgency(game, multiplier = 1) {
      const urgentActive = game.aircraft.filter((aircraft) => aircraft.isUrgent()).length;
      if (urgentActive >= game.difficulty.maxUrgentActive) {
        return false;
      }

      const progress = clamp(game.elapsed / game.roundLength, 0, 1);
      const chance = game.difficulty.urgencyChance * multiplier * (0.68 + progress * 0.7);
      return Math.random() < chance;
    }
  }

  AirportTower.Spawner = Spawner;
}(window));
