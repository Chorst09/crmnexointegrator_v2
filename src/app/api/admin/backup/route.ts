import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

// Diretório para armazenar backups
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

// GET - Listar backups disponíveis
export async function GET() {
  try {
    // Criar diretório de backup se não existir
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    const files = await fs.readdir(BACKUP_DIR);
    const backups = await Promise.all(
      files
        .filter(file => file.endsWith('.sql.gz'))
        .map(async (file) => {
          const filePath = path.join(BACKUP_DIR, file);
          const stats = await fs.stat(filePath);
          return {
            filename: file,
            size: stats.size,
            created_at: stats.mtime,
            path: filePath
          };
        })
    );

    // Ordenar por data de criação (mais recente primeiro)
    backups.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    return NextResponse.json({ backups });
  } catch (error) {
    console.error('Error listing backups:', error);
    return NextResponse.json(
      { error: 'Failed to list backups' },
      { status: 500 }
    );
  }
}

// POST - Criar novo backup
export async function POST(request: NextRequest) {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup-${timestamp}.sql.gz`;
    const backupPath = path.join(BACKUP_DIR, filename);

    // Criar diretório de backup se não existir
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // Obter credenciais do banco de dados
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL not configured');
    }

    // Parse da URL do banco
    const url = new URL(dbUrl);
    const dbHost = url.hostname;
    const dbPort = url.port || '5432';
    const dbName = url.pathname.slice(1);
    const dbUser = url.username;
    const dbPassword = url.password;

    // Comando para fazer backup (pg_dump com compressão)
    const command = `PGPASSWORD="${dbPassword}" pg_dump -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName} --clean --if-exists | gzip > "${backupPath}"`;

    await execAsync(command);

    // Verificar se o arquivo foi criado
    const stats = await fs.stat(backupPath);

    return NextResponse.json({
      success: true,
      backup: {
        filename,
        size: stats.size,
        created_at: stats.mtime,
        path: backupPath
      }
    });
  } catch (error) {
    console.error('Error creating backup:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create backup' },
      { status: 500 }
    );
  }
}
