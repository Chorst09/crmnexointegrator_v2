import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import subprocess
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('drive_backup', Path(__file__).with_name('drive-backup.py'))
backup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backup)


class BackupSafetyTests(unittest.TestCase):
    def test_dump_retries_transient_docker_failure(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(backup, 'db', side_effect=[subprocess.CalledProcessError(1, 'docker'), None, None]) as db, patch.object(backup.time, 'sleep'):
                backup.dump_database(Path(tmp) / 'database.dump')
                self.assertEqual(db.call_count, 3)

    def test_dump_stops_after_three_failures(self):
        with tempfile.TemporaryDirectory() as tmp:
            with patch.object(backup, 'db', side_effect=subprocess.CalledProcessError(1, 'docker')) as db, patch.object(backup.time, 'sleep'):
                with self.assertRaises(subprocess.CalledProcessError):
                    backup.dump_database(Path(tmp) / 'database.dump')
                self.assertEqual(db.call_count, 3)

    def test_rejects_paths_instead_of_backup_names(self):
        for name in ['../../etc/passwd', '/BACKUP/example', 'doublecrm-full-20261022-120000.tar.gz;id']:
            with self.assertRaises(ValueError):
                backup.validate_name(name)
        backup.validate_name('doublecrm-full-20261022-120000.tar.gz')

    def test_live_restore_requires_explicit_confirmation_before_database_access(self):
        with patch.object(backup, 'db') as db:
            with self.assertRaises(ValueError):
                backup.restore('doublecrm-full-20261022-120000.tar.gz', '')
            db.assert_not_called()

    def test_archive_traversal_is_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'unsafe.tar.gz'
            with tarfile.open(archive, 'w:gz') as tar:
                member = tarfile.TarInfo('../escape')
                member.size = 1
                tar.addfile(member, io.BytesIO(b'x'))
            with patch.object(backup, 'ROOT', root):
                with self.assertRaises(ValueError):
                    with backup.unpack(archive):
                        pass
            self.assertFalse((root.parent / 'escape').exists())

    def test_corrupted_payload_rejected_before_restore(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            archive = root / 'bad.tar.gz'
            contents = {'database.dump': b'corrupt', 'files.tar.gz': b'files',
                        'manifest.json': json.dumps({'format': 'doublecrm-drive-v1', 'sha256': {'database.dump': '0' * 64}}).encode()}
            with tarfile.open(archive, 'w:gz') as tar:
                for name, value in contents.items():
                    member = tarfile.TarInfo(name)
                    member.size = len(value)
                    tar.addfile(member, io.BytesIO(value))
            with patch.object(backup, 'ROOT', root), patch.object(backup, 'db') as db:
                with self.assertRaises(ValueError):
                    with backup.unpack(archive):
                        pass
                db.assert_not_called()


class RetentionTests(unittest.TestCase):
    def test_keeps_three_latest_and_only_deletes_backup_pairs(self):
        names = [f'doublecrm-full-202610{day:02d}-180001.tar.gz' for day in range(20, 27)]
        entries = [{'Name': name + suffix, 'Size': 100, 'ModTime': '2026-10-26'}
                   for name in names for suffix in ['', '.sha256']]
        entries.append({'Name': 'RESTORE-doublecrm.py', 'Size': 100, 'ModTime': '2026-10-26'})
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            for name in names:
                (root / name).write_text('archive')
                (root / (name + '.sha256')).write_text('checksum')
            (root / 'rclone.conf').write_text('preserve')
            with patch.object(backup, 'ROOT', root), patch.object(backup, 'rc', return_value=json.dumps(entries)) as rc:
                result = backup.prune_backups()
            self.assertEqual(result['keep'], 3)
            self.assertEqual(sorted(result['removedRemote']), names[:-3])
            self.assertEqual(sorted(p.name for p in root.glob('*.tar.gz')), names[-3:])
            self.assertEqual((root / 'rclone.conf').read_text(), 'preserve')
            deleted = [call.args[1] for call in rc.call_args_list if call.args[0] == 'deletefile']
            self.assertEqual(len(deleted), 8)
            self.assertFalse(any('RESTORE' in value for value in deleted))
            self.assertEqual(len(json.loads((root / 'remote-files.json').read_text())['files']), 3)

    def test_missing_recent_checksum_prevents_all_deletion(self):
        entries = [{'Name': f'doublecrm-full-202610{day}-180001.tar.gz', 'Size': 10, 'ModTime': ''}
                   for day in range(20, 25)]
        with tempfile.TemporaryDirectory() as tmp, patch.object(backup, 'ROOT', Path(tmp)), patch.object(backup, 'rc', return_value=json.dumps(entries)) as rc:
            with self.assertRaises(RuntimeError):
                backup.prune_backups()
            self.assertEqual(rc.call_count, 1)

    def test_remote_failure_does_not_prune_local_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            names = [f'doublecrm-full-202610{day}-180001.tar.gz' for day in range(20, 25)]
            for name in names: (root / name).write_text('archive')
            with patch.object(backup, 'ROOT', root), patch.object(backup, 'rc', side_effect=RuntimeError('offline')):
                with self.assertRaises(RuntimeError): backup.prune_backups()
            self.assertEqual(len(list(root.glob('*.tar.gz'))), 5)


if __name__ == '__main__':
    unittest.main()
