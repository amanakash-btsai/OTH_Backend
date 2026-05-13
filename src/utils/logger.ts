import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    isProduction ? json() : combine(colorize(), simple()),
  ),
  transports: [new winston.transports.Console()],
});
