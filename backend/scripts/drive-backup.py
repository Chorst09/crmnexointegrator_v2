#!/usr/bin/env python3
"""Independent Drive backup and explicit, administrator-only recovery CLI."""
from contextlib import contextmanager
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import subprocess
import sys
import tarfile
import tempfile
import time

ROOT = Path('/BACKUP/GOOGLE_DRIVE')
CONFIG = ROOT / 'rclone.conf'
REMOTE = 'doublecrm:DOUBLECRM_BACKUP'
BASE = Path('/var/www/nexoscrm')
CONTAINER = 'nexoscrm-postgres'
ACCOUNT = 'chorstconsult@gmail.com'
RETAIN_BACKUPS = 3
NAME = re.compile(r'^doublecrm-full-\d{8}-\d{6}\.tar\.gz$')

def run(args, **kw):
    return subprocess.run(args, check=True, timeout=1800, **kw)

def rc(*args):
    command = ['rclone', '--config', str(CONFIG), '--contimeout', '20s', '--timeout', '5m', '--retries', '3', *args]
    for attempt in range(3):
        try:
            return run(command, capture_output=True, text=True).stdout
        except subprocess.CalledProcessError as exc:
            if attempt == 2:
                # Tokens are never printed; rclone's normal error output identifies the failure.
                raise RuntimeError('Google Drive: ' + (exc.stderr or 'operação falhou')[-700:]) from None
            time.sleep(2 ** attempt)

def state(**values):
    old = read_state()
    old.update(values)
    p = ROOT / 'status.tmp'
    p.write_text(json.dumps(old))
    os.chmod(p, 0o600)
    p.replace(ROOT / 'status.json')

def read_state():
    try:
        return json.loads((ROOT / 'status.json').read_text())
    except (OSError, ValueError):
        return {}

def digest(p):
    h = hashlib.sha256()
    with p.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()

def db(*args, **kw):
    return run(['docker', 'exec', '-i', CONTAINER, *args], **kw)

def dump_database(target):
    for attempt in range(3):
        try:
            with target.open('wb') as out:
                db('pg_dump', '-U', 'nexoscrm', '-d', 'doublecrm', '-Fc', stdout=out)
            with target.open('rb') as src:
                db('pg_restore', '--list', stdin=src, stdout=subprocess.DEVNULL)
            return
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
            if attempt == 2:
                raise
            time.sleep(20)

def backup(upload=True):
    state(running=True, startedAt=dt.datetime.now(dt.timezone.utc).isoformat(), error=None)
    stamp = dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    name = f'doublecrm-full-{stamp}.tar.gz'
    with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
        work = Path(tmp)
        dump_database(work / 'database.dump')
        roots = ['var/www/nexoscrm/.env', 'var/www/nexoscrm/docker-compose.yml',
                 'var/www/nexoscrm/backend', 'var/www/nexoscrm/apps/api',
                 'var/www/nexoscrm/frontend/dist', 'var/www/site-double/apache.conf']
        existing = [p for p in roots if Path('/' + p).exists()]
        run(['tar', '--dereference', '-czf', str(work / 'files.tar.gz'), '--exclude=node_modules',
             '--exclude=.git', '--exclude=*.tar.gz', '--exclude=*.dump', '--exclude=*.log',
             '--exclude=*.pre-doublecrm-*', '-C', '/', *existing])
        (work / 'manifest.json').write_text(json.dumps({
            'format': 'doublecrm-drive-v1', 'database': 'doublecrm',
            'createdAt': dt.datetime.now(dt.timezone.utc).isoformat(),
            'sha256': {n: digest(work / n) for n in ['database.dump', 'files.tar.gz']},
            'paths': existing, 'excluded': ['node_modules', '.git', 'old archives'],
            'restore': '/var/www/nexoscrm/backend/scripts/drive-backup.py restore <name> RESTAURAR_DOUBLECRM'
        }, indent=2))
        target = ROOT / name
        partial = ROOT / (name + '.partial')
        with tarfile.open(partial, 'w:gz') as tar:
            for n in ['database.dump', 'files.tar.gz', 'manifest.json']:
                tar.add(work / n, arcname=n)
        partial.replace(target)
    checksum = digest(target)
    (ROOT / (name + '.sha256')).write_text(checksum + '  ' + name + '\n')
    if upload:
        if not CONFIG.exists():
            raise RuntimeError('Google Drive ainda não conectado; pacote preservado localmente.')
        rc('mkdir', REMOTE)
        rc('copyto', str(target), REMOTE + '/' + name)
        rc('copyto', str(ROOT / (name + '.sha256')), REMOTE + '/' + name + '.sha256')
        rc('copyto', str(Path(__file__).resolve()), REMOTE + '/RESTORE-doublecrm.py')
        # Verify the remote bytes, not just an upload response.
        with tempfile.TemporaryDirectory(dir=ROOT) as tmp:
            check = Path(tmp) / name
            rc('copyto', REMOTE + '/' + name, str(check))
            if digest(check) != checksum:
                raise RuntimeError('Checksum do arquivo baixado do Drive divergiu.')
    state(running=False, lastSuccessAt=dt.datetime.now(dt.timezone.utc).isoformat(),
          latest=name, uploaded=upload, checksum=checksum, error=None)
    retention = prune_backups(remote=upload)
    state(retention=retention)
    return {'name': name, 'uploaded': upload, 'sha256': checksum}

