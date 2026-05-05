# CSM — Guía de base de datos

CSM soporta **Postgres 14+** (recomendado) y **MySQL 8.4+** (con limitaciones). La detección es automática a partir del prefijo de `DATABASE_URL`.

```bash
# Postgres
DATABASE_URL=postgres://user:pass@host:5432/dbname?sslmode=require

# MySQL
DATABASE_URL=mysql://user:pass@host:3306/dbname
```

---

## ¿Qué BD elegir?

### Elige **Postgres** si:
- Quieres todas las features sin trade-offs.
- Despliegues > 1 instancia y quieres simplicidad (LISTEN/NOTIFY sin Redis).
- Necesitas vector search nativo (recomendaciones, RAG, semantic search).
- FTS de calidad (tokenizer multi-idioma, stemming, weighted search).

### Elige **MySQL** si:
- Tu organización ya usa MySQL/MariaDB y quieres consolidar stack.
- Hosting compartido limita a MySQL (cPanel, hostings tradicionales).
- Familiar con MySQL ops (backup, monitoring, tuning).

---

## Matriz de features por BD

| Feature                       | Postgres                   | MySQL 8.4                   | MySQL 9.0+                  |
|-------------------------------|----------------------------|-----------------------------|-----------------------------|
| CRUD + transactions           | ✅                         | ✅                          | ✅                          |
| Branching (forks de contenido)| ✅                         | ✅                          | ✅                          |
| Workflows + Editorial OS      | ✅                         | ✅                          | ✅                          |
| Comments + moderación AI      | ✅                         | ✅                          | ✅                          |
| Memberships + Stripe          | ✅                         | ✅                          | ✅                          |
| Forms + automations           | ✅                         | ✅                          | ✅                          |
| **FTS (search interno)**      | ✅ tsvector + ts_headline  | ⚠️ MATCH...AGAINST + JS snippet | ⚠️ idem 8.4              |
| **Vector search (RAG, semantic)** | ✅ pgvector            | ❌ usar Qdrant              | ✅ VECTOR + VEC_DISTANCE    |
| **Pubsub cross-instance**     | ✅ LISTEN/NOTIFY (cero deps) | ⚠️ Redis requerido       | ⚠️ Redis requerido          |
| **Y.js collab + presence**    | ✅                         | ✅ (con Redis)              | ✅ (con Redis)              |
| **Realtime notifications**    | ✅                         | ✅ (con Redis)              | ✅ (con Redis)              |
| Single-instance               | ✅                         | ✅                          | ✅                          |
| Multi-instance                | ✅                         | ✅ (con Redis)              | ✅ (con Redis)              |

**Leyenda:** ✅ funciona out-of-the-box · ⚠️ funciona con caveat · ❌ no soportado nativamente

---

## Configuración por escenario

### Escenario 1 — Postgres, todo nativo (recomendado)

```bash
DATABASE_URL=postgres://csm:pass@db:5432/csm
# REDIS_URL no necesario
```

**Compose:**
```bash
docker compose up -d
```

Multi-instance funciona sin Redis: el LISTEN/NOTIFY de Postgres maneja el fanout entre instancias para presence/collab/notifications.

### Escenario 2 — MySQL 8.4 single-instance

```bash
DATABASE_URL=mysql://csm:pass@db:3306/csm
# REDIS_URL no necesario para single-instance
```

**Compose:**
```bash
docker compose -f docker-compose.mysql.yml up -d mysql
```

Trade-off: vector search desactivado (sin pgvector, sin VEC_DISTANCE en 8.x). El RAG/semantic search devuelve resultados solo por FTS (BM25), sin componente semántico.

### Escenario 3 — MySQL 8.4 multi-instance (con Redis)

```bash
DATABASE_URL=mysql://csm:pass@db:3306/csm
REDIS_URL=redis://:pass@redis:6379
```

**Compose:**
```bash
docker compose -f docker-compose.yml \
  -f docker-compose.mysql.yml \
  -f docker-compose.redis.yml up -d
```

Pubsub cross-instance va por Redis. FTS funciona pero con stemming básico. Para vector search: añadir Qdrant external (ver siguiente sección).

### Escenario 4 — MySQL 9 multi-instance (paridad casi completa)

```bash
DATABASE_URL=mysql://csm:pass@db:3306/csm
REDIS_URL=redis://:pass@redis:6379
```

Vector search nativo via `VECTOR(1536)` + `VEC_DISTANCE(col, ?, "COSINE")`. Solo el FTS se queda detrás de Postgres por la calidad del tokenizer.

