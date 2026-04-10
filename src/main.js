(function bootMain(global) {
  const { Game, UI } = global.AirportTower;

  const ui = new UI(document);
  const game = new Game({
    canvas: ui.canvas,
    ui,
  });

  global.airportTowerGame = game;
  global.airportTowerUI = ui;

  ui.bind({
    onStart: (settings) => game.start(settings),
    onPlayAgain: () => game.playAgain(),
    onReturnToMenu: () => game.returnToMenu(),
    onPauseToggle: () => game.togglePause(),
    onSpeedChange: (speed) => game.setSpeed(speed),
    onCanvasClick: (point) => game.handleCanvasClick(point),
    onCommand: (command) => game.handleCommand(command),
    onAssignRunway: (runwayId) => game.assignRunway(runwayId),
  });

  ui.updateMenuHighScore();
  game.init();

  const params = new URLSearchParams(global.location.search);
  const autoStart = params.get("autostart") === "1";
  const difficulty = ["easy", "medium", "expert"].includes(params.get("difficulty")) ? params.get("difficulty") : "easy";
  const roundLength = [300, 600].includes(Number(params.get("round"))) ? Number(params.get("round")) : 300;

  if (autoStart) {
    game.start({
      difficulty,
      roundLength,
    });
  }
}(window));
