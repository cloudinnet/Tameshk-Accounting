'use strict';
const fs = require('node:fs');
const path = require('node:path');

function validPort(value) {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : null;
}

function readPreferredPort(file) {
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    return validPort(saved?.port);
  } catch { return null; }
}

function savePreferredPort(file, value) {
  const port = validPort(value);
  if (!port) throw new TypeError('Invalid local server port');
  fs.mkdirSync(path.dirname(file), { recursive:true });
  const temporary = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify({ port }), { encoding:'utf8', mode:0o600 });
  fs.renameSync(temporary, file);
  return port;
}

module.exports = Object.freeze({ validPort, readPreferredPort, savePreferredPort });
