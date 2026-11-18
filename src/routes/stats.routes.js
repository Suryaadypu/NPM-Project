import { Router } from 'express';
import { retryConfig } from '../config.js';

export function createStatsRouter(statistics) {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json(statistics.snapshot(retryConfig));
  });

  router.post('/reset', (_req, res) => {
    statistics.reset();
    res.json({ message: 'Demo statistics have been reset.', ...statistics.snapshot(retryConfig) });
  });

  return router;
}
