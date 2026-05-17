// ─────────────────────────────────────────────────────────────────────────────
// FILE: server.ts
// This is the ENTRY POINT of the backend. Think of it as the "power button" of
// the API. It does three things: starts listening for incoming requests, logs
// that it's alive, and knows how to shut down cleanly without losing data.
// ─────────────────────────────────────────────────────────────────────────────

import 'dotenv/config';
import { config } from '@config/index';
import { logger } from '@utils/logger';
import { prisma } from '@config/database';
import app from './app';

// Start the Express web server on the configured port (default: 8000).
// Once it's up, log a message so we know it's running.
const server = app.listen(config.PORT, () => {
  logger.info({ message: `EQC Backend API running`, port: config.PORT, env: config.NODE_ENV });
});

// Graceful shutdown: when the server receives a "stop" signal (e.g. from
// the Azure cloud platform or Ctrl+C), we stop accepting new requests,
// wait for in-progress requests to finish, then close the DB connection.
// The 10-second timeout is a safety net — if shutdown hangs, force-exit.
async function shutdown(signal: string): Promise<void> {
  logger.info({ message: `${signal} received — shutting down gracefully` });
  server.close(async () => {
    await prisma.$disconnect();
    logger.info({ message: 'Server closed' });
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

// Listen for OS-level kill signals. SIGTERM is sent by hosting platforms
// (Azure App Service) during deployments. SIGINT is Ctrl+C in the terminal.
process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
