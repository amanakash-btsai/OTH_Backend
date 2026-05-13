import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '@config/index';
import { requestLogger } from '@middleware/requestLogger.middleware';
import { errorHandler } from '@middleware/errorHandler.middleware';
import apiRouter from './routes/index';

const app = express();

// Security headers
app.use(helmet());

// CORS — allow only the configured frontend origin
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging
app.use(requestLogger);

// API routes
app.use('/api', apiRouter);

// Global error handler (must be last)
app.use(errorHandler);

export default app;
