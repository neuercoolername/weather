interface Attempt {
  count: number;
  resetAt: number;
}

const store = new Map<string, Attempt>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(ip: string): { allowed: boolean } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { allowed: false };
  }

  entry.count += 1;
  return { allowed: true };
}

export function resetRateLimit(ip: string): void {
  store.delete(ip);
}
