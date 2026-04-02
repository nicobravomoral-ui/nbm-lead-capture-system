const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const detector = require('../services/detector');

// Siempre usa la SocialAccount más reciente y activa
async function getCuentaActiva() {
  return prisma.socialAccount.findFirst({
    where: { activa: true },
    orderBy: { createdAt: 'desc' }, // la más reciente primero
    include: { tenant: true },
  });
}

/**
 * GET /api/test/env-check
 * Verifica qué variables de entorno críticas están definidas (sin exponer valores).
 */
router.get('/env-check', (_req, res) => {
  const vars = [
    'DATABASE_URL',
    'ANTHROPIC_API_KEY',
    'META_APP_ID',
    'META_APP_SECRET',
    'META_VERIFY_TOKEN',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN',
    'TWILIO_WHATSAPP_FROM',
    'NODE_ENV',
    'TZ',
  ];

  const resultado = {};
  for (const v of vars) {
    const val = process.env[v];
    if (!val) {
      resultado[v] = '❌ NO DEFINIDA';
    } else {
      resultado[v] = `✅ definida (${val.slice(0, 6)}...)`;
    }
  }

  res.json(resultado);
});

/**
 * POST /api/test/simular-comentario
 * Simula el payload exacto que Instagram enviaría al webhook.
 */
