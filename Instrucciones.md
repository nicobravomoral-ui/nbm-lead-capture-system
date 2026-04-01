# NBM Lead Capture System — Instrucciones de Desarrollo

**Proyecto:** NBM Lead Capture System
**Propietario:** NBM Asesorías e Inversiones
**Stack:** Node.js + Express + Prisma + PostgreSQL + Claude API + Meta Graph API
**Deploy:** Railway
**Versión:** MVP
**Última actualización:** Abril 2026

---

## 1. CONTEXTO DEL PROYECTO

Sistema SaaS de **captación automatizada de leads inmobiliarios** desde redes sociales:
- Monitorea comentarios en Instagram y Facebook en **tiempo real**
- Detecta **señales de intención de compra** (IA + palabras clave)
- Responde automáticamente en **menos de 2 minutos**
- Califica al prospecto mediante **conversación con Claude Haiku**
- Asigna al broker correcto con **reasignación automática** por inactividad (5 días)

**Cliente piloto:** LoopOn (franquicia de Capitalizarme)
**Mercado objetivo:** Franquicias Capitalizarme, equipos de brokers, inmobiliarias chilenas

---

## 2. DECISIONES DE NEGOCIO — NO CAMBIAR SIN CONSULTAR

```
1. Tenant = la franquicia completa (ej: LoopOn)
   → NO es el equipo ni el broker individual

2. Los leads son propiedad del tenant, no del broker
   → Si un broker se va, los leads quedan en el tenant

3. Reasignación automática por inactividad (5 días)
   → Si broker no contacta al lead en 5 días → siguiente broker (round-robin)
   → Si se agotan brokers → estado SIN_BROKER + alerta al admin
```

---

## 3. ARQUITECTURA — 5 MÓDULOS

```
LISTEN → DETECT → ENGAGE → QUALIFY → ROUTE
```

| Módulo | Función | Tecnología |
|--------|---------|-----------|
| **LISTEN** | Monitorea RRSS en tiempo real | Meta Graph API (webhooks) |
| **DETECT** | Clasifica señales de intención (score 1-10) | Reglas + Claude API |
| **ENGAGE** | Respuesta pública + DM automático en < 2 min | Meta Messaging API |
| **QUALIFY** | Conversación de 3 preguntas con IA | Claude API (Haiku) |
| **ROUTE** | Asigna broker + notifica por WhatsApp | Twilio WhatsApp Business |

---

## 4. SCHEMA DE BASE DE DATOS (Prisma)

**Implementar exactamente. No agregar campos sin consultar.**

```prisma
model Tenant {
  id           String          @id @default(cuid())
  nombre       String
  plan         String          @default("pilot")
  keywords     String[]        // configurables desde dashboard
  createdAt    DateTime        @default(now())
  brokers      Broker[]
  leads        Lead[]
  cuentas      SocialAccount[]
}

model SocialAccount {
  id         String   @id @default(cuid())
  tenantId   String
  plataforma String   // ig | fb | tiktok | linkedin
  accountId  String
  token      String
  activa     Boolean  @default(true)
  tenant     Tenant   @relation(fields: [tenantId], references: [id])
}

model Broker {
  id          String       @id @default(cuid())
  tenantId    String
  nombre      String
  whatsapp    String
  zona        String?
  activo      Boolean      @default(true)
  tenant      Tenant       @relation(fields: [tenantId], references: [id])
  asignaciones Asignacion[]
}

model Lead {
  id              String       @id @default(cuid())
  tenantId        String
  nombre          String?
  handleRrss      String       // @usuario en la red social
  plataforma      String       // ig | fb | tiktok
  postUrl         String?      // URL del post donde comentó
  comentario      String       // texto original detectado
  score           Int          // 1-10
  estado          String       @default("NUEVO")
  // NUEVO | CONTACTADO | EN_CONVERSACION | CALIFICADO
  // AGENDADO | CONVERTIDO | PERDIDO
  // NO_CALIFICADO | SIN_RESPUESTA | REASIGNADO | SIN_BROKER
  tipoBuyer       String?      // inversor | vivienda
  pieEstimado     String?      // texto libre ("$8-12M")
  disponibilidad  String?      // texto libre ("jueves tarde")
  ultimoContacto  DateTime?
  createdAt       DateTime     @default(now())
  tenant          Tenant       @relation(fields: [tenantId], references: [id])
  asignaciones    Asignacion[]
  conversacion    Conversacion?
}

model Asignacion {
  id               String    @id @default(cuid())
  leadId           String
  brokerId         String
  orden            Int       // 1, 2, 3... (historial de reasignaciones)
  activa           Boolean   @default(true)
  motivoCambio     String?   // "sin_contacto_5_dias" | "broker_inactivo"
  fechaAsignacion  DateTime  @default(now())
  fechaVencimiento DateTime  // fechaAsignacion + 5 días
  lead             Lead      @relation(fields: [leadId], references: [id])
  broker           Broker    @relation(fields: [brokerId], references: [id])
}

model Conversacion {
  id        String   @id @default(cuid())
  leadId    String   @unique
  mensajes  Json     // array de { role, content, timestamp }
  estado    String   @default("ACTIVA")
  // ACTIVA | COMPLETADA | ABANDONADA
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  lead      Lead     @relation(fields: [leadId], references: [id])
}
```

