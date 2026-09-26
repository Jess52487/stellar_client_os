export interface NotificationSubscriptionOptions {
  readonly vapidPublicKey: string;
  readonly vapidPrivateKey: string;
  readonly vapidSenderId: string;
}

export interface NotificationSubscription {
  readonly endpoint: string;
  readonly keys: {
    readonly p256dh: string;
    readonly auth: string;
  };
  readonly subscriptionId?: string;
}

export interface NotificationReadState {
  readonly reportId: string;
  readonly isRead: boolean;
  readonly readAt: string;
}

export interface NotificationPreferences {
  readonly eventCategories: Record<string, boolean>;
  readonly pushEnabled: boolean;
}

export class NotificationManager {
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidSenderId: string;
  private readonly broadcastChannel: BroadcastChannel | null;
  private readonly pendingSubscribers: Map<
    string,
    {(subscription: NotificationSubscription) => void}
  > = new Map();

  constructor(options: NotificationSubscriptionOptions) {
    this.vapidPublicKey = options.vapidPublicKey;
    this.vapidPrivateKey = options.vapidPrivateKey;
    this.vapidSenderId = options.vapidSenderId;

    const channelName = `@fundable/notifications-${this.vapidSenderId}`;
    try {
      this.broadcastChannel = new BroadcastChannel(channelName);
      this.broadcastChannel.onmessage = (event) => this.handleMessage(event.data);
    } catch {
      this.broadcastChannel = null;
    }
  }

  async requestPermission(): Promise<"granted" | "denied"> {
    const result = await Notification.requestPermission();

    if (result !== "granted") {
      return result;
    }

    // Subscribe to web push after permission is granted
    return this.subscribe();
  }

  private async subscribe(): Promise<"granted" | "denied"> {
    if (!("serviceWorker" in navigator)) {
      console.warn("Service Worker not available for push notifications");
      return "denied";
    }

    try {
      const registration = await (navigator as any).serviceWorker.ready;

      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        // Already subscribed
        return "granted";
      }

      const subscriptionOptions = await this.getPushSubscriptionOptions();

      const pushSubscription = await registration.pushManager.subscribe(
        subscriptionOptions,
      );

      return this.saveSubscription(pushSubscription);
    } catch (error) {
      console.error("Push subscription failed:", error);
      return "denied";
    }
  }

  private async getPushSubscriptionOptions(): Promise<{
    readonly serverKey: string;
    readonly userVisibleOnly: boolean;
  }> {
    return {
      serverKey: this.vapidPublicKey,
      userVisibleOnly: true,
    };
  }

  private async saveSubscription(
    subscription: PushSubscription,
  ): Promise<"granted"> {
    const { endpoint, keys } = subscription;

    const subscriptionData: NotificationSubscription = {
      endpoint,
      keys: {
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    };

    // TODO: Save to backend
    console.log("Saved push subscription:", subscriptionData);

    return "granted";
  }

  markReportAsRead(reportId: string): void {
    const readState: NotificationReadState = {
      reportId,
      isRead: true,
      readAt: new Date().toISOString(),
    };

    // Broadcast read state to all tabs
    this.broadcastChannel?.postMessage({
      type: "report-read",
      reportId,
      readState,
    });
  }

  handleMessage(message: any): void {
    if (message.type === "report-read") {
      const { reportId, readState } = message;
      // Update local read state
      this.updateReadState(reportId, readState.isRead, readState.readAt);
    }
  }

  private updateReadState(
    reportId: string,
    isRead: boolean,
    readAt: string,
  ): void {
    // Store in localStorage or IndexedDB
    const readStates =
      JSON.parse(localStorage.getItem("notification-read-states") || "{}");

    readStates[reportId] = {
      isRead,
      readAt,
    };

    localStorage.setItem(
      "notification-read-states",
      JSON.stringify(readStates),
    );
  }

  getReportReadState(reportId: string): NotificationReadState | undefined {
    const readStates =
      JSON.parse(localStorage.getItem("notification-read-states") || "{}");

    return readStates[reportId];
  }

  getPreferences(): NotificationPreferences {
    const stored = localStorage.getItem("notification-preferences");

    if (stored) {
      return JSON.parse(stored);
    }

    return {
      eventCategories: {},
      pushEnabled: false,
    };
  }

  setPreferences(preferences: NotificationPreferences): void {
    localStorage.setItem(
      "notification-preferences",
      JSON.stringify(preferences),
    );
  }

  async unsubscribe(): Promise<void> {
    if (!("serviceWorker" in navigator)) return;

    try {
      const registration = await (navigator as any).serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();
        await registration.pushManager.deleteSubscription(
          subscription.subscriptionId!,
        );
      }
    } catch (error) {
      console.error("Push unsubscribe failed:", error);
    }
  }
}

export default NotificationManager;