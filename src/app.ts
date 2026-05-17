// ─────────────────────────────────────────────────────────────────────────────
// FILE: app.ts
// This file assembles the Express application — think of it as "wiring up the
// building". It stacks security layers, teaches the app how to read incoming
// data, hooks up all the API routes, and installs the safety net that catches
// any unexpected errors. server.ts then takes this assembled app and actually
// starts it listening on a port.
// ─────────────────────────────────────────────────────────────────────────────

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '@config/index';
import { requestLogger } from '@middleware/requestLogger.middleware';
import { errorHandler } from '@middleware/errorHandler.middleware';
import apiRouter from './routes/index';

const app = express();

// ── Diagnostic catch-all — remove after debugging ─────────────────────────────
app.use((req, _res, next) => {
  if (req.path.includes('webhooks') || req.path.includes('teams') || req.method === 'POST') {
    console.log(`[AppRaw] ${req.method} ${req.path} | Content-Type: ${req.headers['content-type'] ?? 'none'} | Auth: ${req.headers.authorization ? 'present' : 'MISSING'}`);
  }
  next();
});
// ─────────────────────────────────────────────────────────────────────────────

// Helmet automatically sets secure HTTP response headers (e.g. prevents
// browsers from sniffing content types, blocks clickjacking attacks).
// Think of it as putting a security camera and lock on the front door.
app.use(helmet());

// CORS (Cross-Origin Resource Sharing) — browsers block requests from one
// website to another unless the server explicitly allows it. This says:
// "only the configured frontend URL is allowed to call this API."
// The `credentials: true` part is needed so cookies (refresh token) flow through.
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Body parsers: teaches Express how to read the data sent in request bodies.
// JSON parser handles {key: value} payloads. urlencoded handles HTML form data.
// cookieParser reads HTTP cookies (used for the refresh token).
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Log every incoming request (method, path, response time) to the console / log sink.
app.use(requestLogger);

// Mount all API routes under the /api prefix (e.g. /api/auth/login, /api/assets).
app.use('/api', apiRouter);

// Global error handler — must be the LAST middleware. Any error thrown inside
// a route handler bubbles up here and gets turned into a clean JSON response
// instead of crashing the server.
app.use(errorHandler);

export default app;