def prune_backups(remote=True):
    """Delete only recognized backup archives and their checksum sidecars."""
    removed_remote = []
    if remote:
        entries = json.loads(rc('lsjson', REMOTE, '--files-only'))
        names = {entry['Name'] for entry in entries}
        archives = sorted((name for name in names if NAME.fullmatch(name)), reverse=True)
        kept = archives[:RETAIN_BACKUPS]
        # Never prune a good historical copy in favor of an incomplete upload.
        if any(name + '.sha256' not in names for name in kept):
            raise RuntimeError('Retenção cancelada: backup recente sem checksum no Drive.')
        for name in archives[RETAIN_BACKUPS:]:
            rc('deletefile', REMOTE + '/' + name)
            if name + '.sha256' in names:
                rc('deletefile', REMOTE + '/' + name + '.sha256')
            removed_remote.append(name)
        remaining = [entry for entry in entries if entry['Name'] not in
                     {value for name in removed_remote for value in (name, name + '.sha256')}]
        cache = {'checkedAt': dt.datetime.now(dt.timezone.utc).isoformat(), 'files': [
            {'name': entry['Name'], 'size': entry['Size'], 'modifiedAt': entry['ModTime']}
            for entry in remaining if NAME.fullmatch(entry['Name'])]}
        cache['files'].sort(key=lambda entry: entry['name'], reverse=True)
        cache_path = ROOT / 'remote-files.json.tmp'
        cache_path.write_text(json.dumps(cache))
        cache_path.chmod(0o600)
        cache_path.replace(ROOT / 'remote-files.json')
    local = sorted((p for p in ROOT.iterdir() if p.is_file() and NAME.fullmatch(p.name)),
                   key=lambda p: p.name, reverse=True)
    removed_local = []
    for archive in local[RETAIN_BACKUPS:]:
        archive.unlink()
        (ROOT / (archive.name + '.sha256')).unlink(missing_ok=True)
        removed_local.append(archive.name)
    current = read_state()
    if current.get('prepared') in removed_local:
        state(prepared=None)
    return {'keep': RETAIN_BACKUPS, 'removedRemote': removed_remote, 'removedLocal': removed_local}


def validate_name(name):
    if not NAME.fullmatch(name):
        raise ValueError('Nome de backup inválido')

def prepare(name):
    validate_name(name)
    dest = ROOT / name
    # Always retrieve the cloud copy so recovery remains independent of local files.
    rc('copyto', REMOTE + '/' + name, str(dest) + '.download')
    expected = rc('cat', REMOTE + '/' + name + '.sha256').split()[0]
    if not re.fullmatch('[a-f0-9]{64}', expected) or digest(Path(str(dest) + '.download')) != expected:
        raise RuntimeError('Checksum inválido no download do Drive')
    Path(str(dest) + '.download').replace(dest)
    with unpack(dest) as tmp:
        pass
    state(prepared=name)
    return {'name': name, 'verified': True,
            'command': f'python3 {BASE}/backend/scripts/drive-backup.py restore {name} RESTAURAR_DOUBLECRM'}

@contextmanager
def unpack(archive):
    with tempfile.TemporaryDirectory(dir=ROOT) as directory:
        target = Path(directory)
        with tarfile.open(archive) as tar:
            members = tar.getmembers()
            if len(members) != 3 or {m.name for m in members} != {'database.dump', 'files.tar.gz', 'manifest.json'} or any(not m.isfile() for m in members):
                raise ValueError('Pacote de backup inválido')
            tar.extractall(target, members=members)
        manifest = json.loads((target / 'manifest.json').read_text())
        if manifest.get('format') != 'doublecrm-drive-v1':
            raise ValueError('Formato inválido')
        for n in ['database.dump', 'files.tar.gz']:
            if digest(target / n) != manifest['sha256'].get(n):
                raise ValueError('Integridade inválida: ' + n)
        with (target / 'database.dump').open('rb') as src:
            db('pg_restore', '--list', stdin=src, stdout=subprocess.DEVNULL)
        yield target


def test_restore(name):
    validate_name(name)
    temporary = 'doublecrm_drive_test_' + str(os.getpid())
    with unpack(ROOT / name) as tmp:
        db('createdb', '-U', 'nexoscrm', temporary)
        try:
            with (tmp / 'database.dump').open('rb') as src:
                db('pg_restore', '-U', 'nexoscrm', '-d', temporary, '--exit-on-error', stdin=src)
            result = db('psql', '-U', 'nexoscrm', '-d', temporary, '-Atc',
                        "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'", capture_output=True, text=True)
            with tarfile.open(tmp / 'files.tar.gz') as tar:
                paths = tar.getnames()
                uploads = [p for p in paths if '/uploads/' in p]
            state(lastRestoreTestAt=dt.datetime.now(dt.timezone.utc).isoformat(), testedBackup=name)
            return {'tested': name, 'tables': int(result.stdout.strip()), 'uploadEntries': len(uploads)}
        finally:
            db('dropdb', '-U', 'nexoscrm', temporary)

