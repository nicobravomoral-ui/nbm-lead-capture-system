const cron = require('node-cron');
const prisma = require('../lib/prisma');
const routerService = require('../services/router');

// Todos los días a las 09:00 AM hora Santiago (UTC-3 / UTC-4 según DST)
// En Railway con TZ=America/Santiago, la expresión '0 9 * * *' aplica correctamente
cron.schedule('0 9 * * *', async () => {
  console.log('[CRON] Ejecutando reasignación automática por inactividad...');

  const ESTADOS_ACTIVOS = ['NUEVO', 'CONTACTADO', 'EN_CONVERSACION', 'CALIFICADO', 'REASIGNADO'];

  try {
    const asignacionesVencidas = await prisma.asignacion.findMany({
      where: {
        activa: true,
        fechaVencimiento: { lt: new Date() },
        lead: { estado: { in: ESTADOS_ACTIVOS } },
      },
      include: { lead: true },
    });

    console.log(`[CRON] ${asignacionesVencidas.length} asignaciones vencidas encontradas.`);

    for (const asignacion of asignacionesVencidas) {
      // 1. Marcar asignación como inactiva
      await prisma.asignacion.update({
        where: { id: asignacion.id },
        data: { activa: false, motivoCambio: 'sin_contacto_5_dias' },
      });

      // 2. Actualizar estado del lead a REASIGNADO temporalmente
      await prisma.lead.update({
        where: { id: asignacion.leadId },
        data: { estado: 'REASIGNADO' },
      });

      // 3. Intentar asignar siguiente broker
      await routerService.asignarBroker(asignacion.leadId, asignacion.lead.tenantId);
    }

    console.log('[CRON] Reasignación completada.');
  } catch (err) {
    console.error('[CRON] Error en reasignación automática:', err.message);
  }
}, {
  timezone: 'America/Santiago',
});
