require('dotenv').config();

const express = require('express');
const app = express();

app.use(express.json());
app.use(express.static('public'));

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Rutas
app.use('/webhook', require('./routes/webhook'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api/brokers', require('./routes/brokers'));
app.use('/api/tenants', require('./routes/tenants'));
app.use('/api/setup', require('./routes/setup'));
app.use('/api/test', require('./routes/test'));

// Health check — incluye diagnóstico de variables y versión
app.get('/health', (_req, res) => {
  const vars = ['DATABASE_URL','ANTHROPIC_API_KEY','META_APP_ID','META_VERIFY_TOKEN',
                 'TWILIO_ACCOUNT_SID','TWILIO_AUTH_TOKEN','TWILIO_WHATSAPP_FROM'];
  const env = {};
  for (const v of vars) env[v] = process.env[v] ? '✅' : '❌ FALTA';
  res.json({ status: 'ok', commit: process.env.RAILWAY_GIT_COMMIT_SHA || '5f9efbb', node: process.version, env });
});

// Cron de reasignación
require('./jobs/reasignacion');

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`NBM Lead Capture corriendo en puerto ${PORT}`);
});
