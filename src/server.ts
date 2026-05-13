import 'dotenv/config';
import { config } from '@config/index';
import { logger } from '@utils/logger';
import { prisma } from '@config/database';
import app from './app';

const server = app.listen(config.PORT, () => {
  logger.info({ message: `EQC Backend API running`, port: config.PORT, env: config.NODE_ENV });
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ message: `${signal} received — shutting down gracefully` });
  server.close(async () => {
    await prisma.$disconnect();
    logger.info({ message: 'Server closed' });
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
