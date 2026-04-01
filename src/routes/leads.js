const express = require('express');
const router = express.Router();
const prisma = require('../lib/prisma');

const ESTADOS_VALIDOS = [
  'NUEVO', 'CONTACTADO', 'EN_CONVERSACION', 'CALIFICADO',
  'AGENDADO', 'CONVERTIDO', 'PERDIDO',
  'NO_CALIFICADO', 'SIN_RESPUESTA', 'REASIGNADO', 'SIN_BROKER',
];

// GET /api/leads?tenantId=xxx
router.get('/', async (req, res) => {
  const { tenantId } = req.query;
  if (!tenantId) return res.status(400).json({ error: 'tenantId requerido' });

  const leads = await prisma.lead.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    include: {
      asignaciones: {
        where: { activa: true },
        include: { broker: true },
      },
    },
  });
  res.json(leads);
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  const lead = await prisma.lead.findUnique({
    where: { id: req.params.id },
    include: {
      conversacion: true,
      asignaciones: { include: { broker: true }, orderBy: { orden: 'asc' } },
    },
  });
  if (!lead) return res.status(404).json({ error: 'Lead no encontrado' });
  res.json(lead);
});

// PUT /api/leads/:id/estado
router.put('/:id/estado', async (req, res) => {
  const { estado } = req.body;
  if (!ESTADOS_VALIDOS.includes(estado)) {
    return res.status(400).json({ error: 'Estado inválido', validos: ESTADOS_VALIDOS });
  }

  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data: { estado, ultimoContacto: new Date() },
  });
  res.json(lead);
});

module.exports = router;
