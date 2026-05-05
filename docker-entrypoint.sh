#!/bin/sh
# CSM container entrypoint.
#
# 1. Espera a que la BD esté lista (max 60s)
# 2. Aplica migrations idempotentes con drizzle-kit push --force
# 3. Lanza el server Next standalone
#
# Si DATABASE_URL no está configurada, salta la migration y deja que la app
# muestre la pantalla "Admin desactivado" (no crashea — útil para preview).

set -e

if [ -z "$DATABASE_URL" ]; then
  echo "[csm] DATABASE_URL no configurada — saltando migration."
  echo "[csm] La app arrancará en modo demo (admin desactivado)."
  exec "$@"
fi

# Espera la BD: hasta 60s pingeando con node tcp socket.
# No usamos pg_isready ni mysqladmin porque mantenemos la imagen mínima.
echo "[csm] Esperando a la base de datos..."
TIMEOUT=60
START=$(date +%s)
until node -e "
const url = new URL(process.env.DATABASE_URL);
const net = require('net');
const port = url.port || (url.protocol === 'postgres:' || url.protocol === 'postgresql:' ? 5432 : 3306);
const client = net.connect(parseInt(port, 10), url.hostname);
client.on('connect', () => { client.end(); process.exit(0); });
client.on('error', () => process.exit(1));
setTimeout(() => process.exit(1), 2000);
" 2>/dev/null; do
  ELAPSED=$(($(date +%s) - START))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "[csm] Timeout esperando la BD ($TIMEOUT s). Continuamos de todas formas..."
    break
  fi
  sleep 2
done
echo "[csm] BD lista."

# Aplica el schema. `--force` salta el prompt interactivo de drizzle-kit
# que pregunta sobre cambios destructivos. En self-hosted asumimos que el
# admin del workspace ha leído los release notes antes de upgrade.
echo "[csm] Aplicando schema..."
npx drizzle-kit push --force || {
  echo "[csm] Migration falló — la app puede tener errores de schema."
  echo "[csm] Revisa logs y ejecuta manualmente: docker compose exec csm npx drizzle-kit push"
}

echo "[csm] Arrancando server Next.js..."
exec "$@"
