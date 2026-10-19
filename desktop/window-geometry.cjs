'use strict';

function fitWindowBounds(bounds, workArea, minWidth = 920, minHeight = 640) {
  const area = {
    x: Number(workArea.x) || 0,
    y: Number(workArea.y) || 0,
    width: Math.max(1, Math.floor(Number(workArea.width) || 1)),
    height: Math.max(1, Math.floor(Number(workArea.height) || 1))
  };
  const original = {
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    width: Math.max(1, Math.floor(Number(bounds.width) || 1)),
    height: Math.max(1, Math.floor(Number(bounds.height) || 1))
  };

  // Scale down proportionally only when the target display cannot contain the window.
  const scale = Math.min(1, area.width / original.width, area.height / original.height);
  const width = Math.max(1, Math.min(area.width, Math.floor(original.width * scale)));
  const height = Math.max(1, Math.min(area.height, Math.floor(original.height * scale)));
  // A window fitted on a smaller or differently scaled monitor must retain a
  // generous manual-resize range. Keep the familiar minimum on displays where
  // no proportional fit was needed, but lower it on a fitted display so its
  // native constraints cannot turn edge drags into a few-pixel movement.
  const wasScaled = scale < 0.999 || area.width < 1440 || area.height < 940;
  const minW = wasScaled
    ? Math.max(1, Math.min(width, Math.floor(area.width * 0.45), Math.max(480, Math.floor(width * 0.45))))
    : Math.max(1, Math.min(width, Math.floor(Number(minWidth) || 1)));
  const minH = wasScaled
    ? Math.max(1, Math.min(height, Math.floor(area.height * 0.45), Math.max(360, Math.floor(height * 0.45))))
    : Math.max(1, Math.min(height, Math.floor(Number(minHeight) || 1)));

  // Preserve the current position when possible; otherwise keep the full window
  // inside the destination display's usable work area (excluding taskbars).
  const maxX = area.x + area.width - width;
  const maxY = area.y + area.height - height;
  const x = Math.min(maxX, Math.max(area.x, Math.round(original.x)));
  const y = Math.min(maxY, Math.max(area.y, Math.round(original.y)));

  return {
    bounds: { x, y, width, height },
    minWidth: minW,
    minHeight: minH,
    resized: width !== original.width || height !== original.height,
    repositioned: x !== original.x || y !== original.y
  };
}

function isInsideWorkArea(bounds, area) {
  return bounds.x >= area.x && bounds.y >= area.y &&
    bounds.x + bounds.width <= area.x + area.width &&
    bounds.y + bounds.height <= area.y + area.height;
}

module.exports = { fitWindowBounds, isInsideWorkArea };
