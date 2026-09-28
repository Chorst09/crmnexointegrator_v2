#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    GRANT ALL PRIVILEGES ON DATABASE nexoscrm TO nexoscrm;
    GRANT ALL PRIVILEGES ON SCHEMA public TO nexoscrm;
    ALTER SCHEMA public OWNER TO nexoscrm;
EOSQL