---

## 5. ESTADOS DEL LEAD — FLUJO COMPLETO

```
NUEVO
  ↓ sistema envía respuesta pública + DM
CONTACTADO
  ↓ lead responde el DM
EN_CONVERSACION
  ↓ 3 preguntas respondidas, intención confirmada
CALIFICADO
  ↓ link de agendamiento enviado
AGENDADO  ← FIN DEL FLUJO AUTOMATIZADO
  ↓ broker registra resultado
CONVERTIDO | PERDIDO

RUTAS ALTERNATIVAS:
  → NO_CALIFICADO   (sin presupuesto o interés real)
  → SIN_RESPUESTA   (no contestó DM en 24h → reactivación D+1/3/7)
  → REASIGNADO      (5 días sin contacto → siguiente broker)
  → SIN_BROKER      (se agotó lista de brokers disponibles)
```

---

## 6. LÓGICA DE REASIGNACIÓN AUTOMÁTICA (CRON)

**Implementar como cron job diario a las 09:00 AM** (zona horaria Santiago, Chile — `America/Santiago`)

```javascript
// Búsqueda diaria:
SELECT * FROM asignaciones
WHERE activa = true
  AND fechaVencimiento < NOW()
  AND lead.estado NOT IN ['AGENDADO', 'CONVERTIDO', 'PERDIDO', 'NO_CALIFICADO']

// Para cada asignación vencida:
1. Marcar asignacion.activa = false
   motivoCambio = "sin_contacto_5_dias"

2. Buscar siguiente broker:
   - Mismo tenant
   - activo = true
   - Distinto al actual
   - Round-robin por orden de creación
   - Excluir brokers ya intentados en este lead

3. Si hay broker disponible:
   - Crear nueva Asignacion (orden + 1, fechaVencimiento = ahora + 5 días)
   - Actualizar lead.estado = "REASIGNADO"
   - Notificar broker por WhatsApp

4. Si NO hay broker disponible:
   - Actualizar lead.estado = "SIN_BROKER"
   - Notificar al admin del tenant por WhatsApp
```

---

## 7. PALABRAS CLAVE PARA CLASIFICADOR (DETECT)

**Configurables por tenant desde dashboard. Defaults en español chileno:**

```javascript
const KEYWORDS = {
  alta_intencion: [    // score base 8-10
    "precio", "valor", "cuánto vale", "cuanto vale",
    "me interesa", "información", "informacion", "info",
    "requisitos", "pie", "dividendo", "quiero comprar",
    "quiero invertir", "disponible", "unidades"
  ],
  media_intencion: [   // score base 5-7
    "dónde queda", "donde queda", "cuándo entrega",
    "cuando entrega", "quedan unidades", "buen negocio",
    "conviene", "rentable", "me llama", "contacto"
  ],
  baja_intencion: [    // score base 2-4
    "hermoso", "precioso", "ojalá", "ojala",
    "algún día", "algun dia", "sueño", "lindo"
  ]
}
```

