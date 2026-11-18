export const retryConfig = Object.freeze({
  retries: 3,
  minDelayMs: 150,
  maxDelayMs: 600,
  factor: 2,
  jitter: 'none',
  timeoutMs: 350,
});

export const allowedScenarios = Object.freeze(['success', 'flaky', 'failure', 'slow']);
export const maxRecentOperations = 50;
