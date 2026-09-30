function getRequiredEnv(name) {
  const value = String(process.env[name] || '').trim();
  if (!value) {
    throw new Error(`${name} precisa estar configurado`);
  }
  return value;
}

function getJwtSecret() {
  return getRequiredEnv('JWT_SECRET');
}

module.exports = {
  getRequiredEnv,
  getJwtSecret
};
