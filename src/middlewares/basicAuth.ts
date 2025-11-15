import { NextFunction, Request, Response } from 'express';
import { env } from '../constants/env';

export function serviceBasicAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const expectedHeader = (env.SERVICE_BASIC_AUTH || '').trim();
  if (expectedHeader.length === 0) {
    next();
    return;
  }
  const header =
    req.header('authorization') || req.header('Authorization') || '';
  if (header !== expectedHeader) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  next();
}
