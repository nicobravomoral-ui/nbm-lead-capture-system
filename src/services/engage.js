const meta = require('../lib/meta');
const prisma = require('../lib/prisma');

const RESPUESTA_PUBLICA = '¡Hola! Gracias por tu interés 😊 Te escribo por DM con más información.';

/**
 * Responde públicamente al comentario y envía un DM al lead.
 * Actualiza el estado del lead a CONTACTADO.
 */
async function iniciarContacto(lead, commentId, accessToken, igScopedId) {
  const cuenta = await prisma.socialAccount.findFirst({
    where: { tenantId: lead.tenantId, activa: true },
    include: { tenant: true },
  });
  if (!cuenta) throw new Error(`Sin cuenta activa para tenant ${lead.tenantId}`);

  const tenantNombre = cuenta.tenant.nombre;

  // 1. Respuesta pública al comentario
  await meta.replyComment(commentId, RESPUESTA_PUBLICA, accessToken);
  console.log(`[ENGAGE] Respuesta pública enviada — comentario ${commentId}`);

  // 2. DM privado
  const mensajeDM = buildMensajeDM(lead, tenantNombre);
  await meta.sendDM(cuenta.accountId, igScopedId, mensajeDM, accessToken);
  console.log(`[ENGAGE] DM enviado — lead ${lead.id}, IGSID ${igScopedId}`);

  // 3. Actualizar estado del lead
  await prisma.lead.update({
    where: { id: lead.id },
    data: { estado: 'CONTACTADO', ultimoContacto: new Date() },
  });

  // 4. Crear registro de conversación
  await prisma.conversacion.create({
    data: { leadId: lead.id, mensajes: [], estado: 'ACTIVA' },
  });

  console.log(`[ENGAGE] Lead ${lead.id} → estado CONTACTADO`);
}

function buildMensajeDM(lead, tenantNombre) {
  if (lead.score >= 8) {
    return `¡Hola! Vi que te interesa una propiedad. Soy asesor de ${tenantNombre} y me encantaría ayudarte 🏠 ¿Me cuentas un poco más sobre lo que buscas?`;
  }
  if (lead.score >= 5) {
    return `¡Hola! Vi tu comentario y quería contarte más sobre nuestros proyectos en ${tenantNombre}. ¿Estás buscando para vivir o como inversión?`;
  }
  return `¡Hola! Gracias por tu comentario. Si en algún momento quieres conocer más sobre las propiedades de ${tenantNombre}, con gusto te ayudo 😊`;
}

module.exports = { iniciarContacto };
