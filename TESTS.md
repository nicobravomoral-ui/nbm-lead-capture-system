# NBM Lead Capture — Pruebas de Validación

**Base URL:** `https://nbm-lead-capture-system-production.up.railway.app`

Todas las pruebas se hacen con `curl` o cualquier cliente HTTP (Postman, Insomnia, etc).

---

## PRUEBA 1 — Health check (30 segundos)

Confirma que el servidor está activo y todas las variables de entorno están cargadas.

```bash
curl https://nbm-lead-capture-system-production.up.railway.app/health
```

**Respuesta esperada:**
```json
{
  "status": "ok",
  "commit": "9baa72c...",
  "node": "v22.x.x",
  "env": {
    "DATABASE_URL": "✅",
    "ANTHROPIC_API_KEY": "✅",
    "META_APP_ID": "✅",
    "META_VERIFY_TOKEN": "✅",
    "TWILIO_ACCOUNT_SID": "✅",
    "TWILIO_AUTH_TOKEN": "✅",
    "TWILIO_WHATSAPP_FROM": "✅"
  }
}
```

**Fallo si:** algún campo dice `❌ FALTA` → revisar variables en Railway.

---

## PRUEBA 2 — Detector de keywords (1 minuto)

Valida que el clasificador funciona sin tocar la base de datos.

```bash
curl "https://nbm-lead-capture-system-production.up.railway.app/api/test/detector?texto=me+interesa+el+precio+cuanto+vale"
```

**Respuesta esperada:**
```json
{
  "texto": "me interesa el precio cuanto vale",
  "score": 6,
  "genera_lead": true
}
```

**Fallo si:** `genera_lead: false` con ese texto → revisar `services/detector.js`.

---

## PRUEBA 3 — Crear lead simulado (2 minutos)

Simula un comentario de Instagram y guarda el lead en PostgreSQL.

```bash
curl -X POST https://nbm-lead-capture-system-production.up.railway.app/api/test/simular-comentario \
  -H "Content-Type: application/json" \
  -d '{"texto": "me interesa el depto, cuánto vale el pie?", "handle": "@test_validacion"}'
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "mensaje": "Lead creado correctamente",
  "lead": {
    "id": "cm...",
    "handleRrss": "@test_validacion",
    "score": 6,
    "estado": "NUEVO",
    "plataforma": "ig"
  }
}
```

**Verificar en dashboard:** Abrir `/dashboard` — debe aparecer el lead en columna NUEVO.

---

## PRUEBA 4 — Pipeline completo con Claude (prueba principal)

Ejecuta el flujo end-to-end: crea lead → simula conversación → califica → asigna broker.

```bash
curl -X POST https://nbm-lead-capture-system-production.up.railway.app/api/test/flujo-completo \
  -H "Content-Type: application/json" \
  -d '{
    "comentario": "me interesa el precio del departamento",
    "mensajes": [
      "para vivir yo mismo",
      "tengo como 12 millones de pie",
      "puedo el viernes en la tarde"
    ]
  }'
```

**Respuesta esperada (éxito):**
```json
{
  "ok": true,
  "pasos": [
    "✅ Lead creado — id: cm..., score: 4",
    "💬 Lead: \"para vivir yo mismo\" → Claude: \"...",
    "💬 Lead: \"tengo como 12 millones de pie\" → Claude: \"...",
    "💬 Lead: \"puedo el viernes en la tarde\" → Claude: \"..."
  ],
  "resultado": {
    "estado": "CALIFICADO",
    "tipoBuyer": "vivienda",
    "pieEstimado": "12 millones",
    "disponibilidad": "viernes en la tarde",
    "broker_asignado": "Nicolás Bravo"
  }
}
```

**Fallo si:**
- `ok: false` con `error` → leer el mensaje, probablemente Claude API o DB
- `estado: "EN_CONVERSACION"` → mensajes insuficientes para calificar, normal si Claude pide más info
- `broker_asignado: null` → no hay broker activo en DB, verificar con `/api/setup/status`

**Verificar en dashboard:** Lead debe aparecer en columna CALIFICADO con broker asignado.

---

## PRUEBA 5 — WhatsApp broker (requiere sandbox activo)

**Prerequisito:** Enviar desde +56975326208 el mensaje de activación al número sandbox de Twilio.
Ver instrucciones en: https://console.twilio.com → Messaging → Try it out → Send a WhatsApp message

```bash
curl -X POST https://nbm-lead-capture-system-production.up.railway.app/api/test/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"whatsapp": "+56975326208"}'
```

**Respuesta esperada:**
```json
{
  "ok": true,
  "sid": "SM...",
  "to": "+56975326208",
  "status": "queued"
}
```

**Verificar:** Abrir WhatsApp en +56975326208 — debe llegar mensaje del número `+14155238886`.

---

## SECUENCIA RECOMENDADA DE VALIDACIÓN

Ejecutar en orden, verificando cada resultado antes de continuar:

```
1. GET  /health                    → todas las vars ✅
2. GET  /api/test/detector         → score correcto
3. POST /api/test/simular-comentario → lead en DB, visible en /dashboard
4. POST /api/test/flujo-completo   → estado CALIFICADO, broker asignado
5. POST /api/test/whatsapp         → SID retornado, WhatsApp recibido
```

Si los 5 pasos pasan, **Fase 2 está completamente validada**.

---

## ESTADO ACTUAL DE LAS PRUEBAS

| Prueba | Estado |
|---|---|
| 1 — Health check | ✅ Validada |
| 2 — Detector keywords | ✅ Validada |
| 3 — Crear lead simulado | ✅ Validada |
| 4 — Pipeline completo Claude | ⚠️ Pendiente ejecutar |
| 5 — WhatsApp broker | ⚠️ Pendiente activar sandbox Twilio |

---

*Actualizado: 2 Abril 2026 — commit `9baa72c`*
