const fs = require('fs');
const path = require('path');

// Minimal .env loader so the API can run without exporting variables manually.
// - Does not override variables already present in process.env.
// - Supports .env and .env.local (local overrides .env).

const parseEnvValue = (raw) => {
  if (raw === undefined || raw === null) return '';
  const trimmed = String(raw).trim();

  // Strip surrounding quotes.
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const loadFile = (filePath, preexistingKeys) => {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;

    const normalized = raw.startsWith('export ') ? raw.slice('export '.length) : raw;
    const idx = normalized.indexOf('=');
    if (idx < 1) continue;

    const key = normalized.slice(0, idx).trim();
    const value = parseEnvValue(normalized.slice(idx + 1));

    // Never override OS-provided environment variables.
    if (preexistingKeys.has(key)) continue;

    process.env[key] = value;
  }
};

const loadEnv = () => {
  const apiRoot = path.join(__dirname, '..');
  const projectRoot = path.join(apiRoot, '..', '..');
  const preexistingKeys = new Set(Object.keys(process.env));

  // Project-level env files (repo root)
  loadFile(path.join(projectRoot, '.env'), preexistingKeys);
  loadFile(path.join(projectRoot, '.env.local'), preexistingKeys);

  // API-level env files
  loadFile(path.join(apiRoot, '.env'), preexistingKeys);
  loadFile(path.join(apiRoot, '.env.local'), preexistingKeys);
};

// Load on require.
loadEnv();

module.exports = { loadEnv };
