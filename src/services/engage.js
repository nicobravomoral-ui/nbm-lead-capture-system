const meta = require('../lib/meta');
const prisma = require('../lib/prisma');

const RESPUESTA_PUBLICA = '¡Hola! Gracias por tu interés 😊 Te escribo por DM con más información.';

/**
 * Responde públicamente al comentario y envía un DM al lead.
 * Actualiza el estado del lead a CONTACTADO.
 *
 * @param {object} lead           Registro Lead de DB
 * @param {string} commentId      ID del comentario a responder
 * @param {string} accessToken    Token de acceso de la SocialAccount
 * @param {string} igScopedId     IGSID del usuario que comentó
 */
async function iniciarContacto(lead, commentId, accessToken, igScopedId) {
  // 1. Respuesta pública al comentario
  await meta.replyComment(commentId, RESPUESTA_PUBLICA, accessToken);

  // 2. DM privado con mensaje de calificación inicial
  const mensajeDM = buildMensajeDM(lead);
  const cuenta = await prisma.socialAccount.findFirst({
    where: { tenantId: lead.tenantId, activa: true },
  });
  if (!cuenta) throw new Error(`Sin cuenta activa para tenant ${lead.tenantId}`);

  await meta.sendDM(cuenta.accountId, igScopedId, mensajeDM, accessToken);

  // 3. Actualizar estado del lead
  await prisma.lead.update({
    where: { id: lead.id },
    data: { estado: 'CONTACTADO', ultimoContacto: new Date() },
  });

  // 4. Crear registro de conversación vacío (se llenará en qualify)
  await prisma.conversacion.create({
    data: {
      leadId: lead.id,
      mensajes: [],
      estado: 'ACTIVA',
    },
  });
}

function buildMensajeDM(lead) {
  const score = lead.score;
  if (score >= 8) {
    return `¡Hola! Vi que te interesa una propiedad. Soy asesor de ${lead.tenantId} y me encantaría ayudarte. ¿Me cuentas un poco más sobre lo que buscas?`;
  }
  if (score >= 5) {
    return `¡Hola! Vi tu comentario y quería contarte más sobre nuestros proyectos. ¿Estás buscando para vivir o como inversión?`;
  }
  return `¡Hola! Gracias por tu comentario. Si en algún momento quieres conocer más sobre nuestras propiedades, con gusto te ayudo 😊`;
}

module.exports = { iniciarContacto };
