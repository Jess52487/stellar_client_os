export interface CacheItem {
  key: string;
  value: unknown;
  size: number;
  lastAccessed: number;
}

export interface CacheOptions {
  maxItems?: number;
  maxSize?: number;
  storageQuota?: number;
}

export class CacheManager {
  private readonly storageName: string;
  private readonly dbName: string;
  private readonly storeName: string;
  private maxItems: number;
  private maxSize: number;
  private storageQuota: number;
  private readonly items: Map<string, CacheItem> = new Map();
  private readonly sizeByKey: Map<string, number> = new Map();
  private storageEstimate?: { usage: number; quota: number };

  constructor(options: CacheOptions = {}) {
    this.storageName = options.storageName ?? "trellis-cache";
    this.dbName = options.dbName ?? "trellis-cache-db";
    this.storeName = options.storeName ?? "cache-items";
    this.maxItems = options.maxItems ?? 500;
    this.maxSize = options.maxSize ?? 5 * 1024 * 1024; // 5MB default
    this.storageQuota = options.storageQuota ?? this.maxSize;
  }

  async init(): Promise<void> {
    if (!("indexedDB" in window)) {
      console.warn("IndexedDB not supported, using in-memory cache");
      return;
    }

    const request = indexedDB.open(this.dbName, 1);

    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = (event) => {
        const db = (request.result as IDBDatabase);
        const objectStore = db.createObjectStore(this.storeName, { keyPath: "key" });
        objectStore.createIndex("lastAccessed", "lastAccessed", { unique: false });
      };

      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(event);
    });
  }

  async get(key: string): Promise<unknown | undefined> {
    if (!("indexedDB" in window)) {
      return this.items.get(key)?.value;
    }

    const request = indexedDB.open(this.dbName);

    return new Promise((resolve) => {
      request.onupgradeneeded = () => {};
      request.onsuccess = async (event) => {
        const db = (event.target!.result as IDBDatabase);
        const transaction = db.transaction(this.storeName, "readonly");
        const store = transaction.objectStore(this.storeName);
        const entry = await store.get(key);

        if (entry) {
          this.items.set(key, {
            key,
            value: entry.value,
            size: entry.size || 0,
            lastAccessed: Date.now(),
          });
          this.sizeByKey.set(key, entry.size || 0);
          this.touch(key);
        }
        resolve(entry?.value);
      };
      request.onerror = () => resolve(undefined);
    });
  }

  async set(key: string, value: unknown, size?: number): Promise<void> {
    const itemSize = size ?? this.estimateSize(value) ?? 1024;

    if (!("indexedDB" in window)) {
      this.items.set(key, {
        key,
        value,
        size: itemSize,
        lastAccessed: Date.now(),
      });
      this.sizeByKey.set(key, itemSize);
      this.pruneIfNeeded();
      return;
    }

    const actualSize = Math.max(itemSize, 1);

    const request = indexedDB.open(this.dbName, 2);

    await new Promise<void>((resolve, reject) => {
      request.onupgradeneeded = (event) => {
        const db = (request.result as IDBDatabase);
        const objectStore = db.createObjectStore(this.storeName, { keyPath: "key" });
        objectStore.createIndex("lastAccessed", "lastAccessed", { unique: false });
      };

      request.onsuccess = async (event) => {
        const db = (event.target!.result as IDBDatabase);

        // Check storage quota before adding
        await this.checkQuota(db, actualSize);

        const transaction = db.transaction(this.storeName, "readwrite");
        const store = transaction.objectStore(this.storeName);

        // Remove existing entry if updating
        store.delete(key);

        const entry = {
          key,
          value: value instanceof Blob ? value : new Blob([JSON.stringify(value)]),
          size: actualSize,
          lastAccessed: Date.now(),
        };

        store.add(entry);
        this.items.set(key, {
          key,
          value,
          size: actualSize,
          lastAccessed: Date.now(),
        });
        this.sizeByKey.set(key, actualSize);

        transaction.oncomplete = async () => {
          this.pruneIfNeeded();
        };

        transaction.onerror = (event) => {
          console.error("IndexedDB transaction error:", event);
        };
        transaction.commit();
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB error:", event);
        reject(event);
      };
    });
  }

  private async checkQuota(db: IDBDatabase, newSize: number): Promise<void> {
    try {
      const estimate = await (navigator.storage as any).estimate?.();
      if (estimate) {
        this.storageEstimate = estimate;
        const usagePercent = ((estimate.usage + newSize) / estimate.quota) * 100;

        if (usagePercent > 80) {
          // Prune cache before exceeding quota
          this.pruneCache(Math.ceil((usagePercent - 80) / 10 * this.maxItems));
        }
      }
    } catch (e) {
      console.warn("Storage estimate failed:", e);
    }
  }

  private pruneCache(neededItems: number): void {
    // Sort items by lastAccessed (LRU - least recently used first)
    const sortedItems = Array.from(this.items.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

    // Remove least recently used items
    for (let i = 0; i < Math.min(neededItems, sortedItems.length); i++) {
      const [key] = sortedItems[i];
      this.removeItem(key, /* fromIndexedDB */ true);
    }
  }

  private removeItem(key: string, fromIndexedDB: boolean): void {
    this.items.delete(key);
    this.sizeByKey.delete(key);

    if (fromIndexedDB && "indexedDB" in window) {
      const request = indexedDB.open(this.dbName);
      request.onupgradeneeded = () => {};
      request.onsuccess = (event) => {
        const db = (event.target!.result as IDBDatabase);
        const transaction = db.transaction(this.storeName, "readwrite");
        transaction.objectStore(this.storeName).delete(key);
      };
    }
  }

  private async pruneIfNeeded(): Promise<void> {
    if (!("indexedDB" in window)) {
      // In-memory pruning
      let totalSize = 0;
      for (const size of this.sizeByKey.values()) {
        totalSize += size;
      }

      while (this.items.size > this.maxItems || totalSize > this.maxSize) {
        const sorted = Array.from(this.items.entries())
          .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
        const [key] = sorted.shift()!;
        this.removeItem(key, false);
        totalSize -= this.sizeByKey.get(key) ?? 0;
      }
      return;
    }

    const estimate = this.storageEstimate ?? await (navigator.storage as any).estimate?.();
    if (!estimate) return;

    const usagePercent = (estimate.usage / estimate.quota) * 100;
    if (usagePercent > 80) {
      this.pruneCache(Math.ceil(this.maxItems * (usagePercent - 80) / 100));
    }
  }

  private touch(key: string): void {
    const item = this.items.get(key);
    if (item) {
      item.lastAccessed = Date.now();
    }
  }

  private estimateSize(value: unknown): number | undefined {
    if (value === null || value === undefined) return 0;
    if (typeof value === "string") return Buffer.byteLength(value, "utf8");
    if (typeof value === "object") return Buffer.byteLength(JSON.stringify(value), "utf8");
    return undefined;
  }

  async getStats(): Promise<{
    itemCount: number;
    totalSize: number;
    usagePercent: number;
    maxSize: number;
  }> {
    let totalSize = 0;
    for (const size of this.sizeByKey.values()) {
      totalSize += size;
    }

    const estimate = this.storageEstimate ?? await (navigator.storage as any).estimate?.();
    const usagePercent = estimate ? (estimate.usage / estimate.quota) * 100 : 0;

    return {
      itemCount: this.items.size,
      totalSize,
      usagePercent,
      maxSize: this.maxSize,
    };
  }

  async clear(): Promise<void> {
    this.items.clear();
    this.sizeByKey.clear();

    if ("indexedDB" in window) {
      const request = indexedDB.deleteDatabase(this.dbName);
      await new Promise<void>((resolve) => {
        request.onsuccess = () => resolve();
      });
    }
  }
}

export default CacheManager;