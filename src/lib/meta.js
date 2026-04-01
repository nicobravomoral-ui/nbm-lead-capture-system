const axios = require('axios');

const BASE_URL = 'https://graph.facebook.com/v19.0';

function metaError(err) {
  const data = err.response?.data?.error;
  if (data) {
    return new Error(`Meta API [${data.code}] ${data.type}: ${data.message}`);
  }
  return err;
}

/**
 * Responde públicamente a un comentario en Instagram o Facebook.
 */
async function replyComment(commentId, message, accessToken) {
  try {
    await axios.post(`${BASE_URL}/${commentId}/replies`, {
      message,
      access_token: accessToken,
    });
  } catch (err) {
    throw metaError(err);
  }
}

/**
 * Envía un mensaje directo (DM) a un usuario de Instagram.
 * @param {string} igUserId     ID de la cuenta de negocio IG
 * @param {string} recipientId  IGSID del usuario destinatario
 * @param {string} message
 * @param {string} accessToken
 */
async function sendDM(igUserId, recipientId, message, accessToken) {
  try {
    const { data } = await axios.post(`${BASE_URL}/${igUserId}/messages`, {
      recipient: { id: recipientId },
      message: { text: message },
      access_token: accessToken,
    });
    return data;
  } catch (err) {
    throw metaError(err);
  }
}

/**
 * Obtiene el perfil público de un usuario de Instagram por IGSID.
 */
async function getIGUserProfile(igScopedId, accessToken) {
  try {
    const { data } = await axios.get(`${BASE_URL}/${igScopedId}`, {
      params: { fields: 'name,username', access_token: accessToken },
    });
    return data;
  } catch (err) {
    throw metaError(err);
  }
}

module.exports = { replyComment, sendDM, getIGUserProfile };
