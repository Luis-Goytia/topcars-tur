export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function callWithRetry<T>(
  fn: () => Promise<T>,
  { maxRetries = 3, baseDelayMs = 500 }: RetryOptions = {},
): Promise<T> {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      return await fn();
    } catch (error: any) {
      const status = error?.status ?? error?.response?.status;
      const isRetriable = status === 429 || (typeof status === "number" && status >= 500 && status < 600);
      if (!isRetriable || attempt >= maxRetries) {
        throw error;
      }
      attempt += 1;
      const jitter = Math.floor(Math.random() * 300);
      const delay = baseDelayMs * 2 ** attempt + jitter;
      // eslint-disable-next-line no-console
      console.warn(`LLM call failed with status ${status}, retrying in ${delay}ms (attempt ${attempt})`);
      await sleep(delay);
    }
  }
}