---

## 8. LAS 3 PREGUNTAS DE CALIFICACIÓN (QUALIFY)

El agente Claude debe hacer **exactamente estas preguntas en este orden**, de forma conversacional:

1. **Tipo de buyer:** "¿Estás buscando para vivir tú mismo o como inversión?"
2. **Capacidad financiera:** "¿Tienes una idea de cuánto tienes disponible de pie?"
3. **Disponibilidad:** "¿Cuándo te acomoda conversar 15 minutos con un asesor?"

**Reglas del agente:**
- Máximo 4 turnos de conversación antes de ofrecer agendar
- Tono cálido, informal, nunca presionar
- Español chileno
- Si el lead da señales de alta urgencia, priorizar inmediatamente
- Si no califica (sin presupuesto, no interesado), agradecer y marcar como `NO_CALIFICADO`

**System prompt base:**
```
Eres un asistente de [tenant.nombre]. Tu objetivo es entender si esta
persona está lista para hablar con un asesor inmobiliario. Sé cálido,
breve y directo. Nunca presiones. Máximo 4 mensajes de ida y vuelta
antes de ofrecer agendar. Habla en español chileno informal.

Contexto del lead:
- Comentó: "[lead.comentario]"
- Red social: [lead.plataforma]
- Score de intención: [lead.score]/10
```

---

## 9. PLANTILLA DE NOTIFICACIÓN AL BROKER (WhatsApp)

```
🔔 Nuevo lead calificado — NBM Lead Capture

Nombre:        [lead.nombre ?? lead.handleRrss]
Red social:    [lead.plataforma] ([lead.handleRrss])
Comentó en:    [lead.postUrl]
Tipo:          [lead.tipoBuyer]
Pie aprox.:    [lead.pieEstimado]
Disponible:    [lead.disponibilidad]

Ver ficha → [link al dashboard]
```

---

## 10. STACK TÉCNICO Y VERSIONES

```
Node.js         >= 18
Express         ^4.18
Prisma          ^5.x
PostgreSQL      (Railway managed)
Claude API      claude-haiku-4-5-20251001  ← USAR ESTE MODELO EXACTO
Twilio          WhatsApp Business API
Meta API        Graph API v19+
Railway         deploy automático desde GitHub
```

---

## 11. VARIABLES DE ENTORNO REQUERIDAS

```env
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=sk-ant-...
META_APP_ID=...
META_APP_SECRET=...
META_VERIFY_TOKEN=...        # string aleatorio para verificar webhook
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
PORT=3000
NODE_ENV=production
TZ=America/Santiago
```

---

## 12. ESTRUCTURA DE CARPETAS DEL PROYECTO

```
nbm-lead-capture/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── index.js              # entry point, Express setup
│   ├── routes/
│   │   ├── webhook.js        # POST /webhook/meta
│   │   ├── leads.js          # CRUD leads
│   │   ├── brokers.js        # CRUD brokers
│   │   └── tenants.js        # CRUD tenants
│   ├── services/
│   │   ├── detector.js       # clasificador de keywords + score
│   │   ├── engage.js         # respuesta pública + DM automático
│   │   ├── qualify.js        # conversación Claude Haiku
│   │   ├── router.js         # lógica de asignación de brokers
│   │   └── notifier.js       # WhatsApp via Twilio
│   ├── jobs/
│   │   └── reasignacion.js   # cron diario 09:00 AM Santiago
│   └── lib/
│       ├── prisma.js         # cliente Prisma singleton
│       ├── meta.js           # helpers Meta Graph API
│       └── claude.js         # helpers Claude API
├── public/
│   └── dashboard/            # frontend HTML/CSS/JS vanilla
├── .env.example
├── package.json
└── railway.toml
```

---

## 13. ENDPOINTS MÍNIMOS PARA EL MVP

