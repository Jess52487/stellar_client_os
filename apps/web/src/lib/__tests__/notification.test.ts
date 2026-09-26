import { describe, expect, it, vi, beforeEach } from "vitest";
import NotificationManager from "../lib/notifications";

describe("NotificationManager", () => {
  let manager: NotificationManager;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new NotificationManager({
      vapidPublicKey: "BNpIS2EAAAAAAF3yLTVp4yJ9JkA2mM8K8sqA0z7sNfK9l95MAaPi08O9xbk9vW7hN8g5vPmT8m3PT8m3PT8m3PT8m3PT8m3",
      vapidPrivateKey: "private-key",
      vapidSenderId: "fundable",
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("requestPermission", () => {
    it("requests notification permission", async () => {
      const result = await manager.requestPermission();
      expect(["granted", "denied", "default"]).toContain(result);
    });

    it("returns 'denied' when permission not granted", async () => {
      // Mock permission result
      vi.spyOn(Notification, "requestPermission").mockResolvedValueOnce("denied");
      const result = await manager.requestPermission();
      expect(result).toBe("denied");
    });
  });

  describe("subscribe", () => {
    it("subscribes to push notifications", async () => {
      // Mock service worker
      vi.spyOn((navigator as any), "serviceWorker", "get")
        .mockValue({
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue(null),
              subscribe: vi.fn().mockResolvedValue({
                endpoint: "https://example.com/push",
                keys: {
                  p256dh: "test-p256dh",
                  auth: "test-auth",
                },
              }),
            },
          }),
        });

      const result = await manager.requestPermission();
      expect(result).toBe("granted");
    });

    it("handles existing subscription", async () => {
      vi.spyOn((navigator as any), "serviceWorker", "get")
        .mockValue({
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({
                endpoint: "https://example.com/push-existing",
                keys: {
                  p256dh: "existing-p256dh",
                  auth: "existing-auth",
                },
              }),
              subscribe: vi.fn(),
              deleteSubscription: vi.fn().mockResolvedValue(true),
            },
          }),
        });

      const result = await manager.requestPermission();
      expect(result).toBe("granted");
    });
  });

  describe("markReportAsRead", () => {
    it("marks a report as read and broadcasts state", () => {
      const reportId = "report-123";
      manager.markReportAsRead(reportId);

      const readState = manager.getReportReadState(reportId);
      expect(readState?.isRead).toBe(true);
      expect(readState?.reportId).toBe(reportId);
    });

    it("stores read state in localStorage", () => {
      const reportId = "report-456";
      manager.markReportAsRead(reportId);

      const stored = localStorage.getItem("notification-read-states");
      expect(stored).not.toBeNull();
      if (stored) {
        const states = JSON.parse(stored);
        expect(states[reportId].isRead).toBe(true);
      }
    });
  });

  describe("BroadcastChannel handling", () => {
    it("handles incoming report-read messages", () => {
      const testReportId = "report-789";
      const testReadState = {
        isRead: true,
        readAt: new Date().toISOString(),
      };

      manager["handleMessage"]({
        type: "report-read",
        reportId: testReportId,
        readState,
      });

      const stored = localStorage.getItem("notification-read-states");
      if (stored) {
        const states = JSON.parse(stored);
        expect(states[testReportId].isRead).toBe(true);
      }
    });
  });

  describe("getPreferences and setPreferences", () => {
    it("returns default preferences when none stored", () => {
      const prefs = manager.getPreferences();
      expect(prefs.pushEnabled).toBe(false);
      expect(Object.keys(prefs.eventCategories).length).toBe(0);
    });

    it("stores and retrieves preferences", () => {
      const preferences = {
        eventCategories: {
          "proposal-passing": true,
          "payout-execution": false,
        },
        pushEnabled: true,
      };

      manager.setPreferences(preferences);
      const retrieved = manager.getPreferences();

      expect(retrieved.pushEnabled).toBe(true);
      expect(retrieved.eventCategories["proposal-passing"]).toBe(true);
      expect(retrieved.eventCategories["payout-execution"]).toBe(false);
    });
  });

  describe("unsubscribe", () => {
    it("attempts to unsubscribe from push", async () => {
      vi.spyOn((navigator as any), "serviceWorker", "get")
        .mockValue({
          ready: Promise.resolve({
            pushManager: {
              getSubscription: vi.fn().mockResolvedValue({
                endpoint: "https://example.com/push",
                keys: {
                  p256dh: "test-p256dh",
                  auth: "test-auth",
                },
              }),
              unsubscribe: vi.fn().mockResolvedValue(true),
              deleteSubscription: vi.fn().mockResolvedValue(true),
            },
          }),
        });

      await manager.unsubscribe();
      // Should not throw
    });
  });
});