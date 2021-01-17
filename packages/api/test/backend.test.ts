import * as api from '../lib/api';

describe('Request event validation', () => {
  test('Create server fails at malformed request', async () => {
    // WITH
    const event = {
      queryStringParametrs: {
        region: '',
      },
    };

    // WHEN
    const result = await api.createServer(event);

    // THEN
    expect(result.statusCode).toBe(400);
  });

  test('Destroy server fails at malformed request', async () => {
    // WITH
    const event = {
      queryStringParametrs: {
        region: '',
      },
    };

    // WHEN
    const result = await api.terminateServer(event);

    // THEN
    expect(result.statusCode).toBe(400);
  });
});
