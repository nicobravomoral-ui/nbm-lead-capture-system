const twilio = require('twilio');
const prisma = require('../lib/prisma');

const FROM = process.env.TWILIO_WHATSAPP_FROM;
const APP_URL = process.env.APP_URL || 'https://nbm-lead-capture-system-production.up.railway.app';

// Instanciación lazy — evita crash al startup si las credenciales no están definidas
function getClient() {
  return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
}

/**
 * Notifica al broker por WhatsApp cuando se le asigna un lead calificado.
 */
async function notificarBroker(broker, lead) {
  const nombre = lead.nombre || lead.handleRrss;
  const dashboardUrl = `${APP_URL}/dashboard`;

  const mensaje = `🔔 Nuevo lead calificado — NBM Lead Capture

Nombre:        ${nombre}
Red social:    ${lead.plataforma.toUpperCase()} (${lead.handleRrss})
Comentó en:    ${lead.postUrl || 'N/A'}
Tipo:          ${lead.tipoBuyer || 'No indicado'}
Pie aprox.:    ${lead.pieEstimado || 'No indicado'}
Disponible:    ${lead.disponibilidad || 'No indicado'}

Ver dashboard → ${dashboardUrl}`;

  try {
    const result = await getClient().messages.create({
      from: FROM,
      to: `whatsapp:${broker.whatsapp}`,
      body: mensaje,
    });
    console.log(`[NOTIFIER] WhatsApp enviado a ${broker.whatsapp} — SID: ${result.sid}`);
    return result;
  } catch (err) {
    console.error(`[NOTIFIER] Error Twilio al notificar broker ${broker.id}:`, err.message);
    throw err;
  }
}

/**
 * Notifica al admin cuando un lead queda sin broker disponible.
 */
async function notificarAdminSinBroker(leadId, tenantId) {
  const [tenant, lead, admin] = await Promise.all([
    prisma.tenant.findUnique({ where: { id: tenantId } }),
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.broker.findFirst({
      where: { tenantId, activo: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (!admin) {
    console.warn(`[NOTIFIER] Sin broker activo para notificar en tenant ${tenantId}`);
    return;
  }

  const mensaje = `⚠️ Lead sin broker — NBM Lead Capture

El lead ${lead?.handleRrss} (${lead?.plataforma?.toUpperCase()}) quedó sin broker asignado en "${tenant?.nombre}".

Todos los brokers disponibles ya fueron intentados.
Acción requerida: agregar un broker o reasignar manualmente.

Ver dashboard → ${APP_URL}/dashboard`;

  try {
    const result = await getClient().messages.create({
      from: FROM,
      to: `whatsapp:${admin.whatsapp}`,
      body: mensaje,
    });
    console.log(`[NOTIFIER] Alerta SIN_BROKER enviada a ${admin.whatsapp} — SID: ${result.sid}`);
    return result;
  } catch (err) {
    console.error(`[NOTIFIER] Error Twilio en alerta SIN_BROKER:`, err.message);
    throw err;
  }
}

module.exports = { notificarBroker, notificarAdminSinBroker };