---

## Vector search externo con Qdrant

Si MySQL <9 y necesitas semantic search, levanta Qdrant aparte (no incluido en compose porque es opt-in):

```yaml
# docker-compose.qdrant.yml
services:
  qdrant:
    image: qdrant/qdrant:latest
    restart: always
    volumes:
      - csm_qdrant_data:/qdrant/storage
    networks:
      - csm_net

volumes:
  csm_qdrant_data:
```

```bash
# .env adicional
QDRANT_URL=http://qdrant:6333
QDRANT_API_KEY=<opcional>
```

> **Nota:** el adapter Qdrant queda documentado en `src/db/dialect/vector.ts` como referencia. Implementación completa diferida a F10x cuando exista demanda real.

---

## Limitaciones específicas

### FTS en MySQL

- Tokenizer básico (no stemming sofisticado por idioma).
- Min word length por defecto 3 chars (`innodb_ft_min_token_size=3`). Para incluir palabras de 2 chars (ej. siglas): bajar a 2 en my.cnf.
- Snippet con `<mark>` se genera en JS (MySQL no tiene `ts_headline`). Calidad similar para ventanas de 200 chars.

### Pubsub en MySQL

- Sin LISTEN/NOTIFY equivalent. Multi-instance requiere Redis para presence/collab/notifications.
- Single-instance funciona sin Redis (in-memory pubsub) — pero pierdes fanout cross-instance.

### Vector search en MySQL 8.x

- No hay tipo `VECTOR` nativo. La columna `embedding` queda como BLOB sin queries de distancia.
- Workaround: Qdrant external (ver arriba). El pipeline de embeddings sigue corriendo y guarda los vectores también allí.

### Branching

- Funciona idéntico en ambas BDs. CTEs recursivos (sintaxis `WITH RECURSIVE`) son compatibles MySQL 8+ y Postgres. CSM aplana la mayoría de árboles en JS para ahorrar cycles.

---

## Migración entre BDs

**Postgres → MySQL** (o viceversa) NO es trivial:
1. `pg_dump` no produce SQL portable a MySQL (tipos, syntax difieren).
2. Usar herramienta intermedia: [pgloader](https://pgloader.io/) (PG→MySQL), [mysql_to_postgresql](https://github.com/Nodet/mysql_to_postgresql) (MySQL→PG).
3. Después de migrar datos: `npm run db:push -- --force` con la BD destino para aplicar el schema correcto.
4. Re-indexar embeddings (`/admin/buscar/reindexar`) si cambias entre dialectos.

**Recomendación:** elige la BD al principio y mantén. Cambiar mid-flight requiere downtime de minutos a horas según volumen.

---

## Backup recomendado

### Postgres

```bash
docker compose exec postgres pg_dump -U csm -Fc csm > backup_$(date +%F).dump

# Restore
docker compose exec -T postgres pg_restore -U csm -d csm < backup_2026-05-05.dump
```

### MySQL

```bash
docker compose exec mysql mysqldump -u csm -p csm > backup_$(date +%F).sql

# Restore
docker compose exec -T mysql mysql -u csm -p csm < backup_2026-05-05.sql
```

Para producción: configurar backup automático (cron + S3) — ver `docs/DOCKER.md` sección "Backup".

---

## Troubleshooting

### "ERROR: extension vector does not exist"
Postgres sin pgvector. Instálalo:
```sql
CREATE EXTENSION vector;
```
Imagen `ankane/pgvector:latest` ya lo trae. La oficial `postgres:16-alpine` NO.

### "ERROR 1191: Can't find FULLTEXT index matching the column list"
MySQL sin FULLTEXT index en `entries`. Aplicar migration:
```sql
ALTER TABLE entries ADD FULLTEXT INDEX entries_fts_idx (title, body_text, excerpt);
```
La migration la genera `npm run db:push` o `npm run db:generate`.

### "[csm/pubsub] Using in-memory pubsub: cross-instance fanout DISABLED"
Estás corriendo MySQL multi-instance sin REDIS_URL. Configurar Redis o aceptar el trade-off (single-instance only).

### Vector search devuelve 0 resultados con MySQL 8.x
MySQL 8.x no tiene VEC_DISTANCE. El adapter degrada a "no semantic" — solo BM25/FTS contribuyen al ranking. Para semantic: upgrade a MySQL 9+ o añadir Qdrant external.
