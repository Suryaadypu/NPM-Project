import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDemoRouter } from './routes/demo.routes.js';
import { createStatsRouter } from './routes/stats.routes.js';
import { createStatistics } from './utils/statistics.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export function createApp({ statistics = createStatistics() } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '16kb' }));
  app.use(express.static(path.resolve(currentDirectory, '../public'), { index: 'index.html' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'retryflow-demo', timestamp: new Date().toISOString() });
  });
  app.use('/api/demo', createDemoRouter(statistics));
  app.use('/api/stats', createStatsRouter(statistics));

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found.' });
  });

  app.use((error, _req, res, _next) => {
    console.error('Request failed:', error.message);
    res.status(500).json({ error: 'The request could not be completed.' });
  });

  return app;
}
