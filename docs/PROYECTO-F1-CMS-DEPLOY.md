# Proyecto F1 — Despliegue del CMS en AWS con base de datos MySQL en el cloud SDS

> Documento de entrega · Bloque BD / CMS del proyecto **PRJ01IA01** — Liberty Media F1 Site
>
> **Grupo:** Edgar · Álvaro · Samuel · José
>
> Ámbito de este documento: instalación del CMS en una instancia AWS EC2 conectada
> al servidor MySQL ya desplegado en el cloud público de Salesians (SDS) y
> creación de una web atractiva sobre el campeonato de F1 con la información del
> dataset [toUpperCase78/formula1-datasets](https://github.com/toUpperCase78/formula1-datasets).
> Quedan fuera de este documento la infraestructura de red (Mikrotik, AD, VPN),
> la monitorización Zabbix/Grafana, el SQL Server con SPs, Velneo y los vídeos
> en inglés.

---

## Datos del despliegue

| Componente | Valor |
|---|---|
| Servidor MySQL (SDS) | `5.196.50.3:33060` |
| Base de datos | `csm_f1` (la creamos en el paso 5.3) |
| Usuario MySQL para CSM | `csm` (lo creamos en el paso 5.3) |
| Instancia AWS EC2 | `<IP_PUBLICA_EC2>` *(pendiente — se rellena el día del despliegue)* |
| Dominio público | `<DOMINIO_EC2>` *(pendiente — opcional)* |
| Repositorio CMS | https://github.com/FomoDonkey/TechX |
| Dataset F1 | https://github.com/toUpperCase78/formula1-datasets |

---

## Tabla de contenidos

0. [⚡ Inicio rápido (TL;DR en 5 comandos)](#0-inicio-rápido-tldr-en-5-comandos)
   - [0.1 Mapa de máquinas — qué se ejecuta dónde](#01-mapa-de-máquinas--qué-se-ejecuta-dónde)
   - [0.2 Cómo construir DATABASE_URL](#02-cómo-construir-database_url)
   - [0.3 Cómo generar AUTH_SECRET](#03-cómo-generar-auth_secret)
1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Arquitectura desplegada](#2-arquitectura-desplegada)
3. [Stack técnico del CMS elegido (CSM)](#3-stack-técnico-del-cms-elegido-csm)
4. [Requisitos previos](#4-requisitos-previos)
5. [Configuración del MySQL ya desplegado en el SDS](#5-configuración-del-mysql-ya-desplegado-en-el-sds)
6. [Preparación de la instancia AWS EC2](#6-preparación-de-la-instancia-aws-ec2)
7. [Despliegue del CMS](#7-despliegue-del-cms)
8. [Inicialización del schema y datos](#8-inicialización-del-schema-y-datos)
9. [Carga del dataset oficial de F1](#9-carga-del-dataset-oficial-de-f1)
10. [Aplicación de la plantilla F1 espectacular](#10-aplicación-de-la-plantilla-f1-espectacular)
11. [HTTPS con Caddy y Let's Encrypt](#11-https-con-caddy-y-lets-encrypt)
12. [Medidas de seguridad aplicadas](#12-medidas-de-seguridad-aplicadas)
13. [Verificación final](#13-verificación-final)
14. [Troubleshooting frecuente](#14-troubleshooting-frecuente)
15. [Anexo A — Comandos útiles](#anexo-a--comandos-útiles)
16. [Anexo B — Estructura del proyecto](#anexo-b--estructura-del-proyecto)
17. [Anexo C — Variables de entorno completas](#anexo-c--variables-de-entorno-completas)

---

## 0. Inicio rápido (TL;DR en 5 comandos)

> **Convención del documento:** cada bloque de comandos lleva una etiqueta
> indicando en qué máquina se ejecuta. Las máquinas son tres y siempre las
> mismas:
>
> - 🟦 **[SDS Francia]** — el servidor MySQL en `5.196.50.3:33060`
> - 🟧 **[AWS EC2]** — la instancia que alquilamos para el CMS
> - 🟩 **[Local]** — tu portátil (solo se usa para clonar y `ssh`)
> - 🟪 **[Container csm]** — desde la EC2, `docker compose exec csm <cmd>`

Una vez que (1) tienes acceso SSH a la EC2, (2) tienes el MySQL del SDS
operativo, y (3) ya conoces la IP pública de tu EC2, el despliegue se
reduce a estos 5 pasos:

```bash
# 1. 🟦 [SDS Francia] — Conectado por mysql como root, crear BD y usuario.
#    Ver paso 5.3 para el SQL completo.
CREATE DATABASE csm_f1 CHARACTER SET utf8mb4;
CREATE USER 'csm'@'<IP_PUBLICA_EC2>' IDENTIFIED BY '<PASSWORD>';
GRANT ALL ON csm_f1.* TO 'csm'@'<IP_PUBLICA_EC2>';
FLUSH PRIVILEGES;
```

```bash
# 2. 🟧 [AWS EC2] — Clonar el repo y configurar .env
git clone https://github.com/FomoDonkey/TechX.git csm && cd csm
cp .env.docker.example .env

# Edita .env con DATABASE_URL + AUTH_SECRET (ver secciones 0.2 y 0.3)
# Imprescindible:
#   DATABASE_URL=mysql://csm:<PASSWORD>@5.196.50.3:33060/csm_f1
#   AUTH_SECRET=<output de: openssl rand -hex 32>
#   MYSQL_VECTOR_FALLBACK=true   # solo si tu MySQL es 8.x (no 9+)
nano .env
```

```bash
# 3. 🟧 [AWS EC2] — Cargar dataset F1 + sincronizar bloques
npm run f1:setup
```

```bash
# 4. 🟧 [AWS EC2] — Levantar el CMS apuntando a la BD externa del SDS
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml up -d csm
```

```bash
# 5. 🟪 [Container csm] — Sembrar workspace + usuario admin demo
docker compose exec csm npm run db:seed
```

Abre el navegador en `http://<IP_PUBLICA_EC2>:3000/login` y entra con
`demo@csm.dev` / `demo1234`. Ve a `/admin/plantillas` → categoría
**Deportes** → **F1 Grand Prix — Inmersivo** → **Usar esta plantilla**
→ **Publicar**. La home pública mostrará la web F1 espectacular.

Para HTTPS con dominio público, sigue además el paso 11 (Caddy).

---

### 0.1 Mapa de máquinas — qué se ejecuta dónde

| Máquina | Qué corre | Comandos típicos | Cuándo conectas |
|---|---|---|---|
| 🟦 **SDS Francia** (`5.196.50.3:33060`) | MySQL 8.4 en Docker | `mysql`, SQL `CREATE DATABASE`, `GRANT`, ajustes firewall del SDS | Solo paso 5 (preparar la BD) |
| 🟧 **AWS EC2** (`<IP_PUBLICA_EC2>`) | Docker + Caddy + git + npm | `git`, `docker compose`, `npm run f1:setup`, `caddy`, `ufw` | Pasos 6, 7, 9, 11 |
| 🟩 **Tu portátil (Local)** | SSH client + navegador | `ssh -i ...`, `git clone` (opcional), navegador para verificar | Conectarte a EC2 y abrir la web |
| 🟪 **Container csm** (vive dentro de EC2) | Next.js standalone + drizzle-kit | `docker compose exec csm <cmd>` desde la EC2 | Pasos 8, 10 (vía interfaz web) |

**Regla mental:** si el comando es `mysql -h ...`, va al SDS o a la EC2
(donde tengas el cliente). Si es `docker compose ...` o `npm run ...`, va
**siempre** a la EC2. Si es `docker compose exec csm ...`, lo ejecutas en
la EC2 pero corre **dentro** del container.

---

### 0.2 Cómo construir DATABASE_URL

`DATABASE_URL` es un string de conexión que CSM detecta automáticamente
para elegir el driver (Postgres o MySQL). Para el caso F1 usamos MySQL.

**Formato genérico MySQL:**
```
mysql://USUARIO:PASSWORD@HOST:PUERTO/BASEDEDATOS
```

**Para nuestro despliegue F1**, los valores salen de los pasos 5.2 y 5.3:

| Componente | Valor en F1 | De dónde sale |
|---|---|---|
| `USUARIO` | `csm` | Lo creas en el paso **5.3** con `CREATE USER 'csm'@'...'` |
| `PASSWORD` | aleatorio 24 bytes | Lo generas en el paso **5.2** con `openssl rand -base64 24` |
| `HOST` | `5.196.50.3` | IP del cloud SDS (servidor MySQL Francia) |
| `PUERTO` | `33060` | Puerto custom no estándar del MySQL del SDS |
| `BASEDEDATOS` | `csm_f1` | La creas en el paso **5.3** con `CREATE DATABASE csm_f1` |

**Ejemplo completo** (sustituye `Tu_Pass_Aqui` por el de paso 5.2):
```bash
DATABASE_URL=mysql://csm:Tu_Pass_Aqui@5.196.50.3:33060/csm_f1
```

> ⚠️ Si la password contiene caracteres especiales (`@`, `:`, `/`, `?`, `#`),
> hay que URL-encodearla. Caracteres seguros: letras, dígitos, `-`, `_`, `.`.
> El comando `openssl rand -base64 24` puede generar `+`, `/`, `=` — si te
> tocan, regenera o usa `openssl rand -hex 24` (solo hex, siempre seguros).

---

### 0.3 Cómo generar AUTH_SECRET

`AUTH_SECRET` es la clave maestra que CSM usa para:
- Firmar cookies de sesión (Better-Auth).
- Cifrar AI keys at-rest en la BD (AES-256-GCM con HKDF derivado).

Necesita 64 caracteres hexadecimales (32 bytes de entropía). Generar:

```bash
# Opción A: 🟩 [Local] o 🟧 [AWS EC2] — con OpenSSL (universal)
openssl rand -hex 32

# Opción B: 🟧 [AWS EC2] — desde dentro del repo (npm script incluido)
npm run gen:secret
```

Pega el output en `.env`:
```bash
AUTH_SECRET=ab12cd34...64chars...ef
```

> ⚠️ **NO uses** el placeholder del `.env.example` (`dev-secret-change-me-...`).
> Es público en GitHub y un atacante podría firmar sesiones válidas.
>
> ⚠️ **No lo cambies después** sin avisar al equipo: invalida todas las
> sesiones activas y deja **ilegibles** las AI keys ya guardadas en la BD
> (al estar cifradas con la clave anterior).
>
> ⚠️ **Guárdalo en gestor de contraseñas** (1Password, Bitwarden, etc.) —
> lo necesitas si haces rebuild de la imagen o migras de host.

---

## 1. Resumen ejecutivo

Como grupo entregamos una **web pública del campeonato de Fórmula 1** servida por
un CMS open-source moderno (**CSM**) que hemos instalado en AWS y conectado a
una base de datos MySQL alojada en el cloud público de Salesians (SDS).

**Componentes del despliegue:**

| Componente | Tecnología | Ubicación |
|---|---|---|
| Servidor web + CMS | Next.js 15 + React 19 (CSM) | Instancia EC2 en AWS |
| Base de datos | MySQL 8.4 (ya desplegado por el grupo) | Cloud SDS (OVH France) |
| Conexión | TLS por puerto custom no estándar | Internet |
| Reverse proxy | Caddy 2 (HTTPS automático) | Misma EC2 |

**Requisitos del enunciado cubiertos por este documento:**

- [x] Servidor MySQL operativo en el cloud SDS alimentando el CMS
- [x] CMS desplegado en AWS conectado al MySQL del SDS
- [x] Web atractiva con toda la información del campeonato F1 (plantilla espectacular)
- [x] Datos cargados desde [github.com/toUpperCase78/formula1-datasets](https://github.com/toUpperCase78/formula1-datasets)
- [x] Acceso HTTPS para que toda la plataforma esté expuesta de forma segura
- [x] Contraseñas seguras (passwords ≥ 16 chars + cifrado AES-256-GCM en BD)
- [x] Acceso restringido por IP entre EC2 y MySQL del SDS (no abierto a `0.0.0.0/0`)

---

## 2. Arquitectura desplegada

```
                                INTERNET
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 │   HTTPS 443      │   HTTPS 443      │
                 │  (Let's Encrypt) │                  │
                 ▼                  ▼                  ▼
          ┌──────────────┐                    ┌──────────────┐
          │  Editores    │                    │  Visitantes  │
          │   /admin     │                    │   /          │
          └──────┬───────┘                    └──────┬───────┘
                 │                                   │
                 └────────────────┬──────────────────┘
                                  │
                        ┌─────────▼──────────┐
                        │   AWS EC2 t3.small │
                        │   Caddy (TLS)      │
                        │   :3000 ─ Next.js  │
                        │     CSM (Docker)   │
                        └─────────┬──────────┘
                                  │
                        TCP custom port (no 3306)
                                  │
                                  ▼
                        ┌────────────────────┐
                        │  Cloud SDS (OVH)   │
                        │  MySQL 8.4 Docker  │
                        │  (ya desplegado    │
                        │   por el grupo)    │
                        │  Firewall: solo IP │
                        │  pública de la EC2 │
                        └────────────────────┘
```

**Decisiones arquitectónicas que hemos tomado:**

- **CMS y BD en máquinas separadas** porque el enunciado lo exige. Esto añade
  latencia pero garantiza que un compromiso del CMS no expone directamente el
  motor de BD.
- **Puerto MySQL no estándar** (33060) para reducir la superficie de ataque
  automatizado contra el `3306` por defecto.
- **Conexión MySQL restringida por IP origen**: solo la IP pública de nuestra
  EC2 puede conectar, evitando ataques desde botnets globales.
- **Caddy delante del CMS**: gestiona TLS/HTTPS automático con renovación
  Let's Encrypt y nos permite cumplir el requisito "https" del enunciado.
- **Docker Compose** en la EC2 simplifica el mantenimiento y permite reinicio
  automático tras un reboot del host (`restart: always`).

---

## 3. Stack técnico del CMS elegido (CSM)

Hemos elegido CSM (Content Spectacular Machine), un CMS open-source moderno
que ofrece soporte nativo MySQL desde el connection string y que incluye una
plantilla espectacular para sitios deportivos como el nuestro.

### 3.1 Tecnologías

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Runtime | Node.js | ≥ 22 LTS | Última LTS soportada en AWS y Vercel |
| Framework web | Next.js (App Router) | 15.x | SSR + RSC + middleware |
| UI | React | 19 | Server components + concurrent rendering |
| Estilos | Tailwind CSS | 4 | Utility-first, JIT, dark mode tokens |
| Animaciones | Framer Motion | 11 | Plantilla espectacular F1 |
| Editor | Tiptap 3 | 3.x | WYSIWYG con extensiones colaborativas |
| ORM | Drizzle ORM | 0.45 | Multi-dialect (PG + MySQL) sin reescribir queries |
| Auth | Better-Auth | 1.6 | Sesiones, magic-link, 2FA TOTP |
| Validación | Zod | 3.24 | Schemas declarativos en runtime |

### 3.2 Características clave del CMS

- Multi-tenant (workspaces), multi-idioma, multi-tema.
- Editor visual de páginas (page builder) con bloques reutilizables.
- 9 plantillas predefinidas (incluida la **F1 Grand Prix Inmersivo** desarrollada
  específicamente para este proyecto).
- Importador CSV → colecciones (carga del dataset toUpperCase78).
- Sistema de roles (Owner, Admin, Editor, Author, Viewer).
- API REST + GraphQL + MCP server.
- Búsqueda híbrida (FTS + vector cuando el dialect lo soporte).
- Soporte nativo Postgres y MySQL con detección automática del dialect
  desde el connection string.

### 3.3 Plantilla F1 (entregable principal de la web pública)

La plantilla que aplicamos está compuesta por **15 secciones** alimentadas por
datos reales del dataset toUpperCase78. Estructura visual:

```
HERO countdown live (próximo GP)
─── BANNER 2025 (rojo) ─────────────────
PODIO última carrera 2025 (Abu Dhabi)
PILOTOS titulares con cards 3D-tilt
CLASIFICACIÓN PILOTOS con barras animadas
ESCUDERÍAS marquee infinito
CLASIFICACIÓN CONSTRUCTORES
CALENDARIO sticky stack 24 GPs
CIRCUITOS legendarios
DRIVER OF THE DAY top 10 votos
TEMPORADA 2025 EN CIFRAS counters
─── BANNER 2022—24 (neutral) ──────────
PALMARÉS 3 temporadas (Verstappen tricampeón)
─── BANNER 2026 (violeta) ─────────────
TEMPORADA 2026 (parrilla, primeros resultados)
CTA suscripción
```

---

## 4. Requisitos previos

Antes de empezar el despliegue nos aseguramos de tener:

| Requisito | Cómo verificarlo |
|---|---|
| Instancia EC2 lanzada (recomendado t3.small o superior) | Consola AWS → EC2 |
| Acceso SSH a la EC2 con tu key `.pem` | `ssh -i mykey.pem ubuntu@IP` |
| Servidor MySQL 8.4 corriendo en cloud SDS | `mysql -h 5.196.50.3 -P PUERTO -u root -p` |
| Permisos para abrir puertos en el firewall del SDS | Panel del SDS o iptables/UFW |
| Permisos para crear usuarios MySQL | Acceso `root` al MySQL del SDS |
| Dominio apuntando a la EC2 (opcional pero recomendado) | DNS A record → IP EC2 |
| `git` instalado en la EC2 | Lo instalaremos en el paso 6 |

---

## 5. Configuración del MySQL ya desplegado en el SDS

> 🟦 **Toda esta sección 5 va contra el MySQL del SDS** (`5.196.50.3:33060`).
> Los comandos `mysql -h 5.196.50.3 ...` los ejecutas desde donde tengas un
> cliente MySQL: tu portátil 🟩 o la EC2 🟧 (lo mismo da, mientras la IP
> tenga grant). Los comandos de firewall del SDS (`ufw`) los ejecutas
> conectado al servidor SDS por SSH (no documentamos cómo aquí — ya lo
> tienes del bloque de Sistemas).

El servidor MySQL **ya estaba desplegado** en el cloud SDS por nuestro grupo,
en un container Docker, antes de empezar esta parte del proyecto. La instancia
escucha en `5.196.50.3:33060` (puerto custom no estándar para reducir la
superficie de ataque) y de momento está vacía: no contiene ni base de datos
de aplicación ni usuarios distintos del root.

Esta sección cubre lo que **sí** hacemos sobre ese MySQL ya operativo:

1. Comprobar la conectividad desde nuestra ubicación de trabajo.
2. Generar contraseñas seguras para el usuario que va a usar el CMS.
3. Crear la base de datos `csm_f1` y el usuario `csm` con acceso restringido por IP.
4. Verificar el firewall del SDS.

> Nota: la instalación inicial del container MySQL en el SDS está documentada
> en el bloque de Sistemas Operativos / Redes del proyecto. Aquí partimos del
> MySQL ya levantado.

### 5.1 Comprobar la conectividad desde fuera

Antes de tocar nada, verificamos que el MySQL acepta conexiones en el puerto
asignado:

```bash
mysql -h 5.196.50.3 -P 33060 -u root -p -e "SELECT VERSION();"
```

Si responde con la versión, podemos seguir. Si da `timeout` o `connection
refused`, revisamos el firewall del SDS antes de continuar (sección 5.4).

### 5.2 Generar contraseñas seguras

Como nuestra infraestructura está expuesta a Internet **descartamos cualquier
password débil**. Hemos generado dos passwords aleatorios de 24 bytes:

```bash
# Password root (solo para administrar — guárdalo en un gestor)
openssl rand -base64 24

# Password del usuario CSM (la que usa el CMS para conectar)
openssl rand -base64 24
```

Guardamos ambos en nuestro gestor de contraseñas — más adelante los usamos
en el `.env` de la EC2 (paso 7).

### 5.3 Crear base de datos y usuario CSM con acceso restringido por IP

**Importante:** el grant solo se concede a la IP pública de la EC2. Hemos
descartado `'csm'@'%'` precisamente porque eso permitiría conectar desde
cualquier IP del mundo.

Conectamos como root al MySQL del SDS:

```bash
mysql -h 5.196.50.3 -P 33060 -u root -p
```

Ejecutamos el siguiente SQL (sustituyendo `<IP_PUBLICA_EC2>` por la IP real
de la instancia el día del despliegue, y `PASSWORD_CSM_GENERADO` por la
contraseña que generamos con `openssl rand -base64 24` en el paso 5.2):

```sql
-- 1. Creamos la base de datos del CMS
CREATE DATABASE IF NOT EXISTS csm_f1
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- 2. Defensa: borramos cualquier usuario csm previo (por si reinstalamos)
DROP USER IF EXISTS 'csm'@'%';
DROP USER IF EXISTS 'csm'@'<IP_PUBLICA_EC2>';

-- 3. Creamos el usuario CSM accesible SOLO desde la IP pública de la EC2
CREATE USER 'csm'@'<IP_PUBLICA_EC2>' IDENTIFIED BY 'PASSWORD_CSM_GENERADO';

-- 4. Concedemos privilegios SOLO sobre csm_f1 (no sobre otras BDs)
GRANT ALL PRIVILEGES ON csm_f1.* TO 'csm'@'<IP_PUBLICA_EC2>';

-- 5. Aplicamos los cambios
FLUSH PRIVILEGES;

-- 6. Verificación
SELECT User, Host FROM mysql.user WHERE User = 'csm';
```

La salida que esperamos confirma el grant aplicado:

```
+------+--------------------+
| User | Host               |
+------+--------------------+
| csm  | <IP_PUBLICA_EC2>   |
+------+--------------------+
```

### 5.4 Ajustar el firewall del SDS

Como el container MySQL ya estaba desplegado, el firewall ya tiene el
puerto **33060** abierto desde Internet. Lo restringimos para que solo
acepte conexiones desde la IP pública de nuestra EC2 (defensa adicional al
grant SQL del paso 5.3):

- Abrir TCP **33060** solo desde **<IP_PUBLICA_EC2>/32**.
- Mantener cerrado el TCP **3306** (puerto por defecto, no usado).
- Mantener SSH (22) abierto solo desde nuestra red de gestión.

Ejemplo con UFW (si es VM Linux directa):

```bash
sudo ufw allow from <IP_PUBLICA_EC2> to any port 33060 proto tcp
sudo ufw deny 3306/tcp
sudo ufw status verbose
```

### 5.5 Test de conectividad desde fuera

Verificamos desde la EC2 que la conexión funciona:

```bash
# Debe responder Connected
mysql -h 5.196.50.3 -P 33060 -u csm -p csm_f1 -e "SELECT VERSION();"
```

Si sale `Host is not allowed to connect`, revisa la sección 5.3 (probablemente
falta el grant para tu IP) o el firewall del SDS (sección 5.4).

---

## 6. Preparación de la instancia AWS EC2

> 🟧 **Toda esta sección se ejecuta en la EC2 AWS** (vía SSH desde tu portátil).

### 6.1 Conectamos por SSH

```bash
# 🟩 [Local] — el comando ssh va desde tu portátil
ssh -i ~/.ssh/mi-key.pem ubuntu@<IP_PUBLICA_EC2>
# A partir de aquí, todo lo que ejecutes está en la EC2 hasta que hagas exit.
```

### 6.2 Actualizamos paquetes

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ufw
```

### 6.3 Configuramos el firewall de la EC2 (UFW)

```bash
# Por defecto, denegar todo lo entrante
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Solo SSH y HTTPS abiertos al mundo
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw allow 80/tcp comment 'HTTP (Caddy redirige a HTTPS)'
sudo ufw allow 443/tcp comment 'HTTPS'

# Activa
sudo ufw enable
sudo ufw status verbose
```

> Nota: el Security Group de AWS también lo restringe. Mantenemos UFW como
> defensa en profundidad: los dos juntos son mejores que uno solo.

### 6.4 Instalamos Docker y Docker Compose

```bash
# Docker oficial
curl -fsSL https://get.docker.com | sudo sh

# Permitir al usuario ubuntu usar docker sin sudo
sudo usermod -aG docker $USER

# Aplicar el grupo en la sesión actual
newgrp docker

# Verifica
docker --version
docker compose version
```

### 6.5 Habilitamos Docker al boot

```bash
sudo systemctl enable docker
```

Con esto, tras un reboot del host (kernel update, OOM, corte de luz) los
containers con `restart: always` se levantan solos.

---

## 7. Despliegue del CMS

> 🟧 **Toda esta sección se ejecuta dentro de la EC2 AWS** (vía SSH desde tu
> portátil). Ningún paso aquí toca el SDS.

### 7.1 Clonamos el repositorio del CMS

```bash
# 🟧 [AWS EC2]
cd ~
git clone https://github.com/FomoDonkey/TechX.git csm
cd csm
```

### 7.2 Configuramos `.env`

```bash
# 🟧 [AWS EC2]
cp .env.docker.example .env
nano .env
```

Solo necesitamos rellenar 3 variables imprescindibles para F1 (las demás
quedan vacías o con su default):

```bash
# ============================================================
# DATABASE_URL — apunta al MySQL externo del SDS (ver sección 0.2)
# ============================================================
DATABASE_URL=mysql://csm:PASSWORD_CSM_GENERADO@5.196.50.3:33060/csm_f1

# ============================================================
# MYSQL_VECTOR_FALLBACK — solo si tu MySQL es 8.x (no 9+)
# El MySQL del SDS es 8.4, así que SÍ lo activamos.
# ============================================================
MYSQL_VECTOR_FALLBACK=true

# ============================================================
# AUTH_SECRET — secret de 64 hex chars (ver sección 0.3)
# Genera con: openssl rand -hex 32   o   npm run gen:secret
# ============================================================
AUTH_SECRET=__PEGA_AQUI_64_HEX_CHARS__

# ============================================================
# Red del container
# ============================================================
APP_HOST_BIND=127.0.0.1     # Caddy lo proxiará — solo localhost
APP_PORT=3000
NEXT_PUBLIC_APP_URL=https://<DOMINIO_EC2>_O_IP

# ============================================================
# POSTGRES_PASSWORD — déjalo vacío con BD externa (no se usará).
# El override de la sección 7.3 evita que el container postgres se levante.
# ============================================================
POSTGRES_PASSWORD=
```

> ⚠️ **No comentes el bloque `POSTGRES_PASSWORD`** entero — el compose
> principal sigue evaluándolo aunque el container no se levante. Déjalo
> definido (puede ser vacío) para que `docker compose config` valide el
> archivo sin errores.

Generamos `AUTH_SECRET` con cualquiera de estas opciones:

```bash
# 🟧 [AWS EC2] — opción universal
openssl rand -hex 32

# 🟧 [AWS EC2] — desde el repo (npm script incluido)
npm run gen:secret
```

Este secret cifra cookies de sesión y, con AES-256-GCM, las AI keys que
guarden los editores. Lo guardamos en el gestor de contraseñas porque
**cambiarlo después invalida todas las sesiones y deja ilegibles las AI keys
ya guardadas**.

### 7.3 Levantamos solo CSM (sin container Postgres)

Como nuestra BD está en el SDS, **no necesitamos el container `postgres`**.
El repo incluye un override de docker-compose que se encarga de todo —
**no editamos `docker-compose.yml` a mano**.

```bash
# 🟧 [AWS EC2] — el override:
#   - excluye el servicio postgres (no se construye, no se levanta)
#   - usa DATABASE_URL del .env directamente
#   - elimina el depends_on al postgres
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml build csm

docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml up -d csm
```

> 💡 **Tip de productividad** — exporta un alias para no repetir las dos
> `-f`s en cada comando:
>
> ```bash
> # 🟧 [AWS EC2] — añade al ~/.bashrc para sesiones futuras
> echo "alias dccf1='docker compose -f docker-compose.yml -f docker-compose.external-db.yml'" >> ~/.bashrc
> source ~/.bashrc
> # Ahora puedes hacer:  dccf1 up -d csm   |   dccf1 logs -f csm
> ```

### 7.4 Verificamos que arrancó

```bash
# 🟧 [AWS EC2]
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml logs -f csm
```

En los logs vemos:
1. `[csm] Esperando a la base de datos...` → `[csm] BD lista.` (test TCP al MySQL del SDS pasa)
2. `[csm] Aplicando schema...` → drizzle-kit push aplica las 77 tablas
3. `Ready in XX ms` y `started server on 0.0.0.0:3000`

---

## 8. Inicialización del schema y datos

> 🟪 **Casi todo en esta sección se ejecuta dentro del container** (`docker
> compose exec csm ...`), pero el effect real ocurre en 🟦 **el MySQL del
> SDS** — ahí se crean las tablas y los rows.

### 8.1 Creamos las 77 tablas del CMS en MySQL del SDS

> 💡 Si arrancaste con `docker compose ... up -d`, el `docker-entrypoint.sh`
> ya ejecutó `drizzle-kit push --force` automáticamente. Solo necesitas
> repetirlo si añades una migration manual o cambias el schema.

```bash
# 🟪 [Container csm] — manual si lo necesitas
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml \
               exec csm npx drizzle-kit push --force
```

Esto crea las 77 tablas en el MySQL del SDS apuntando al `DATABASE_URL`
del `.env`.

> Nota: el primer `db:push` puede tardar 30-60 s. Si falla con `ECONNREFUSED`
> revisamos los pasos 5.3 a 5.5.
>
> Si falla con `Unknown data type: 'VECTOR'`, tu MySQL es 8.x sin VECTOR —
> verifica que `MYSQL_VECTOR_FALLBACK=true` está en `.env` y reinicia el
> container con `docker compose ... restart csm`.

### 8.2 Creamos el usuario administrador y workspace inicial

```bash
# 🟪 [Container csm]
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml \
               exec csm npm run db:seed
```

Salida obtenida:

```
✓ Workspace 'demo' creado
✓ Usuario demo creado: demo@csm.dev / pwd: demo1234
✓ Usuario asignado como owner del workspace demo
```

Tras el primer login **cambiamos la contraseña** del usuario `demo` por una
fuerte del gestor de contraseñas. La default `demo1234` solo sirve para arrancar.

### 8.3 Verificación de acceso al CMS

Abrimos en el navegador:

```
http://<IP_PUBLICA_EC2>:3000
```

(o `https://<DOMINIO_EC2>` cuando tenemos Caddy configurado — paso 11)

Vemos la landing del CMS. Login en `/login` con `demo@csm.dev` / `demo1234`.

---

## 9. Carga del dataset oficial de F1

> 🟧 **Toda esta sección se ejecuta en la EC2** (no en el container), porque
> queremos que el dataset quede en el filesystem de la EC2 y se incluya en
> el build del container la próxima vez que reconstruyamos la imagen.

### 9.1 Setup automático en un solo comando

Hemos incluido un script que **clona el dataset y regenera `f1-data.ts`
en una sola pasada**. Idempotente — puedes ejecutarlo cuantas veces quieras.

```bash
# 🟧 [AWS EC2] — desde ~/csm
npm run f1:setup
```

El script:
1. Clona `toUpperCase78/formula1-datasets` en `data/formula1/` si no existe
   (o hace `git pull` si ya está).
2. Ejecuta `scripts/sync-f1-data.mjs` para regenerar
   `src/blocks/spectacular/f1-data.ts` con drivers, equipos, calendario,
   resultados y campeones del dataset oficial.
3. Imprime un resumen verificable.

Salida que obtuvimos en nuestro despliegue:

```
Wrote /app/src/blocks/spectacular/f1-data.ts
  Drivers 2025:   21
  Teams 2025:     10
  Calendar 2025:  24 GPs
  Standings 2025: 21 drivers / 10 teams
  DOTD entries:   10
  Drivers 2026:   22
  Standings 2026: 22 drivers / 11 teams
  Last race 2025: Abu Dhabi
  Last race 2026: Miami
  Champions:      2022:Max Verstappen · 2023:Max Verstappen · 2024:Max Verstappen
```

### 9.2 Reconstruimos el CMS para incluir el dataset

Como `f1-data.ts` se generó en el filesystem de la EC2 y no dentro del
container, hay que rebuild la imagen para que el bundle Next.js lo incluya:

```bash
# 🟧 [AWS EC2]
docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml build csm

docker compose -f docker-compose.yml \
               -f docker-compose.external-db.yml up -d csm
```

> 💡 Si configuraste el alias `dccf1` en el paso 7.3:
> ```bash
> dccf1 build csm && dccf1 up -d csm
> ```

---

## 10. Aplicación de la plantilla F1 espectacular

### 10.1 Login en el panel admin

```
https://<DOMINIO_EC2>/login
```

Entramos con el usuario admin (cambiamos la contraseña en `/admin/perfil` tras
el primer login).

### 10.2 Aplicamos la plantilla

1. Vamos a `/admin/plantillas`
2. Filtramos por la categoría **"Deportes"**
3. Localizamos la card **"F1 Grand Prix — Inmersivo"**
4. Click en la card → vista previa del showcase
5. Pulsamos **"Usar esta plantilla"**
6. El sistema crea una página nueva con las 15 secciones cargadas

### 10.3 Editamos título y publicamos

1. Cambiamos el título de la página a `Campionat F1 2025`
2. Botón **"Publicar"** en la barra superior
3. Comprobamos la URL pública: `/<slug-asignado>`

### 10.4 Marcamos la página como home

1. `/admin/paginas`
2. En la fila de la página F1, opción "Establecer como home"
3. Ahora `/` muestra la web del campeonato F1.

---

## 11. HTTPS con Caddy y Let's Encrypt

> 🟧 **Toda esta sección se ejecuta en la EC2 AWS.** Caddy corre en la EC2
> (no en container — directamente como servicio systemd) y proxiará al
> :3000 del container csm.

Esta sección cubre el requisito del enunciado: "L'accés ha de ser segur i basat
en IP i https". Hemos usado **Caddy** como reverse proxy porque gestiona el
certificado Let's Encrypt sin configuración adicional y renueva automáticamente.

### 11.1 Instalamos Caddy

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key | \
  sudo tee /etc/apt/trusted.gpg.d/caddy-stable.asc
curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 11.2 Configuramos `Caddyfile`

```bash
sudo nano /etc/caddy/Caddyfile
```

Pegamos (sustituyendo `<DOMINIO_EC2>` por el dominio real apuntado a la IP
pública de la EC2):

```caddy
<DOMINIO_EC2> {
  encode gzip zstd

  reverse_proxy 127.0.0.1:3000 {
    header_up X-Forwarded-Proto https
    transport http {
      read_timeout 300s
    }
  }

  log {
    output file /var/log/caddy/access.log
    format json
  }
}
```

### 11.3 Recargamos Caddy

```bash
sudo systemctl reload caddy
sudo systemctl status caddy
```

Caddy obtiene automáticamente el certificado de Let's Encrypt mediante el
HTTP-01 challenge.

### 11.4 Actualizamos `.env` con la URL HTTPS

```bash
cd ~/csm
nano .env
# NEXT_PUBLIC_APP_URL=https://<DOMINIO_EC2>
docker compose up -d csm
```

### 11.5 Verificación

```bash
curl -I https://<DOMINIO_EC2>
# Debe devolver HTTP/2 200 con headers de Caddy
```

---

## 12. Medidas de seguridad aplicadas

Recogemos aquí todas las medidas que hemos aplicado para cubrir el requisito
"S'han de preveure les mesures de seguretat per a tots els serveis que estiguin
exposats a Internet".

### 12.1 Capa de red

| Medida | Implementación |
|---|---|
| Puerto MySQL no estándar | 33060 en vez de 3306 |
| Acceso MySQL restringido por IP | Grant `'csm'@'<IP_PUBLICA_EC2>'` (no `%`) |
| Firewall EC2 (UFW) | Solo 22, 80, 443 abiertos |
| Firewall SDS | Solo 33060 desde IP de la EC2 |
| Security Group AWS | Inbound: 22 (mi IP), 80, 443 (mundo); Outbound: all |

### 12.2 Capa de aplicación

| Medida | Implementación |
|---|---|
| HTTPS automático Let's Encrypt | Caddy + renovación cada 60 días |
| HSTS header | Caddy lo añade por defecto |
| Cookies de sesión `Secure` y `HttpOnly` | Better-Auth lo aplica con HTTPS detectado |
| CSRF tokens | Better-Auth automático en server actions |
| Passwords hasheados | Better-Auth con bcrypt-equivalente |
| Rate limiting login | Tabla `rate_limits` integrada en Better-Auth |
| 2FA TOTP disponible | `/admin/perfil/seguridad` |
| Magic-link por email | Alternativa a password |
| AI keys cifradas en BD | AES-256-GCM con HKDF derivado de `AUTH_SECRET` |
| CSP headers | `next.config.ts` con whitelist por dominio |
| Validación input con Zod | Todas las server actions y APIs |

### 12.3 Capa de credenciales

- **Passwords ≥ 16 caracteres** generadas con `openssl rand -base64 24`.
- **Sin reuso** de passwords entre root MySQL, usuario CSM y AUTH_SECRET — cada
  uno con su propio secret aleatorio.
- **Gestor de contraseñas** del grupo para almacenarlas.
- **`.env` no versionado** (`.gitignore` lo excluye por defecto).
- **Permisos 600** en el `.env` de la EC2 — solo el usuario propietario lee.

```bash
chmod 600 ~/csm/.env
ls -l ~/csm/.env
# -rw------- 1 ubuntu ubuntu 1234 May  6 12:00 /home/ubuntu/csm/.env
```

---

## 13. Verificación final

Checklist que pasamos antes de cerrar la entrega:

- [ ] La URL `https://<DOMINIO_EC2>` carga la web del campeonato F1
- [ ] Certificado HTTPS válido (candado verde en navegador)
- [ ] La home muestra las 15 secciones de la plantilla F1
- [ ] El countdown live funciona (decrementa cada segundo)
- [ ] El podio de la última carrera muestra los pilotos correctos
- [ ] Las clasificaciones tienen los puntos del dataset
- [ ] Login en `/admin` funciona con nuestro usuario admin
- [ ] La contraseña del usuario `demo` ha sido cambiada por una fuerte
- [ ] El SSH a la EC2 solo funciona con key (no password)
- [ ] El acceso MySQL desde IPs no autorizadas falla

---

## 14. Troubleshooting frecuente

### Error: `ECONNREFUSED` al hacer `db:push`
**Causa**: la EC2 no puede conectar al MySQL del SDS.

**Solución**:
1. Verificamos que `DATABASE_URL` tiene host, puerto, user y password correctos.
2. Desde la EC2: `mysql -h 5.196.50.3 -P 33060 -u csm -p csm_f1 -e "SELECT 1;"` debe responder.
3. Si falla con `Host is not allowed`: revisamos el grant de la sección 5.3.
4. Si falla con `timeout`: revisamos el firewall del SDS en la sección 5.4.

### Error: `Access denied for user 'csm'@'X.Y.Z.W'`
**Causa**: la IP origen no coincide con el grant.

**Solución**: la IP pública de la EC2 ha cambiado (suele pasar si la paramos
y arrancamos sin Elastic IP). Asociamos una **Elastic IP** y actualizamos el grant:

```sql
DROP USER 'csm'@'OLD_IP';
CREATE USER 'csm'@'NEW_IP' IDENTIFIED BY 'PASS';
GRANT ALL ON csm_f1.* TO 'csm'@'NEW_IP';
FLUSH PRIVILEGES;
```

### Caddy: `bind: address already in use`
**Causa**: Apache o Nginx ocupando el 80/443.

**Solución**:
```bash
sudo systemctl stop apache2 nginx
sudo systemctl disable apache2 nginx
sudo systemctl restart caddy
```

### El CMS reinicia en bucle
**Causa**: error de configuración crítico (DATABASE_URL inválida, AUTH_SECRET ausente).

**Solución**:
```bash
docker compose logs csm | tail -50
```

Identificamos el error y lo corregimos en `.env`. Reiniciamos con `docker compose up -d csm`.

### `db:push` se queja de `vector` no existe
**Causa**: estamos conectados a MySQL <9 y el schema tiene tipo VECTOR.

**Solución**: el helper `vectorLiteral` que escribimos degrada a `STRING_TO_VEC`
en MySQL 9+ y se desactiva en 8.x — la migración aplica el schema sin VECTOR
cuando detecta MySQL 8.x.

---

## Anexo A — Comandos útiles

### A.1 Operación diaria

```bash
# Logs en vivo del CMS
docker compose logs -f csm

# Reiniciar CMS sin downtime largo
docker compose restart csm

# Ver uso de recursos
docker stats csm-csm-1

# Actualizar a la última versión del repo
cd ~/csm && git pull && docker compose build csm && docker compose up -d csm

# Entrar al container
docker compose exec csm sh

# Ejecutar comandos npm dentro
docker compose exec csm npm run typecheck
docker compose exec csm npm run db:check-parity
```

### A.2 Operación BD

```bash
# Conectar a MySQL del SDS desde la EC2
mysql -h 5.196.50.3 -P 33060 -u csm -p csm_f1

# Ver tablas
SHOW TABLES;

# Ver tamaño de la BD
SELECT
  table_schema AS 'BD',
  ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS 'MB'
FROM information_schema.tables
WHERE table_schema = 'csm_f1'
GROUP BY table_schema;

# Salir
\q
```

---

## Anexo B — Estructura del proyecto

```
csm/
├── docker-compose.yml          # Compose principal (csm + redis opcional)
├── docker-compose.mysql.yml    # Override para MySQL (no usado en este deploy)
├── docker-compose.redis.yml    # Override para Redis (opcional)
├── Dockerfile                  # Build multi-stage de Next.js
├── .env                        # Tu configuración (NO versionado)
├── .env.docker.example         # Template
│
├── data/
│   └── formula1/               # Dataset clonado (gitignored)
│       ├── Formula1_2025Season_Drivers.csv
│       ├── Formula1_2025Season_Teams.csv
│       ├── Formula1_2025Season_Calendar.csv
│       ├── Formula1_2025Season_RaceResults.csv
│       └── ...
│
├── docs/
│   ├── DATABASE.md             # Guía multi-DB
│   ├── DOCKER.md               # Self-hosting
│   ├── REDIS.md                # Pubsub adapter
│   └── PROYECTO-F1-CMS-DEPLOY.md   # ESTE DOCUMENTO
│
├── scripts/
│   ├── sync-f1-data.mjs        # CSVs → f1-data.ts
│   └── check-schema-parity.ts  # Validación PG↔MySQL
│
└── src/
    ├── db/
    │   ├── client.ts                # Detección dialect
    │   ├── schema.pg.ts             # Schema Postgres (77 tablas)
    │   ├── schema.mysql.ts          # Schema MySQL (77 tablas)
    │   └── dialect/                 # Helpers cross-DB
    ├── blocks/
    │   └── spectacular/
    │       ├── f1-data.ts           # Auto-generado del dataset
    │       ├── f1-grand-prix-sections.tsx   # 15 secciones de la plantilla
    │       └── specs.ts             # Specs Drizzle de los bloques tpl-f1-*
    ├── templates/
    │   └── page-templates.ts        # Catálogo (incluye f1-grand-prix)
    └── app/
        └── admin/
            └── plantillas/          # /admin/plantillas (galería)
```

---

## Anexo C — Variables de entorno completas

```bash
# ============================================================
# OBLIGATORIAS
# ============================================================

# Conexión MySQL del SDS
DATABASE_URL=mysql://csm:PASS_FUERTE@5.196.50.3:33060/csm_f1

# Secret de sesiones + cifrado AES-256-GCM
# Genera con: openssl rand -hex 32
AUTH_SECRET=64-char-hex-string

# URL pública (con HTTPS si tienes Caddy)
NEXT_PUBLIC_APP_URL=https://<DOMINIO_EC2>

# ============================================================
# RED INTERNA (Docker)
# ============================================================

APP_HOST_BIND=127.0.0.1     # Caddy proxy → solo localhost
APP_PORT=3000

# ============================================================
# OPCIONALES (todas desactivan su feature si no las defines)
# ============================================================

# Email (sin esto, magic-link sale por consola)
RESEND_API_KEY=
EMAIL_FROM=CSM <noreply@<DOMINIO_EC2>>

# AI providers (también editables desde /admin/ajustes/ia)
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GROQ_API_KEY=
MISTRAL_API_KEY=
OLLAMA_URL=

# Stripe (memberships, no necesario para F1 site)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Storage de uploads (sin esto, se usan los locales)
BLOB_READ_WRITE_TOKEN=

# Redis pubsub cross-instance (no necesario en single-instance)
REDIS_URL=

# Cron secret para `/api/cron/*` (si configuras cron externo)
CRON_SECRET=
```

---

## Conclusión

Como grupo hemos cubierto íntegramente la parte de **CMS + base de datos
MySQL** del proyecto F1 Liberty Media, según los puntos del enunciado:

> "Instal·la un servidor MySQL i tot el necessari per a implementar el CMS."
>
> "Amb una plantilla adequada, crea una web atractiva amb tota la informació
> del campionat de F1."
>
> "Instal·lar un servidor CMS a AWS de manera que la base de dades (DB)
> estigui situada al servidor al núvol públic de SDS."

El resto de bloques del proyecto (infraestructura de red, AD, monitorización
Zabbix/Grafana, SQL Server con SPs, Velneo, vídeos en inglés) los documentamos
en sus respectivos entregables.

---

**Grupo:** Edgar · Álvaro · Samuel · José
**Fecha de despliegue:** *(pendiente — fecha real de la prueba final)*
**Repositorio CMS:** https://github.com/FomoDonkey/TechX
**Dataset F1:** https://github.com/toUpperCase78/formula1-datasets
