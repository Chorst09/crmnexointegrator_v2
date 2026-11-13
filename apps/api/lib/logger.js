import winston from 'winston';

const logDir = './logs';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'crmnexointegrator-api' },
  transports: [
    new winston.transports.File({ filename: `${logDir}/app.log`, level: 'error' }),
    new winston.transports.File({ filename: `${logDir}/combined.log` })
  ]
});

// If we're not in production then also log to the console with a simple format.
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

export default logger;
