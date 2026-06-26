'use strict';

const handler = require('../../api/monday');

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
  delete process.env.MONDAY_API_TOKEN;
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('api/monday', () => {
  test('rejects non-POST methods with 405', async () => {
    const req = mockReq('GET');
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
    expect(res._body.error).toMatch(/Method not allowed/i);
  });

  test('returns 500 when MONDAY_API_TOKEN is not set', async () => {
    const req = mockReq('POST', { query: '{ boards { id } }' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(500);
    expect(res._body.error).toMatch(/MONDAY_API_TOKEN/);
  });

  test('returns 400 when query is missing', async () => {
    process.env.MONDAY_API_TOKEN = 'test-token';
    const req = mockReq('POST', {});
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
    expect(res._body.error).toMatch(/Missing GraphQL query/i);
  });

  test('proxies query to monday.com and returns data on success', async () => {
    process.env.MONDAY_API_TOKEN = 'test-token';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { boards: [{ id: '123' }] } }),
    });

    const req = mockReq('POST', { query: '{ boards { id } }' });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toEqual({ boards: [{ id: '123' }] });
  });

  test('sends Authorization header with token', async () => {
    process.env.MONDAY_API_TOKEN = 'my-secret-token';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await handler(mockReq('POST', { query: '{ boards { id } }' }), mockRes());

    const [, fetchOptions] = global.fetch.mock.calls[0];
    expect(fetchOptions.headers['Authorization']).toBe('my-secret-token');
  });

  test('parses JSON-string variables before forwarding', async () => {
    process.env.MONDAY_API_TOKEN = 'test-token';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: {} }),
    });

    await handler(
      mockReq('POST', { query: '{ boards { id } }', variables: '{"boardId":["123"]}' }),
      mockRes()
    );

    const [, fetchOptions] = global.fetch.mock.calls[0];
    const body = JSON.parse(fetchOptions.body);
    expect(body.variables).toEqual({ boardId: ['123'] });
  });

  test('returns 502 when monday.com returns GraphQL errors', async () => {
    process.env.MONDAY_API_TOKEN = 'test-token';
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ errors: [{ message: 'Not authorized' }, { message: 'Invalid board' }] }),
    });

    const res = mockRes();
    await handler(mockReq('POST', { query: '{ boards { id } }' }), res);

    expect(res._status).toBe(502);
    expect(res._body.error).toContain('Not authorized');
    expect(res._body.error).toContain('Invalid board');
  });

  test('returns 500 when fetch throws a network error', async () => {
    process.env.MONDAY_API_TOKEN = 'test-token';
    global.fetch.mockRejectedValueOnce(new Error('network failure'));

    const res = mockRes();
    await handler(mockReq('POST', { query: '{ boards { id } }' }), res);

    expect(res._status).toBe(500);
    expect(res._body.error).toContain('network failure');
  });
});
