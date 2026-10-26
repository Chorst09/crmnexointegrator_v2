#!/bin/sh
# Install as /etc/letsencrypt/renewal-hooks/deploy/50-double-crm-apache (0755).
set -eu

case "${RENEWED_LINEAGE:-}" in
    /etc/letsencrypt/live/double.chorstconsult.com.br)
        docker exec site-double-apache httpd -t
        docker exec site-double-apache httpd -k graceful
        ;;
esac
