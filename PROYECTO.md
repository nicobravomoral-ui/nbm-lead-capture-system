# NBM Lead Capture System — Estado del Proyecto

**Última actualización:** 2 Abril 2026
**Entorno productivo:** Railway
**Repositorio:** https://github.com/nicobravomoral-ui/nbm-lead-capture-system
**Commit actual:** `9baa72c`

---

## URLS DEL SISTEMA

| Recurso | URL |
|---|---|
| Servidor productivo | `https://nbm-lead-capture-system-production.up.railway.app` |
| Health check | `/health` |
| Dashboard | `/dashboard` |
| Webhook Meta | `/webhook/meta` |
| Estado del sistema | `/api/setup/status` |

---

## INFRAESTRUCTURA

| Servicio | Plataforma | Estado |
|---|---|---|
| Servidor Node.js 22 + Express 4 | Railway | ✅ Activo |
| Base de datos PostgreSQL | Railway | ✅ Schema aplicado (`prisma db push`) |
| Repositorio GitHub | `nicobravomoral-ui/nbm-lead-capture-system` | ✅ Auto-deploy desde `main` |

---

## CREDENCIALES Y CONFIGURACIÓN

### Tenant Piloto — LoopOn

| Campo | Valor |
|---|---|
| Tenant ID | `cmngh004o00001476hr9cpo1t` |
| IG Account ID correcto | `66869359832` (`nicolas.bravo.inversiones`) |
| Facebook Page ID | `1031412506728321` (`Nbm Lead Capture System`) |
| Plan | pilot |

### Broker configurado

| Campo | Valor |
|---|---|
| Nombre | Nicolás Bravo |
| WhatsApp | +56975326208 |
| Broker ID | `cmngh006600041476yhqclnb7` |

### Variables de entorno (Railway)

| Variable | Estado |
|---|---|
| `DATABASE_URL` | ✅ `${{ Postgres.DATABASE_URL }}` |
| `ANTHROPIC_API_KEY` | ✅ Claude Haiku |
| `META_APP_ID` | ✅ `1470519741134938` |
| `META_APP_SECRET` | ✅ Configurada |
| `META_VERIFY_TOKEN` | ✅ `j8e9kshaakkk373910` |
| `TWILIO_ACCOUNT_SID` | ✅ Configurada |
| `TWILIO_AUTH_TOKEN` | ✅ Configurada |
| `TWILIO_WHATSAPP_FROM` | ✅ `whatsapp:+14155238886` (sandbox) |
| `NODE_ENV` | ✅ `production` |
| `TZ` | ✅ `America/Santiago` |

### Meta for Developers

| Campo | Valor |
|---|---|
| App | `nbm-lead-capture` (Development Mode) |
| Webhook callback | `/webhook/meta` |
| Verify Token | `j8e9kshaakkk373910` |
| Webhook | ✅ Verificado y activo |
| Campos suscritos | `comments`, `messages` |
| Cuenta IG conectada | ✅ `nicolas.bravo.inversiones` → página "Nbm Lead Capture System" |
| Token largo plazo | ✅ En DB. Válido ~60 días desde 1 Abril 2026 |

---

## ARQUITECTURA

```
Comentario en IG/FB
        ↓
   LISTEN    → POST /webhook/meta
        ↓
   DETECT    → detector.js (keywords + score 1–10, umbral ≥ 2)
        ↓
   ENGAGE    → engage.js (DM Meta API) — fire-and-forget
        ↓
   QUALIFY   → qualify.js (Claude Haiku, 3 preguntas, MAX_TURNOS=4)
        ↓
   ROUTE     → router.js (round-robin, expiry 5 días)
        ↓
   NOTIFY    → notifier.js (WhatsApp Twilio al broker)
        ↓
   CRON      → reasignacion.js (09:00 AM, reasigna leads vencidos)
```

---

## RESUMEN EJECUTIVO — 2 ABRIL 2026

### Qué está funcionando ✅

