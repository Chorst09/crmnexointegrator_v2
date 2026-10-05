module.exports = {
  apps: [
    {
      name: "crmnexointegrator_v2",
      script: "./backend/server.js",
      cwd: "/var/www/crmnexointegrator_v2",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: "production",
        PORT: "3025",
        HOST: "0.0.0.0",
        DATABASE_URL: "postgresql://nexoscrm:NexosCRM%402024%21@localhost:5433/nexoscrm?schema=public",
        JWT_SECRET: "CRM_Nexo_Integrator_JWT_Secret_Key_v2_Production",
        JWT_EXPIRES_IN: "7d",
        JWT_REFRESH_SECRET: "CRM_Nexo_Integrator_Refresh_Secret_Key_v2_Production",
        JWT_REFRESH_EXPIRES_IN: "30d",
        BCRYPT_ROUNDS: "12",
        SESSION_SECRET: "CRM_Nexo_Integrator_Session_Secret_v2_2026",
        CORS_ORIGIN: "http://209.50.241.25:3025,http://209.50.241.25,https://nexos.chorstconsult.com.br,https://nexosv2.chorstconsult.com.br,http://nexos.chorstconsult.com.br,http://nexosv2.chorstconsult.com.br",
        MAX_FILE_SIZE: "10485760",
        UPLOAD_PATH: "./uploads",
        LOG_LEVEL: "info",
        LOG_FILE: "logs/app.log"
      }
    }
  ]
};
