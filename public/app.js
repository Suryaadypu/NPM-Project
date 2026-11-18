const scenarioLabels = {
  success: 'Successful request',
  flaky: 'Flaky API request',
  failure: 'Permanent failure',
  slow: 'Timeout scenario',
};

const elements = {
  total: document.querySelector('#total-operations'),
  successful: document.querySelector('#successful-operations'),
  failed: document.querySelector('#failed-operations'),
  retries: document.querySelector('#retry-attempts'),
  average: document.querySelector('#average-time'),
  successRate: document.querySelector('#success-rate'),
  config: document.querySelector('#retry-config'),
  activity: document.querySelector('#activity-body'),
  activityCount: document.querySelector('#activity-count'),
  timeline: document.querySelector('#timeline'),
  timelineTotal: document.querySelector('#timeline-total'),
  status: document.querySelector('#run-status'),
  toast: document.querySelector('#toast'),
};

let running = false;

document.querySelector('#scenario-buttons').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-scenario]');
  if (!button || running) return;
  await runScenario(button.dataset.scenario);
});

document.querySelector('#reset-button').addEventListener('click', async () => {
  if (running || !window.confirm('Clear all in-memory dashboard statistics and recent activity?')) return;
  try {
    await requestJson('/api/stats/reset', { method: 'POST' });
    renderTimeline(null);
    setStatus('Statistics reset. Run a scenario to create new activity.');
    hideToast();
    await refreshStats();
  } catch (error) {
    showToast(error.message);
  }
});

async function runScenario(scenario) {
  running = true;
  toggleScenarioButtons(true);
  setStatus(`Running ${scenarioLabels[scenario]} with RetryFlow…`, 'is-running');
  hideToast();
  try {
    const result = await requestJson(`/api/demo/run?scenario=${encodeURIComponent(scenario)}`);
    renderTimeline(result);
    setStatus(result.status === 'success'
      ? `${scenarioLabels[scenario]} completed in ${result.totalAttempts} attempt${result.totalAttempts === 1 ? '' : 's'}.`
      : `${scenarioLabels[scenario]} reached its retry limit after ${result.totalAttempts} attempts.`);
    await refreshStats();
  } catch (error) {
    setStatus('The request could not be completed.', 'is-error');
    showToast(error.message);
  } finally {
    running = false;
    toggleScenarioButtons(false);
  }
}

async function requestJson(url, options) {
  const response = await fetch(url, { headers: { Accept: 'application/json' }, ...options });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed with status ${response.status}.`);
  return payload;
}

async function refreshStats() {
  const stats = await requestJson('/api/stats');
  elements.total.textContent = stats.totalOperations;
  elements.successful.textContent = stats.successfulOperations;
  elements.failed.textContent = stats.failedOperations;
  elements.retries.textContent = stats.totalRetryAttempts;
  elements.average.textContent = formatNumber(stats.averageExecutionTimeMs);
  elements.successRate.textContent = `${stats.successPercentage}% success rate`;
  renderConfig(stats.retryConfig);
  renderActivity(stats.recentOperations);
}

function renderConfig(config) {
  const rows = [
    ['Maximum retries', config.retries],
    ['Initial delay', `${config.minDelayMs} ms`],
    ['Maximum delay', `${config.maxDelayMs} ms`],
    ['Backoff factor', `${config.factor}×`],
    ['Per-attempt timeout', `${config.timeoutMs} ms`],
    ['Jitter strategy', config.jitter],
  ];
  elements.config.innerHTML = rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('');
}

function renderActivity(operations) {
  elements.activityCount.textContent = `${operations.length} event${operations.length === 1 ? '' : 's'}`;
  if (!operations.length) {
    elements.activity.innerHTML = '<tr class="empty-row"><td colspan="6">No operations recorded yet.</td></tr>';
    return;
  }
  elements.activity.innerHTML = operations.map((operation) => `
    <tr>
      <td><span class="operation-id">${escapeHtml(operation.operationId.slice(0, 8))}</span></td>
      <td>${escapeHtml(scenarioLabels[operation.scenario] || operation.scenario)}</td>
      <td>${operation.attempts} <span class="muted-cell">(${operation.retryCount} retries)</span></td>
      <td><span class="status-pill ${operation.status}">${operation.status === 'success' ? 'Success' : 'Failed'}</span></td>
      <td>${formatNumber(operation.durationMs)} ms</td>
      <td>${formatTime(operation.createdAt)}</td>
    </tr>`).join('');
}

function renderTimeline(operation) {
  if (!operation) {
    elements.timelineTotal.textContent = 'No run yet';
    elements.timeline.className = 'timeline-empty';
    elements.timeline.innerHTML = '<span class="empty-mark">⌁</span><strong>Waiting for a scenario</strong><span>Attempt details will appear here after a run.</span>';
    return;
  }
  elements.timelineTotal.textContent = `${operation.totalAttempts} attempt${operation.totalAttempts === 1 ? '' : 's'} · ${formatNumber(operation.totalExecutionTimeMs)} ms`;
  elements.timeline.className = 'timeline-list';
  elements.timeline.innerHTML = operation.attempts.map((attempt) => {
    const succeeded = attempt.status === 'success';
    const detail = succeeded ? 'Mock service returned a successful response.' : (attempt.error?.message || 'Request failed.');
    const retry = attempt.delayBeforeNextAttemptMs === null ? '' : ` · next retry in ${attempt.delayBeforeNextAttemptMs} ms`;
    return `<div class="attempt-row ${succeeded ? 'success' : 'failure'}">
      <span class="attempt-number">${attempt.attempt}</span>
      <div class="attempt-main"><div class="attempt-title">${succeeded ? 'Attempt succeeded' : 'Attempt failed'}</div><div class="attempt-detail">${escapeHtml(detail)}${escapeHtml(retry)}</div></div>
      <span class="attempt-meta">${formatNumber(attempt.durationMs)} ms</span>
    </div>`;
  }).join('');
}

function toggleScenarioButtons(disabled) {
  document.querySelectorAll('[data-scenario]').forEach((button) => { button.disabled = disabled; });
}

function setStatus(message, className = '') {
  elements.status.textContent = message;
  elements.status.className = `inline-status ${className}`.trim();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.hidden = false;
}

function hideToast() { elements.toast.hidden = true; }
function formatNumber(value) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 }); }
function formatTime(value) { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)); }
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

refreshStats().catch((error) => {
  setStatus('Dashboard data could not be loaded.', 'is-error');
  showToast(error.message);
});
