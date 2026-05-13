import { Response } from 'express';
import { PaginationMeta } from '@types/api.types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200): void {
  res.status(statusCode).json({ success: true, data });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): void {
  res.status(200).json({ success: true, data, pagination });
}
