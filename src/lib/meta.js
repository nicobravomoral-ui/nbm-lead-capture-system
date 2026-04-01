const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com/v19.0';

/**
 * Responde públicamente a un comentario en Instagram o Facebook.
 * @param {string} commentId
 * @param {string} message
 * @param {string} accessToken
 */
async function replyComment(commentId, message, accessToken) {
  await axios.post(`${BASE_URL}/${commentId}/replies`, {
    message,
    access_token: accessToken,
  });
}

/**
 * Envía un mensaje directo (DM) a un usuario de Instagram.
 * @param {string} igUserId   ID de la cuenta de negocio IG
 * @param {string} recipientId  IGSID del usuario destinatario
 * @param {string} message
 * @param {string} accessToken
 */
async function sendDM(igUserId, recipientId, message, accessToken) {
  await axios.post(`${BASE_URL}/${igUserId}/messages`, {
    recipient: { id: recipientId },
    message: { text: message },
    access_token: accessToken,
  });
}

/**
 * Obtiene el perfil público de un usuario de Instagram por IGSID.
 * @param {string} igScopedId
 * @param {string} accessToken
 * @returns {Promise<{name: string, username: string}>}
 */
async function getIGUserProfile(igScopedId, accessToken) {
  const { data } = await axios.get(`${BASE_URL}/${igScopedId}`, {
    params: {
      fields: 'name,username',
      access_token: accessToken,
    },
  });
  return data;
}

module.exports = { replyComment, sendDM, getIGUserProfile };
