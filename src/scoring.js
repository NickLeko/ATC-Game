(function attachScoring(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const { PERFORMANCE_LABELS, SCORING, average } = AirportTower;

  class ScoreKeeper {
    constructor() {
      this.reset();
    }

    reset() {
      this.score = 0;
      this.totalHandled = 0;
      this.arrivalsLanded = 0;
      this.departuresLaunched = 0;
      this.totalDelay = 0;
      this.goArounds = 0;
      this.safetyIncidents = 0;
      this.delayPenalties = 0;
      this.flowBonuses = 0;
      this.streak = 0;
      this.recentOperations = [];
    }

    add(points) {
      this.score = Math.max(0, Math.round(this.score + points));
    }

    recordLanding(aircraft, now, flowTarget) {
      this.totalHandled += 1;
      this.arrivalsLanded += 1;
      this.totalDelay += aircraft.waitTime;
      this.add(SCORING.landing);
      this.recordFlow(now, flowTarget);
    }

    recordTakeoff(aircraft, now, flowTarget) {
      this.totalHandled += 1;
      this.departuresLaunched += 1;
      this.totalDelay += aircraft.waitTime;
      this.add(SCORING.takeoff);
      this.recordFlow(now, flowTarget);
    }

    recordFlow(now, flowTarget) {
      this.streak += 1;
      this.add(Math.min(this.streak * SCORING.streakStep, SCORING.streakCap));

      this.recentOperations = this.recentOperations.filter((time) => now - time <= SCORING.flowWindow);
      this.recentOperations.push(now);

      if (this.recentOperations.length >= flowTarget) {
        this.flowBonuses += 1;
        this.add(SCORING.flowBonus);
        this.recentOperations = this.recentOperations.slice(-1);
      }
    }

    recordGoAround() {
      this.goArounds += 1;
      this.streak = 0;
      this.add(-SCORING.goAround);
    }

    recordDelayPenalty(points) {
      this.delayPenalties += 1;
      this.streak = 0;
      this.add(-Math.abs(points));
    }

    recordIdlePenalty() {
      this.add(-SCORING.idleBacklogPenalty);
    }

    recordHoldPenalty() {
      this.streak = 0;
      this.add(-SCORING.repeatedHoldPenalty);
    }

    recordSafetyIncident(major = false) {
      this.safetyIncidents += 1;
      this.streak = 0;
      if (major) {
        this.add(-SCORING.unsafeMajor);
      }
    }

    determineLabel(summary) {
      if (summary.status === "failed" && summary.safety <= 0) {
        return PERFORMANCE_LABELS[PERFORMANCE_LABELS.length - 1].label;
      }

      const scoreRate = this.score / Math.max(1, summary.elapsedMinutes);
      const rating = scoreRate + summary.safety * 3 + summary.efficiency * 1.5 + summary.satisfaction * 1.5;

      const match = PERFORMANCE_LABELS.find((label) => rating >= label.min);
      return match ? match.label : PERFORMANCE_LABELS[PERFORMANCE_LABELS.length - 1].label;
    }

    buildSummary({ status, reason, meters, elapsedSeconds, difficultyLabel }) {
      const averageDelay = average(this.totalDelay, this.totalHandled);
      const summary = {
        status,
        reason,
        score: this.score,
        totalHandled: this.totalHandled,
        arrivalsLanded: this.arrivalsLanded,
        departuresLaunched: this.departuresLaunched,
        averageDelay,
        goArounds: this.goArounds,
        safetyIncidents: this.safetyIncidents,
        safety: Math.round(meters.safety),
        efficiency: Math.round(meters.efficiency),
        satisfaction: Math.round(meters.satisfaction),
        elapsedMinutes: elapsedSeconds / 60,
        difficultyLabel,
      };

      summary.performanceLabel = this.determineLabel(summary);
      return summary;
    }
  }

  AirportTower.ScoreKeeper = ScoreKeeper;
}(window));
