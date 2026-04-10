(function attachUtils(global) {
  const AirportTower = global.AirportTower = global.AirportTower || {};

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function lerp(start, end, amount) {
    return start + (end - start) * amount;
  }

  function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function randomRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function pick(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function formatTime(totalSeconds) {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(safeSeconds / 60);
    const seconds = safeSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  function average(total, count) {
    return count > 0 ? total / count : 0;
  }

  function createFlightId(prefixes, sequence) {
    const prefix = prefixes[sequence % prefixes.length];
    const number = 100 + ((sequence * 37) % 900);
    return `${prefix}${number}`;
  }

  function canvasPointFromEvent(canvas, event) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  Object.assign(AirportTower, {
    clamp,
    lerp,
    distance,
    randomRange,
    pick,
    formatTime,
    average,
    createFlightId,
    canvasPointFromEvent,
    capitalize,
  });
}(window));
