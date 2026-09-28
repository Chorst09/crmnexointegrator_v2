module.exports = {
  apps: [
    {
      name: 'crm-api',
      script: './apps/api/server.cjs',
      cwd: '/var/www/crm-comercial',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 8081
      },
      error_file: '/var/log/crm-api-error.log',
      out_file: '/var/log/crm-api-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      ignore_watch: ['node_modules', 'dist', 'uploads'],
      env_production: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'crm-web',
      script: 'npm',
      args: 'run preview',
      cwd: '/var/www/crm-comercial/apps/web',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/var/log/crm-web-error.log',
      out_file: '/var/log/crm-web-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ],

  deploy: {
    production: {
      user: 'root',
      host: 'seu-servidor.com',
      ref: 'origin/main',
      repo: 'https://github.com/seu-usuario/crm-comercial.git',
      path: '/var/www/crm-comercial',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production'
    }
  }
};
