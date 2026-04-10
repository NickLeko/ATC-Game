(function attachAirport(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};
  const { GAME_CONFIG, Runway } = AirportTower;

  function createAirportLayout() {
    const runways = [
      new Runway({
        id: "RWY_09_27",
        label: "Runway 09/27",
        shortLabel: "09/27",
        orientation: "horizontal",
        rect: { x: 150, y: 201, width: 890, height: 58 },
        start: { x: 150, y: 230 },
        end: { x: 1040, y: 230 },
        touchdownPoint: { x: 168, y: 230 },
        rolloutPoint: { x: 448, y: 230 },
        exitPoint: { x: 492, y: 332 },
        arrivalExitTarget: { x: 430, y: 380 },
        approachPoint: { x: 8, y: 230 },
        approachHoldBase: { x: 84, y: 160 },
        goAroundPoint: { x: 332, y: 118 },
        queueOrigin: { x: 178, y: 304 },
        queueVector: { x: -1, y: 0.28 },
        lineupPoint: { x: 205, y: 230 },
        takeoffEnd: { x: 1084, y: 230 },
        departExitPoint: { x: 1300, y: 230 },
        labelPosition: { x: 593, y: 186 },
      }),
      new Runway({
        id: "RWY_18_36",
        label: "Runway 18/36",
        shortLabel: "18/36",
        orientation: "vertical",
        rect: { x: 731, y: 98, width: 58, height: 552 },
        start: { x: 760, y: 650 },
        end: { x: 760, y: 98 },
        touchdownPoint: { x: 760, y: 636 },
        rolloutPoint: { x: 760, y: 358 },
        exitPoint: { x: 642, y: 330 },
        arrivalExitTarget: { x: 590, y: 320 },
        approachPoint: { x: 760, y: 848 },
        approachHoldBase: { x: 848, y: 700 },
        goAroundPoint: { x: 940, y: 510 },
        queueOrigin: { x: 698, y: 652 },
        queueVector: { x: -0.28, y: 1 },
        lineupPoint: { x: 760, y: 604 },
        takeoffEnd: { x: 760, y: 52 },
        departExitPoint: { x: 760, y: -140 },
        labelPosition: { x: 818, y: 372 },
      }),
    ];

    return {
      width: GAME_CONFIG.canvas.width,
      height: GAME_CONFIG.canvas.height,
      runways,
      gates: [
        { x: 226, y: 615 },
        { x: 272, y: 655 },
        { x: 318, y: 615 },
        { x: 364, y: 655 },
      ],
      arrivalEntries: [
        { spawn: { x: -120, y: 136 }, holding: { x: 150, y: 112 } },
        { spawn: { x: 1220, y: 118 }, holding: { x: 1006, y: 122 } },
        { spawn: { x: 1280, y: 702 }, holding: { x: 1008, y: 626 } },
        { spawn: { x: 604, y: -120 }, holding: { x: 610, y: 106 } },
      ],
      terminal: { x: 148, y: 520, width: 292, height: 110 },
      tower: { x: 474, y: 508, width: 44, height: 82 },
      hangar: { x: 166, y: 666, width: 188, height: 48 },
      serviceRoads: [
        { x: 120, y: 482, width: 370, height: 10 },
        { x: 514, y: 536, width: 168, height: 10 },
      ],
    };
  }

  AirportTower.createAirportLayout = createAirportLayout;
}(window));
