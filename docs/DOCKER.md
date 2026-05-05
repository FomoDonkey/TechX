# CSM — Self-hosting con Docker

Levantar CSM completo (app + BD) en cualquier servidor Linux/Mac/Windows con Docker.

Tras un reboot del host, todo arranca solo (`restart: always`). Datos persistentes en volúmenes Docker.

---

## TL;DR

```bash
# 1. Clonar
git clone https://github.com/<owner>/csm.git
cd csm

# 2. Configurar
cp .env.docker.example .env
nano .env   # rellena POSTGRES_PASSWORD y AUTH_SECRET (mínimo)

# 3. Generar secrets
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env

# 4. Levantar
docker compose up -d

# 5. Ver logs
docker compose logs -f csm
```

CSM disponible en `http://localhost:3000` (o el puerto que hayas puesto en `APP_PORT`).

---

## Requisitos

- Docker Engine ≥ 24
- Docker Compose v2 (`docker compose ...`, no `docker-compose ...`)
- ~1GB RAM libre (+2GB extra si usas SQL Server)
- ~2GB de disco para imágenes + datos iniciales

---

## Variables `.env` (las críticas)

| Variable | Obligatoria | Default | Descripción |
|---|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | — | Password BD. Generar: `openssl rand -base64 24` |
| `AUTH_SECRET` | ✅ | — | Secret cookies + AI key encryption. Generar: `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | ⚠️ | `http://localhost:3000` | URL pública de tu CSM (para magic-link, OG, OAuth callbacks) |
| `APP_HOST_BIND` | ❌ | `127.0.0.1` | IP del host donde escucha CSM. Pon `0.0.0.0` para exponer a la red |
| `APP_PORT` | ❌ | `3000` | Puerto público |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, etc. | ❌ | — | Fallback global de AI keys (mejor configurarlas en `/admin/ajustes/ia`) |

Todas en `.env.docker.example` con explicación inline.

---

## Comandos típicos

```bash
# Arrancar (background)
docker compose up -d

# Parar (mantiene volúmenes)
docker compose down

# Parar y BORRAR los datos (⚠️ destructivo)
docker compose down -v

# Logs en vivo
docker compose logs -f csm
docker compose logs -f postgres

# Aplicar nuevas migrations tras git pull
docker compose pull       # si la imagen es de un registry
docker compose build csm  # si construyes local
docker compose up -d
# El entrypoint ejecuta `drizzle-kit push --force` automáticamente al arrancar.

# Shell dentro del contenedor
docker compose exec csm sh

# Backup de Postgres
docker compose exec postgres pg_dump -U csm csm > backup_$(date +%F).sql

# Restore
cat backup_2026-05-05.sql | docker compose exec -T postgres psql -U csm csm
```

---

## Auto-arranque tras reboot

Ya viene configurado: `restart: always` en ambos servicios. Cuando reinicias el host (por kernel update, OOM, corte de luz), Docker daemon arranca → CSM y Postgres se levantan automáticamente.

Verifica que el daemon de Docker arranca al boot:

```bash
# systemd (Ubuntu/Debian/Fedora)
sudo systemctl enable docker

# En Mac/Windows con Docker Desktop, configura "Open Docker Desktop at login"
```

---

## Detrás de un reverse proxy (recomendado producción)

CSM bindea por defecto a `127.0.0.1:3000` — no se expone a internet. Pon Caddy/Nginx/Traefik delante:

### Caddy (simplísimo)

```caddy
# /etc/caddy/Caddyfile
csm.tudominio.com {
  reverse_proxy 127.0.0.1:3000
}
```

Caddy gestiona TLS/Let's Encrypt automático.

### Nginx

```nginx
server {
  listen 443 ssl http2;
  server_name csm.tudominio.com;

  ssl_certificate     /etc/letsencrypt/live/csm.tudominio.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/csm.tudominio.com/privkey.pem;

  # WebSocket / Server-Sent Events para presencia + collab
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300s;   # SSE no debe cerrarse rápido
  }
}
```

Recuerda actualizar `NEXT_PUBLIC_APP_URL=https://csm.tudominio.com` en `.env`.

---

## ¿Y MySQL?

**Estado actual:** CSM soporta **Postgres** (recomendado) y **MySQL 8.4+** desde Tarea 9. La detección es automática a partir del prefijo de `DATABASE_URL` (`postgres://` o `mysql://`).

### Postgres (recomendado)

Stack completo sin deps adicionales:
- FTS nativo con tsvector + ts_headline
- Vector search con pgvector
- Pubsub cross-instance con LISTEN/NOTIFY (cero deps)
- Todas las features funcionan out-of-the-box

```bash
docker compose up -d
```

### MySQL 8.4+

Funciona con limitaciones documentadas:
- FTS con `MATCH...AGAINST IN BOOLEAN MODE` (snippets generados en JS)
- Vector search nativo solo en MySQL 9+ (`VECTOR(N)` + `VEC_DISTANCE`). MySQL 8.4 → usar Qdrant external.
- Pubsub cross-instance requiere Redis (LISTEN/NOTIFY no existe en MySQL).

```bash
# Solo MySQL (en lugar de Postgres):
docker compose -f docker-compose.mysql.yml up -d mysql
# Configura DATABASE_URL=mysql://csm:PASS@mysql:3306/csm en .env

# Con Redis para pubsub cross-instance:
docker compose -f docker-compose.yml \
  -f docker-compose.mysql.yml \
  -f docker-compose.redis.yml up -d
```

### Redis (opcional)

Necesario solo si:
- Multi-instance + DB=MySQL (single-instance MySQL funciona sin Redis).
- Multi-instance + DB=Postgres y quieres separar pubsub del DB.

```bash
docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d
```

### SQL Server

**No soportado.** El compose `docker-compose.mssql.yml` queda como referencia histórica pero CSM no se conecta a MSSQL — el ORM Drizzle no tiene driver oficial.

---

## Troubleshooting

### "AUTH_SECRET es obligatorio"
Falta o está vacío en `.env`. Genera uno: `openssl rand -hex 32`.

### El contenedor csm reinicia continuamente
Mira `docker compose logs csm`. Causas comunes:
- `DATABASE_URL` apunta a un Postgres que no responde → revisa el healthcheck del servicio postgres
- `AUTH_SECRET` o `POSTGRES_PASSWORD` vacíos → revisa `.env`
- Schema desactualizado → entra al contenedor y ejecuta `npx drizzle-kit push --force`

### "Connection refused" desde la app a Postgres
El servicio `csm` usa el hostname `postgres` (nombre del servicio en compose), no `localhost`. Si modificaste `DATABASE_URL` manualmente, asegúrate de que apunta a `postgres:5432`.

### Quiero acceder a Postgres desde mi máquina (DBeaver, psql)
Crea un `docker-compose.override.yml` con:
```yaml
services:
  postgres:
    ports:
      - "127.0.0.1:5432:5432"
```
Y conecta con `postgres://csm:<TU_PASSWORD>@127.0.0.1:5432/csm`.

### Ollama no se ve desde el contenedor
Si Ollama corre en tu host y CSM en Docker, `localhost` desde dentro del contenedor apunta al propio contenedor, no al host. Usa:
- Mac/Windows: `OLLAMA_URL=http://host.docker.internal:11434`
- Linux: `OLLAMA_URL=http://172.17.0.1:11434` (IP del bridge default)

### Los videos / fonts del CDN no cargan
La CSP está configurada para los CDNs específicos del proyecto (cloudfront, motionsites, etc.). Si añades dominios propios, edita `next.config.ts` → `headers` → CSP `img-src` y `media-src`.
