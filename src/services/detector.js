// Keywords por defecto en español chileno
const DEFAULT_KEYWORDS = {
  alta_intencion: [
    'precio', 'valor', 'cuánto vale', 'cuanto vale',
    'me interesa', 'información', 'informacion', 'info',
    'requisitos', 'pie', 'dividendo', 'quiero comprar',
    'quiero invertir', 'disponible', 'unidades',
  ],
  media_intencion: [
    'dónde queda', 'donde queda', 'cuándo entrega',
    'cuando entrega', 'quedan unidades', 'buen negocio',
    'conviene', 'rentable', 'me llama', 'contacto',
  ],
  baja_intencion: [
    'hermoso', 'precioso', 'ojalá', 'ojala',
    'algún día', 'algun dia', 'sueño', 'lindo',
  ],
};

/**
 * Calcula el score de intención de compra (1-10) para un comentario.
 * @param {string} texto          Comentario del usuario
 * @param {string[]|null} tenantKeywords  Keywords personalizadas del tenant (alta intención)
 * @returns {number} score 1-10, o 0 si no hay señal
 */
function calcularScore(texto, tenantKeywords = null) {
  const normalizado = texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const keywords = tenantKeywords
    ? buildKeywordsFromTenant(tenantKeywords)
    : DEFAULT_KEYWORDS;

  let score = 0;
  let hits = 0;

  for (const kw of keywords.alta_intencion) {
    if (normalizado.includes(normalize(kw))) {
      score += 3;
      hits++;
    }
  }

  for (const kw of keywords.media_intencion) {
    if (normalizado.includes(normalize(kw))) {
      score += 2;
      hits++;
    }
  }

  for (const kw of keywords.baja_intencion) {
    if (normalizado.includes(normalize(kw))) {
      score += 1;
      hits++;
    }
  }

  if (hits === 0) return 0;

  // Clamp entre 1 y 10
  return Math.min(10, Math.max(1, score));
}

/**
 * Cuando el tenant tiene keywords propias, se tratan todas como alta intención.
 */
function buildKeywordsFromTenant(tenantKeywords) {
  return {
    alta_intencion: tenantKeywords,
    media_intencion: DEFAULT_KEYWORDS.media_intencion,
    baja_intencion: DEFAULT_KEYWORDS.baja_intencion,
  };
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = { calcularScore };
