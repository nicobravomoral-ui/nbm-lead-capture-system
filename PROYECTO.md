# NBM Lead Capture System — Estado del Proyecto

**Última actualización:** 1 Abril 2026
**Entorno productivo:** Railway
**Repositorio:** https://github.com/nicobravomoral-ui/nbm-lead-capture-system

---

## URLS DEL SISTEMA

| Recurso | URL |
|---|---|
| Servidor productivo | `https://nbm-lead-capture-system-production.up.railway.app` |
| Health check | `https://nbm-lead-capture-system-production.up.railway.app/health` |
| Dashboard | `https://nbm-lead-capture-system-production.up.railway.app/dashboard` |
| Webhook Meta | `https://nbm-lead-capture-system-production.up.railway.app/webhook/meta` |
| Estado del sistema | `https://nbm-lead-capture-system-production.up.railway.app/api/setup/status` |

---

## INFRAESTRUCTURA

| Servicio | Plataforma | Estado |
|---|---|---|
| Servidor Node.js | Railway | ✅ Activo y deployado |
| Base de datos PostgreSQL | Railway | ✅ Activa, schema aplicado |
| Repositorio GitHub | `nicobravomoral-ui/nbm-lead-capture-system` | ✅ Auto-deploy desde main |

---

## CREDENCIALES Y CONFIGURACIÓN

### Tenant Piloto — LoopOn

| Campo | Valor |
|---|---|
| Tenant ID | `cmngh004o00001476hr9cpo1t` |
| Plan | pilot |
| IG Account ID actual | `1470519741134938` ⚠️ INCORRECTO — ver bloqueo Meta |

### Broker configurado

| Campo | Valor |
|---|---|
| Nombre | Nicolás Bravo |
| WhatsApp | +56975326208 |
| Broker ID | `cmngh006600041476yhqclnb7` |

### Variables de entorno (Railway — servicio nbm-lead-capture)

| Variable | Estado | Notas |
|---|---|---|
| `DATABASE_URL` | ✅ Configurada | Referencia `${{ Postgres.DATABASE_URL }}` |
| `ANTHROPIC_API_KEY` | ✅ Configurada | Claude Haiku |
| `META_APP_ID` | ✅ Configurada | `1470519741134938` (ID de la app Meta) |
| `META_APP_SECRET` | ✅ Configurada | Regenerar después de uso en sesión |
| `META_VERIFY_TOKEN` | ✅ Configurada | `j8e9kshaakkk373910` |
| `TWILIO_ACCOUNT_SID` | ✅ Configurada | |
| `TWILIO_AUTH_TOKEN` | ✅ Configurada | |
| `TWILIO_WHATSAPP_FROM` | ✅ Configurada | `whatsapp:+14155238886` (sandbox) |
| `NODE_ENV` | ✅ Configurada | `production` |
| `TZ` | ✅ Configurada | `America/Santiago` |

### Meta for Developers

| Campo | Valor |
|---|---|
| App name | `nbm-lead-capture` |
| Callback URL webhook | `https://nbm-lead-capture-system-production.up.railway.app/webhook/meta` |
| Verify Token | `j8e9kshaakkk373910` |
| Webhook | ✅ Verificado y activo |
| Campos suscritos | `comments`, `messages` |
| Tipo de integración | Instagram API with Facebook Login (Graph API) |
| Cuenta Instagram conectada | ⚠️ PENDIENTE — ver bloqueo |

### Token de acceso Instagram

| Campo | Valor |
|---|---|
| Tipo | Page Access Token (larga duración) |
| Válido hasta | ~60 días desde 1 Abril 2026 |
| Renovación | `PUT /api/setup/token` |

---

## ARQUITECTURA DEL SISTEMA

```
Comentario en IG/FB
        ↓
   LISTEN (webhook POST /webhook/meta)
        ↓
   DETECT (detector.js — keywords + score 1-10)
        ↓ score >= 2
   ENGAGE (engage.js — respuesta pública + DM)     ← bloqueo Meta
        ↓
   QUALIFY (qualify.js — Claude Haiku, 3 preguntas) ← pendiente prueba real
        ↓
   ROUTE (router.js — asignar broker round-robin)
        ↓
   NOTIFY (notifier.js — WhatsApp Twilio)           ← pendiente prueba real
        ↓
   CRON (reasignacion.js — 09:00 AM, 5 días)       ← implementado, sin probar
```

---

## ESTADO DETALLADO POR FASE

---

### FASE 1 — Infraestructura y detección ✅ COMPLETA Y VALIDADA

| Tarea | Estado | Validación |
|---|---|---|
| Proyecto Node.js + Express en Railway | ✅ | `/health` responde `{status: ok}` |
| PostgreSQL conectado y schema aplicado | ✅ | `prisma db push` ejecutado en deploy |
| Webhook Meta GET (verificación) | ✅ | Verificado en Meta Developers |
| Webhook Meta POST (recepción eventos) | ✅ | Código en `routes/webhook.js` |
| Clasificador keywords + score 1-10 | ✅ | `/api/test/detector?texto=me interesa el precio` → score 6 |
| Lead guardado en PostgreSQL | ✅ | `/api/test/simular-comentario` → lead creado y persistido |
| Dashboard HTML con pipeline kanban | ✅ | Visible en `/dashboard` |
| Tenant LoopOn + broker en DB | ✅ | `/api/setup/status` confirma datos |

---

### FASE 2 — Automatización del flujo ⚠️ EN PROGRESO

#### Bloque 1 — DM automático vía Meta API

