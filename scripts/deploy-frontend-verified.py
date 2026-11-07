#!/usr/bin/env python3
"""Install a verified frontend archive before atomically changing the active release.

Usage (root on server): python3 deploy-frontend-verified.py package.tar.gz
The archive must include .deploy-manifest.json mapping each build file to SHA-256.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sys
import tarfile


def deploy(archive, frontend=Path('/var/www/nexoscrm/frontend')):
    releases = frontend / 'releases'
    releases.mkdir(parents=True, exist_ok=True, mode=0o755)
    tag = datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    release = releases / tag
    release.mkdir(mode=0o755)
    active = frontend / 'dist'
    try:
        with tarfile.open(archive) as tar:
            members = tar.getmembers()
            names = [m.name for m in members]
            if len(names) != len(set(names)) or '.deploy-manifest.json' not in names:
                raise ValueError('Manifesto ausente ou arquivos duplicados')
            for m in members:
                p = PurePosixPath(m.name)
                if not m.isfile() or p.is_absolute() or '..' in p.parts:
                    raise ValueError('Arquivo inválido: ' + m.name)
            tar.extractall(release, members=members)
        manifest = json.loads((release / '.deploy-manifest.json').read_text())
        if set(manifest) != set(names) - {'.deploy-manifest.json'}:
            raise ValueError('Manifesto não corresponde ao pacote')
        if 'index.html' not in manifest:
            raise ValueError('index.html ausente')
        for name, expected in manifest.items():
            if hashlib.sha256((release / name).read_bytes()).hexdigest() != expected:
                raise ValueError('Checksum divergente: ' + name)
        # Keep immutable chunks referenced by tabs opened before this deployment.
        if (active / 'assets').exists():
            for old in (active / 'assets').rglob('*'):
                if old.is_file() and not old.is_symlink() and not old.name.startswith('.'):
                    target = release / 'assets' / old.relative_to(active / 'assets')
                    if not target.exists():
                        target.parent.mkdir(parents=True, exist_ok=True)
                        shutil.copyfile(old, target)
        for p in release.rglob('*'):
            p.chmod(0o755 if p.is_dir() else 0o644)
        if active.exists() and not active.is_symlink():
            active.rename(releases / ('legacy-' + tag))
        pending = frontend / ('.dist-' + tag)
        pending.symlink_to(release, target_is_directory=True)
        os.replace(pending, active)
    except Exception:
        shutil.rmtree(release)
        raise
    print(json.dumps({'release': str(release), 'verifiedFiles': len(manifest)}))


if __name__ == '__main__':
    deploy(Path(sys.argv[1]))
