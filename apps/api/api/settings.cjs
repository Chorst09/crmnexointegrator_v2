const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { prisma } = require('../lib/prisma.cjs');
const { requireRole } = require('../lib/auth.cjs');

const router = express.Router();


const SETTINGS_KEYS = {
  appName: 'app_name',
  logoUrl: 'logo_url'
};

async function readSettings() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { in: [SETTINGS_KEYS.appName, SETTINGS_KEYS.logoUrl] } },
    select: { key: true, value: true }
  });

  const map = new Map(rows.map((r) => [r.key, r.value]));

  const appName = (map.get(SETTINGS_KEYS.appName) || '').trim() || 'CRM COMERCIAL B2G';
  const rawLogoUrl = (map.get(SETTINGS_KEYS.logoUrl) || '').trim();
  const logoUrl = rawLogoUrl || null;

  return { appName, logoUrl };
}

router.get('/', async (req, res) => {
  try {
    const settings = await readSettings();
    return res.json(settings);
  } catch (error) {
    console.error('Erro ao buscar configurações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

router.put('/', requireRole(['ADMIN']), async (req, res) => {
  try {
    const { appName, logoUrl } = req.body || {};

    const ops = [];

    if (typeof appName === 'string') {
      const v = appName.trim();
      if (v) {
        ops.push(
          prisma.systemSetting.upsert({
            where: { key: SETTINGS_KEYS.appName },
            update: { value: v },
            create: { key: SETTINGS_KEYS.appName, value: v }
          })
        );
      } else {
        ops.push(prisma.systemSetting.deleteMany({ where: { key: SETTINGS_KEYS.appName } }));
      }
    }

    if (typeof logoUrl === 'string') {
      const v = logoUrl.trim();
      if (v) {
        ops.push(
          prisma.systemSetting.upsert({
            where: { key: SETTINGS_KEYS.logoUrl },
            update: { value: v },
            create: { key: SETTINGS_KEYS.logoUrl, value: v }
          })
        );
      } else {
        ops.push(prisma.systemSetting.deleteMany({ where: { key: SETTINGS_KEYS.logoUrl } }));
      }
    }

    if (ops.length > 0) {
      await Promise.all(ops);
    }

    const settings = await readSettings();
    return res.json(settings);
  } catch (error) {
    console.error('Erro ao atualizar configurações:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

const uploadsDir = path.join(__dirname, '..', 'uploads', 'system');

const ensureUploadsDir = () => {
  try {
    fs.mkdirSync(uploadsDir, { recursive: true });
    return true;
  } catch (error) {
    console.error('Erro ao preparar diretório de uploads:', error);
    return false;
  }
};

const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (!ensureUploadsDir()) {
      return cb(new Error('Diretório de upload indisponível'));
    }
    cb(null, uploadsDir);
  },
  filename(req, file, cb) {
    const ext = (path.extname(file.originalname || '') || '').toLowerCase();
    const safeExt = ext.match(/^\.(png|jpe?g|webp|gif)$/) ? ext : '';
    cb(null, `logo-${Date.now()}${safeExt}`);
  }
});

const allowedLogoTypes = new Map([
  ['image/png', ['.png']],
  ['image/jpeg', ['.jpg', '.jpeg']],
  ['image/jpg', ['.jpg', '.jpeg']],
  ['image/webp', ['.webp']],
  ['image/gif', ['.gif']]
]);

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const allowedExtensions = allowedLogoTypes.get(file.mimetype || '');

    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
      return cb(new Error('Arquivo inválido. Envie uma imagem.'));
    }
    return cb(null, true);
  }
});

router.post('/logo', requireRole(['ADMIN']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.filename) {
      return res.status(400).json({ error: 'Arquivo não enviado' });
    }

    const logoPath = `/uploads/system/${req.file.filename}`;

    await prisma.systemSetting.upsert({
      where: { key: SETTINGS_KEYS.logoUrl },
      update: { value: logoPath },
      create: { key: SETTINGS_KEYS.logoUrl, value: logoPath }
    });

    const settings = await readSettings();
    return res.json(settings);
  } catch (error) {
    console.error('Erro ao salvar logo:', error);
    return res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

module.exports = router;
