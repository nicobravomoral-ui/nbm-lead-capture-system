const twilio = require('twilio');
const prisma = require('../lib/prisma');

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const FROM = process.env.TWILIO_WHATSAPP_FROM;

/**
 * Notifica al broker por WhatsApp cuando se le asigna un lead calificado.
 */
async function notificarBroker(broker, lead) {
  const nombre = lead.nombre || lead.handleRrss;
  const dashboardUrl = `${process.env.APP_URL || 'https://tu-app.railway.app'}/api/leads/${lead.id}`;

  const mensaje = `🔔 Nuevo lead calificado — NBM Lead Capture

Nombre:        ${nombre}
Red social:    ${lead.plataforma} (${lead.handleRrss})
Comentó en:    ${lead.postUrl || 'N/A'}
Tipo:          ${lead.tipoBuyer || 'No indicado'}
Pie aprox.:    ${lead.pieEstimado || 'No indicado'}
Disponible:    ${lead.disponibilidad || 'No indicado'}

Ver ficha → ${dashboardUrl}`;

  await client.messages.create({
    from: FROM,
    to: `whatsapp:${broker.whatsapp}`,
    body: mensaje,
  });
}

/**
 * Notifica al admin del tenant cuando un lead queda sin broker disponible.
 */
async function notificarAdminSinBroker(leadId, tenantId) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });

  // Buscar el broker más antiguo del tenant como fallback para contactar al admin
  const admin = await prisma.broker.findFirst({
    where: { tenantId, activo: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) return;

  const mensaje = `⚠️ Lead sin broker disponible — NBM Lead Capture

El lead ${lead?.handleRrss} (${lead?.plataforma}) quedó sin broker asignado.
Todos los brokers del tenant "${tenant?.nombre}" ya fueron intentados.

Acción requerida: agregar un broker o reasignar manualmente.`;

  await client.messages.create({
    from: FROM,
    to: `whatsapp:${admin.whatsapp}`,
    body: mensaje,
  });
}

module.exports = { notificarBroker, notificarAdminSinBroker };
