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
  const twilio = require('twilio');
  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  const numero = req.body.whatsapp || '+56975326208';
  const FROM = process.env.TWILIO_WHATSAPP_FROM;

  try {
    const result = await client.messages.create({
      from: FROM,
      to: `whatsapp:${numero}`,
      body: '🔔 Prueba NBM Lead Capture — sistema funcionando correctamente ✅',
    });
    res.json({ ok: true, sid: result.sid, to: numero, status: result.status });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/test/dm
 * Envía un DM real de prueba a un IGSID específico.
 */
router.post('/dm', async (req, res) => {
  const { igsid, mensaje } = req.body;
  if (!igsid) return res.status(400).json({ error: 'igsid requerido' });

  const cuenta = await getCuentaActiva();
  if (!cuenta) return res.status(400).json({ error: 'Sin SocialAccount configurada' });

  const meta = require('../lib/meta');
  try {
    const result = await meta.sendDM(
      cuenta.accountId,
      igsid,
      mensaje || '¡Hola! Esto es un mensaje de prueba del sistema NBM Lead Capture 🏠',
      cuenta.token
    );
    res.json({ ok: true, cuenta_usada: cuenta.accountId, result });
  } catch (err) {
    res.status(500).json({ ok: false, cuenta_usada: cuenta.accountId, error: err.message });
  }
});

module.exports = router;
