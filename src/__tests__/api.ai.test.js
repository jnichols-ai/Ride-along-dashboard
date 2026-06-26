'use strict';

const handler = require('../../api/ai');

function mockReq(method = 'POST', body = {}) {
  return { method, body };
}

function mockRes() {
  const res = {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(data) { this._body = data; return this; },
  };
  return res;
}

beforeEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_MODEL;
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('api/ai', () => {
  test('rejects non-POST methods with 405', async () => {
    const res = mockRes();
    await handler(mockReq('GET'), res);
    expect(res._status).toBe(405);
    expect(res._body.error).toMatch(/Method not allowed/i);
  });

  test('returns 500 when ANTHROPIC_API_KEY is not set', async () => {
    const res = mockRes();
    await handler(mockReq('POST', { prompt: 'Summarize this' }), res);
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/ANTHROPIC_API_KEY/);
  });

  test('returns 400 when prompt is missing', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    const res = mockRes();
    await handler(mockReq('POST', {}), res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Missing prompt/i);
  });

  test('returns extracted text on success', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        content: [{ type: 'text', text: 'Great compliance overall.' }],
      }),
    });

    const res = mockRes();
    await handler(mockReq('POST', { prompt: 'Summarize' }), res);

    expect(res._status).toBe(200);
    expect(res._body.text).toBe('Great compliance overall.');
  });

  test('defaults to claude-haiku-4-5-20251001 when ANTHROPIC_MODEL is not set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await handler(mockReq('POST', { prompt: 'hi' }), mockRes());

    const [, fetchOptions] = global.fetch.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.model).toBe('claude-haiku-4-5-20251001');
  });

  test('uses ANTHROPIC_MODEL env var when set', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await handler(mockReq('POST', { prompt: 'hi' }), mockRes());

    const [, fetchOptions] = global.fetch.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.model).toBe('claude-sonnet-4-6');
  });

  test('appends data to the prompt when provided', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await handler(mockReq('POST', { prompt: 'Summarize', data: [{ score: 95 }] }), mockRes());

    const [, fetchOptions] = global.fetch.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.messages[0].content).toContain('Summarize');
    expect(body.messages[0].content).toContain('"score": 95');
  });

  test('sends correct Anthropic API headers', async () => {
    process.env.ANTHROPIC_API_KEY = 'my-api-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });

    await handler(mockReq('POST', { prompt: 'hi' }), mockRes());

    const [url, fetchOptions] = global.fetch.mock.calls[0];
    expect(url).toContain('anthropic.com');
    expect(fetchOptions.headers['x-api-key']).toBe('my-api-key');
    expect(fetchOptions.headers['anthropic-version']).toBeTruthy();
  });

  test('returns 502 when Anthropic returns an error object', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({ error: { message: 'Invalid API key' } }),
    });

    const res = mockRes();
    await handler(mockReq('POST', { prompt: 'Summarize' }), res);

    expect(res._status).toBe(502);
    expect(res._body.error).toContain('Invalid API key');
  });

  test('returns 500 when fetch throws a network error', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockRejectedValueOnce(new Error('connection refused'));

    const res = mockRes();
    await handler(mockReq('POST', { prompt: 'Summarize' }), res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain('connection refused');
  });

  test('joins multiple content blocks into single text', async () => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
    global.fetch.mockResolvedValueOnce({
      json: async () => ({
        content: [
          { type: 'text', text: 'Part one.' },
          { type: 'text', text: 'Part two.' },
        ],
      }),
    });

    const res = mockRes();
    await handler(mockReq('POST', { prompt: 'hi' }), res);

    expect(res._body.text).toBe('Part one. Part two.');
  });
});