| Tarea | Estado | Notas |
|---|---|---|
| Código `engage.js` | ✅ Implementado | Respuesta pública + DM con nombre tenant correcto |
| Errores detallados Meta API | ✅ Implementado | `meta.js` muestra código y mensaje exacto |
| Engage desacoplado de persistencia | ✅ Implementado | Fire-and-forget, lead se guarda siempre |
| Token de larga duración en DB | ✅ Actualizado | Válido ~60 días |
| `PUT /api/setup/token` para renovar | ✅ Implementado | |
| **Prueba real con comentario IG** | ❌ BLOQUEADO | Ver bloqueo Meta abajo |

#### Bloque 2 — Notificación WhatsApp Twilio

| Tarea | Estado | Notas |
|---|---|---|
| Código `notifier.js` | ✅ Implementado | Mensaje formateado según spec |
| URL dashboard correcta en mensaje | ✅ Corregido | Apunta a `/dashboard` real |
| Logging con Twilio SID | ✅ Implementado | |
| `POST /api/test/whatsapp` | ✅ Implementado | Para probar sin flujo completo |
| **Sandbox Twilio activado** | ⚠️ PENDIENTE | Ver instrucciones abajo |
| **Prueba real WhatsApp** | ⚠️ PENDIENTE | Requiere sandbox activo |

#### Bloque 3 — Conversación Claude Haiku

| Tarea | Estado | Notas |
|---|---|---|
| Código `qualify.js` | ✅ Implementado | 3 preguntas, detección CALIFICADO/NO_CALIFICADO |
| System prompt en español chileno | ✅ Implementado | Según spec de Instrucciones.md |
| Extracción de datos del lead | ✅ Implementado | tipoBuyer, pieEstimado, disponibilidad |
| **Prueba real con DM** | ❌ BLOQUEADO | Depende de bloqueo Meta |

---

### FASE 3 — Dashboard y multi-tenant ⏸ NO INICIADA

| Tarea | Estado |
|---|---|
| Dashboard kanban básico | ✅ Adelantado en Fase 1 |
| Configuración keywords desde UI | ❌ Pendiente |
| Integración TikTok | ❌ Pendiente |
| Multi-tenant: segundo tenant | ❌ Pendiente |

---

### FASE 4 — Escala ⏸ NO INICIADA

| Tarea | Estado |
|---|---|
| Social listening externo (Apify) | ❌ Pendiente |
| Reportes exportables PDF | ❌ Pendiente |
| Conector CRM NBM | ❌ Pendiente |
| OAuth flow onboarding | ❌ Pendiente |

---

## BLOQUEOS ACTIVOS

### 🔴 BLOQUEO 1 — Instagram Business Account ID incorrecto

**Problema:** El `igAccountId` configurado (`1470519741134938`) es el ID de la Meta App, no de una cuenta de Instagram Business. Sin el ID correcto, el webhook no puede identificar al tenant cuando llega un comentario real.

**Qué se necesita:**
1. Conectar la cuenta `nicolas.bravo.inversiones` (ya convertida a Business) a la Meta App
2. En Meta Developers → Instagram → API with Facebook Login → conectar página de Facebook vinculada al Instagram
3. Obtener el Instagram Business Account ID real que aparece al conectar
4. Actualizar en el sistema:
```
POST /api/setup/tenant
{
  "tenantNombre": "LoopOn",
  "igAccountId": "ID_REAL_AQUI",
  "igAccessToken": "TOKEN_LARGO_AQUI",
  "brokerNombre": "Nicolás Bravo",
  "brokerWhatsapp": "+56975326208"
}
```

**Causa probable del bloqueo:** La página de Facebook no está vinculada al Instagram `nicolas.bravo.inversiones`, o el usuario administrador de Meta Developers no tiene acceso a esa página.

---

### 🟡 BLOQUEO 2 — Sandbox Twilio no activado

**Problema:** Para recibir WhatsApp desde el sandbox de Twilio, el número `+56975326208` debe enviar primero el mensaje de activación.

**Qué se necesita:**
1. Ir a [console.twilio.com](https://console.twilio.com) → Messaging → Try it out → Send a WhatsApp message
2. Copiar la palabra clave de activación (ej: `join word-word`)
3. Desde el WhatsApp `+56975326208`, enviar ese mensaje al número `+1 415 523 8886`
4. Una vez activado, probar con `POST /api/test/whatsapp`

---

## ENDPOINTS DE PRUEBA DISPONIBLES

```
GET  /api/test/detector?texto=me interesa    → prueba clasificador sin DB
POST /api/test/simular-comentario            → crea lead simulado en DB
POST /api/test/whatsapp                      → envía WhatsApp real vía Twilio
POST /api/test/dm                            → envía DM real vía Meta API
PUT  /api/setup/token                        → renueva token de Instagram
GET  /api/setup/status                       → estado completo del sistema
```

---

## PRÓXIMOS PASOS EN ORDEN

1. **Resolver bloqueo Meta** — conectar `nicolas.bravo.inversiones` y obtener IG Business Account ID real
2. **Resolver bloqueo Twilio** — activar sandbox desde WhatsApp +56975326208
3. **Probar WhatsApp** — `POST /api/test/whatsapp` debe llegar al celular
4. **Probar DM** — comentar en Instagram real y verificar que llega el DM
5. **Validar flujo completo** — comentario → lead → DM → Claude → WhatsApp broker
6. **Cerrar Fase 2** y avanzar a Fase 3

---

*Documento confidencial — NBM Asesorías e Inversiones*
*Generado: Abril 2026*
