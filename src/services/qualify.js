const claude = require('../lib/claude');
const prisma = require('../lib/prisma');
const router = require('./router');

const MAX_TURNOS = 4;

/**
 * Procesa la respuesta del lead al DM y avanza la conversación de calificación.
 * @param {object} lead  Lead con conversacion incluida
 * @param {string} texto Mensaje del lead
 */
async function procesarRespuesta(lead, texto) {
  const conv = lead.conversacion;
  const mensajes = Array.isArray(conv?.mensajes) ? conv.mensajes : [];

  // Agregar mensaje del lead
  mensajes.push({ role: 'user', content: texto, timestamp: new Date().toISOString() });

  const systemPrompt = buildSystemPrompt(lead);
  const historial = mensajes.map(({ role, content }) => ({ role, content }));

  const respuestaIA = await claude.chat(systemPrompt, historial);

  // Agregar respuesta del asistente
  mensajes.push({ role: 'assistant', content: respuestaIA, timestamp: new Date().toISOString() });

  // Detectar si la conversación terminó (calificado o no calificado)
  const { estado, tipoBuyer, pieEstimado, disponibilidad } = extraerDatos(mensajes);

  // Actualizar conversación
  await prisma.conversacion.update({
    where: { leadId: lead.id },
    data: {
      mensajes,
      estado: estado === 'CALIFICADO' || estado === 'NO_CALIFICADO' ? 'COMPLETADA' : 'ACTIVA',
    },
  });

  // Actualizar lead
  const updateData = {
    estado: estado || (mensajes.filter(m => m.role === 'user').length >= MAX_TURNOS ? 'SIN_RESPUESTA' : 'EN_CONVERSACION'),
    ultimoContacto: new Date(),
  };
  if (tipoBuyer) updateData.tipoBuyer = tipoBuyer;
  if (pieEstimado) updateData.pieEstimado = pieEstimado;
  if (disponibilidad) updateData.disponibilidad = disponibilidad;

  await prisma.lead.update({ where: { id: lead.id }, data: updateData });

  // Si calificó, asignar broker
  if (estado === 'CALIFICADO') {
    await router.asignarBroker(lead.id, lead.tenantId);
  }

  return respuestaIA;
}

function buildSystemPrompt(lead) {
  return `Eres un asistente de una inmobiliaria. Tu objetivo es entender si esta persona está lista para hablar con un asesor. Sé cálido, breve y directo. Nunca presiones. Máximo ${MAX_TURNOS} mensajes de ida y vuelta antes de ofrecer agendar. Habla en español chileno informal.

Debes hacer estas preguntas en orden, de forma conversacional:
1. ¿Estás buscando para vivir tú mismo o como inversión?
2. ¿Tienes una idea de cuánto tienes disponible de pie?
3. ¿Cuándo te acomoda conversar 15 minutos con un asesor?

Cuando tengas las 3 respuestas, responde EXACTAMENTE con este formato JSON al final de tu mensaje (después de tu respuesta normal):
[CALIFICADO: {"tipoBuyer":"...","pieEstimado":"...","disponibilidad":"..."}]

Si el lead claramente no tiene interés real o presupuesto, responde con [NO_CALIFICADO] al final.

Contexto:
- Comentó: "${lead.comentario}"
- Red social: ${lead.plataforma}
- Score de intención: ${lead.score}/10`;
}

function extraerDatos(mensajes) {
  const ultimoAsistente = [...mensajes].reverse().find(m => m.role === 'assistant');
  if (!ultimoAsistente) return {};

  const texto = ultimoAsistente.content;

  const matchCalificado = texto.match(/\[CALIFICADO:\s*({.*?})\]/s);
  if (matchCalificado) {
    try {
      const datos = JSON.parse(matchCalificado[1]);
      return { estado: 'CALIFICADO', ...datos };
    } catch {
      return { estado: 'CALIFICADO' };
    }
  }

  if (texto.includes('[NO_CALIFICADO]')) {
    return { estado: 'NO_CALIFICADO' };
  }

  return {};
}

module.exports = { procesarRespuesta };
