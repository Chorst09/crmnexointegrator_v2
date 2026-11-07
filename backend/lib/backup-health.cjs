const fs = require('node:fs/promises');
const { execFile } = require('node:child_process');

// Brasília has used UTC-03 without daylight saving since 2019.
function backupFreshness(lastSuccessAt, hour, minute = 0, now = new Date()) {
  const local = new Date(now.getTime() - 3 * 3600000);
  let due = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), hour + 3, minute);
  if (now.getTime() < due) due -= 86400000;
  const success = Date.parse(lastSuccessAt);
  const overdue = !Number.isFinite(success) || success < due;
  return { overdue, expectedBackupAt: new Date(due).toISOString(), nextBackupAt: new Date(due + 86400000).toISOString() };
}

async function cronHealth(file, expression, command) {
  const content = await fs.readFile(file, 'utf8').catch(() => '');
  const installed = content.split('\n').some(line => {
    const parts = line.trim().split(/\s+/);
    return parts.slice(0, 5).join(' ') === expression && parts[5] === 'root' && parts.slice(6).join(' ').startsWith(command);
  });
  const serviceActive = await new Promise(resolve => {
    execFile('systemctl', ['is-active', 'cron.service', 'crond.service'], { timeout: 3000 }, (_error, stdout) => {
      resolve(String(stdout).split(/\s+/).includes('active'));
    });
  });
  return { installed, serviceActive, active: installed && serviceActive };
}

module.exports = { backupFreshness, cronHealth };
