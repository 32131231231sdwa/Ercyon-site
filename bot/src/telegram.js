export function telegramClient(token, fetcher = fetch) {
  return async (method, payload) => {
    const response = await fetcher('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.json();
    return {
      ok: Boolean(response.ok && body.ok),
      retry: response.status >= 500 || response.status === 429,
      retryAfter: body.parameters?.retry_after,
    };
  };
}
