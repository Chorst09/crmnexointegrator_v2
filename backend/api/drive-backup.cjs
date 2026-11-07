const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { backupFreshness, cronHealth } = require('../lib/backup-health.cjs');
const router = express.Router();
const script = path.resolve(__dirname, '../scripts/drive-backup.py');
const root = '/BACKUP/GOOGLE_DRIVE';
const readJSON = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
let refreshing = false;
let attemptedAt = 0;
function refreshDrive() {
  if (refreshing || Date.now() - attemptedAt < 60000) return;
  refreshing = true;
  attemptedAt = Date.now();
  const worker = execFile('python3', [script, 'status'], { detached: true, timeout: 25000, maxBuffer: 2 * 1024 * 1024 }, (err, stdout) => {
    refreshing = false;
    if (err) {
      try { process.kill(-worker.pid, 'SIGTERM'); } catch { /* Already exited. */ }
      return;
    }
    try {
      const data = JSON.parse(stdout);
      if (data.connectionError) return;
      fs.writeFileSync(`${root}/remote-files.json.tmp`, JSON.stringify({ files: data.files, checkedAt: new Date().toISOString() }), { mode: 0o600 });
      fs.renameSync(`${root}/remote-files.json.tmp`, `${root}/remote-files.json`);
    } catch { /* Preserve the last successful listing. */ }
  });
}
router.use((req, res, next) => {
  if (String(req.user?.actualRole || req.user?.role).toUpperCase() !== 'MASTER') {
    return res.status(403).json({ error: 'Backup do Drive restrito ao usuário MASTER.' });
  }
  next();
});
router.get('/status', async (req, res) => {
  const state = readJSON(`${root}/status.json`);
  const cache = readJSON(`${root}/remote-files.json`, { files: [] });
  let files = cache.files || [];
  if (state.uploaded && state.latest && !files.some(f => f.name === state.latest)) {
    try {
      const stat = fs.statSync(path.join(root, state.latest));
      files = [{ name: state.latest, size: stat.size, modifiedAt: stat.mtime.toISOString() }, ...files];
    } catch { /* The Drive listing can still include rotated local files. */ }
  }
  const scheduler = await cronHealth('/etc/cron.d/doublecrm-drive-backup', '0 18 * * *', '');
  const freshness = backupFreshness(state.uploaded ? state.lastSuccessAt : null, 18);
  res.set('Cache-Control', 'no-store');
  res.json({ ...state, ...freshness, scheduler, files, configured: fs.existsSync(`${root}/rclone.conf`), scheduled: scheduler.installed,
    account: 'chorstconsult@gmail.com', folder: 'DOUBLECRM_BACKUP',
    localDir: root, listingCheckedAt: cache.checkedAt || null });
  refreshDrive();
});
let running = false;
router.post('/:action', (req, res) => {
  const { action } = req.params;
  if (!['run', 'prepare', 'test'].includes(action)) return res.sendStatus(404);
  if (running) return res.status(409).json({ error: 'Uma operação já está em execução.' });
  const args = [script, action];
  if (action !== 'run') {
    if (!/^doublecrm-full-\d{8}-\d{6}\.tar\.gz$/.test(req.body?.name || '')) {
      return res.status(400).json({ error: 'Nome de backup inválido.' });
    }
    args.push(req.body.name);
  }
  fs.mkdirSync('/BACKUP/GOOGLE_DRIVE', { recursive: true, mode: 0o700 });
  const log = fs.openSync('/BACKUP/GOOGLE_DRIVE/operations.log', 'a', 0o600);
  running = true;
  const child = spawn('python3', args, { stdio: ['ignore', log, log] });
  fs.closeSync(log);
  child.on('error', () => { running = false; });
  child.on('exit', () => { running = false; });
  return res.status(202).json({ message: 'Operação iniciada. Atualize o status para acompanhar.' });
});
module.exports = router;
