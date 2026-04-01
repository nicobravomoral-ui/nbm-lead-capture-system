const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

/**
 * POST /api/setup/tenant
 * Crea el tenant piloto (LoopOn) con una SocialAccount y un broker inicial.
 * Solo para uso en onboarding. Idempotente — no duplica si ya existe.
 *
 * Body: {
 *   tenantNombre: "LoopOn",
 *   igAccountId: "123456789",       // ID de la cuenta de negocio Instagram
 *   igAccessToken: "EAAB...",       // Token de acceso de la página
 *   brokerNombre: "Juan Pérez",
 *   brokerWhatsapp: "+56912345678"
 * }
 */
router.post('/tenant', async (req, res) => {
  const { tenantNombre, igAccountId, igAccessToken, brokerNombre, brokerWhatsapp } = req.body;

  if (!tenantNombre || !igAccountId || !igAccessToken || !brokerNombre || !brokerWhatsapp) {
    return res.status(400).json({
      error: 'Faltan campos requeridos',
      requeridos: ['tenantNombre', 'igAccountId', 'igAccessToken', 'brokerNombre', 'brokerWhatsapp'],
    });
  }

  // Idempotente: buscar si ya existe
  let tenant = await prisma.tenant.findFirst({ where: { nombre: tenantNombre } });

  if (!tenant) {
    tenant = await prisma.tenant.create({
      data: { nombre: tenantNombre, plan: 'pilot' },
    });
  }

  // Crear o actualizar SocialAccount
  let cuenta = await prisma.socialAccount.findFirst({
    where: { tenantId: tenant.id, accountId: igAccountId },
  });

  if (!cuenta) {
    cuenta = await prisma.socialAccount.create({
      data: {
        tenantId: tenant.id,
        plataforma: 'ig',
        accountId: igAccountId,
        token: igAccessToken,
        activa: true,
      },
    });
  } else {
    cuenta = await prisma.socialAccount.update({
      where: { id: cuenta.id },
      data: { token: igAccessToken, activa: true },
    });
  }

  // Crear broker si no existe
  let broker = await prisma.broker.findFirst({
    where: { tenantId: tenant.id, whatsapp: brokerWhatsapp },
  });

  if (!broker) {
    broker = await prisma.broker.create({
      data: { tenantId: tenant.id, nombre: brokerNombre, whatsapp: brokerWhatsapp },
    });
  }

  res.json({
    ok: true,
    tenant: { id: tenant.id, nombre: tenant.nombre },
    cuenta: { id: cuenta.id, accountId: cuenta.accountId },
    broker: { id: broker.id, nombre: broker.nombre },
  });
});

/**
 * GET /api/setup/status
 * Muestra el estado actual de tenants y cuentas configuradas.
 */
router.get('/status', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({
    include: {
      cuentas: { select: { id: true, plataforma: true, accountId: true, activa: true } },
      brokers: { select: { id: true, nombre: true, whatsapp: true, activo: true } },
      _count: { select: { leads: true } },
    },
  });
  res.json(tenants);
});

/**
 * PUT /api/setup/token
 * Actualiza el access token de una SocialAccount (cuando expira).
 * Body: { igAccountId: "123", newToken: "EAAB..." }
 */
router.put('/token', async (req, res) => {
  const { igAccountId, newToken } = req.body;
  if (!igAccountId || !newToken) {
    return res.status(400).json({ error: 'igAccountId y newToken requeridos' });
  }

  const cuenta = await prisma.socialAccount.findFirst({
    where: { accountId: igAccountId },
  });
  if (!cuenta) return res.status(404).json({ error: 'Cuenta no encontrada' });

  await prisma.socialAccount.update({
    where: { id: cuenta.id },
    data: { token: newToken },
  });

  res.json({ ok: true, mensaje: 'Token actualizado correctamente' });
});

module.exports = router;
