'use strict';

function isMainWindowEvent(event, mainContents) {
  return !!event && !!mainContents && event.sender === mainContents;
}

function isMainFrameEvent(event, contents) {
  return !!event && !!contents && event.sender === contents &&
    !!event.senderFrame && event.senderFrame === contents.mainFrame;
}

function cleanNotificationText(value, limit = 180) {
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.min(2000, Math.floor(Number(limit)))) : 180;
  return String(value ?? '').replace(/[\r\n\t\u0000-\u001f\u007f]+/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, max);
}

function boundedLogValue(value, budget = { remaining: 6000 }, seen = new WeakSet(), depth = 0) {
  if (budget.remaining <= 0) return '[truncated]';
  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    budget.remaining -= 16;
    return value;
  }
  if (typeof value === 'string') {
    const text = cleanNotificationText(value, Math.min(1200, budget.remaining));
    budget.remaining -= text.length;
    return text;
  }
  if (typeof value !== 'object') return String(value);
  if (seen.has(value)) return '[circular]';
  if (depth >= 4) return '[depth limited]';
  seen.add(value);
  const output = Array.isArray(value) ? [] : {};
  let count = 0;
  for (const key in value) {
    if (!Object.hasOwn(value, key)) continue;
    if (count >= 40 || budget.remaining <= 0) { output._truncated = true; break; }
    const safeKey = cleanNotificationText(key, 100);
    if (!safeKey) continue;
    if (Array.isArray(output)) output.push(boundedLogValue(value[key], budget, seen, depth + 1));
    else output[safeKey] = boundedLogValue(value[key], budget, seen, depth + 1);
    count++;
  }
  seen.delete(value);
  return output;
}

function sanitizeRendererLogEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const level = ['ERROR', 'WARN', 'INFO', 'DEBUG'].includes(String(entry.level || '').toUpperCase())
    ? String(entry.level).toUpperCase() : 'ERROR';
  let details;
  if (entry.details !== undefined) {
    try { details = JSON.stringify(boundedLogValue(entry.details)); }
    catch { details = '[details unavailable]'; }
  }
  return {
    kind: entry.kind === 'error' ? 'error' : 'info',
    level,
    message: cleanNotificationText(entry.message || 'Renderer event', 2000),
    details
  };
}

module.exports = Object.freeze({ isMainWindowEvent, isMainFrameEvent, cleanNotificationText, sanitizeRendererLogEntry });
