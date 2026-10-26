#!/usr/bin/env python3
"""Prepare ACME HTTP validation, then install the CRM certificate in Apache.

Run on the production host with --phase challenge before Certbot issuance,
and --phase https afterwards. No certificate keys are copied into this repo.
"""
import argparse
import datetime
import json
from pathlib import Path
import re
import subprocess

DOMAIN = 'double.chorstconsult.com.br'
CONTAINER = 'site-double-apache'
SOURCE = Path('/var/www/site-double/apache.conf')
RUNTIME = '/usr/local/apache2/conf/extra/httpd-vhosts.conf'
WEBROOT = Path('/etc/letsencrypt/acme-webroot')
CHALLENGE = '''    # BEGIN CRM ACME CHALLENGE
    ProxyPass /.well-known/acme-challenge/ !
    Alias /.well-known/acme-challenge/ /etc/letsencrypt/acme-webroot/.well-known/acme-challenge/
    <Directory "/etc/letsencrypt/acme-webroot/.well-known/acme-challenge">
        Options None
        AllowOverride None
        Require all granted
    </Directory>
    # END CRM ACME CHALLENGE
'''


def host_blocks(text, port):
    return [m for m in re.finditer(r'<VirtualHost \*:' + str(port) + r'>.*?</VirtualHost>', text, re.S)
            if re.search(r'(?m)^\s*ServerName\s+' + re.escape(DOMAIN) + r'\s*$', m.group())]


def configure(text, phase):
    hosts = host_blocks(text, 80)
    if len(hosts) != 1:
        raise ValueError('Expected exactly one CRM HTTP virtual host')
    if host_blocks(text, 443):
        if phase == 'https':
            return text
        raise ValueError('HTTPS already configured; do not replace the active configuration')
    match = hosts[0]
    block = match.group()
    server_name = '    ServerName ' + DOMAIN + '\n'
    if server_name not in block:
        raise ValueError('Unexpected CRM virtual host format')
    if '# BEGIN CRM ACME CHALLENGE' not in block:
        block = block.replace(server_name, server_name + CHALLENGE, 1)
    if phase == 'challenge':
        return text[:match.start()] + block + text[match.end():]
    tls = '''    # BEGIN CRM HTTPS
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/double.chorstconsult.com.br/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/double.chorstconsult.com.br/privkey.pem
    SSLProtocol all -SSLv3 -TLSv1 -TLSv1.1
    SSLCipherSuite HIGH:!aNULL:!MD5
    SSLHonorCipherOrder on
    RequestHeader set X-Forwarded-Proto "https"
    RequestHeader set X-Forwarded-Port "443"
    # END CRM HTTPS
'''
    secure = block.replace('<VirtualHost *:80>', '<VirtualHost *:443>', 1)
    secure = secure.replace(server_name, server_name + tls, 1)
    redirect = ('<VirtualHost *:80>\n' + server_name + CHALLENGE + '''    RewriteEngine On
    RewriteCond %{REQUEST_URI} !^/\\.well-known/acme-challenge/
    RewriteRule ^ https://double.chorstconsult.com.br%{REQUEST_URI} [R=308,L,NE]
    ErrorLog /usr/local/apache2/logs/nexos-error.log
    CustomLog /usr/local/apache2/logs/nexos-access.log combined
</VirtualHost>''')
    return text[:match.start()] + redirect + '\n\n' + secure + text[match.end():]


def run(*args):
    return subprocess.check_output(args, text=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase', required=True, choices=['challenge', 'https'])
    phase = parser.parse_args().phase
    previous = run('docker', 'exec', CONTAINER, 'cat', RUNTIME)
    if previous != SOURCE.read_text():
        raise ValueError('Runtime and Docker build source differ; review before applying')
    for directory in [WEBROOT, WEBROOT / '.well-known', WEBROOT / '.well-known/acme-challenge']:
        directory.mkdir(exist_ok=True, mode=0o755)
    if phase == 'https':
        subprocess.check_call(['openssl', 'x509', '-in', '/etc/letsencrypt/live/' + DOMAIN + '/fullchain.pem',
                               '-noout', '-checkhost', DOMAIN])
    updated = configure(previous, phase)
    tag = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup = Path('/var/www/nexoscrm/backups') / ('https-' + phase + '-' + tag)
    backup.mkdir(mode=0o700)
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
    print(json.dumps({'phase': phase, 'backup': str(backup), 'domain': DOMAIN, 'reload': 'graceful'}))


if __name__ == '__main__':
    main()