def restore(name, confirmation):
    validate_name(name)
    if confirmation != 'RESTAURAR_DOUBLECRM':
        raise ValueError('Confirmação RESTAURAR_DOUBLECRM obrigatória')
    with unpack(ROOT / name) as tmp:
        # Validate file paths and prohibit links before extracting as root.
        with tarfile.open(tmp / 'files.tar.gz') as tar:
            for m in tar.getmembers():
                p = PurePosixPath(m.name)
                allowed = m.name.startswith(('var/www/nexoscrm/backend/', 'var/www/nexoscrm/apps/api/', 'var/www/nexoscrm/frontend/')) or m.name in ['var/www/nexoscrm/backend', 'var/www/nexoscrm/apps/api', 'var/www/nexoscrm/frontend', 'var/www/nexoscrm/.env', 'var/www/nexoscrm/docker-compose.yml', 'var/www/site-double/apache.conf']
                if p.is_absolute() or '..' in p.parts or not allowed or not (m.isfile() or m.isdir()):
                    raise ValueError('Caminho inseguro no pacote: ' + m.name)
        run(['/BACKUP/backup-doublecrm.sh'])
        run(['pm2', 'stop', 'nexoscrm-api'])
        try:
            db('psql', '-U', 'nexoscrm', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
               "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='doublecrm' AND pid<>pg_backend_pid()")
            # A single transaction rolls back the database if any restore command fails.
            with (tmp / 'database.dump').open('rb') as src:
                db('pg_restore', '-U', 'nexoscrm', '-d', 'doublecrm', '--clean', '--if-exists', '--single-transaction', '--exit-on-error', stdin=src)
            run(['tar', '-xzf', str(tmp / 'files.tar.gz'), '-C', '/'])
            # The current credentials remain authoritative after restoring old .env files.
            cfg = run(['docker', 'inspect', CONTAINER, '--format', '{{json .Config.Env}}'], capture_output=True, text=True)
            env = dict(s.split('=', 1) for s in json.loads(cfg.stdout))
            from urllib.parse import quote
            url = 'postgresql://nexoscrm:' + quote(env['POSTGRES_PASSWORD'], safe='') + '@127.0.0.1:5433/doublecrm?schema=public'
            for p in [BASE / '.env', BASE / 'backend/.env', BASE / 'apps/api/.env']:
                if p.exists():
                    p.write_text(re.sub(r'^DATABASE_URL=.*$', 'DATABASE_URL=' + url, p.read_text(), flags=re.M))
            run(['pm2', 'restart', 'nexoscrm-frontend'])
        finally:
            run(['pm2', 'restart', 'nexoscrm-api', '--update-env'])
    return {'restored': name}

def status():
    configured = CONFIG.exists()
    files, error = [], None
    if configured:
        try:
            entries = json.loads(rc('lsjson', REMOTE, '--files-only'))
            files = sorted([{'name': f['Name'], 'size': f['Size'], 'modifiedAt': f['ModTime']} for f in entries if NAME.fullmatch(f['Name'])], key=lambda f: f['name'], reverse=True)
        except Exception:
            error = 'Não foi possível consultar o Drive. Verifique a conexão e as permissões.'
    cron = Path('/etc/cron.d/doublecrm-drive-backup')
    return dict(read_state(), configured=configured, account=ACCOUNT,
                schedule='Diariamente às 18h (America/Sao_Paulo)',
                scheduled=cron.exists() and '0 18 * * * root' in cron.read_text(),
                folder='DOUBLECRM_BACKUP', localDir=str(ROOT), files=files,
                connectionError=error, remoteRetention='Últimos 3 backups', retainBackups=RETAIN_BACKUPS)

def main():
    os.umask(0o077)
    ROOT.mkdir(mode=0o700, parents=True, exist_ok=True)
    action = sys.argv[1] if len(sys.argv) > 1 else 'status'
    if action == 'status':
        result = status()
    else:
        with (ROOT / '.lock').open('w') as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except BlockingIOError:
                print(json.dumps({'error': 'Outra operação de backup ou restauração está em execução'}), file=sys.stderr)
                return
            state(running=True, action=action, error=None)
            if action == 'run': result = backup()
            elif action == 'local-test': result = backup(False)
            elif action == 'prune':
                result = prune_backups()
                state(retention=result)
            elif action == 'prepare': result = prepare(sys.argv[2])
            elif action == 'test': result = test_restore(sys.argv[2])
            elif action == 'restore': result = restore(sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
            else: raise ValueError('Ação inválida')
            state(running=False, lastAction=action, lastResult=result)
    print(json.dumps(result))

if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        if ROOT.exists():
            state(running=False, error=str(exc)[:500])
        print(json.dumps({'error': str(exc)[:500]}), file=sys.stderr)
        sys.exit(1)
