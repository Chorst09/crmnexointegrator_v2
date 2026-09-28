import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const MAX_UPLOAD_SIZE_BYTES = 512 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.sql', '.gz', '.sql.gz'];

const sanitizeFilename = (filename: string) => {
  const base = path.basename(filename || 'backup-upload');
  return base.replace(/[^a-zA-Z0-9._-]/g, '-');
};

const toSqlGzName = (filename: string) => {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.sql.gz')) return filename;
  if (lower.endsWith('.sql')) return `${filename}.gz`;
  if (lower.endsWith('.gz')) return filename.replace(/\.gz$/i, '.sql.gz');
  return `${filename}.sql.gz`;
};

const isAllowedBackupExtension = (filename: string) => {
  const lower = filename.toLowerCase();
  return ALLOWED_EXTENSIONS.some((extension) => lower.endsWith(extension));
};

export async function POST(request: NextRequest) {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Arquivo de backup não enviado' }, { status: 400 });
    }

    if (!file.name || !isAllowedBackupExtension(file.name)) {
      return NextResponse.json(
        { error: 'Formato inválido. Envie um arquivo .sql, .gz ou .sql.gz' },
        { status: 400 }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json({ error: 'Arquivo vazio' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Limite de ${Math.floor(MAX_UPLOAD_SIZE_BYTES / (1024 * 1024))}MB` },
        { status: 400 }
      );
    }

    const sanitizedName = sanitizeFilename(file.name);
    const normalizedName = toSqlGzName(sanitizedName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseName = normalizedName.replace(/\.sql\.gz$/i, '');
    const filename = `${baseName}-${timestamp}.sql.gz`;
    const backupPath = path.join(BACKUP_DIR, filename);

    const rawBuffer = Buffer.from(await file.arrayBuffer());
    const shouldCompress = sanitizedName.toLowerCase().endsWith('.sql');
    const backupBuffer = shouldCompress ? await gzipAsync(rawBuffer) : rawBuffer;

    await fs.writeFile(backupPath, backupBuffer);
    const stats = await fs.stat(backupPath);

    return NextResponse.json({
      success: true,
      message: 'Backup enviado com sucesso',
      backup: {
        filename,
        size: stats.size,
        created_at: stats.mtime,
        path: backupPath,
      },
    });
  } catch (error) {
    console.error('Error uploading backup:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Falha no upload do backup' },
      { status: 500 }
    );
  }
}
