function abortError(signal) {
  const error = new Error('The simulated request was aborted after its per-attempt timeout.');
  error.name = 'AbortError';
  error.cause = signal?.reason;
  return error;
}

function wait(ms, signal) {
  if (signal?.aborted) return Promise.reject(abortError(signal));

  return new Promise((resolve, reject) => {
    const cleanup = () => signal?.removeEventListener('abort', onAbort);
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(abortError(signal));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function upstreamError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

export async function callMockApi(scenario, attempt, signal) {
  if (scenario === 'success') {
    await wait(70, signal);
    return { message: 'The mock service responded successfully.', source: 'controlled-mock-api' };
  }

  if (scenario === 'flaky') {
    await wait(90, signal);
    if (attempt < 3) {
      throw upstreamError(`Temporary upstream failure on attempt ${attempt}.`, 'MOCK_TEMPORARY');
    }
    return { message: 'The mock service recovered on attempt 3.', source: 'controlled-mock-api' };
  }

  if (scenario === 'failure') {
    await wait(80, signal);
    throw upstreamError('The mock service is unavailable.', 'MOCK_UNAVAILABLE');
  }

  if (scenario === 'slow') {
    await wait(2_000, signal);
    return { message: 'This response should not arrive before the timeout.', source: 'controlled-mock-api' };
  }

  throw new TypeError(`Unsupported mock scenario: ${scenario}`);
}
