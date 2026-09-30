import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

// POST - Restaurar backup
export async function POST(request: NextRequest) {
  try {
    const { filename } = await request.json();

    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      );
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    // Verificar se o arquivo existe
    try {
      await fs.access(backupPath);
    } catch {
      return NextResponse.json(
        { error: 'Backup file not found' },
        { status: 404 }
      );
    }

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

    // Comando para restaurar backup
    const command = `gunzip -c "${backupPath}" | PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbName}`;

    const { stdout, stderr } = await execAsync(command);

    return NextResponse.json({
      success: true,
      message: 'Backup restored successfully',
      details: {
        stdout: stdout.substring(0, 500),
        stderr: stderr.substring(0, 500)
      }
    });
  } catch (error) {
    console.error('Error restoring backup:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to restore backup' },
      { status: 500 }
    );
  }
}
