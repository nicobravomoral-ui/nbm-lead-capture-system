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

  console.log(`[WEBHOOK] Verificación recibida — mode: ${mode}, token_match: ${token === process.env.META_VERIFY_TOKEN}`);

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    console.log('[WEBHOOK] Verificación exitosa.');
    return res.status(200).send(challenge);
  }
  console.warn('[WEBHOOK] Verificación fallida — token no coincide.');
  res.sendStatus(403);
});

// POST /webhook/meta — recibe eventos de comentarios y DMs
router.post('/meta', async (req, res) => {
  res.sendStatus(200); // Meta espera 200 inmediato

  const body = req.body;
  if (body.object !== 'instagram' && body.object !== 'page') return;

  for (const entry of body.entry || []) {
    // Comentarios en Instagram / Facebook
    for (const change of entry.changes || []) {
      if (change.field === 'comments' || change.field === 'feed') {
        await handleComment(change.value, entry.id);
      }
    }

    // Mensajes directos (respuestas del lead al DM)
    for (const event of entry.messaging || []) {
      if (event.message && !event.message.is_echo) {
        await handleDMReply(event);
      }
    }
  }
});

async function handleComment(value, entryId) {
  try {
    const commentText = value.text || value.message || '';
    const commentId = value.id;
    const handle = value.from?.username || value.from?.name || 'desconocido';
    const postUrl = value.post_id ? `https://www.instagram.com/p/${value.post_id}` : null;
    const plataforma = value.item === 'comment' ? 'ig' : 'fb';
    const recipientId = value.recipient_id || entryId;

    const cuenta = await prisma.socialAccount.findFirst({
      where: { accountId: recipientId, activa: true },
      include: { tenant: true },
    });
    if (!cuenta) {
      console.warn(`[WEBHOOK] No se encontró SocialAccount para accountId: ${recipientId}`);
      return;
    }

    const { tenant } = cuenta;
    const keywords = tenant.keywords?.length ? tenant.keywords : null;
    const score = detector.calcularScore(commentText, keywords);

    if (score < 2) return;

    console.log(`[WEBHOOK] Lead detectado — @${handle}, score: ${score}`);

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

    await engage.iniciarContacto(lead, commentId, cuenta.token, value.from?.id);
  } catch (err) {
    console.error('[WEBHOOK] Error en handleComment:', err.message);
  }
}

async function handleDMReply(event) {
  try {
    const senderId = event.sender.id;
    const messageText = event.message?.text || '';
    if (!messageText) return;

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
    console.error('[WEBHOOK] Error en handleDMReply:', err.message);
  }
}

module.exports = router;
