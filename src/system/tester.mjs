/**
 * HTTP endpoint tester using the native fetch API (Node 18+).
 */

const TIMEOUT_MS = 6000;

/**
 * Test a single endpoint.
 * @param {string} baseUrl  - e.g. "http://localhost:3000"
 * @param {object} endpoint - { method, path, requiresAuth, exampleBody }
 */
export async function testEndpoint(baseUrl, endpoint) {
  const url   = `${baseUrl}${endpoint.path}`;
  const start = Date.now();

  try {
    const opts = {
      method:  endpoint.method,
      headers: { 'Content-Type': 'application/json' },
      signal:  AbortSignal.timeout(TIMEOUT_MS),
    };

    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method) && endpoint.exampleBody) {
      opts.body = JSON.stringify(endpoint.exampleBody);
    }

    const response = await fetch(url, opts);
    const time     = Date.now() - start;

    let bodySnippet = '';
    try {
      const text   = await response.text();
      bodySnippet  = text.slice(0, 120);
    } catch (_) { /* ignore */ }

    // Any non-5xx status is considered a pass
    const passed = response.status < 500;

    let note = 'OK';
    if      (response.status === 401 || response.status === 403) note = 'Auth Guard';
    else if (response.status === 400)                             note = 'Expected';
    else if (response.status === 404)                             note = 'Not Found';
    else if (response.status === 422)                             note = 'Validation';
    else if (response.status >= 500)                              note = 'Server Error';

    return { method: endpoint.method, path: endpoint.path, status: response.status, time, passed, note, body: bodySnippet };
  } catch (err) {
    const time = Date.now() - start;
    const note = err.name === 'TimeoutError' ? 'Timeout' : 'Connection Error';
    return { method: endpoint.method, path: endpoint.path, status: 0, time, passed: false, note, body: err.message.slice(0, 60) };
  }
}

/**
 * Test all endpoints sequentially with a small delay between requests.
 * @param {string} baseUrl
 * @param {Array}  endpoints
 */
export async function testAllEndpoints(baseUrl, endpoints) {
  const results = [];

  for (const endpoint of endpoints) {
    const result = await testEndpoint(baseUrl, endpoint);
    results.push(result);
    await new Promise(r => setTimeout(r, 250));
  }

  return results;
}
