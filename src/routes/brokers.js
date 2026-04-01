const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

// GET /api/brokers?tenantId=xxx
router.get('/', async (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId requerido' });

  const brokers = await prisma.broker.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(brokers);
});

// POST /api/brokers
router.post('/', async (req, res) => {
  const { tenantId, nombre, whatsapp, zona } = req.body;
  if (!tenantId || !nombre || !whatsapp) {
    return res.status(400).json({ error: 'tenantId, nombre y whatsapp son requeridos' });
  }

  const broker = await prisma.broker.create({
    data: { tenantId, nombre, whatsapp, zona },
  });
  res.status(201).json(broker);
});

// PUT /api/brokers/:id/activo
router.put('/:id/activo', async (req, res) => {
  const { activo } = req.body;
  const broker = await prisma.broker.update({
    where: { id: req.params.id },
    data: { activo: Boolean(activo) },
  });
  res.json(broker);
});

module.exports = router;
