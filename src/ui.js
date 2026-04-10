(function attachUi(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const { canvasPointFromEvent, formatTime } = AirportTower;
  const HIGH_SCORE_KEY = "airport-tower-highscores-v1";

  class UI {
    constructor(documentRef) {
      this.document = documentRef;
      this.canvas = this.document.getElementById("game-canvas");

      this.menuScreen = this.document.getElementById("menu-screen");
      this.summaryScreen = this.document.getElementById("summary-screen");
      this.startButton = this.document.getElementById("start-game-btn");
      this.playAgainButton = this.document.getElementById("play-again-btn");
      this.returnMenuButton = this.document.getElementById("return-menu-btn");
      this.pauseButton = this.document.getElementById("pause-btn");
      this.speedButtons = [...this.document.querySelectorAll(".speed-btn")];
      this.difficultyButtons = [...this.document.querySelectorAll("[data-difficulty]")];
      this.roundButtons = [...this.document.querySelectorAll("[data-round]")];
      this.commandButtons = [...this.document.querySelectorAll("[data-command]")];
      this.assignButtons = [...this.document.querySelectorAll("[data-runway]")];

      this.menuHighScore = this.document.getElementById("menu-high-score");
      this.statusLine = this.document.getElementById("status-line");
      this.warningBanner = this.document.getElementById("warning-banner");
      this.eventLog = this.document.getElementById("event-log");
      this.runwayStatusList = this.document.getElementById("runway-status-list");

      this.hudTimer = this.document.getElementById("hud-timer");
      this.hudScore = this.document.getElementById("hud-score");
      this.hudDifficulty = this.document.getElementById("hud-difficulty");
      this.hudSafetyValue = this.document.getElementById("hud-safety-value");
      this.hudEfficiencyValue = this.document.getElementById("hud-efficiency-value");
      this.hudSatisfactionValue = this.document.getElementById("hud-satisfaction-value");
      this.hudSafetyFill = this.document.getElementById("hud-safety-fill");
      this.hudEfficiencyFill = this.document.getElementById("hud-efficiency-fill");
      this.hudSatisfactionFill = this.document.getElementById("hud-satisfaction-fill");

      this.selectedEmpty = this.document.getElementById("selected-empty");
      this.selectedContent = this.document.getElementById("selected-content");
      this.selectedFlight = this.document.getElementById("selected-flight");
      this.selectedType = this.document.getElementById("selected-type");
      this.selectedUrgencyChip = this.document.getElementById("selected-urgency-chip");
      this.selectedStatus = this.document.getElementById("selected-status");
      this.selectedRunway = this.document.getElementById("selected-runway");
      this.selectedWait = this.document.getElementById("selected-wait");
      this.selectedProfile = this.document.getElementById("selected-profile");
      this.selectedQueue = this.document.getElementById("selected-queue");
      this.selectedNote = this.document.getElementById("selected-note");

      this.summaryStatus = this.document.getElementById("summary-status");
      this.summaryLabel = this.document.getElementById("summary-label");
      this.summaryReason = this.document.getElementById("summary-reason");
      this.summaryIncident = this.document.getElementById("summary-incident");
      this.summaryIncidentTitle = this.document.getElementById("summary-incident-title");
      this.summaryIncidentCause = this.document.getElementById("summary-incident-cause");
      this.summaryIncidentGuidance = this.document.getElementById("summary-incident-guidance");
      this.summaryScore = this.document.getElementById("summary-score");
      this.summaryBest = this.document.getElementById("summary-best");
      this.summaryHandled = this.document.getElementById("summary-handled");
      this.summaryLanded = this.document.getElementById("summary-landed");
      this.summaryDeparted = this.document.getElementById("summary-departed");
      this.summaryDelay = this.document.getElementById("summary-delay");
      this.summaryGoArounds = this.document.getElementById("summary-go-arounds");
      this.summaryIncidents = this.document.getElementById("summary-incidents");
      this.summaryMeters = this.document.getElementById("summary-meters");
      this.summaryDifficulty = this.document.getElementById("summary-difficulty");
    }

    bind(callbacks) {
      this.callbacks = callbacks;

      this.startButton.addEventListener("click", () => {
        callbacks.onStart(this.getMenuSettings());
      });

      this.playAgainButton.addEventListener("click", () => {
        callbacks.onPlayAgain();
      });

      this.returnMenuButton.addEventListener("click", () => {
        callbacks.onReturnToMenu();
      });

      this.pauseButton.addEventListener("click", () => {
        callbacks.onPauseToggle();
      });

      this.speedButtons.forEach((button) => {
        button.addEventListener("click", () => {
          callbacks.onSpeedChange(Number(button.dataset.speed));
        });
      });

      this.difficultyButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.markSelected(this.difficultyButtons, button);
          this.updateMenuHighScore();
        });
      });

      this.roundButtons.forEach((button) => {
        button.addEventListener("click", () => {
          this.markSelected(this.roundButtons, button);
          this.updateMenuHighScore();
        });
      });

      this.commandButtons.forEach((button) => {
        button.addEventListener("click", () => {
          callbacks.onCommand(button.dataset.command);
        });
      });

      this.assignButtons.forEach((button) => {
        button.addEventListener("click", () => {
          callbacks.onAssignRunway(button.dataset.runway);
        });
      });

      this.canvas.addEventListener("click", (event) => {
        callbacks.onCanvasClick(canvasPointFromEvent(this.canvas, event));
      });
    }

    getMenuSettings() {
      const difficultyButton = this.difficultyButtons.find((button) => button.classList.contains("is-active"));
      const roundButton = this.roundButtons.find((button) => button.classList.contains("is-active"));

      return {
        difficulty: difficultyButton?.dataset.difficulty ?? "easy",
        roundLength: Number(roundButton?.dataset.round ?? 300),
      };
    }

    markSelected(buttons, target) {
      buttons.forEach((button) => {
        button.classList.toggle("is-active", button === target);
      });
    }

    updateMenuHighScore() {
      const bestScore = this.getHighScore(this.getMenuSettings());
      this.menuHighScore.textContent = bestScore ? `Best score: ${bestScore}` : "Best score: --";
    }

    showMenu() {
      this.summaryScreen.classList.add("hidden");
      this.menuScreen.classList.remove("hidden");
      this.updateMenuHighScore();
    }

    hideMenu() {
      this.menuScreen.classList.add("hidden");
    }

    hideSummary() {
      this.summaryScreen.classList.add("hidden");
    }

    showSummary(summary) {
      const failed = summary.status === "failed";
      this.summaryStatus.textContent = failed ? "Safety Violation" : "Round Complete";
      this.summaryLabel.textContent = failed
        ? summary.failureReport?.headline ?? "Unsafe Runway Operation"
        : summary.performanceLabel;
      this.summaryReason.textContent = failed
        ? summary.failureReport?.summary ?? summary.reason
        : summary.reason;

      if (failed && summary.failureReport) {
        this.summaryIncident.classList.remove("hidden");
        this.summaryIncidentTitle.textContent = summary.failureReport.title;
        this.summaryIncidentCause.textContent = summary.failureReport.cause;
        this.summaryIncidentGuidance.textContent = summary.failureReport.guidance;
      } else {
        this.summaryIncident.classList.add("hidden");
        this.summaryIncidentTitle.textContent = "";
        this.summaryIncidentCause.textContent = "";
        this.summaryIncidentGuidance.textContent = "";
      }

      this.summaryScore.textContent = String(summary.score);
      this.summaryHandled.textContent = String(summary.totalHandled);
      this.summaryLanded.textContent = String(summary.arrivalsLanded);
      this.summaryDeparted.textContent = String(summary.departuresLaunched);
      this.summaryDelay.textContent = formatTime(summary.averageDelay);
      this.summaryGoArounds.textContent = String(summary.goArounds);
      this.summaryIncidents.textContent = String(summary.safetyIncidents);
      this.summaryMeters.textContent = `${summary.safety} / ${summary.efficiency} / ${summary.satisfaction}`;
      this.summaryDifficulty.textContent = summary.difficultyLabel;

      const bestScore = this.recordHighScore(summary.settings, summary.score);
      this.summaryBest.textContent = bestScore ? `Best score: ${bestScore}` : "Best score: --";

      this.summaryScreen.classList.remove("hidden");
    }

    render(view) {
      this.hudTimer.textContent = view.timer;
      this.hudScore.textContent = String(view.score);
      this.hudDifficulty.textContent = view.difficultyLabel;
      this.pauseButton.textContent = view.paused ? "Resume" : "Pause";

      this.renderMeter(this.hudSafetyValue, this.hudSafetyFill, view.meters.safety);
      this.renderMeter(this.hudEfficiencyValue, this.hudEfficiencyFill, view.meters.efficiency);
      this.renderMeter(this.hudSatisfactionValue, this.hudSatisfactionFill, view.meters.satisfaction);

      this.speedButtons.forEach((button) => {
        button.classList.toggle("is-active", Number(button.dataset.speed) === view.speed);
      });

      this.statusLine.textContent = view.statusLine;

      if (view.warning) {
        this.warningBanner.classList.remove("hidden");
        this.warningBanner.textContent = view.warning;
      } else {
        this.warningBanner.classList.add("hidden");
        this.warningBanner.textContent = "";
      }

      this.renderSelectedAircraft(view.selectedAircraft);
      this.renderCommands(view);
      this.renderRunwayCards(view.runways);
      this.renderEventLog(view.events);
    }

    renderMeter(valueNode, fillNode, value) {
      const rounded = Math.max(0, Math.round(value));
      valueNode.textContent = String(rounded);
      fillNode.style.width = `${rounded}%`;
    }

    renderSelectedAircraft(selected) {
      if (!selected) {
        this.selectedEmpty.classList.remove("hidden");
        this.selectedContent.classList.add("hidden");
        return;
      }

      this.selectedEmpty.classList.add("hidden");
      this.selectedContent.classList.remove("hidden");

      this.selectedFlight.textContent = selected.flightId;
      this.selectedType.textContent = selected.typeLabel;
      this.selectedUrgencyChip.textContent = selected.urgencyLabel;
      this.selectedUrgencyChip.classList.toggle("is-urgent", selected.isUrgent);
      this.selectedStatus.textContent = selected.stateLabel;
      this.selectedRunway.textContent = selected.runwayLabel;
      this.selectedWait.textContent = selected.waitTime;
      this.selectedProfile.textContent = selected.profileLabel;
      this.selectedQueue.textContent = selected.queueLabel;
      this.selectedNote.textContent = selected.note;
    }

    renderCommands(view) {
      this.commandButtons.forEach((button) => {
        const key = button.dataset.command;
        button.disabled = !view.commandAvailability[key];
      });

      this.assignButtons.forEach((button) => {
        button.disabled = !view.runwayAssignmentEnabled;
        button.classList.toggle("is-active", view.selectedAircraft?.assignedRunwayId === button.dataset.runway);
      });
    }

    renderRunwayCards(runways) {
      this.runwayStatusList.innerHTML = runways
        .map((runway) => `
          <article class="runway-card">
            <h4>${runway.label}</h4>
            <p>Status: ${runway.status}</p>
            <p>Queue: ${runway.queueCount} waiting</p>
            <p>${runway.cooldownText}</p>
          </article>
        `)
        .join("");
    }

    renderEventLog(events) {
      this.eventLog.innerHTML = events
        .map((event) => `<li>${event}</li>`)
        .join("");
    }

    recordHighScore(settings, score) {
      const scores = this.loadScores();
      const key = this.buildScoreKey(settings);
      const previous = scores[key] ?? 0;
      scores[key] = Math.max(previous, score);
      this.saveScores(scores);
      return scores[key];
    }

    getHighScore(settings) {
      const scores = this.loadScores();
      return scores[this.buildScoreKey(settings)] ?? 0;
    }

    buildScoreKey(settings) {
      return `${settings.difficulty}-${settings.roundLength}`;
    }

    loadScores() {
      try {
        return JSON.parse(window.localStorage.getItem(HIGH_SCORE_KEY) ?? "{}");
      } catch (error) {
        return {};
      }
    }

    saveScores(scores) {
      try {
        window.localStorage.setItem(HIGH_SCORE_KEY, JSON.stringify(scores));
      } catch (error) {
        return;
      }
    }
  }

  AirportTower.UI = UI;
}(window));
