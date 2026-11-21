#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
repo=/opt/nexos-icp-github
config=/opt/nexos-icp-config
remote=https://github.com/Chorst09/crmnexointegrator_v2.git
branch=main
name=nexos-icp
port=3015
domain=nexos.chorstconsult.com.br
envfile=$config/app.env
mkdir -p "$config"
chmod 700 "$config"
exec 9>"$config/deploy.lock"
flock -n 9 || { echo 'Another CRM deployment is running'; exit 1; }
for tool in git docker curl python3; do command -v "$tool" >/dev/null; done
[[ -f "$envfile" && $(stat -c %a "$envfile") == 600 ]] || { echo 'app.env must exist with mode 600'; exit 1; }
python3 - "$envfile" <<'PY'
import sys,urllib.parse
values={}
for line in open(sys.argv[1]):
    if line.strip() and not line.lstrip().startswith('#'):
        key,sep,value=line.rstrip('\n').partition('=')
        if not sep or key in values: raise SystemExit('Invalid or duplicate env key')
        values[key]=value
for key in ['DATABASE_URL','JWT_SECRET','CORS_ORIGIN','FRONTEND_URL','API_URL','MASTER_EMAILS']:
    if not values.get(key) or 'REPLACE' in values[key]: raise SystemExit('Missing required configuration: '+key)
u=urllib.parse.urlparse(values['DATABASE_URL'])
if u.hostname!='postgresql_17' or u.port!=5432 or u.path!='/nexos_icp' or not u.password or u.username!='nexos_icp': raise SystemExit('Exclusive CRM database configuration required')
if len(values['JWT_SECRET'])<32: raise SystemExit('JWT_SECRET too short')
for key in ['CORS_ORIGIN','FRONTEND_URL','API_URL']:
    if values[key]!='https://nexos.chorstconsult.com.br': raise SystemExit('Incorrect public origin: '+key)
if values.get('DISABLE_STARTUP_WRITES')!='true': raise SystemExit('Startup writes must be disabled')
PY
docker network inspect icontainer-network >/dev/null
if [[ ! -d "$repo" ]]; then git clone --branch "$branch" --single-branch "$remote" "$repo"; fi
cd "$repo"
[[ $(git remote get-url origin) == "$remote" && $(git branch --show-current) == "$branch" ]] || { echo 'Unexpected remote or branch'; exit 1; }
[[ -z $(git status --porcelain) ]] || { echo 'Working tree is dirty; nothing overwritten'; exit 1; }
git pull --ff-only origin "$branch"
commit=$(git rev-parse HEAD)
release="$(date -u +%Y%m%dT%H%M%SZ)-${commit:0:12}-$RANDOM"
image="$name:$release"
candidate="$name-check-$release"
previous="$name-previous-$release"
old=false
switched=false
healthy() {
  for ((i=0;i<60;i++)); do
    [[ $(docker inspect -f '{{.State.Health.Status}}' "$1" 2>/dev/null || true) == healthy ]] && return 0
    sleep 2
  done
  return 1
}
cleanup() { docker rm -f "$candidate" >/dev/null 2>&1 || true; }
rollback() {
  trap - ERR INT TERM
  cleanup
  if $switched; then
    docker rm -f "$name" >/dev/null 2>&1 || true
    if $old; then docker rename "$previous" "$name"; docker start "$name" >/dev/null; fi
  fi
  echo 'Deploy failed; previous CRM container restored when present. Database unchanged.' >&2
  exit 1
}
trap cleanup EXIT
trap rollback ERR INT TERM
docker build --target runtime -f Dockerfile.icp --label "org.opencontainers.image.revision=$commit" -t "$image" .
for volume in nexos-icp-uploads nexos-icp-attachments; do docker volume create "$volume" >/dev/null; done
docker run -d --name "$candidate" --network icontainer-network --env-file "$envfile" -e "CRM_RELEASE=$release" -e DISABLE_STARTUP_WRITES=true --mount type=volume,src=nexos-icp-uploads,dst=/app/apps/api/uploads,readonly --mount type=volume,src=nexos-icp-attachments,dst=/app/apps/attachments/editais,readonly "$image" >/dev/null
healthy "$candidate"
docker exec "$candidate" node deploy/icp/smoke.cjs
cleanup
if docker container inspect "$name" >/dev/null 2>&1; then
  [[ $(docker inspect -f '{{index .Config.Labels "com.integrator.app"}}' "$name") == nexos-icp ]] || { echo 'Unmanaged container conflict'; exit 1; }
  old=true
  docker stop "$name" >/dev/null
  docker rename "$name" "$previous" || { docker start "$name" >/dev/null; exit 1; }
fi
switched=true
docker run -d --name "$name" --label com.integrator.app=nexos-icp --restart unless-stopped --network icontainer-network --env-file "$envfile" -e "CRM_RELEASE=$release" -e DISABLE_STARTUP_WRITES=true -p "127.0.0.1:$port:3000" --mount type=volume,src=nexos-icp-uploads,dst=/app/apps/api/uploads --mount type=volume,src=nexos-icp-attachments,dst=/app/apps/attachments/editais "$image" >/dev/null
healthy "$name"
docker exec "$name" node deploy/icp/smoke.cjs
headers=$(curl --fail --silent --show-error --max-time 20 -D - "https://$domain/api/health")
printf '%s' "$headers" | tr -d '\r' | grep -Fqi "X-CRM-Release: $release"
curl --fail --silent --show-error --max-time 20 "https://$domain/" -o /dev/null
printf '%s\n' "$release" > "$config/current-release"
if $old; then printf '%s\n' "$previous" > "$config/previous-container"; fi
trap - ERR INT TERM
echo "Published $commit at https://$domain (release $release)"
