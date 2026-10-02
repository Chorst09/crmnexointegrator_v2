const CHORST_EMAIL = 'chorstconsult@gmail.com';
const CHORST_USER_ID = '0135bec0-498b-450b-86f6-c2a714014f3f';
const CARLOS_MASTER_EMAIL = 'carlos.horst@doubletelecom.com.br';

function normalizeEmail(val) {
  return String(val || '').trim().toLowerCase();
}

/**
 * Retorna verdadeiro se o usuário atual tem permissão para visualizar dados do usuário chorstconsult@gmail.com.
 * Regra do sistema: SOMENTE carlos.horst@doubletelecom.com.br (e o próprio chorstconsult@gmail.com) têm essa permissão.
 */
function canAccessChorstData(user = {}) {
  const email = normalizeEmail(user?.email);
  return email === CARLOS_MASTER_EMAIL || email === CHORST_EMAIL;
}

/**
 * Verifica se um email ou ID corresponde ao usuário chorstconsult@gmail.com
 */
function isChorstUser(target = '') {
  const norm = normalizeEmail(target);
  return norm === CHORST_EMAIL || norm === CHORST_USER_ID;
}

module.exports = {
  CHORST_EMAIL,
  CHORST_USER_ID,
  CARLOS_MASTER_EMAIL,
  canAccessChorstData,
  isChorstUser
};
