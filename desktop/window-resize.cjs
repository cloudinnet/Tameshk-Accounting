'use strict';

const VALID_DIRECTIONS = new Set(['n','s','e','w','ne','nw','se','sw']);

function resizeBoundsFromDrag(start, direction, delta, minimum = {}) {
  if (!VALID_DIRECTIONS.has(direction)) throw new Error(`Unsupported resize direction: ${direction}`);
  const minWidth = Math.max(1, Math.floor(Number(minimum.width) || 1));
  const minHeight = Math.max(1, Math.floor(Number(minimum.height) || 1));
  const dx = Number(delta.x) || 0;
  const dy = Number(delta.y) || 0;
  let { x, y, width, height } = start;
  if (direction.includes('e')) width = Math.max(minWidth, start.width + dx);
  if (direction.includes('s')) height = Math.max(minHeight, start.height + dy);
  if (direction.includes('w')) { width = Math.max(minWidth, start.width - dx); x = start.x + start.width - width; }
  if (direction.includes('n')) { height = Math.max(minHeight, start.height - dy); y = start.y + start.height - height; }
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

module.exports = { resizeBoundsFromDrag, VALID_DIRECTIONS };
