type Task<T> = () => Promise<T>;

let currentMaxConcurrency = Number(process.env.MAX_LLM_CONCURRENCY) || 10;
const MIN_CONCURRENCY = 1;
const MAX_CONCURRENCY = Number(process.env.MAX_LLM_CONCURRENCY) || 10;

let running = 0;
const queue: Array<() => void> = [];

const recent429Timestamps: number[] = [];
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_THRESHOLD = 3;

function adjustConcurrencyOn429() {
  const now = Date.now();
  recent429Timestamps.push(now);
  // prune old entries
  while (recent429Timestamps.length && recent429Timestamps[0] !== undefined && now - recent429Timestamps[0] > RATE_LIMIT_WINDOW_MS) {
    recent429Timestamps.shift();
  }
  if (recent429Timestamps.length >= RATE_LIMIT_THRESHOLD) {
    currentMaxConcurrency = Math.max(MIN_CONCURRENCY, Math.floor((currentMaxConcurrency * 7) / 10));
  }
}

// Simple timer to slowly increase concurrency again if no recent 429s
setInterval(() => {
  const now = Date.now();
  while (recent429Timestamps.length && recent429Timestamps[0] !== undefined && now - recent429Timestamps[0] > RATE_LIMIT_WINDOW_MS) {
    recent429Timestamps.shift();
  }
  if (recent429Timestamps.length === 0 && currentMaxConcurrency < MAX_CONCURRENCY) {
    currentMaxConcurrency += 1;
  }
}, 30_000).unref();

export async function runWithLlmConcurrency<T>(task: Task<T>): Promise<T> {
  if (running >= currentMaxConcurrency) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  running += 1;
  try {
    const result = await task();
    return result;
  } catch (error: any) {
    const status = error?.status ?? error?.response?.status;
    if (status === 429) {
      adjustConcurrencyOn429();
    }
    throw error;
  } finally {
    running -= 1;
    const next = queue.shift();
    if (next) next();
  }
}

export function getCurrentMaxConcurrency() {
  return currentMaxConcurrency;
}

