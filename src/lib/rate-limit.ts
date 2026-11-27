export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  check(key: string, now = Date.now()) {
    const recent = (this.hits.get(key) ?? []).filter((timestamp) => now - timestamp < this.windowMs);
    if (recent.length >= this.limit) {
      const retryAfterSeconds = Math.max(1, Math.ceil((this.windowMs - (now - recent[0])) / 1000));
      this.hits.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }
    this.hits.set(key, [...recent, now]);
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export const loginLimiter = new SlidingWindowLimiter(10, 15 * 60 * 1000);

export function clientAddress(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || "local";
}
