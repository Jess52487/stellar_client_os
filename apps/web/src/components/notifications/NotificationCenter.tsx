"use client";

import React, { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { NotificationManager } from "@/lib/notifications";
import { useStorage } from "@/hooks/use-storage";

const VAPID_PUBLIC_KEY =
  "BMyhm6wE_CmR1a1l2fYz6jKk8qB8kqZ3QqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQq";
const VAPID_PRIVATE_KEY = "private-key-from-dashboard";
const VAPID_SENDER_ID = "fundable";

const notificationManager = new NotificationManager({
  vapidPublicKey: VAPID_PUBLIC_KEY,
  vapidPrivateKey: VAPID_PRIVATE_KEY,
  vapidSenderId: VAPID_SENDER_ID,
});

const defaultPreferences: NotificationPreferences = {
  eventCategories: {
    "proposal-passing": true,
    "payout-execution": true,
    "agent-error": true,
    "agent-online": false,
    "system-update": false,
  },
  pushEnabled: false,
};

type NotificationPreferences = {
  eventCategories: Record<string, boolean>;
  pushEnabled: boolean;
};

export function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(
    defaultPreferences,
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPreferences();
    checkSubscriptionStatus();
  }, []);

  const loadPreferences = async () => {
    const stored = localStorage.getItem("notification-preferences");
    if (stored) {
      setPreferences(JSON.parse(stored));
    } else {
      setPreferences(defaultPreferences);
    }
  };

  const checkSubscriptionStatus = async () => {
    if (typeof window === "undefined") return;

    try {
      const registration = await (navigator as any).serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error("Failed to check subscription:", error);
    }
  };

  const handlePreferenceChange = (
    category: keyof NotificationPreferences["eventCategories"],
    value: boolean,
  ) => {
    setPreferences((prev) => ({
      ...prev,
      eventCategories: {
        ...prev.eventCategories,
        [category]: value,
      },
    }));

    localStorage.setItem(
      "notification-preferences",
      JSON.stringify(preferences),
    );
  };

  const handleTogglePush = async (enabled: boolean) => {
    setPreferences((prev) => ({
      ...prev,
      pushEnabled: enabled,
    }));

    localStorage.setItem(
      "notification-preferences",
      JSON.stringify(preferences),
    );

    if (enabled) {
      const result = await notificationManager.requestPermission();
      setIsSubscribed(result === "granted");

      if (result === "granted") {
        toast({
          title: "Push enabled",
          description: "You will receive push notifications for selected events",
        });
      }
    } else {
      await notificationManager.unsubscribe();
      setIsSubscribed(false);
      toast({
        title: "Push disabled",
        description: "Push notifications have been turned off",
      });
    }
  };

  const handleSave = () => {
    notificationManager.setPreferences(preferences);
    toast({
      title: "Saved",
      description: "Notification preferences have been saved",
    });
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="flex-1">
          Notification Settings
        </Button>
      </SheetTrigger>

      <SheetContent className="p-6">
        <SheetHeader>
          <SheetTitle>Notification Preferences</SheetTitle>
          <SheetClose />
        </SheetHeader>

        <p className="mt-4 text-sm text-muted-foreground">
          Choose which events trigger notifications and whether to enable push alerts.
        </p>

        {/* Event categories toggle */}
        <div className="space-y-3 mt-6">
          {Object.entries(
            preferences.eventCategories,
          ).map(([category, enabled]) => (
            <div key={category} className="flex items-center">
              <Input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  handlePreferenceChange(category, e.target.checked)
                }
                className="w-4 h-4 rounded border-current"
              />
              <span className="ml-3 text-sm capitalize">{category}</span>
            </div>
          ))}
        </div>

        {/* Push notification toggle */}
        <div className="mt-6">
          <label className="flex items-center cursor-pointer">
            <Input
              type="checkbox"
              checked={preferences.pushEnabled}
              onChange={(e) => handleTogglePush(e.target.checked)}
              className="w-4 h-4 rounded border-current mr-3"
            />
            <span>Enable push notifications</span>
          </label>
          <p className="ml-6 text-xs text-muted-foreground">
            Receive system alerts even when this tab is inactive
          </p>
        </div>

        <div className="mt-6 pt-6 border-t border-white/10">
          <Button onClick={handleSave} className="w-full">
            Save Preferences
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}