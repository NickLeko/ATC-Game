(function attachConfig(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};

  AirportTower.GAME_CONFIG = {
    canvas: {
      width: 1180,
      height: 760,
    },
    roundLengths: [
      { label: "5 Minutes", value: 300 },
      { label: "10 Minutes", value: 600 },
    ],
    speedOptions: [1, 2, 3],
    startingMeters: {
      safety: 100,
      efficiency: 100,
      satisfaction: 100,
    },
    delayThresholds: [40, 75, 110],
    flightPrefixes: ["ATC", "SKY", "ORB", "JET", "SUN", "ARC", "PIN", "NVA"],
    difficulties: {
      easy: {
        key: "easy",
        label: "Easy",
        spawnInterval: {
          opening: [14, 18],
          peak: [8, 11],
        },
        maxActive: 8,
        urgencyChance: 0.08,
        maxUrgentActive: 1,
        runwayCooldown: {
          arrival: 8,
          takeoff: 6,
        },
        queueSpacing: 48,
        idlePenalty: 0.65,
        efficiencyGain: 0.4,
        satisfactionDrain: 0.032,
        urgentSatisfactionDrain: 0.085,
        urgentSafetyDrain: 0.16,
        penaltyMultiplier: 0.8,
        flowBonusTarget: 2,
        heavyChance: 0.12,
      },
      medium: {
        key: "medium",
        label: "Medium",
        spawnInterval: {
          opening: [11, 14],
          peak: [6, 8.5],
        },
        maxActive: 10,
        urgencyChance: 0.16,
        maxUrgentActive: 2,
        runwayCooldown: {
          arrival: 7,
          takeoff: 5,
        },
        queueSpacing: 46,
        idlePenalty: 0.95,
        efficiencyGain: 0.5,
        satisfactionDrain: 0.045,
        urgentSatisfactionDrain: 0.12,
        urgentSafetyDrain: 0.24,
        penaltyMultiplier: 1,
        flowBonusTarget: 3,
        heavyChance: 0.18,
      },
      expert: {
        key: "expert",
        label: "Expert",
        spawnInterval: {
          opening: [8, 10.5],
          peak: [4.8, 6.3],
        },
        maxActive: 12,
        urgencyChance: 0.24,
        maxUrgentActive: 3,
        runwayCooldown: {
          arrival: 6,
          takeoff: 4.4,
        },
        queueSpacing: 44,
        idlePenalty: 1.2,
        efficiencyGain: 0.62,
        satisfactionDrain: 0.064,
        urgentSatisfactionDrain: 0.16,
        urgentSafetyDrain: 0.35,
        penaltyMultiplier: 1.22,
        flowBonusTarget: 3,
        heavyChance: 0.22,
      },
    },
  };

  AirportTower.SCORING = {
    landing: 100,
    takeoff: 100,
    goAround: 75,
    delayPenalties: [25, 45, 70],
    urgentDelayBonusPenalty: 30,
    repeatedHoldPenalty: 12,
    idleBacklogPenalty: 8,
    flowBonus: 30,
    streakStep: 5,
    streakCap: 25,
    flowWindow: 18,
    unsafeMajor: 400,
  };

  AirportTower.AIRCRAFT_PROFILES = {
    standard: {
      label: "Standard",
      cruise: 104,
      approach: 98,
      taxi: 56,
      rollout: 78,
      orbitSpeed: 1.5,
      separation: 1,
    },
    fast: {
      label: "Fast",
      cruise: 118,
      approach: 112,
      taxi: 60,
      rollout: 84,
      orbitSpeed: 1.75,
      separation: 0.9,
    },
    heavy: {
      label: "Heavy",
      cruise: 90,
      approach: 88,
      taxi: 48,
      rollout: 70,
      orbitSpeed: 1.25,
      separation: 1.25,
    },
  };

  AirportTower.PERFORMANCE_LABELS = [
    { min: 540, label: "Runway Wizard" },
    { min: 450, label: "Tower Expert" },
    { min: 360, label: "Steady Operator" },
    { min: 0, label: "Rookie Controller" },
  ];

  AirportTower.STATE_LABELS = {
    inbound: "Inbound",
    holding: "Holding",
    approach: "On Approach",
    cleared_to_land: "Cleared To Land",
    landing: "Landing Roll",
    exiting_airport: "Exit Runway",
    go_around: "Going Around",
    at_gate: "At Gate",
    taxi_ready: "Taxiing To Queue",
    queued: "Queued",
    lined_up: "Lined Up",
    taking_off: "Taking Off",
    departed: "Departed",
    completed: "Handled",
  };
}(window));
