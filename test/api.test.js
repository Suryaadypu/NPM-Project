import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

before(async () => {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

beforeEach(async () => {
  await fetch(`${baseUrl}/api/stats/reset`, { method: 'POST' });
});

async function json(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  return { response, body: await response.json() };
}

test('serves the dashboard and health endpoint', async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /RetryFlow Dashboard/);

  const health = await json('/api/health');
  assert.equal(health.response.status, 200);
  assert.equal(health.body.status, 'ok');
});

test('validates unknown scenario values', async () => {
  const { response, body } = await json('/api/demo/run?scenario=unknown');
  assert.equal(response.status, 400);
  assert.deepEqual(body.allowedScenarios, ['success', 'flaky', 'failure', 'slow']);
});

test('runs the success scenario on the first attempt', async () => {
  const { response, body } = await json('/api/demo/run?scenario=success');
  assert.equal(response.status, 200);
  assert.equal(body.status, 'success');
  assert.equal(body.totalAttempts, 1);
  assert.equal(body.retryCount, 0);
  assert.equal(body.attempts[0].status, 'success');
});

test('retries a flaky operation and recovers', async () => {
  const { body } = await json('/api/demo/run?scenario=flaky');
  assert.equal(body.status, 'success');
  assert.equal(body.totalAttempts, 3);
  assert.equal(body.retryCount, 2);
  assert.deepEqual(body.attempts.map((attempt) => attempt.status), ['failure', 'failure', 'success']);
  assert.deepEqual(body.retryDelayHistoryMs, [150, 300]);
});

test('stops a permanent failure after the configured retry limit', async () => {
  const { body } = await json('/api/demo/run?scenario=failure');
  assert.equal(body.status, 'failure');
  assert.equal(body.totalAttempts, 4);
  assert.equal(body.retryCount, 3);
  assert.equal(body.error.cause.code, 'MOCK_UNAVAILABLE');
});

test('demonstrates per-attempt timeout exhaustion', async () => {
  const { body } = await json('/api/demo/run?scenario=slow');
  assert.equal(body.status, 'failure');
  assert.equal(body.totalAttempts, 4);
  assert.equal(body.error.cause.name, 'RetryTimeoutError');
  assert.ok(body.attempts.every((attempt) => attempt.status === 'failure'));
  assert.match(body.attempts[0].error.message, /per-attempt timeout/);
});

test('updates statistics and resets history', async () => {
  await json('/api/demo/run?scenario=success');
  await json('/api/demo/run?scenario=flaky');

  const stats = await json('/api/stats');
  assert.equal(stats.body.totalOperations, 2);
  assert.equal(stats.body.successfulOperations, 2);
  assert.equal(stats.body.failedOperations, 0);
  assert.equal(stats.body.totalRetryAttempts, 2);
  assert.equal(stats.body.successPercentage, 100);
  assert.equal(stats.body.recentOperations.length, 2);
  assert.equal(stats.body.retryConfig.timeoutMs, 350);

  const reset = await json('/api/stats/reset', { method: 'POST' });
  assert.equal(reset.body.totalOperations, 0);
  assert.equal(reset.body.recentOperations.length, 0);
});

test('keeps concurrent operations separate in the activity log', async () => {
  const results = await Promise.all([
    json('/api/demo/run?scenario=success'),
    json('/api/demo/run?scenario=flaky'),
  ]);
  assert.ok(results.every(({ response }) => response.ok));

  const stats = await json('/api/stats');
  assert.equal(stats.body.totalOperations, 2);
  assert.equal(stats.body.successfulOperations, 2);
  assert.equal(stats.body.totalRetryAttempts, 2);
  assert.equal(new Set(stats.body.recentOperations.map((item) => item.operationId)).size, 2);
});

test('returns a safe JSON 404 for unknown routes', async () => {
  const { response, body } = await json('/api/not-a-route');
  assert.equal(response.status, 404);
  assert.deepEqual(body, { error: 'Route not found.' });
  assert.equal('stack' in body, false);
});