```
POST /webhook/meta              # recibe eventos de Meta (comentarios, DMs)
GET  /webhook/meta              # verificación del webhook (GET challenge)

GET  /api/leads                 # lista leads del tenant
GET  /api/leads/:id             # detalle de un lead
PUT  /api/leads/:id/estado      # actualizar estado manualmente

GET  /api/brokers               # lista brokers del tenant
POST /api/brokers               # crear broker

GET  /api/dashboard/resumen     # métricas para el dashboard
```

---

## 14. PLAN DE DESARROLLO — ORDEN DE IMPLEMENTACIÓN

**Respetar este orden. Cada fase debe funcionar antes de avanzar.**

### Fase 1 — MVP Demo (Días 1-3)
- [ ] Proyecto Node.js + Express en Railway (vacío pero deployado)
- [ ] Schema Prisma aplicado en PostgreSQL
- [ ] Webhook Meta registrado y verificado (GET + POST funcionando)
- [ ] Clasificador de keywords retorna score correcto
- [ ] Respuesta pública automática en post de IG (cuenta de prueba)

### Fase 2 — Sprint 1 (Días 4-7)
- [ ] DM automático enviado al lead
- [ ] Conversación Claude Haiku funcionando (3 preguntas)
- [ ] Lead guardado en DB con datos de calificación
- [ ] Notificación WhatsApp al broker via Twilio
- [ ] Cron de reasignación implementado y probado

### Fase 3 — Sprint 2 (Semana 2-3)
- [ ] Dashboard HTML básico (pipeline kanban + resumen)
- [ ] Configuración de keywords desde UI
- [ ] Integración TikTok (Display API)
- [ ] Multi-tenant: segundo tenant puede conectar sus propias cuentas

### Fase 4 — Sprint 3 (Semana 4-6)
- [ ] Social listening externo (Apify)
- [ ] Reportes exportables PDF
- [ ] Conector con CRM NBM (exportar leads calificados)
- [ ] OAuth flow completo para onboarding de nuevos tenants

---

## 15. FUERA DE SCOPE EN v1 — NO IMPLEMENTAR

```
❌ App móvil nativa
❌ Integración con portales (Portal Inmobiliario, Toctoc, Yapo)
❌ TikTok Ads (solo contenido orgánico)
❌ Multi-idioma
❌ Automatización de publicación de contenido en RRSS
❌ Análisis de sentiment avanzado o modelos ML propios
```

---

## 16. NOTAS DE DOMINIO — MERCADO INMOBILIARIO CHILENO

Términos relevantes que aparecen en comentarios y conversaciones:

- **UF:** Unidad de Fomento, unidad indexada a inflación. Referencia de precios inmobiliarios
- **Pie:** pago inicial del inmueble (equivale a "enganche" en otros países)
- **Bono pie:** subsidio gubernamental que complementa el pie
- **Dividendo:** cuota mensual del crédito hipotecario
- **Promesa:** contrato previo a la escritura de compraventa
- **Escritura:** contrato definitivo de compraventa ante notario
- **Plusvalía:** valorización esperada del inmueble
- **Cap rate:** rentabilidad anual neta de una propiedad de inversión
- **Arriendo notariado:** contrato de arriendo con validez legal

---

## 17. CHECKLIST RÁPIDO ANTES DE CÓDIGO

- [ ] Leer completamente este documento
- [ ] Entender la arquitectura de 5 módulos
- [ ] Conocer los 3 estados clave: NUEVO → CONTACTADO → EN_CONVERSACION → CALIFICADO → AGENDADO
- [ ] Entender la lógica de reasignación (5 días, round-robin, SIN_BROKER)
- [ ] Configurar Railway con PostgreSQL
- [ ] Preparar credenciales: Meta, Twilio, Anthropic
- [ ] Crear cuenta de prueba en Instagram/Facebook para testing
- [ ] ¿Está claro que el Tenant es la unidad base, no el Broker?

---

**Documento confidencial — NBM Asesorías e Inversiones**
**Generado: Abril 2026**
