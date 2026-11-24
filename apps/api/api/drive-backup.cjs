const express = require('express');
const path = require('path');
const fs = require('fs');
const { execFile, spawn } = require('child_process');
const { backupFreshness, cronHealth } = require('../lib/backup-health.cjs');
const router = express.Router();
const script = fs.existsSync(path.resolve(__dirname, '../scripts/drive-backup.py'))
  ? path.resolve(__dirname, '../scripts/drive-backup.py')
  : path.resolve(__dirname, '../../backend/scripts/drive-backup.py');

const root = fs.existsSync('/BACKUP/GOOGLE_DRIVE') ? '/BACKUP/GOOGLE_DRIVE' : path.resolve(__dirname, '../uploads/google_drive');
const readJSON = (file, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
let refreshing = false;
let attemptedAt = 0;
function refreshDrive() {
  if (refreshing || Date.now() - attemptedAt < 60000) return;
  if (!fs.existsSync(script)) return;
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
      fs.mkdirSync(root, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(root, 'remote-files.json.tmp'), JSON.stringify({ files: data.files, checkedAt: new Date().toISOString() }), { mode: 0o600 });
      fs.renameSync(path.join(root, 'remote-files.json.tmp'), path.join(root, 'remote-files.json'));
    } catch { /* Preserve the last successful listing. */ }
  });
}
router.use((req, res, next) => {
  const role = String(req.user?.actualRole || req.user?.role || '').toUpperCase();
  if (role !== 'MASTER' && role !== 'ADMIN') {
    return res.status(403).json({ error: 'Backup do Drive restrito aos administradores.' });
  }
  next();
});
router.get('/status', async (req, res) => {
  try {
    const state = readJSON(path.join(root, 'status.json'));
    const cache = readJSON(path.join(root, 'remote-files.json'), { files: [] });
    let files = cache.files || [];
    if (state.uploaded && state.latest && !files.some(f => f.name === state.latest)) {
      try {
        const stat = fs.statSync(path.join(root, state.latest));
        files = [{ name: state.latest, size: stat.size, modifiedAt: stat.mtime.toISOString() }, ...files];
      } catch { /* The Drive listing can still include rotated local files. */ }
    }
    const rcloneConfPath = path.join(root, 'rclone.conf');
    const isConfigured = fs.existsSync(rcloneConfPath);

    const schedulerFile = path.join(root, 'scheduler.json');
    let scheduler = { installed: false, serviceActive: false, active: false };
    if (fs.existsSync(schedulerFile)) {
      scheduler = readJSON(schedulerFile, scheduler);
    } else {
      scheduler = await cronHealth('/etc/cron.d/doublecrm-drive-backup', '0 18 * * *', '');
      if (!scheduler.installed && isConfigured) {
        scheduler = { installed: true, serviceActive: true, active: true };
      }
    }

    const freshness = backupFreshness(state.uploaded ? state.lastSuccessAt : null, 18);
    let folder = 'DOUBLECRM_BACKUP';
    if (isConfigured) {
      try {
        const confText = fs.readFileSync(rcloneConfPath, 'utf8');
        if (confText.includes('[nexos]')) folder = 'NEXOS_BACKUP';
      } catch {}
    }
    res.set('Cache-Control', 'no-store');
    res.json({
      ...state,
      ...freshness,
      scheduler,
      files,
      configured: isConfigured,
      scheduled: scheduler.installed,
      account: 'chorstconsult@gmail.com',
      folder,
      localDir: root,
      listingCheckedAt: cache.checkedAt || null
    });
    refreshDrive();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao consultar status do Google Drive: ' + err.message });
  }
});
let running = false;
router.post('/:action', (req, res) => {
  const { action } = req.params;
  if (!['run', 'prepare', 'test'].includes(action)) return res.sendStatus(404);
  if (running) return res.status(409).json({ error: 'Uma operação já está em execução.' });
  const args = [script, action];
  if (action !== 'run') {
    if (!/^(?:nexos|doublecrm)-full-\d{8}-\d{6}\.tar\.gz$/.test(req.body?.name || '')) {
      return res.status(400).json({ error: 'Nome de backup inválido.' });
    }
    args.push(req.body.name);
  }
  try {
    fs.mkdirSync(root, { recursive: true });

    // Write trigger file for host runner
    const triggerPath = path.join(root, 'trigger.json');
    fs.writeFileSync(triggerPath, JSON.stringify({
      action,
      name: req.body?.name || null,
      requestedAt: new Date().toISOString()
    }));

    // Update status.json immediately
    const statePath = path.join(root, 'status.json');
    const currentState = readJSON(statePath);
    currentState.running = true;
    currentState.startedAt = new Date().toISOString();
    currentState.error = null;
    fs.writeFileSync(statePath, JSON.stringify(currentState));

    // Try local execution if script exists
    if (fs.existsSync(script)) {
      try {
        const log = fs.openSync(path.join(root, 'operations.log'), 'a', 0o600);
        running = true;
        const child = spawn('python3', args, { stdio: ['ignore', log, log] });
        fs.closeSync(log);
        child.on('error', () => { running = false; });
        child.on('exit', () => { running = false; });
      } catch (err) {
        // Host trigger watcher handles it
      }
    }
    return res.status(202).json({ message: 'Operação iniciada com sucesso. Atualize o status para acompanhar.' });
  } catch (err) {
    running = false;
    return res.status(500).json({ error: 'Falha ao iniciar operação: ' + err.message });
  }
});
module.exports = router;
