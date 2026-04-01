const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const detector = require('../services/detector');

/**
 * POST /api/test/simular-comentario
 * Simula exactamente el payload que Instagram enviaría al webhook.
 * Útil para validar el flujo comentario → detector → DB sin depender de Meta.
 *
 * Body: {
 *   texto: "me interesa, cuánto vale?",
 *   handle: "@usuario_prueba"   (opcional, default: @test_user)
 * }
 */
router.post('/simular-comentario', async (req, res) => {
  const texto = req.body.texto || 'me interesa, cuánto vale?';
  const handle = (req.body.handle || '@test_user').replace('@', '');

  // Buscar la primera SocialAccount activa
  const cuenta = await prisma.socialAccount.findFirst({
    where: { activa: true },
    include: { tenant: true },
  });

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
 * Query: ?texto=me interesa el precio
 */
router.get('/detector', (req, res) => {
  const texto = req.query.texto || '';
  if (!texto) return res.status(400).json({ error: 'Parámetro ?texto requerido' });

  const score = detector.calcularScore(texto);
  res.json({
    texto,
    score,
    genera_lead: score >= 2,
  });
});

/**
 * POST /api/test/dm
 * Envía un DM real de prueba a un IGSID específico.
 * Útil para validar token, permisos y conectividad con Meta API.
 *
 * Body: { igsid: "123456789", mensaje: "Hola, esto es una prueba" }
 */
router.post('/dm', async (req, res) => {
  const { igsid, mensaje } = req.body;
  if (!igsid) return res.status(400).json({ error: 'igsid requerido' });

  const cuenta = await prisma.socialAccount.findFirst({
    where: { activa: true },
    include: { tenant: true },
  });
  if (!cuenta) return res.status(400).json({ error: 'Sin SocialAccount configurada' });

  const meta = require('../lib/meta');
  try {
    const result = await meta.sendDM(
      cuenta.accountId,
      igsid,
      mensaje || '¡Hola! Esto es un mensaje de prueba del sistema NBM Lead Capture 🏠',
      cuenta.token
    );
    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
