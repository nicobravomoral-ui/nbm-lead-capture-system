const prisma = require('../lib/prisma');
const notifier = require('./notifier');

const DIAS_VENCIMIENTO = 5;

/**
 * Asigna el primer broker disponible del tenant al lead.
 * Excluye brokers ya intentados en este lead.
 * @param {string} leadId
 * @param {string} tenantId
 */
async function asignarBroker(leadId, tenantId) {
  // Brokers ya intentados en este lead
  const intentados = await prisma.asignacion.findMany({
    where: { leadId },
    select: { brokerId: true },
  });
  const intentadosIds = intentados.map(a => a.brokerId);

  // Siguiente broker disponible (round-robin por orden de creación)
  const broker = await prisma.broker.findFirst({
    where: {
      tenantId,
      activo: true,
      id: { notIn: intentadosIds },
    },
    orderBy: { createdAt: 'asc' },
  });

  const orden = intentadosIds.length + 1;

  if (!broker) {
    await prisma.lead.update({
      where: { id: leadId },
      data: { estado: 'SIN_BROKER' },
    });
    await notifier.notificarAdminSinBroker(leadId, tenantId);
    return null;
  }

  const fechaVencimiento = new Date();
  fechaVencimiento.setDate(fechaVencimiento.getDate() + DIAS_VENCIMIENTO);

  await prisma.asignacion.create({
    data: { leadId, brokerId: broker.id, orden, fechaVencimiento },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { estado: 'CALIFICADO' },
  });

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  await notifier.notificarBroker(broker, lead);

  return broker;
}

module.exports = { asignarBroker };
