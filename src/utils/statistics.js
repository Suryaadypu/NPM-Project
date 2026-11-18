import { maxRecentOperations } from '../config.js';

export function createStatistics() {
  let operations = [];

  return {
    record(operation) {
      operations = [operation, ...operations].slice(0, maxRecentOperations);
    },

    reset() {
      operations = [];
    },

    snapshot(retryConfig) {
      const totalOperations = operations.length;
      const successfulOperations = operations.filter((item) => item.status === 'success').length;
      const failedOperations = totalOperations - successfulOperations;
      const totalRetryAttempts = operations.reduce((sum, item) => sum + item.retryCount, 0);
      const totalDurationMs = operations.reduce((sum, item) => sum + item.durationMs, 0);

      return {
        totalOperations,
        successfulOperations,
        failedOperations,
        totalRetryAttempts,
        averageExecutionTimeMs: totalOperations ? round(totalDurationMs / totalOperations) : 0,
        successPercentage: totalOperations ? round((successfulOperations / totalOperations) * 100) : 0,
        recentOperations: operations,
        retryConfig,
      };
    },
  };
}

function round(value) {
  return Math.round(value * 100) / 100;
}
