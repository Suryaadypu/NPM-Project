import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { Router } from 'express';
import { RetryError, retry } from 'retryflow-lite';
import { allowedScenarios, retryConfig } from '../config.js';
import { callMockApi } from '../services/mock-api.service.js';

export function createDemoRouter(statistics) {
  const router = Router();

  router.get('/run', async (req, res, next) => {
    const scenario = req.query.scenario;
    if (typeof scenario !== 'string' || !allowedScenarios.includes(scenario)) {
      return res.status(400).json({
        error: 'Invalid scenario.',
        allowedScenarios,
      });
    }

    const operationId = randomUUID();
    const attempts = [];
    const startedAt = performance.now();
    let result;

    try {
      result = await retry(async ({ attempt, signal }) => {
        const attemptStartedAt = performance.now();
        const entry = { attempt, status: 'running', durationMs: 0, error: null, delayBeforeNextAttemptMs: null };
        attempts.push(entry);

        try {
          const value = await callMockApi(scenario, attempt, signal);
          entry.status = 'success';
          entry.durationMs = elapsed(attemptStartedAt);
          return value;
        } catch (error) {
          entry.status = 'failure';
          entry.durationMs = elapsed(attemptStartedAt);
          entry.error = { name: error.name, message: error.message, code: error.code ?? null };
          throw error;
        }
      }, {
        ...retryConfig,
        onRetry: (_error, { attempt, delayMs }) => {
          const failedAttempt = attempts.find((entry) => entry.attempt === attempt);
          if (failedAttempt) failedAttempt.delayBeforeNextAttemptMs = delayMs;
        },
      });

      return finish('success', result, null);
    } catch (error) {
      if (!(error instanceof RetryError)) return next(error);
      const cause = error.cause;
      const details = {
        name: error.name,
        message: error.message,
        attempts: error.attempts,
        cause: cause ? { name: cause.name, message: cause.message, code: cause.code ?? null } : null,
      };
      return finish('failure', null, details);
    }

    function finish(status, value, error) {
      const durationMs = elapsed(startedAt);
      const retryCount = Math.max(0, attempts.length - 1);
      const response = {
        operationId,
        scenario,
        status,
        result: value,
        totalAttempts: attempts.length,
        retryCount,
        totalExecutionTimeMs: durationMs,
        retryDelayHistoryMs: attempts
          .filter((attempt) => attempt.delayBeforeNextAttemptMs !== null)
          .map((attempt) => attempt.delayBeforeNextAttemptMs),
        attempts,
        error,
      };

      statistics.record({
        operationId,
        scenario,
        attempts: attempts.length,
        retryCount,
        status,
        durationMs,
        createdAt: new Date().toISOString(),
      });
      return res.json(response);
    }
  });

  return router;
}

function elapsed(startedAt) {
  return Math.round((performance.now() - startedAt) * 100) / 100;
}
