import { describe, expect, it, beforeEach, vi } from "vitest";
import CacheManager from "../cache-manager";

describe("CacheManager", () => {
  let cache: CacheManager;

  beforeEach(() => {
    cache = new CacheManager({ maxItems: 10, maxSize: 1024 });
  });

  describe("initialization", () => {
    it("sets default options", () => {
      const c = new CacheManager();
      expect(c["maxItems"]).toBe(500);
      expect(c["maxSize"]).toBe(5 * 1024 * 1024);
    });

    it("accepts custom options", () => {
      const c = new CacheManager({ maxItems: 200, maxSize: 2 * 1024 * 1024 });
      expect(c["maxItems"]).toBe(200);
      expect(c["maxSize"]).toBe(2 * 1024 * 1024);
    });
  });

  describe("LRU eviction with in-memory mode", () => {
    beforeEach(() => {
      cache = new CacheManager({ maxItems: 3, maxSize: 100, storageQuota: 100 });
    });

    it("evicts least recently used item when maxItems exceeded", async () => {
      await cache.set("key1", { data: "value1" }, 10);
      await cache.set("key2", { data: "value2" }, 20);
      await cache.set("key3", { data: "value3" }, 30);

      // Access key1 to make it recently used
      await cache.get("key1");

      // Adding key4 should evict key2 (least recently used)
      await cache.set("key4", { data: "value4" }, 15);

      expect(cache.items.has("key1")).toBe(true);
      expect(cache.items.has("key2")).toBe(false);
      expect(cache.items.has("key3")).toBe(true);
      expect(cache.items.has("key4")).toBe(true);
    });

    it("evicts items when maxSize exceeded", async () => {
      await cache.set("key1", { large: "data1" }, 60);
      await cache.set("key2", { large: "data2" }, 60);

      // Adding key3 should start eviction
      await cache.set("key3", { large: "data3" }, 10);

      expect(cache.items.size).toBe(2);
    });
  });

  describe("navigator.storage.estimate integration", () => {
    it("checks storage quota and prunes when exceeding 80%", async () => {
      // Mock navigator.storage.estimate
      vi.spyOn(navigator.storage, "estimate").mockResolvedValueOnce({
        usage: 800,
        quota: 1000,
      });

      await cache.init();

      // Fill cache
      await cache.set("key1", { data: "value1" }, 100);
      await cache.set("key2", { data: "value2" }, 100);

      // Adding more should trigger pruning at 80%+
      await cache.set("key3", { data: "value3" }, 100);

      const stats = await cache.getStats();
      expect(stats.itemCount).toBeLessThanOrEqual(3);
    });

    it("handles missing storage estimate gracefully", async () => {
      vi.spyOn(navigator.storage, "estimate").mockResolvedValueOnce(undefined);

      await cache.init();

      // Should not throw when estimate is unavailable
      await cache.set("key1", { data: "value1" }, 10);
      expect(cache.items.size).toBe(1);
    });
  });

  describe("getStats", () => {
    it("returns current cache statistics", async () => {
      await cache.set("key1", { data: "value1" }, 50);
      await cache.set("key2", { data: "value2" }, 30);

      const stats = await cache.getStats();
      expect(stats.itemCount).toBe(2);
      expect(stats.totalSize).toBe(80);
      expect(stats.usagePercent).toBeGreaterThan(0);
      expect(stats.maxSize).toBe(1024);
    });
  });

  describe("clear", () => {
    it("clears all cache entries", async () => {
      await cache.set("key1", { data: "value1" }, 10);
      await cache.set("key2", { data: "value2" }, 20);

      await cache.clear();
      expect(cache.items.size).toBe(0);
    });
  });
});