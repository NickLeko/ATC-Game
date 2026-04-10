(function attachGame(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const {
    createAirportLayout,
    GAME_CONFIG,
    SCORING,
    ScoreKeeper,
    Spawner,
    clamp,
    distance,
    formatTime,
  } = AirportTower;

  const ARRIVAL_STATES = new Set(["inbound", "holding", "approach", "cleared_to_land", "go_around"]);
  const DEPARTURE_QUEUE_STATES = new Set(["taxi_ready", "queued"]);
  const COMPLETED_STATES = new Set(["completed", "departed"]);

  class Game {
    constructor({ canvas, ui }) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.ui = ui;

      this.airport = createAirportLayout();
      this.runwayMap = new Map(this.airport.runways.map((runway) => [runway.id, runway]));
      this.scoreKeeper = new ScoreKeeper();
      this.spawner = new Spawner(this.airport);

      this.aircraft = [];
      this.selectedAircraftId = null;
      this.lastFrameTime = 0;
      this.mode = "menu";
      this.paused = false;
      this.speed = 1;
      this.elapsed = 0;
      this.roundLength = 300;
      this.difficulty = GAME_CONFIG.difficulties.easy;
      this.lastSettings = { difficulty: "easy", roundLength: 300 };
      this.meters = { ...GAME_CONFIG.startingMeters };
      this.idlePenaltyClock = 0;
      this.warning = "";
      this.eventMessages = ["Tower inactive. Start a round to open the airport."];
      this.failureReason = "";
      this.failureReport = null;

      this.loop = this.loop.bind(this);
    }

    init() {
      this.ui.render(this.buildViewModel());
      this.ui.showMenu();
      requestAnimationFrame(this.loop);
    }

    start(settings) {
      this.lastSettings = settings;
      this.mode = "running";
      this.paused = false;
      this.speed = 1;
      this.elapsed = 0;
      this.roundLength = settings.roundLength;
      this.difficulty = GAME_CONFIG.difficulties[settings.difficulty];
      this.meters = { ...GAME_CONFIG.startingMeters };
      this.aircraft = [];
      this.selectedAircraftId = null;
      this.warning = "";
      this.failureReason = "";
      this.failureReport = null;
      this.idlePenaltyClock = 0;

      this.airport.runways.forEach((runway) => runway.reset());
      this.spawner.reset();
      this.scoreKeeper.reset();
      this.eventMessages = [
        `${this.difficulty.label} traffic profile loaded.`,
        `Tower open for a ${Math.round(this.roundLength / 60)} minute session.`,
      ];

      this.addAircraft(this.spawner.createArrival(this));
      this.addAircraft(this.spawner.createDeparture(this));
      this.spawner.timeUntilSpawn = 8;

      this.ui.hideMenu();
      this.ui.hideSummary();
      this.ui.render(this.buildViewModel());
    }

    playAgain() {
      this.start(this.lastSettings);
    }

    returnToMenu() {
      this.mode = "menu";
      this.paused = false;
      this.warning = "";
      this.ui.showMenu();
      this.ui.render(this.buildViewModel());
    }

    togglePause() {
      if (this.mode !== "running") {
        return;
      }

      this.paused = !this.paused;
    }

    setSpeed(speed) {
      if (this.mode !== "running") {
        return;
      }

      this.speed = speed;
    }

    handleCanvasClick(point) {
      if (!["running", "summary"].includes(this.mode)) {
        return;
      }

      const aircraft = [...this.aircraft]
        .reverse()
        .find((candidate) => distance(candidate, point) <= candidate.displayRadius + 10);

      this.selectedAircraftId = aircraft ? aircraft.id : null;
    }

    handleCommand(command) {
      const aircraft = this.getSelectedAircraft();
      if (!aircraft || this.mode !== "running") {
        return;
      }

      if (command === "clear-land") {
        this.clearToLand(aircraft);
        return;
      }

      if (command === "clear-takeoff") {
        this.clearForTakeoff(aircraft);
        return;
      }

      if (command === "hold") {
        this.holdAircraft(aircraft);
        return;
      }

      if (command === "line-up") {
        this.lineUpAndWait(aircraft);
        return;
      }

      if (command === "go-around") {
        this.commandGoAround(aircraft);
      }
    }

    assignRunway(runwayId) {
      const aircraft = this.getSelectedAircraft();
      if (!aircraft || this.mode !== "running") {
        return;
      }

      const runway = this.getRunway(runwayId);
      const previousRunway = this.getRunway(aircraft.assignedRunwayId);
      if (!runway) {
        return;
      }

      if (["landing", "exiting_airport", "taking_off", "departed", "completed"].includes(aircraft.state)) {
        this.pushEvent(`${aircraft.flightId} cannot switch runways in its current state.`);
        return;
      }

      if (aircraft.state === "lined_up" && aircraft.assignedRunwayId !== runwayId) {
        this.pushEvent(`${aircraft.flightId} must vacate the runway before reassignment.`);
        return;
      }

      if (previousRunway && previousRunway.id !== runway.id) {
        previousRunway.clearReservation(aircraft.id);
      }

      aircraft.assignedRunwayId = runwayId;
      aircraft.holdRequested = false;

      if (aircraft.kind === "arrival") {
        aircraft.exitTarget = { ...runway.arrivalExitTarget };
        if (aircraft.state === "holding") {
          aircraft.state = "approach";
        }
      } else {
        aircraft.exitTarget = { ...runway.departExitPoint };
        if (aircraft.state === "at_gate") {
          aircraft.state = "taxi_ready";
        } else if (aircraft.state === "queued") {
          aircraft.state = "taxi_ready";
        }
      }

      this.pushEvent(`${aircraft.flightId} assigned ${runway.shortLabel}.`);
    }

    clearToLand(aircraft) {
      if (aircraft.kind !== "arrival") {
        this.pushEvent(`${aircraft.flightId} is not an arrival.`);
        return;
      }

      const runway = this.getRunway(aircraft.assignedRunwayId);
      if (!runway) {
        this.pushEvent(`${aircraft.flightId} needs a runway assignment first.`);
        return;
      }

      if (aircraft.state !== "approach") {
        this.pushEvent(`${aircraft.flightId} must be established on approach before landing clearance.`);
        return;
      }

      if (!runway.canReserveArrival(aircraft.id, this.elapsed)) {
        this.failSafety(this.buildRunwayFailureReport("clear-land", aircraft, runway));
        return;
      }

      aircraft.holdRequested = false;
      aircraft.state = "cleared_to_land";
      aircraft.exitTarget = { ...runway.arrivalExitTarget };
      runway.reserveArrival(aircraft.id);

      this.adjustEfficiency(2);
      this.pushEvent(`${aircraft.flightId} cleared to land on ${runway.shortLabel}.`);
    }

    clearForTakeoff(aircraft) {
      if (aircraft.kind !== "departure") {
        this.pushEvent(`${aircraft.flightId} is not a departure.`);
        return;
      }

      const runway = this.getRunway(aircraft.assignedRunwayId);
      if (!runway) {
        this.pushEvent(`${aircraft.flightId} needs a runway assignment first.`);
        return;
      }

      const wasLinedUp = aircraft.state === "lined_up";
      const ready = wasLinedUp || (DEPARTURE_QUEUE_STATES.has(aircraft.state) && this.isDepartureLeader(aircraft));
      if (!ready) {
        this.pushEvent(`${aircraft.flightId} is not first in line for ${runway.shortLabel}.`);
        return;
      }

      if (!runway.canUseForDeparture(aircraft.id, this.elapsed) && runway.occupiedById !== aircraft.id) {
        this.failSafety(this.buildRunwayFailureReport("clear-takeoff", aircraft, runway));
        return;
      }

      if (runway.reservedArrivalId && runway.reservedArrivalId !== aircraft.id) {
        this.failSafety(this.buildRunwayFailureReport("arrival-protected", aircraft, runway));
        return;
      }

      aircraft.holdRequested = false;
      aircraft.state = "taking_off";
      aircraft.takeoffStep = wasLinedUp ? 1 : 0;
      runway.occupy(aircraft.id, "takeoff");

      this.adjustEfficiency(1.5);
      this.pushEvent(`${aircraft.flightId} cleared for takeoff on ${runway.shortLabel}.`);
    }

    holdAircraft(aircraft) {
      const runway = this.getRunway(aircraft.assignedRunwayId);

      if (aircraft.kind === "arrival") {
        if (["landing", "exiting_airport", "completed"].includes(aircraft.state)) {
          this.pushEvent(`${aircraft.flightId} is already committed and cannot hold.`);
          return;
        }

        if (runway) {
          runway.clearReservation(aircraft.id);
        }

        aircraft.holdRequested = true;
        aircraft.state = "holding";
        aircraft.holdCount += 1;

        if (aircraft.holdCount > 1) {
          this.scoreKeeper.recordHoldPenalty();
          this.adjustSatisfaction(-1.8);
        }

        this.pushEvent(`${aircraft.flightId} instructed to hold.`);
        return;
      }

      if (["taking_off", "departed", "completed"].includes(aircraft.state)) {
        this.pushEvent(`${aircraft.flightId} cannot hold now.`);
        return;
      }

      if (runway && aircraft.state === "lined_up" && runway.occupiedById === aircraft.id) {
        runway.release(aircraft.id, this.elapsed, 0);
        aircraft.state = "queued";
      }

      aircraft.holdRequested = true;
      aircraft.holdCount += 1;

      if (aircraft.holdCount > 1) {
        this.scoreKeeper.recordHoldPenalty();
        this.adjustSatisfaction(-1.2);
      }

      this.pushEvent(`${aircraft.flightId} told to hold position.`);
    }

    lineUpAndWait(aircraft) {
      if (aircraft.kind !== "departure") {
        this.pushEvent(`${aircraft.flightId} is not a departure.`);
        return;
      }

      const runway = this.getRunway(aircraft.assignedRunwayId);
      if (!runway) {
        this.pushEvent(`${aircraft.flightId} needs a runway assignment first.`);
        return;
      }

      if (!DEPARTURE_QUEUE_STATES.has(aircraft.state)) {
        this.pushEvent(`${aircraft.flightId} cannot line up from its current state.`);
        return;
      }

      if (!this.isDepartureLeader(aircraft)) {
        this.pushEvent(`${aircraft.flightId} is not first in line for ${runway.shortLabel}.`);
        return;
      }

      if (!runway.canUseForDeparture(aircraft.id, this.elapsed)) {
        this.failSafety(this.buildRunwayFailureReport("line-up", aircraft, runway));
        return;
      }

      aircraft.holdRequested = false;
      aircraft.state = "lined_up";
      runway.occupy(aircraft.id, "lined_up");

      this.pushEvent(`${aircraft.flightId} line up and wait on ${runway.shortLabel}.`);
    }

    commandGoAround(aircraft) {
      if (aircraft.kind !== "arrival") {
        this.pushEvent(`${aircraft.flightId} is not an arrival.`);
        return;
      }

      if (!["approach", "cleared_to_land"].includes(aircraft.state)) {
        this.pushEvent(`${aircraft.flightId} is not in a go-around state.`);
        return;
      }

      const runway = this.getRunway(aircraft.assignedRunwayId);
      if (runway) {
        runway.clearReservation(aircraft.id);
      }

      aircraft.state = "go_around";
      aircraft.goAroundStep = 0;
      aircraft.goAroundCount += 1;
      aircraft.holdRequested = false;

      this.scoreKeeper.recordGoAround();
      this.adjustSatisfaction(-5.5);
      this.pushEvent(`${aircraft.flightId} going around.`);
    }

    addAircraft(aircraft) {
      this.aircraft.push(aircraft);
      const kindLabel = aircraft.kind === "arrival" ? "arrival" : "departure";
      const urgentText = aircraft.isUrgent() ? " Urgent." : "";
      this.pushEvent(`${aircraft.flightId} entered as ${kindLabel}.${urgentText}`.trim());
    }

    update(delta) {
      this.elapsed += delta;

      this.spawner.update(delta, this);
      this.updateQueues();

      this.aircraft.forEach((aircraft) => {
        aircraft.update(delta, this);
      });

      this.applyPressure(delta);
      this.aircraft = this.aircraft.filter((aircraft) => !aircraft.completed);

      if (this.selectedAircraftId && !this.aircraft.some((aircraft) => aircraft.id === this.selectedAircraftId)) {
        this.selectedAircraftId = null;
      }

      this.warning = this.computeWarning();

      if (this.elapsed >= this.roundLength) {
        this.finishRound("complete", "Shift complete. Review the tower summary.");
      }
    }

    applyPressure(delta) {
      let satisfactionDrain = 0;
      let urgentSafetyDrain = 0;

      const waitingAircraft = this.aircraft.filter((aircraft) => aircraft.isAwaitingService());
      const backlogCount = waitingAircraft.length;
      const runwayBusy = this.airport.runways.filter((runway) => runway.occupiedById || runway.reservedArrivalId).length;

      waitingAircraft.forEach((aircraft) => {
        if (aircraft.delayStage < GAME_CONFIG.delayThresholds.length && aircraft.waitTime >= GAME_CONFIG.delayThresholds[aircraft.delayStage]) {
          const basePenalty = SCORING.delayPenalties[aircraft.delayStage] * this.difficulty.penaltyMultiplier;
          const urgentPenalty = aircraft.isUrgent() ? SCORING.urgentDelayBonusPenalty : 0;
          this.scoreKeeper.recordDelayPenalty(basePenalty + urgentPenalty);
          this.adjustSatisfaction(-(4 + aircraft.delayStage * 2) * (aircraft.isUrgent() ? 1.2 : 1));
          if (aircraft.kind === "arrival" && aircraft.isUrgent()) {
            this.adjustSafety(-(2 + aircraft.delayStage * 1.4));
          }
          aircraft.delayStage += 1;
          this.pushEvent(`${aircraft.flightId} delay penalty triggered.`);
        }

        const isPastGrace = aircraft.waitTime > (aircraft.isUrgent() ? 14 : 20);
        if (!isPastGrace) {
          return;
        }

        const baseDrain = aircraft.isUrgent() ? this.difficulty.urgentSatisfactionDrain : this.difficulty.satisfactionDrain;
        const typeModifier = aircraft.kind === "arrival" ? 1.15 : 0.9;
        satisfactionDrain += baseDrain * typeModifier * delta;

        if (aircraft.kind === "arrival" && aircraft.isUrgent() && aircraft.waitTime > 34) {
          urgentSafetyDrain += this.difficulty.urgentSafetyDrain * delta;
        }
      });

      if (backlogCount > 0 && runwayBusy === 0) {
        this.adjustEfficiency(-(this.difficulty.idlePenalty * delta * Math.min(1.7, backlogCount / 3)));
        this.idlePenaltyClock += delta;
        if (this.idlePenaltyClock >= 10) {
          this.scoreKeeper.recordIdlePenalty();
          this.idlePenaltyClock = 0;
        }
      } else {
        this.idlePenaltyClock = 0;
        if (runwayBusy > 0) {
          this.adjustEfficiency(this.difficulty.efficiencyGain * delta * Math.min(1.5, runwayBusy));
        }
      }

      this.adjustSatisfaction(-satisfactionDrain);
      this.adjustSafety(-urgentSafetyDrain);
    }

    updateQueues() {
      this.airport.runways.forEach((runway) => {
        const queue = this.aircraft
          .filter((aircraft) => aircraft.kind === "departure" && aircraft.assignedRunwayId === runway.id && DEPARTURE_QUEUE_STATES.has(aircraft.state))
          .sort((left, right) => left.sequence - right.sequence);

        queue.forEach((aircraft, index) => {
          aircraft.queueIndex = index;
          aircraft.queueTarget = runway.getQueuePosition(index, this.difficulty.queueSpacing);
          aircraft.exitTarget = { ...runway.departExitPoint };
        });
      });

      this.aircraft.forEach((aircraft) => {
        if (aircraft.kind === "departure" && !DEPARTURE_QUEUE_STATES.has(aircraft.state)) {
          aircraft.queueIndex = null;
        }
      });
    }

    onAircraftHandled(aircraft, type) {
      if (aircraft.serviceRecorded) {
        return;
      }

      aircraft.serviceRecorded = true;

      if (type === "arrival") {
        this.scoreKeeper.recordLanding(aircraft, this.elapsed, this.difficulty.flowBonusTarget);
        this.adjustSatisfaction(2.4);
        this.adjustEfficiency(3.2);
        this.pushEvent(`${aircraft.flightId} landed and exited the runway.`);
        return;
      }

      this.scoreKeeper.recordTakeoff(aircraft, this.elapsed, this.difficulty.flowBonusTarget);
      this.adjustSatisfaction(1.8);
      this.adjustEfficiency(2.8);
      this.pushEvent(`${aircraft.flightId} departed cleanly.`);
    }

    finishRound(status, reason) {
      if (this.mode === "summary") {
        return;
      }

      this.mode = "summary";
      this.paused = false;

      const summary = this.scoreKeeper.buildSummary({
        status,
        reason,
        meters: this.meters,
        elapsedSeconds: Math.min(this.elapsed, this.roundLength),
        difficultyLabel: this.difficulty.label,
      });

      summary.settings = this.lastSettings;
      summary.failureReport = this.failureReport;
      this.ui.showSummary(summary);
    }

    failSafety(report) {
      const normalizedReport = typeof report === "string" ? this.createFallbackFailureReport(report) : report;
      this.scoreKeeper.recordSafetyIncident(true);
      this.adjustSafety(-100);
      this.failureReport = normalizedReport;
      this.failureReason = normalizedReport.summary;
      this.pushEvent(`Safety violation: ${normalizedReport.summary}`);
      this.finishRound("failed", normalizedReport.summary);
    }

    buildRunwayFailureReport(type, aircraft, runway) {
      const blocker = this.describeRunwayBlocker(runway, aircraft.id);
      const runwayName = runway.shortLabel;

      if (type === "clear-land") {
        return {
          headline: `Unsafe landing clearance on ${runwayName}`,
          title: "Arrival released into a closed runway window",
          summary: `${aircraft.flightId} was cleared to land even though ${runwayName} was not protected for an arrival.`,
          cause: blocker.long,
          guidance: `Keep ${aircraft.flightId} in the stack or send it around until ${runwayName} is fully open with no aircraft on the runway and no spacing lock active.`,
        };
      }

      if (type === "clear-takeoff") {
        return {
          headline: `Unsafe takeoff clearance on ${runwayName}`,
          title: "Departure sent while the runway was not clear",
          summary: `${aircraft.flightId} was cleared for takeoff before ${runwayName} was fully safe for a departure roll.`,
          cause: blocker.long,
          guidance: `Hold the departure or keep it lined up until ${runwayName} is empty, the spacing lock is gone, and no arrival has the runway protected.`,
        };
      }

      if (type === "arrival-protected") {
        return {
          headline: `Arrival priority was broken on ${runwayName}`,
          title: "Protected arrival window was ignored",
          summary: `${aircraft.flightId} was cleared for takeoff while another arrival had already been committed to ${runwayName}.`,
          cause: blocker.long,
          guidance: "Once an arrival has runway priority, departures must wait. Launch the departure only after that arrival lands or goes around and the runway status clears.",
        };
      }

      return {
        headline: `Unsafe line-up on ${runwayName}`,
        title: "Departure entered an unsafe runway window",
        summary: `${aircraft.flightId} was told to line up while ${runwayName} was still unsafe to occupy.`,
        cause: blocker.long,
        guidance: "Keep the departure queued until the runway is fully open. Line up only when the runway card shows available and no arrival has reserved it.",
      };
    }

    describeRunwayBlocker(runway, actorId) {
      if (runway.occupiedById && runway.occupiedById !== actorId) {
        const occupant = this.aircraft.find((aircraft) => aircraft.id === runway.occupiedById);
        if (occupant) {
          const action =
            runway.mode === "landing"
              ? "was landing"
              : runway.mode === "takeoff"
                ? "was taking off"
                : "was already on the runway";

          return {
            short: `${occupant.flightId} occupied the runway.`,
            long: `${runway.shortLabel} was occupied because ${occupant.flightId} ${action}. Issuing another runway command created an immediate same-runway conflict.`,
          };
        }

        return {
          short: "The runway was occupied.",
          long: `${runway.shortLabel} was already occupied by another aircraft. A second clearance on the same strip created an immediate conflict.`,
        };
      }

      if (runway.reservedArrivalId && runway.reservedArrivalId !== actorId) {
        const reservedAircraft = this.aircraft.find((aircraft) => aircraft.id === runway.reservedArrivalId);
        return {
          short: reservedAircraft ? `${reservedAircraft.flightId} had arrival priority.` : "An arrival had priority.",
          long: reservedAircraft
            ? `${reservedAircraft.flightId} already had ${runway.shortLabel} protected for arrival. That reserved window could not be handed to another aircraft yet.`
            : `Another arrival already had ${runway.shortLabel} protected. The runway window could not be reassigned yet.`,
        };
      }

      if (this.elapsed < runway.cooldownUntil) {
        const secondsLeft = Math.max(1, Math.ceil(runway.cooldownUntil - this.elapsed));
        return {
          short: "Spacing lock was still active.",
          long: `${runway.shortLabel} was still inside its post-operation spacing lock for about ${secondsLeft} more second${secondsLeft === 1 ? "" : "s"}. The strip looked nearly clear, but the protected timing window had not reopened.`,
        };
      }

      return {
        short: "The runway was not safe.",
        long: `${runway.shortLabel} was not in a safe state for that command. The required occupancy and timing protection was not satisfied.`,
      };
    }

    createFallbackFailureReport(reason) {
      return {
        headline: "Safety violation",
        title: "Unsafe tower command",
        summary: reason,
        cause: "A command was issued while the runway or timing window was unsafe for that operation.",
        guidance: "Use the runway status card and current aircraft positions before committing arrivals or departures.",
      };
    }

    computeWarning() {
      const urgentArrival = this.aircraft
        .filter((aircraft) => aircraft.kind === "arrival" && aircraft.isUrgent() && aircraft.isAwaitingService())
        .sort((left, right) => right.waitTime - left.waitTime)[0];

      if (urgentArrival && urgentArrival.waitTime > 16) {
        return `Urgent arrival ${urgentArrival.flightId} needs priority handling.`;
      }

      const waiting = this.aircraft.filter((aircraft) => aircraft.isAwaitingService()).length;
      const runwayBusy = this.airport.runways.some((runway) => runway.occupiedById || runway.reservedArrivalId);
      if (waiting >= 4 && !runwayBusy) {
        return "Backlog building while both runways sit idle.";
      }

      return "";
    }

    pushEvent(message) {
      this.eventMessages.unshift(message);
      this.eventMessages = this.eventMessages.slice(0, 6);
    }

    adjustSafety(delta) {
      this.meters.safety = clamp(this.meters.safety + delta, 0, 100);
    }

    adjustEfficiency(delta) {
      this.meters.efficiency = clamp(this.meters.efficiency + delta, 0, 100);
    }

    adjustSatisfaction(delta) {
      this.meters.satisfaction = clamp(this.meters.satisfaction + delta, 0, 100);
    }

    isDepartureLeader(aircraft) {
      if (aircraft.state === "lined_up") {
        return true;
      }

      const queue = this.aircraft
        .filter((candidate) => candidate.kind === "departure" && candidate.assignedRunwayId === aircraft.assignedRunwayId && DEPARTURE_QUEUE_STATES.has(candidate.state))
        .sort((left, right) => left.sequence - right.sequence);

      return queue[0]?.id === aircraft.id;
    }

    getSelectedAircraft() {
      return this.aircraft.find((aircraft) => aircraft.id === this.selectedAircraftId) ?? null;
    }

    getRunway(runwayId) {
      return this.runwayMap.get(runwayId) ?? null;
    }

    get timeRemaining() {
      return Math.max(0, this.roundLength - this.elapsed);
    }

    buildViewModel() {
      const selected = this.getSelectedAircraft();
      const commandAvailability = this.getCommandAvailability(selected);
      const runwayAssignmentEnabled = Boolean(selected) && !["landing", "exiting_airport", "taking_off", "departed", "completed"].includes(selected.state);

      return {
        timer: formatTime(this.timeRemaining),
        score: this.scoreKeeper.score,
        difficultyLabel: this.difficulty.label,
        meters: { ...this.meters },
        speed: this.speed,
        paused: this.paused,
        statusLine: this.buildStatusLine(selected),
        warning: this.warning,
        selectedAircraft: selected ? this.serializeAircraft(selected) : null,
        runwayAssignmentEnabled,
        commandAvailability,
        runways: this.airport.runways.map((runway) => {
          const queueCount = this.aircraft.filter(
            (aircraft) => aircraft.kind === "departure" && aircraft.assignedRunwayId === runway.id && DEPARTURE_QUEUE_STATES.has(aircraft.state)
          ).length;

          return {
            id: runway.id,
            label: runway.label,
            status: runway.describeStatus(this.elapsed),
            queueCount,
            cooldownText:
              this.elapsed < runway.cooldownUntil
                ? `Spacing lock: ${formatTime(runway.cooldownUntil - this.elapsed)}`
                : "Spacing lock: clear",
          };
        }),
        events: this.eventMessages,
      };
    }

    buildStatusLine(selected) {
      if (this.mode === "menu") {
        return "Select difficulty and round length to start a tower shift.";
      }

      if (this.mode === "summary" && this.failureReason) {
        return `Safety violation ended the round: ${this.failureReason}`;
      }

      if (this.mode === "summary") {
        return "Round complete. Review your tower performance.";
      }

      if (!selected) {
        return `${this.aircraft.length} aircraft active. Keep runway flow moving.`;
      }

      return `${selected.flightId}: ${selected.getStateLabel()} on ${selected.assignedRunwayId ? this.getRunway(selected.assignedRunwayId)?.shortLabel : "unassigned runway"}.`;
    }

    serializeAircraft(aircraft) {
      const runway = this.getRunway(aircraft.assignedRunwayId);
      const queueLabel =
        aircraft.kind === "departure"
          ? aircraft.queueIndex === null
            ? "Not queued"
            : `#${aircraft.queueIndex + 1}`
          : "-";

      return {
        id: aircraft.id,
        flightId: aircraft.flightId,
        typeLabel: aircraft.getTypeLabel(),
        stateLabel: aircraft.getStateLabel(),
        runwayLabel: runway ? runway.shortLabel : "Unassigned",
        waitTime: formatTime(aircraft.waitTime),
        profileLabel: aircraft.getProfileLabel(),
        queueLabel,
        note: this.getAircraftNote(aircraft),
        urgencyLabel: aircraft.isUrgent() ? "Urgent" : "Normal",
        isUrgent: aircraft.isUrgent(),
        assignedRunwayId: aircraft.assignedRunwayId,
      };
    }

    getAircraftNote(aircraft) {
      if (aircraft.kind === "arrival") {
        if (!aircraft.assignedRunwayId) {
          return "Needs runway assignment.";
        }
        if (aircraft.state === "approach") {
          return "Ready for landing clearance if runway is safe.";
        }
        if (aircraft.state === "cleared_to_land") {
          return "Committed to the runway.";
        }
        if (aircraft.state === "holding") {
          return "Orbiting until released.";
        }
        return "Manage spacing and urgency.";
      }

      if (!aircraft.assignedRunwayId) {
        return "Needs runway assignment.";
      }
      if (aircraft.state === "lined_up") {
        return "Occupying the runway.";
      }
      if (this.isDepartureLeader(aircraft)) {
        return "First in line for departure.";
      }
      return "Waiting on traffic ahead.";
    }

    getCommandAvailability(selected) {
      if (!selected || this.mode !== "running") {
        return {
          "clear-land": false,
          "clear-takeoff": false,
          hold: false,
          "line-up": false,
          "go-around": false,
        };
      }

      const hasRunway = Boolean(selected.assignedRunwayId);
      const isLeader = this.isDepartureLeader(selected);

      return {
        "clear-land": selected.kind === "arrival" && hasRunway && selected.state === "approach",
        "clear-takeoff":
          selected.kind === "departure" &&
          hasRunway &&
          (selected.state === "lined_up" || (DEPARTURE_QUEUE_STATES.has(selected.state) && isLeader)),
        hold: !["landing", "exiting_airport", "taking_off", "departed", "completed"].includes(selected.state),
        "line-up": selected.kind === "departure" && hasRunway && DEPARTURE_QUEUE_STATES.has(selected.state) && isLeader,
        "go-around": selected.kind === "arrival" && ["approach", "cleared_to_land"].includes(selected.state),
      };
    }

    loop(timestamp) {
      if (!this.lastFrameTime) {
        this.lastFrameTime = timestamp;
      }

      const delta = Math.min((timestamp - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = timestamp;

      if (this.mode === "running" && !this.paused) {
        this.update(delta * this.speed);
      }

      this.render();
      requestAnimationFrame(this.loop);
    }

    render() {
      this.drawScene();
      this.ui.render(this.buildViewModel());
    }

    drawScene() {
      const ctx = this.ctx;
      const { width, height } = this.canvas;

      ctx.clearRect(0, 0, width, height);

      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, "#2d5c35");
      gradient.addColorStop(1, "#1d3821");
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      this.drawBackgroundGrid(ctx, width, height);
      this.drawAirportSurface(ctx);
      this.drawRunways(ctx);
      this.drawAircraftRoutes(ctx);
      this.drawAircraft(ctx);
    }

    drawBackgroundGrid(ctx, width, height) {
      ctx.save();
      ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= width; x += 80) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y <= height; y += 80) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    drawAirportSurface(ctx) {
      const { terminal, tower, hangar, serviceRoads, gates } = this.airport;

      ctx.fillStyle = "#22472a";
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      ctx.fillStyle = "#365b43";
      serviceRoads.forEach((road) => {
        ctx.fillRect(road.x, road.y, road.width, road.height);
      });

      ctx.fillStyle = "#556775";
      ctx.fillRect(terminal.x, terminal.y, terminal.width, terminal.height);
      ctx.fillStyle = "#6f8593";
      ctx.fillRect(terminal.x + 14, terminal.y + 16, terminal.width - 28, 30);

      ctx.fillStyle = "#738694";
      ctx.fillRect(tower.x, tower.y, tower.width, tower.height);
      ctx.fillStyle = "#a3b3c0";
      ctx.fillRect(tower.x - 8, tower.y - 16, tower.width + 16, 18);

      ctx.fillStyle = "#485660";
      ctx.fillRect(hangar.x, hangar.y, hangar.width, hangar.height);

      ctx.fillStyle = "rgba(255, 255, 255, 0.2)";
      gates.forEach((gate) => {
        ctx.fillRect(gate.x - 16, gate.y - 10, 32, 20);
      });
    }

    drawRunways(ctx) {
      this.airport.runways.forEach((runway) => {
        const occupied = runway.occupiedById !== null || runway.reservedArrivalId !== null;
        ctx.save();
        ctx.fillStyle = occupied ? "#53474b" : "#40484f";
        ctx.fillRect(runway.rect.x, runway.rect.y, runway.rect.width, runway.rect.height);

        if (runway.occupiedById !== null) {
          ctx.fillStyle = runway.mode === "landing" ? "rgba(114, 244, 182, 0.25)" : "rgba(255, 191, 102, 0.25)";
          ctx.fillRect(runway.rect.x, runway.rect.y, runway.rect.width, runway.rect.height);
        } else if (runway.reservedArrivalId !== null) {
          ctx.fillStyle = "rgba(126, 215, 255, 0.16)";
          ctx.fillRect(runway.rect.x, runway.rect.y, runway.rect.width, runway.rect.height);
        }

        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.lineWidth = 2;
        ctx.strokeRect(runway.rect.x, runway.rect.y, runway.rect.width, runway.rect.height);

        ctx.setLineDash([20, 14]);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(runway.start.x, runway.start.y);
        ctx.lineTo(runway.end.x, runway.end.y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = "#d6dee4";
        ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
        ctx.fillText(runway.shortLabel, runway.labelPosition.x, runway.labelPosition.y);

        ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
        ctx.lineWidth = 2;
        if (runway.orientation === "horizontal") {
          ctx.beginPath();
          ctx.moveTo(runway.queueOrigin.x - 10, runway.queueOrigin.y - 20);
          ctx.lineTo(runway.queueOrigin.x + 26, runway.queueOrigin.y - 34);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(runway.queueOrigin.x - 22, runway.queueOrigin.y - 12);
          ctx.lineTo(runway.queueOrigin.x - 42, runway.queueOrigin.y - 42);
          ctx.stroke();
        }

        ctx.restore();
      });
    }

    drawAircraftRoutes(ctx) {
      const selected = this.getSelectedAircraft();
      if (!selected || !selected.assignedRunwayId) {
        return;
      }

      const runway = this.getRunway(selected.assignedRunwayId);
      if (!runway) {
        return;
      }

      ctx.save();
      ctx.setLineDash([8, 8]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(selected.x, selected.y);
      if (selected.kind === "arrival") {
        const stackPoint = runway.getArrivalStackPoint(selected.stackOffset);
        ctx.lineTo(stackPoint.x, stackPoint.y);
        ctx.lineTo(runway.touchdownPoint.x, runway.touchdownPoint.y);
      } else {
        const queuePoint = selected.queueTarget ?? runway.queueOrigin;
        ctx.lineTo(queuePoint.x, queuePoint.y);
        ctx.lineTo(runway.lineupPoint.x, runway.lineupPoint.y);
      }
      ctx.stroke();
      ctx.restore();
    }

    drawAircraft(ctx) {
      const selectedId = this.selectedAircraftId;
      const sorted = [...this.aircraft].sort((left, right) => left.y - right.y);

      sorted.forEach((aircraft) => {
        const selected = aircraft.id === selectedId;
        const urgent = aircraft.isUrgent();
        const color = aircraft.kind === "arrival" ? "#7ed7ff" : "#ffbf66";

        ctx.save();
        ctx.translate(aircraft.x, aircraft.y);
        ctx.rotate(aircraft.heading || 0);

        if (urgent) {
          ctx.fillStyle = "rgba(255, 111, 97, 0.18)";
          ctx.beginPath();
          ctx.arc(0, 0, aircraft.displayRadius + 10, 0, Math.PI * 2);
          ctx.fill();
        }

        if (selected) {
          ctx.strokeStyle = "#f4fbff";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, aircraft.displayRadius + 7, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = color;
        if (aircraft.kind === "arrival") {
          ctx.beginPath();
          ctx.moveTo(14, 0);
          ctx.lineTo(-12, -8);
          ctx.lineTo(-10, 0);
          ctx.lineTo(-12, 8);
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -11);
          ctx.lineTo(11, 0);
          ctx.lineTo(0, 11);
          ctx.lineTo(-11, 0);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();

        ctx.save();
        ctx.font = 'bold 12px "Consolas", monospace';
        ctx.textAlign = "center";
        ctx.fillStyle = "#eef6fb";
        ctx.fillRect(aircraft.x - 33, aircraft.y - 31, 66, 16);
        ctx.fillStyle = "#0f1a23";
        ctx.fillText(aircraft.flightId, aircraft.x, aircraft.y - 19);
        ctx.restore();
      });
    }
  }

  AirportTower.Game = Game;
  AirportTower.ARRIVAL_STATES = ARRIVAL_STATES;
  AirportTower.DEPARTURE_QUEUE_STATES = DEPARTURE_QUEUE_STATES;
  AirportTower.COMPLETED_STATES = COMPLETED_STATES;
}(window));
