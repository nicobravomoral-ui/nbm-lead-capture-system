const claude = require('../lib/claude');
const prisma = require('../lib/prisma');
const router = require('./router');

const MAX_TURNOS = 4;

/**
 * Procesa la respuesta del lead al DM y avanza la conversación de calificación.
 * @param {object} lead  Lead completo (puede o no tener conversacion cargada)
 * @param {string} texto Mensaje del lead
 * @returns {string} Respuesta del asistente
 */
async function procesarRespuesta(lead, texto) {
  // Cargar conversación si no viene incluida
  let conv = lead.conversacion;
  if (!conv) {
    conv = await prisma.conversacion.findUnique({ where: { leadId: lead.id } });
  }

  const mensajes = Array.isArray(conv?.mensajes) ? [...conv.mensajes] : [];

  // Agregar mensaje del lead
  mensajes.push({ role: 'user', content: texto, timestamp: new Date().toISOString() });

  const turnosUsuario = mensajes.filter(m => m.role === 'user').length;
  const systemPrompt = buildSystemPrompt(lead, turnosUsuario);
  const historial = mensajes.map(({ role, content }) => ({ role, content }));

  const respuestaIA = await claude.chat(systemPrompt, historial);

  // Agregar respuesta del asistente
  mensajes.push({ role: 'assistant', content: respuestaIA, timestamp: new Date().toISOString() });

  // Detectar estado final
  const { estado, tipoBuyer, pieEstimado, disponibilidad } = extraerDatos(respuestaIA);

  // Upsert conversación — funciona aunque engage haya fallado y no la haya creado
  await prisma.conversacion.upsert({
    where: { leadId: lead.id },
    create: {
      leadId: lead.id,
      mensajes,
      estado: estado === 'CALIFICADO' || estado === 'NO_CALIFICADO' ? 'COMPLETADA' : 'ACTIVA',
    },
    update: {
      mensajes,
      estado: estado === 'CALIFICADO' || estado === 'NO_CALIFICADO' ? 'COMPLETADA' : 'ACTIVA',
    },
  });

  // Determinar nuevo estado del lead
  let nuevoEstado;
  if (estado === 'CALIFICADO' || estado === 'NO_CALIFICADO') {
    nuevoEstado = estado;
  } else if (turnosUsuario >= MAX_TURNOS) {
    // Turnos agotados: el asistente ya ofreció agendar en el prompt, marcamos calificado parcial
    nuevoEstado = 'CALIFICADO';
  } else {
    nuevoEstado = 'EN_CONVERSACION';
  }

  const updateData = {
    estado: nuevoEstado,
    ultimoContacto: new Date(),
  };
  if (tipoBuyer) updateData.tipoBuyer = tipoBuyer;
  if (pieEstimado) updateData.pieEstimado = pieEstimado;
  if (disponibilidad) updateData.disponibilidad = disponibilidad;

  await prisma.lead.update({ where: { id: lead.id }, data: updateData });
  console.log(`[QUALIFY] Lead ${lead.id} → ${nuevoEstado} (turno ${turnosUsuario}/${MAX_TURNOS})`);

  // Asignar broker si calificó
  if (nuevoEstado === 'CALIFICADO') {
    await router.asignarBroker(lead.id, lead.tenantId);
  }

  return respuestaIA;
}

function buildSystemPrompt(lead, turnoActual) {
  const urgente = turnoActual >= MAX_TURNOS - 1;

  return `Eres un asistente de LoopOn, una empresa inmobiliaria. Tu objetivo es entender si esta persona está lista para hablar con un asesor. Sé cálido, breve y directo. Nunca presiones. Habla en español chileno informal.

Debes hacer estas 3 preguntas en orden, de forma conversacional. UNA por mensaje:
1. ¿Estás buscando para vivir tú mismo o como inversión?
2. ¿Tienes una idea de cuánto tienes disponible de pie?
3. ¿Cuándo te acomoda conversar 15 minutos con un asesor?

${urgente ? 'Es el último turno disponible. Si tienes las 3 respuestas o ya hay suficiente información, cierra ofreciendo agendar directamente.' : ''}

Cuando tengas las 3 respuestas, incluye al FINAL de tu mensaje (sin explicar que lo haces):
[CALIFICADO: {"tipoBuyer":"inversor|vivienda","pieEstimado":"texto libre","disponibilidad":"texto libre"}]

Si el lead no tiene interés real, presupuesto, o claramente no califica, incluye al FINAL:
[NO_CALIFICADO]

Contexto del lead:
- Comentó en ${lead.plataforma}: "${lead.comentario}"
- Score de intención: ${lead.score}/10`;
}

function extraerDatos(texto) {
  // Buscar [CALIFICADO: {...}] — acepta variaciones de espacios y saltos de línea
  const matchCalificado = texto.match(/\[CALIFICADO:\s*(\{[\s\S]*?\})\]/);
  if (matchCalificado) {
    try {
      const datos = JSON.parse(matchCalificado[1]);
      return {
        estado: 'CALIFICADO',
        tipoBuyer: datos.tipoBuyer || null,
        pieEstimado: datos.pieEstimado || null,
        disponibilidad: datos.disponibilidad || null,
      };
    } catch {
      // JSON malformado pero Claude indicó que calificó
      return { estado: 'CALIFICADO', tipoBuyer: null, pieEstimado: null, disponibilidad: null };
    }
  }

  if (texto.includes('[NO_CALIFICADO]')) {
    return { estado: 'NO_CALIFICADO', tipoBuyer: null, pieEstimado: null, disponibilidad: null };
  }

  return { estado: null, tipoBuyer: null, pieEstimado: null, disponibilidad: null };
}

module.exports = { procesarRespuesta };
