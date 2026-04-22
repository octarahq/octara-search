export class DomainLimiter {
  private lastFetch: Map<string, number> = new Map();
  private minIntervalMs: number;
  private cleanupCounter = 0;

  constructor(fetchesPerMinute: number = 30) {
    this.minIntervalMs = (60 * 1000) / fetchesPerMinute;
  }

  private cleanup() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    for (const [domain, time] of this.lastFetch) {
      if (now - time > maxAge) {
        this.lastFetch.delete(domain);
      }
    }
  }

  async wait(url: string) {
    const domain = new URL(url).hostname;
    const now = Date.now();
    const last = this.lastFetch.get(domain) || 0;
    const elapsed = now - last;

    if (elapsed < this.minIntervalMs) {
      const waitTime = this.minIntervalMs - elapsed;
      await new Promise((r) => setTimeout(r, waitTime));
    }

    this.lastFetch.set(domain, Date.now());

    // Periodic cleanup to prevent unbounded growth
    this.cleanupCounter++;
    if (this.cleanupCounter >= 1000) {
      this.cleanupCounter = 0;
      this.cleanup();
    }
  }

  getHostname(url: string) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "unknown";
    }
  }
}
