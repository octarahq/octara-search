export class DomainLimiter {
  private lastFetch: Map<string, number> = new Map();
  private minIntervalMs: number;

  constructor(fetchesPerMinute: number = 30) {
    this.minIntervalMs = (60 * 1000) / fetchesPerMinute;
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
  }

  getHostname(url: string) {
    try {
      return new URL(url).hostname;
    } catch (e) {
      return "unknown";
    }
  }
}
