#!/usr/bin/env python3
"""Enable compression and safe caching for the existing CRM virtual hosts.

Run on the production host. Validates Apache before a graceful reload, keeps
backups, and updates the Docker build source so recreation retains the change.
"""
import datetime
import json
from pathlib import Path
import re
import shutil
import subprocess

CONTAINER = 'site-double-apache'
RUNTIME = '/usr/local/apache2/conf/extra/httpd-vhosts.conf'
SOURCE = Path('/var/www/site-double/apache.conf')
BEGIN = '# BEGIN CRM PERFORMANCE'
END = '# END CRM PERFORMANCE'
POLICY = '''# BEGIN CRM PERFORMANCE
    # Existing upstream gzip is respected; JSON from the API is compressed here.
    AddOutputFilterByType DEFLATE application/json application/javascript text/javascript text/html text/css text/plain image/svg+xml
    <Location "/">
        Header set Cache-Control "no-cache"
    </Location>
    <LocationMatch "^/(api|uploads)/">
        Header set Cache-Control "private, no-store"
    </LocationMatch>
    # Only fingerprinted, successful build assets can be cached permanently.
    <LocationMatch "^/assets/[^/]+-[A-Za-z0-9_-]{8}\\.(js|css)$">
        Header set Cache-Control "public, max-age=31536000, immutable" "expr=(%{REQUEST_STATUS} == 200 || %{REQUEST_STATUS} == 304) && resp('Content-Type') =~ m#^(application/javascript|text/javascript|text/css)(;|$)#"
    </LocationMatch>
    # END CRM PERFORMANCE'''


def run(*args):
    return subprocess.check_output(args, text=True)


def tune(text):
    text = re.sub(r'# BEGIN CRM PERFORMANCE MODULE\n.*?# END CRM PERFORMANCE MODULE\n', '', text, flags=re.S)
    text = re.sub(r'\s*# BEGIN CRM PERFORMANCE\n.*?# END CRM PERFORMANCE', '', text, flags=re.S)
    count = 0

    def host(match):
        nonlocal count
        block = match.group()
        if re.search(r'ServerName\s+(double|nexos)\.chorstconsult\.com\.br\s', block):
            count += 1
            return block.replace('</VirtualHost>', '    ' + POLICY + '\n</VirtualHost>')
        return block

    text = re.sub(r'<VirtualHost\b[^>]*>.*?</VirtualHost>', host, text, flags=re.S)
    if count != 2:
        raise ValueError(f'Expected two CRM virtual hosts, found {count}')
    module = '''# BEGIN CRM PERFORMANCE MODULE
<IfModule !deflate_module>
    LoadModule deflate_module modules/mod_deflate.so
</IfModule>
# END CRM PERFORMANCE MODULE
'''
    return module + text


def main():
    previous = run('docker', 'exec', CONTAINER, 'cat', RUNTIME)
    if previous != SOURCE.read_text():
        raise ValueError('Runtime and Docker build configuration differ; review before applying')
    updated = tune(previous)
    tag = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = Path('/var/www/nexoscrm/backups') / ('performance-apache-' + tag)
    backup.mkdir(parents=True, mode=0o700)
    (backup / 'apache.conf').write_text(previous)
    candidate = backup / 'apache.updated.conf'
    candidate.write_text(updated)
    try:
        subprocess.check_call(['docker', 'cp', str(candidate), CONTAINER + ':' + RUNTIME])
        subprocess.check_call(['docker', 'exec', CONTAINER, 'httpd', '-t'])
        SOURCE.write_text(updated)
        subprocess.check_call(['docker', 'exec', CONTAINER, 'httpd', '-k', 'graceful'])
    except Exception:
        SOURCE.write_text(previous)
        subprocess.check_call(['docker', 'cp', str(backup / 'apache.conf'), CONTAINER + ':' + RUNTIME])
        subprocess.check_call(['docker', 'exec', CONTAINER, 'httpd', '-k', 'graceful'])
        raise
    print(json.dumps({'backup': str(backup), 'crmVirtualHosts': 2, 'reload': 'graceful'}))


if __name__ == '__main__':
    main()
