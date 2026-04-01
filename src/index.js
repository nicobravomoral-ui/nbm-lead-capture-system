require('dotenv').config();

const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// Rutas
app.use('/webhook', require('./routes/webhook'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/tenants', require('./routes/tenants'));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Cron de reasignación
require('./jobs/reasignacion');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NBM Lead Capture corriendo en puerto ${PORT}`);
});
