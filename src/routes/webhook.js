const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');
const detector = require('../services/detector');
const engage = require('../services/engage');

// GET /webhook/meta — verificación del webhook por Meta
router.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('Webhook Meta verificado.');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /webhook/meta — recibe eventos de comentarios y DMs
router.post('/meta', async (req, res) => {
  // Meta espera 200 inmediato
  res.sendStatus(200);

  const body = req.body;

  if (body.object !== 'instagram' && body.object !== 'page') return;

  for (const entry of body.entry || []) {
    // Comentarios en Instagram / Facebook
    const changes = entry.changes || [];
    for (const change of changes) {
      if (change.field === 'comments' || change.field === 'feed') {
        await handleComment(change.value);
      }
    }

    // Mensajes directos (respuestas del lead al DM)
    const messaging = entry.messaging || [];
    for (const event of messaging) {
      if (event.message && !event.message.is_echo) {
        await handleDMReply(event);
      }
    }
  }
});

async function handleComment(value) {
  try {
    const commentText = value.text || value.message || '';
    const commentId = value.id;
    const handle = value.from?.username || value.from?.name || 'desconocido';
    const postUrl = value.post_id ? `https://www.instagram.com/p/${value.post_id}` : null;
    const plataforma = value.item === 'comment' ? 'ig' : 'fb';

    // Buscar tenant por accountId de la cuenta que recibió el comentario
    const cuenta = await prisma.socialAccount.findFirst({
      where: { accountId: value.recipient_id || entry?.id, activa: true },
      include: { tenant: true },
    });
    if (!cuenta) return;

    const { tenant } = cuenta;
    const keywords = tenant.keywords?.length ? tenant.keywords : null;
    const score = detector.calcularScore(commentText, keywords);

    // Solo procesar si hay alguna señal de intención
    if (score < 2) return;

    // Crear lead en DB
    const lead = await prisma.lead.create({
      data: {
        tenantId: tenant.id,
        handleRrss: `@${handle}`,
        plataforma,
        postUrl,
        comentario: commentText,
        score,
        estado: 'NUEVO',
      },
    });

    // Responder públicamente + enviar DM
    await engage.iniciarContacto(lead, comentario, cuenta.token, value.from?.id);
  } catch (err) {
    console.error('Error en handleComment:', err.message);
  }
}

async function handleDMReply(event) {
  try {
    const senderId = event.sender.id;
    const messageText = event.message.text || '';

    // Buscar lead activo por handleRrss o sender id
    const lead = await prisma.lead.findFirst({
      where: {
        estado: { in: ['CONTACTADO', 'EN_CONVERSACION'] },
        handleRrss: { contains: senderId },
      },
      include: { conversacion: true, tenant: { include: { cuentas: true } } },
    });
    if (!lead) return;

    const qualify = require('../services/qualify');
    await qualify.procesarRespuesta(lead, messageText);
  } catch (err) {
    console.error('Error en handleDMReply:', err.message);
  }
}

module.exports = router;
