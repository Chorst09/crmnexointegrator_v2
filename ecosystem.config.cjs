module.exports = {
  apps: [{
    name: 'crmnexointegrator_v2',
    script: 'backend/server.js',
    cwd: '/var/www/crmnexointegrator_v2',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3025,
      DATABASE_URL: 'postgresql://nexoscrm:NexosCRM%402024%21@localhost:5433/nexoscrm?schema=public',
      JWT_SECRET: 'CRM_Nexo_Integrator_JWT_Secret_Key_v2_Production',
      CORS_ORIGIN: 'http://209.50.241.25:3025,http://209.50.241.25,https://nexos.chorstconsult.com.br,https://nexosv2.chorstconsult.com.br,http://nexos.chorstconsult.com.br,http://nexosv2.chorstconsult.com.br',
      BCRYPT_ROUNDS: 12
    }
  }]
};