| Componente | Validación |
|---|---|
| Servidor Railway | `/health` responde con todas las vars ✅ |
| PostgreSQL + Prisma | `prisma db push` en deploy, schema completo |
| Webhook Meta (verificación GET) | Verificado desde Meta Developers |
| Webhook Meta (recepción POST) | Simulado con payload IG real, lead persistido |
| Detector de keywords | `GET /api/test/detector` — score calculado correctamente |
| Creación de leads | `POST /api/test/simular-comentario` — lead en DB |
| Dashboard Kanban | `/dashboard` — actualización auto 30s |
| Twilio WhatsApp (prueba directa) | `POST /api/test/whatsapp` — SID retornado, mensaje queued |
| `qualify.js` — código | Implementado con upsert, MAX_TURNOS, español chileno |
| `router.js` — código | Round-robin con 5-day expiry |
| `notifier.js` — código | Mensaje formateado, lazy Twilio client |
| Error handling Express 4 | **try/catch en todos los handlers async** (fix commit `9baa72c`) |

### Bloqueantes ya resueltos ✅

| Bloqueante | Fix aplicado |
|---|---|
| `DATABASE_URL` placeholder → crash Railway | Variable referencia Railway correcta |
| `prisma migrate deploy` sin carpeta migrations | Cambiado a `prisma db push` en `railway.toml` |
| Webhook 403 por Account ID erróneo | ID real `66869359832` identificado y configurado |
| `plataforma` siempre `'fb'` | Detectado desde `body.object`, no `value.item` |
| Twilio crash al startup | Lazy `getClient()` — instanciación solo al usar |
| Health mostrando commit hardcodeado | Usa `process.env.RAILWAY_GIT_COMMIT_SHA` |
| `POST /api/test/qualify` → 502 crash | Try/catch en todos los handlers async |
| SocialAccount incorrecta en findFirst | `orderBy: createdAt desc` + cuenta errónea desactivada |

### Riesgos pendientes ⚠️

| Riesgo | Impacto | Acción requerida |
|---|---|---|
| Sandbox Twilio no activado | No llega WhatsApp al broker | Enviar `join <código>` desde +56975326208 a +14155238886 |
| Token IG vence en ~58 días | Engage falla silenciosamente | `PUT /api/setup/token` antes de vencer |
| Meta app en Development Mode | DMs solo llegan a testers | Agregar testers o hacer App Review |
| `qualify.js` no probado con Claude real | Flujo completo no validado end-to-end | Correr `POST /api/test/flujo-completo` |

---

## ESTADO POR FASE

### FASE 1 — Infraestructura y detección ✅ COMPLETA

Todos los componentes validados. Webhook activo, leads persisten en DB, dashboard operativo.

### FASE 2 — Automatización del flujo ⚠️ CÓDIGO COMPLETO / PRUEBA PENDIENTE

| Bloque | Código | Prueba end-to-end |
|---|---|---|
| DM automático Meta API | ✅ | ❌ Bloqueado: Meta Dev Mode |
| WhatsApp Twilio broker | ✅ | ⚠️ Pendiente: activar sandbox |
| Conversación Claude Haiku | ✅ | ⚠️ Pendiente: correr flujo-completo |
| Error handling Express 4 | ✅ `9baa72c` | — |

### FASE 3 — Dashboard y multi-tenant ⏸ NO INICIADA

### FASE 4 — Escala ⏸ NO INICIADA

---

## ENDPOINTS ÚTILES

```
GET  /health                                   → vars de entorno + commit actual
GET  /api/setup/status                         → tenant, cuentas, brokers en DB
GET  /api/test/env-check                       → vars sin exponer valores
GET  /api/test/detector?texto=me interesa      → prueba clasificador sin DB
POST /api/test/simular-comentario              → crea lead simulado en DB
POST /api/test/qualify                         → turno de conversación Claude
POST /api/test/flujo-completo                  → pipeline end-to-end simulado
POST /api/test/whatsapp                        → WhatsApp real vía Twilio
POST /api/test/dm                              → DM real vía Meta API
PUT  /api/setup/token                          → renovar token Instagram
GET  /dashboard                                → kanban pipeline + métricas
```

---

## PRÓXIMOS PASOS EN ORDEN

1. **Validar pipeline Claude** — `POST /api/test/flujo-completo` (ver `TESTS.md`)
2. **Activar sandbox Twilio** — enviar join code desde +56975326208 a +14155238886
3. **Validar WhatsApp broker** — después del flujo-completo, verificar que el WhatsApp llega
4. **Probar DM real IG** — agregar tester en Meta Developers o completar App Review
5. **Cerrar Fase 2** y abrir Fase 3

---

*Documento de trabajo — NBM Asesorías e Inversiones*
*Actualizado: 2 Abril 2026*
