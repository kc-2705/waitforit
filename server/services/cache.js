// A small in-memory cache with a time limit and a size cap (oldest entries leave first).
// One server instance is enough for this app; with several instances, swap this for Redis
// behind the same get/set/wrap interface.

class TtlCache {
  constructor({ ttlMs, max = 500 }) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
    this.hits = 0;
    this.misses = 0;
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    if (entry.expires < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key, value) {
    this.map.delete(key);
    this.map.set(key, { value, expires: Date.now() + this.ttlMs });
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }

  /** Returns the cached value, or runs fn once and caches its result. Errors are not cached. */
  async wrap(key, fn) {
    const cached = this.get(key);
    if (cached !== undefined) {
      this.hits++;
      return cached;
    }
    this.misses++;
    // Share one in-flight request between callers asking for the same key at the same time.
    const pendingKey = `pending:${key}`;
    if (this.map.has(pendingKey)) return this.map.get(pendingKey).value;
    const promise = fn();
    this.map.set(pendingKey, { value: promise, expires: Infinity });
    try {
      const value = await promise;
      this.set(key, value);
      return value;
    } finally {
      this.map.delete(pendingKey);
    }
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  stats() {
    return { size: this.map.size, hits: this.hits, misses: this.misses };
  }
}

module.exports = { TtlCache };
