#!/bin/bash
LOGFILE="/var/log/double-website/health-check.log"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

# Monitor only the current website containers; never restart the shared Docker daemon.
for container in site-double-app site-double-apache; do
    status=$(docker inspect --format '{{.State.Status}}' "$container" 2>/dev/null) || continue
    if [ "$status" = exited ] || [ "$status" = created ]; then
        echo "[$DATE] WARNING: Iniciando $container" >> "$LOGFILE"
        docker start "$container" >> "$LOGFILE" 2>&1
    fi
done

# Verificar health check
if ! curl -s -f http://localhost/health >/dev/null; then
    echo "[$DATE] WARNING: Health check falhou" >> $LOGFILE
fi

# Verificar uso de disco
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 85 ]; then
    echo "[$DATE] WARNING: Uso de disco alto: ${DISK_USAGE}%" >> $LOGFILE
fi
