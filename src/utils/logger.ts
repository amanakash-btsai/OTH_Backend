// ─────────────────────────────────────────────────────────────────────────────
// FILE: utils/logger.ts
// Shared logger instance (Winston) used everywhere in the backend.
//
// In development: output is colourised human-readable text in the terminal.
// In production:  output is structured JSON, one line per log event — this
//                 format is what Azure Application Insights and log aggregators
//                 (Datadog, Splunk) expect to parse automatically.
//
// Usage: logger.info({ message: '...', userId: '...' })
//        logger.error({ message: '...', error: err })
// ─────────────────────────────────────────────────────────────────────────────

import winston from 'winston';

const { combine, timestamp, json, colorize, simple, errors } = winston.format;

const isProduction = process.env.NODE_ENV === 'production';

// errors({ stack: true }) ensures that Error objects include their stack trace.
// timestamp() adds an ISO timestamp to every log line.
// json() emits { level, message, timestamp } as a single JSON string per line.
// colorize() + simple() prints nicely coloured human-readable lines in dev.
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    errors({ stack: true }),
    timestamp(),
    isProduction ? json() : combine(colorize(), simple()),
  ),
  transports: [new winston.transports.Console()],
});
