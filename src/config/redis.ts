import IORedis from 'ioredis';
import { logger } from '@utils/logger';

export const redisConnection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

redisConnection.on('error', (err) => {
  logger.error({ message: 'Redis connection error', error: err.message });
});
