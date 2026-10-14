#!/usr/bin/env bash
# Execute on the authorized production server after uploading the reviewed archive.
set -euo pipefail
ARCHIVE=${1:?Supply the reviewed release archive}
COMMIT=${2:?Supply the published commit}
BACKUP=${3:?Supply the verified backup directory}
TARGET=/var/www/crmnexointegrator_3026
test -s "$BACKUP/application.tgz"
test -s "$BACKUP/nexoscrm.dump"
test -s "$BACKUP/v2-guard.json"
STAGE=$(mktemp -d /tmp/nexos-b2b-release.XXXXXX)
tar -xzf "$ARCHIVE" -C "$STAGE"
python3 - "$TARGET" "$STAGE" <<'PY'
import hashlib,json,sys
from pathlib import Path
target,stage=map(Path,sys.argv[1:])
manifest=json.loads((stage/'release-manifest.json').read_text())
for name,digest in manifest['before'].items():
    assert hashlib.sha256((target/name).read_bytes()).hexdigest()==digest, 'Production changed since review: '+name
for name,digest in manifest['after'].items():
    assert hashlib.sha256((stage/name).read_bytes()).hexdigest()==digest, 'Archive integrity failure: '+name
assert (stage/'apps/web/dist/index.html').is_file()
PY
# This obsolete unit runs the 3026 ecosystem from a misleading v2 directory.
# The real v2 process and the PM2 daemon belong to pm2-root.service.
test "$(systemctl show crmnexointegrator-v2.service -p WorkingDirectory --value)" = /var/www/crmnexointegrator_v2
python3 - <<'PY'
import json,subprocess
from pathlib import Path
processes=json.loads(subprocess.check_output(['pm2','jlist']))
v2=next(row for row in processes if row['name']=='crmnexointegrator_v2_3025')
assert 'pm2-root.service' in Path('/proc/'+str(v2['pid'])+'/cgroup').read_text()
config=Path('/var/www/crmnexointegrator_v2/ecosystem.config.cjs').read_text()
assert 'crmnexointegrator_3026' in config and '/var/www/crmnexointegrator_3026' in config
PY
systemctl stop crmnexointegrator-v2.service || true
systemctl disable crmnexointegrator-v2.service
for name in backend/api/dashboard.js apps/api/api/dashboard.js backend/lib/b2bDashboardAnalytics.js apps/api/lib/b2bDashboardAnalytics.js apps/web/src/pages/Dashboard.jsx apps/web/src/components/PipelineDashboardModel.jsx apps/web/src/components/PipelineDashboardModel.css apps/web/src/components/DashboardAdvancedChart.jsx; do
  install -D -m 644 "$STAGE/$name" "$TARGET/$name"
done
pm2 restart crmnexointegrator_3026
node "$STAGE/scripts/tests/b2b-dashboard-production.cjs" "$TARGET" http://127.0.0.1:3026
node - <<'JS'
const assert = require('node:assert/strict');
const session = JSON.parse(require('node:fs').readFileSync('/tmp/nexos-b2b-validation-session.json'));
fetch('http://127.0.0.1:3002/api/auth/me', { headers: { Authorization: `Bearer ${session.token}` }, signal: AbortSignal.timeout(15000) })
  .then(async response => { assert.equal(response.status, 200, 'The existing domain session must remain compatible'); const data = await response.json(); assert.equal(data.user?.id || data.id, session.user.id); })
  .catch(() => { console.error('Existing session compatibility check failed'); process.exitCode = 1; });
JS
# Merge assets so browsers with an earlier index can finish their in-flight requests.
cp -a "$STAGE/apps/web/dist/." "$TARGET/apps/web/dist/"
python3 - "$BACKUP" <<'PY'
from pathlib import Path
import sys
config=Path('/etc/nginx/sites-enabled/nexoscrm')
original=config.read_text()
assert original==Path(sys.argv[1]+'/nginx-nexoscrm.conf').read_text(), 'Nginx changed since review'
marker='    server_name nexos.chorstconsult.com.br;'
blocks=original.split('server {')
matches=[i for i,block in enumerate(blocks) if marker in block and 'listen 443' in block]
assert len(matches)==1
index=matches[0]
route='''
    # Only the B2B dashboard uses the reviewed PM2 API; other modules keep Docker.
    location = /api/dashboard {
        proxy_pass http://$nexos_b2b_dashboard_upstream;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 90s;
    }
'''
blocks[index]=blocks[index].replace('    location /api/ {',route+'\n    location /api/ {',1)
result='server {'.join(blocks)
result='map $arg_type $nexos_b2b_dashboard_upstream {\n    default crm_api_nexos;\n    b2b 127.0.0.1:3026;\n}\n\n'+result
assert all(blocks[i]==original.split('server {')[i] for i in range(1,len(blocks)) if i!=index)
config.write_text(result)
PY
if ! nginx -t; then
  cp "$BACKUP/nginx-nexoscrm.conf" /etc/nginx/sites-enabled/nexoscrm
  exit 1
fi
systemctl reload nginx
python3 - "$STAGE" "$TARGET" "$COMMIT" "$BACKUP" <<'PY'
import json,sys
from pathlib import Path
stage,target=map(Path,sys.argv[1:3]);manifest=json.loads((stage/'release-manifest.json').read_text())
manifest.update(commit=sys.argv[3],backup=sys.argv[4])
(target/'b2b-release.json').write_text(json.dumps(manifest,indent=2))
PY
echo "B2B deployed: $COMMIT; backup: $BACKUP"
