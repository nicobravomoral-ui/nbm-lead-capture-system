const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/tenants
router.get('/', async (_req, res) => {
  const tenants = await prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(tenants);
});

// POST /api/tenants
router.post('/', async (req, res) => {
  const { nombre, plan } = req.body;
  if (!nombre) return res.status(400).json({ error: 'nombre requerido' });

  const tenant = await prisma.tenant.create({
    data: { nombre, plan: plan || 'pilot' },
  });
  res.status(201).json(tenant);
});

// PUT /api/tenants/:id/keywords
router.put('/:id/keywords', async (req, res) => {
  const { keywords } = req.body;
  if (!Array.isArray(keywords)) {
    return res.status(400).json({ error: 'keywords debe ser un array de strings' });
  }

  const tenant = await prisma.tenant.update({
    where: { id: req.params.id },
    data: { keywords },
  });
  res.json(tenant);
});

// GET /api/tenants/:id/dashboard
router.get('/:id/dashboard', async (req, res) => {
  const { id } = req.params;

  const [total, nuevos, calificados, agendados, sinBroker] = await Promise.all([
    prisma.lead.count({ where: { tenantId: id } }),
    prisma.lead.count({ where: { tenantId: id, estado: 'NUEVO' } }),
    prisma.lead.count({ where: { tenantId: id, estado: 'CALIFICADO' } }),
    prisma.lead.count({ where: { tenantId: id, estado: 'AGENDADO' } }),
    prisma.lead.count({ where: { tenantId: id, estado: 'SIN_BROKER' } }),
  ]);

  res.json({ total, nuevos, calificados, agendados, sinBroker });
});

module.exports = router;