router.post('/simular-comentario', async (req, res) => {
  try {
    const texto = req.body.texto || 'me interesa, cuánto vale?';
    const handle = (req.body.handle || '@test_user').replace('@', '');

    const cuenta = await getCuentaActiva();
    if (!cuenta) {
      return res.status(400).json({ error: 'No hay SocialAccount configurada. Ejecuta POST /api/setup/tenant primero.' });
    }

    const { tenant } = cuenta;
    const keywords = tenant.keywords?.length ? tenant.keywords : null;
    const score = detector.calcularScore(texto, keywords);

    if (score < 2) {
      return res.json({
        ok: false,
        mensaje: 'Score insuficiente — comentario no genera lead',
        score,
        texto,
        sugerencia: 'Usa palabras como: precio, me interesa, cuánto vale, información',
      });
    }

    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        handleRrss: `@${handle}`,
        plataforma: cuenta.plataforma,
        postUrl: 'https://www.instagram.com/p/simulado',
        comentario: texto,
        score,
        estado: 'NUEVO',
      },
    });

    res.json({
      ok: true,
      mensaje: 'Lead creado correctamente',
      lead: {
        id: lead.id,
        handleRrss: lead.handleRrss,
        comentario: lead.comentario,
        score: lead.score,
        estado: lead.estado,
        plataforma: lead.plataforma,
      },
      verificar: `GET /api/leads?tenantId=${tenant.id}`,
    });
  } catch (err) {
    console.error('[TEST/simular-comentario]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/test/detector
 * Prueba el clasificador de keywords sin crear nada en DB.
 */
router.get('/detector', (req, res) => {
  const texto = req.query.texto || '';
  if (!texto) return res.status(400).json({ error: 'Parámetro ?texto requerido' });

  const score = detector.calcularScore(texto);
  res.json({ texto, score, genera_lead: score >= 2 });
});

/**
 * POST /api/test/whatsapp
 * Envía un WhatsApp de prueba real vía Twilio.
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const twilio = require('twilio');
    const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    const numero = req.body.whatsapp || '+56975326208';
    const FROM = process.env.TWILIO_WHATSAPP_FROM;

    const result = await client.messages.create({
      from: FROM,
      to: `whatsapp:${numero}`,
      body: '🔔 Prueba NBM Lead Capture — sistema funcionando correctamente ✅',
    });
    res.json({ ok: true, sid: result.sid, to: numero, status: result.status });
  } catch (err) {
    console.error('[TEST/whatsapp]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/test/dm
 * Envía un DM real de prueba a un IGSID específico.
 */
router.post('/dm', async (req, res) => {
  try {
    const { igsid, mensaje } = req.body;
    if (!igsid) return res.status(400).json({ error: 'igsid requerido' });

    const cuenta = await getCuentaActiva();
    if (!cuenta) return res.status(400).json({ error: 'Sin SocialAccount configurada' });

    const meta = require('../lib/meta');
    const result = await meta.sendDM(
      cuenta.accountId,
      igsid,
      mensaje || '¡Hola! Esto es un mensaje de prueba del sistema NBM Lead Capture 🏠',
      cuenta.token
    );
    res.json({ ok: true, cuenta_usada: cuenta.accountId, result });
  } catch (err) {
    console.error('[TEST/dm]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/test/qualify
 * Simula una respuesta de DM del lead y ejecuta el ciclo qualify → route → notify.
 * Usa el lead de prueba más reciente en estado CONTACTADO o EN_CONVERSACION.
 *
 * Body: { mensaje: "para vivir, tengo 10 millones de pie, puedo el jueves" }
 *       { leadId: "xxx", mensaje: "..." }  (opcional: especificar lead)
 */
router.post('/qualify', async (req, res) => {
  try {
    const { mensaje, leadId } = req.body;
    if (!mensaje) return res.status(400).json({ error: 'mensaje requerido' });

    // Buscar lead a usar
    const cuenta = await getCuentaActiva();
    const tenantId = cuenta?.tenant?.id;

    const where = leadId
      ? { id: leadId }
      : { estado: { in: ['CONTACTADO', 'EN_CONVERSACION', 'NUEVO'] }, ...(tenantId ? { tenantId } : {}) };

    const lead = await prisma.lead.findFirst({
      where,
      orderBy: { createdAt: 'desc' },
      include: { conversacion: true },
    });

    if (!lead) return res.status(404).json({ error: 'No hay lead disponible para calificar' });

    // Si está en NUEVO, marcarlo como CONTACTADO primero
    if (lead.estado === 'NUEVO') {
      await prisma.lead.update({ where: { id: lead.id }, data: { estado: 'CONTACTADO' } });
      lead.estado = 'CONTACTADO';
    }

    const qualify = require('../services/qualify');
    const respuesta = await qualify.procesarRespuesta(lead, mensaje);

    const leadActualizado = await prisma.lead.findUnique({ where: { id: lead.id } });

    res.json({
      ok: true,
      leadId: lead.id,
      mensaje_enviado: mensaje,
      respuesta_claude: respuesta,
      estado_resultante: leadActualizado.estado,
      tipoBuyer: leadActualizado.tipoBuyer,
      pieEstimado: leadActualizado.pieEstimado,
      disponibilidad: leadActualizado.disponibilidad,
    });
  } catch (err) {
    console.error('[TEST/qualify]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/test/flujo-completo
 * Simula el flujo end-to-end: comentario → lead → qualify → route → WhatsApp broker.
 * No llama Meta API (no DM real, no reply público).
 *
 * Body: { comentario: "me interesa el precio", mensajes: ["para vivir", "10M de pie", "el viernes"] }
 */
router.post('/flujo-completo', async (req, res) => {
  try {
    const comentario = req.body.comentario || 'me interesa el precio, cuánto vale';
    const mensajes = req.body.mensajes || [
      'para vivir',
      'tengo como 10 millones de pie',
      'puedo el jueves en la tarde',
    ];

    const cuenta = await getCuentaActiva();
    if (!cuenta) return res.status(400).json({ error: 'Sin SocialAccount configurada' });

    // 1. Crear lead
    const lead = await prisma.lead.create({
      data: {
        tenantId: cuenta.tenant.id,
        handleRrss: `@test_flujo_${Date.now()}`,
        plataforma: 'ig',
        postUrl: null,
        comentario,
        score: require('../services/detector').calcularScore(comentario),
        estado: 'CONTACTADO',
      },
    });

    const pasos = [`✅ Lead creado — id: ${lead.id}, score: ${lead.score}`];
    const qualify = require('../services/qualify');

    // 2. Simular conversación
    let leadActual = lead;
    for (const msg of mensajes) {
      leadActual = await prisma.lead.findUnique({ where: { id: lead.id }, include: { conversacion: true } });
      const respuesta = await qualify.procesarRespuesta(leadActual, msg);
      pasos.push(`💬 Lead: "${msg}" → Claude: "${respuesta.slice(0, 80)}..."`);
      leadActual = await prisma.lead.findUnique({ where: { id: lead.id } });
      if (leadActual.estado === 'CALIFICADO' || leadActual.estado === 'NO_CALIFICADO') break;
    }

    const final = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: { asignaciones: { include: { broker: true } } },
    });

    res.json({
      ok: true,
      pasos,
      resultado: {
        estado: final.estado,
        tipoBuyer: final.tipoBuyer,
        pieEstimado: final.pieEstimado,
        disponibilidad: final.disponibilidad,
        broker_asignado: final.asignaciones[0]?.broker?.nombre || null,
      },
    });
  } catch (err) {
    console.error('[TEST/flujo-completo]', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
