type Entry<V> = { v: V; exp: number };

export class LRU<V> {
  private map = new Map<string, Entry<V>>();
  constructor(private max: number, private ttlMs: number) {}

  get(key: string): V | undefined {
    const e = this.map.get(key);
    if (!e) return undefined;
    if (e.exp < Date.now()) {
      this.map.delete(key);
      return undefined;
    }
    this.map.delete(key);
    this.map.set(key, e);
    return e.v;
  }

  set(key: string, v: V): void {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, { v, exp: Date.now() + this.ttlMs });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest !== undefined) this.map.delete(oldest);
    }
  }
}

export interface GeocodeResult {
  place_name: string;
  center: [number, number]; // [lng, lat]
}

export const geocodeCache = new LRU<GeocodeResult[]>(500, 24 * 60 * 60 * 1000);
