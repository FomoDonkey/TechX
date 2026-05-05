# CSM — Guía de Redis

CSM usa Redis (opcional) para **pubsub cross-instance**: presence en vivo, Y.js collaborative editing, notifications SSE, reactions live. Cuando NO está configurado, el sistema escoge automáticamente otro backend.

```bash
# Activar Redis
REDIS_URL=redis://:password@host:6379
```

---

## ¿Cuándo necesitas Redis?

### NO necesitas Redis si:
- Despliegue **single-instance** (1 réplica de la app). El pubsub in-memory del proceso basta.
- Despliegue **multi-instance con Postgres**. CSM usa Postgres `LISTEN/NOTIFY` automáticamente.

### SÍ necesitas Redis si:
- Despliegue **multi-instance con MySQL**. MySQL no tiene equivalente a LISTEN/NOTIFY.
- Quieres **separar el tráfico** de pubsub del DB OLTP (ej. multi-region: DB lejos, Redis cerca).
- **Vercel Functions múltiples** instancias en distintas regiones (mismo motivo).

---

## Auto-detect del backend

El módulo `src/realtime/pubsub.ts` resuelve el backend al primer uso:

```
┌─────────────────────────────────┬──────────────────────────────┐
│ Condición                       │ Backend                      │
├─────────────────────────────────┼──────────────────────────────┤
│ REDIS_URL set                   │ Redis pub/sub (cualquier DB) │
│ DB=Postgres y NO REDIS_URL      │ Postgres LISTEN/NOTIFY        │
│ DB=MySQL y NO REDIS_URL         │ In-memory (warn)              │
│ NO DB                           │ In-memory (warn)              │
└─────────────────────────────────┴──────────────────────────────┘
```

Para verificar qué backend está activo, revisa los logs al primer evento — el adapter in-memory imprime un `console.warn` único.

---

## Setup local con Docker

```bash
docker compose -f docker-compose.yml -f docker-compose.redis.yml up -d
```

Esto añade un servicio `redis:7-alpine` en la red interna `csm_net` y configura `REDIS_URL` en el container `csm` automáticamente.

`.env` requerido:
```bash
REDIS_PASSWORD=<generar con: openssl rand -base64 24>
```

---

## Setup en proveedores managed

### Upstash (recomendado para Vercel)
- Endpoint: `redis://default:TOKEN@xxxxx.upstash.io:6379`
- Free tier: 10K cmds/día, 256MB. Suficiente para sites < 50 editores concurrentes.
- TLS automático.

### AWS ElastiCache / Google Memorystore
- Configurar VPC peering con tu app server.
- Recomendado: cluster mode = disabled (más simple, suficiente para CSM).
- Versión Redis 6+ requerida.

### Redis Cloud
- Tier gratuito 30MB. Suficiente para dev/staging.

---

## Tuning recomendado

CSM usa Redis solo para pubsub (sin persistencia obligatoria). Configuración óptima:

```redis
# Suficiente con persistencia mínima — los mensajes son ephemeral
save 60 1000
appendonly no

# Eviction si la memoria se llena (no debería con pubsub)
maxmemory-policy allkeys-lru
```

Esto ya está aplicado en `docker-compose.redis.yml`.

---

## Channels usados por CSM

| Channel pattern              | Uso                                      | Source           |
|------------------------------|------------------------------------------|------------------|
| `notif:ws:{wsId}`            | Bell SSE — notifications + mentions      | editorial        |
| `presence:ws:{wsId}`         | Presence + reactions live                | presence + threads |
| `collab:up:{entryId}`        | Y.js doc updates entre clientes          | collaborative editor |
| `collab:aw:{entryId}`        | Awareness (cursors, selección)           | collaborative editor |

Payloads JSON serializados, típicamente 200-2000 bytes. Nunca >8KB.

---

## Troubleshooting

### "WRONGPASS invalid username-password pair"
`REDIS_URL` mal formateado. Asegúrate de tener `redis://:PASSWORD@host:port` (los dos puntos antes del password indican usuario default).

### Bell notifications no llegan en tiempo real
Verificar que el servidor que recibe el SSE y el que dispara la notificación comparten el mismo Redis. Si están en VPCs distintas: configurar VPC peering o usar Redis público con TLS.

### Presence se queda colgada con peers fantasma
El presence cleanup cron (`/api/cron/presence-cleanup`) borra sesiones >5min sin heartbeat. Verifica que el cron está configurado en Vercel/cron-runner.

### Y.js cursors no se ven en otros peers
Los updates van por canal `collab:aw:{entryId}` (NO persistente). Si Redis tira durante la edición, los nuevos cursors se sincronizan al próximo update. No causa data loss porque las awareness updates son ephemeral.

### En logs: "[csm/pubsub] Using in-memory pubsub..."
No has configurado REDIS_URL y el dialect no soporta LISTEN/NOTIFY. Acepta o configura Redis.

---

## Coste estimado

Para un site de ~10K editores activos diarios con 100 simultáneos colaborando:
- ~50K msgs/día (presence heartbeat + collab updates).
- Latencia <5ms si Redis está en la misma región.
- Memoria peak: <50MB.

Free tier de Upstash sobra para empezar. Considera Redis dedicado solo cuando tengas >100K editores DAU.
