#!/bin/bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mkdir -p /BACKUP
exec 9>/BACKUP/.lock
flock -n 9 || { echo "$(date -Is) Backup já em execução"; exit 1; }
stamp=$(TZ=America/Sao_Paulo date +%Y%m%d-%H%M%S)
target=/BACKUP/doublecrm-$stamp.dump
trap 'rm -f "${target}.partial"; echo "$(date -Is) ERRO no backup" >> /BACKUP/backup.log' ERR
valid=false
for attempt in 1 2 3; do
  if docker exec nexoscrm-postgres pg_dump -U nexoscrm -d doublecrm -Fc > "$target.partial" &&
     test -s "$target.partial" &&
     docker exec -i nexoscrm-postgres pg_restore --list < "$target.partial" >/dev/null; then
    valid=true
    break
  fi
  echo "$(date -Is) Falha na tentativa $attempt/3" >> /BACKUP/backup.log
  if [ "$attempt" -lt 3 ]; then sleep 20; fi
done
test "$valid" = true
mv "$target.partial" "$target"
sha256sum "$target" > "$target.sha256"
find /BACKUP -maxdepth 1 -type f \( -name 'doublecrm-*.dump' -o -name 'doublecrm-*.dump.sha256' \) -mtime +14 -delete
echo "$(date -Is) OK $target (catalogo pg_restore validado)" >> /BACKUP/backup.log
