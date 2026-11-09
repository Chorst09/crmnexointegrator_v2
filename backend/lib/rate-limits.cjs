const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');

// Verify the signature before using an identity; arbitrary tokens must not
// create new buckets. Tokens renewed for the same user share the same quota.
function requestKey(req) {
  const token = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization || '')?.[1];
  if (token && process.env.JWT_SECRET) {
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const userId = payload.userId || payload.id;
      if (typeof userId === 'string' && userId) return `user:${userId}`;
    } catch {
      // Invalid/expired tokens retain the anonymous IP quota.
    }
  }
  return `ip:${req.ip}`;
}

function createRateLimits({ apiMax = 1000, authMax = 50 } = {}) {
  const common = { standardHeaders: true, legacyHeaders: false };
  return {
    apiLimiter: rateLimit({
      ...common,
      windowMs: 60 * 1000,
      max: apiMax,
      keyGenerator: requestKey,
      // Login has its own independent brute-force protection. OPTIONS and
      // monitoring must not consume the quota used by CRM operations.
      skip: req => req.method === 'OPTIONS' || /^\/(?:auth\/login|health)\/?$/i.test(req.path),
      message: { error: 'Muitas requisições. Aguarde um minuto e tente novamente.' }
    }),
    authLimiter: rateLimit({
      ...common,
      windowMs: 15 * 60 * 1000,
      max: authMax,
      skip: req => req.method !== 'POST',
      skipSuccessfulRequests: true,
      message: { error: 'Muitas tentativas de login. Aguarde 15 minutos.' }
    })
  };
}

module.exports = { createRateLimits, requestKey };
