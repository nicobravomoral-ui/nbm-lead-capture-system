# NBM Lead Capture System — Estado del Proyecto

**Última actualización:** Abril 2026
**Entorno productivo:** Railway
**Repositorio:** https://github.com/nicobravomoral-ui/nbm-lead-capture-system

---

## URLS DEL SISTEMA

| Recurso | URL |
|---|---|
| Servidor productivo | `https://nbm-lead-capture-system-production.up.railway.app` |
| Health check | `https://nbm-lead-capture-system-production.up.railway.app/health` |
| Webhook Meta | `https://nbm-lead-capture-system-production.up.railway.app/webhook/meta` |
| Estado del sistema | `https://nbm-lead-capture-system-production.up.railway.app/api/setup/status` |

---

## INFRAESTRUCTURA

| Servicio | Plataforma | Estado |
|---|---|---|
| Servidor Node.js | Railway | ✅ Activo |
| Base de datos PostgreSQL | Railway | ✅ Activa |
| Repositorio GitHub | `nicobravomoral-ui/nbm-lead-capture-system` | ✅ Conectado |

**Deploy automático:** cada push a `main` dispara un redeploy en Railway.

---

## TENANT PILOTO

| Campo | Valor |
|---|---|
| Nombre | LoopOn |
| Plan | pilot |
| Tenant ID | `cmngh004o00001476hr9cpo1t` |
| Plataforma | Instagram |
| IG Account ID | `1470519741134938` |

---

## BROKER CONFIGURADO

| Campo | Valor |
|---|---|
| Nombre | Nicolás Bravo |
| WhatsApp | +56975326208 |
| Broker ID | `cmngh006600041476yhqclnb7` |

---

## VARIABLES DE ENTORNO (Railway — servicio nbm-lead-capture)

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Referencia `${{ Postgres.DATABASE_URL }}` — gestionada por Railway |
| `ANTHROPIC_API_KEY` | Clave Claude API (Haiku) |
| `META_APP_ID` | ID de la app en Meta for Developers |
| `META_APP_SECRET` | Secret de la app Meta |
| `META_VERIFY_TOKEN` | `j8e9kshaakkk373910` |
| `TWILIO_ACCOUNT_SID` | SID de cuenta Twilio |
| `TWILIO_AUTH_TOKEN` | Token de autenticación Twilio |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` |
| `NODE_ENV` | `production` |
| `TZ` | `America/Santiago` |

---

## META FOR DEVELOPERS

| Campo | Valor |
|---|---|
| Callback URL | `https://nbm-lead-capture-system-production.up.railway.app/webhook/meta` |
| Verify Token | `j8e9kshaakkk373910` |
| Webhook status | ✅ Verificado |
| Campos suscritos | `comments`, `messages` |

---

## ARQUITECTURA DEL SISTEMA

```
Comentario en IG/FB
        ↓
   LISTEN (webhook)
        ↓
   DETECT (score 1-10)
        ↓ score >= 2
   ENGAGE (respuesta pública + DM)
        ↓
   QUALIFY (Claude Haiku — 3 preguntas)
        ↓
   ROUTE (asignar broker + WhatsApp)
        ↓
   CRON (reasignación 5 días si no hay contacto)
```

---

## ESTADO DE FASES

### Fase 1 — MVP Demo ✅ COMPLETA
- [x] Servidor Node.js + Express en Railway
- [x] PostgreSQL conectado y schema aplicado
- [x] Webhook Meta registrado y verificado
- [x] Clasificador de keywords con score 1-10
- [x] Tenant LoopOn + broker configurado en DB

### Fase 2 — Sprint 1 (pendiente)
- [ ] DM automático enviado al lead
- [ ] Conversación Claude Haiku (3 preguntas)
- [ ] Lead guardado con datos de calificación
- [ ] Notificación WhatsApp al broker via Twilio
- [ ] Cron de reasignación implementado y probado

### Fase 3 — Sprint 2 (pendiente)
- [ ] Dashboard HTML básico (pipeline kanban)
- [ ] Configuración de keywords desde UI
- [ ] Integración TikTok
- [ ] Multi-tenant

### Fase 4 — Sprint 3 (pendiente)
- [ ] Social listening externo (Apify)
- [ ] Reportes exportables PDF
- [ ] Conector CRM NBM
- [ ] OAuth flow onboarding

---

## ENDPOINTS DISPONIBLES

```
GET  /health                        → estado del servidor
GET  /webhook/meta                  → verificación webhook Meta
POST /webhook/meta                  → recibe eventos Meta

GET  /api/leads?tenantId=xxx        → lista leads
GET  /api/leads/:id                 → detalle lead
PUT  /api/leads/:id/estado          → actualizar estado

GET  /api/brokers?tenantId=xxx      → lista brokers
POST /api/brokers                   → crear broker
PUT  /api/brokers/:id/activo        → activar/desactivar broker

GET  /api/tenants                   → lista tenants
POST /api/tenants                   → crear tenant
PUT  /api/tenants/:id/keywords      → configurar keywords
GET  /api/tenants/:id/dashboard     → métricas resumen

POST /api/setup/tenant              → seed inicial de tenant
GET  /api/setup/status              → estado actual del sistema
```

---

## PRÓXIMO PASO

Probar el flujo completo:
1. Comentar en un post del Instagram de negocio con intención de compra
   - Ejemplo: *"¿Cuánto vale? Me interesa"*
2. Verificar en Railway Logs que el evento llega y se procesa
3. Confirmar que el lead queda guardado en DB
4. Avanzar a Fase 2: DM automático + Claude Haiku

---

*Documento confidencial — NBM Asesorías e Inversiones*
