"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import {
  FreighterAdapter,
  AlbedoAdapter,
  xBullAdapter,
  type WalletAdapterInfo,
} from "@/features/wallet/adapters";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/providers/StellarWalletProvider";
import { useToast } from "@/components/ui/use-toast";

const WalletIcons: Record<string, React.FC<{ className?: string }>> = {
  freighter: ({ className }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#5E35B1" />
      <path d="M10 14h20M10 20h14M10 26h8" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
  albedo: ({ className }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#1565C0" />
      <circle cx="20" cy="20" r="9" stroke="white" strokeWidth="2.5" />
      <circle cx="20" cy="20" r="4" fill="white" />
    </svg>
  ),
  xbull: ({ className }) => (
    <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="40" height="40" rx="10" fill="#00897B" />
      <path d="M13 13l14 14M27 13L13 27" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  ),
};

const DefaultWalletIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect width="40" height="40" rx="10" fill="#37474F" />
    <rect x="10" y="14" width="20" height="14" rx="2" stroke="white" strokeWidth="2" />
    <path d="M10 19h20" stroke="white" strokeWidth="2" />
    <circle cx="25" cy="22.5" r="1.5" fill="white" />
  </svg>
);

const adapterInfo: WalletAdapterInfo[] = [
  { id: "freighter", name: "Freighter", icon: "/icons/freighter.png", description: "Stellar wallet extension" },
  { id: "albedo", name: "Albedo", icon: "/icons/albedo.png", description: "Stellar ecosystem wallet" },
  { id: "xbull", name: "xBull", icon: "/icons/xbull.png", description: "xBull wallet extension" },
];

type WalletSelection = {
  adapter: StellarWalletAdapter;
  id: WalletAdapterInfo["id"];
};

export function WalletProviderSelector() {
  const {
    isModalOpen,
    closeModal,
    connect,
    disconnect,
    isConnecting,
    isConnected,
    address,
    supportedWallets,
  } = useWallet();

  const [selectedProvider, setSelectedProvider] = React.useState<WalletAdapterInfo | null>(null);
  const [selectedAdapter, setSelectedAdapter] = React.useState<StellarWalletAdapter | null>(null);
  const [isConnectingProvider, setIsConnectingProvider] = React.useState(false);
  const { toast } = useToast();

  const adapterMap: Record<string, new () => StellarWalletAdapter> = {
    freighter: FreighterAdapter,
    albedo: AlbedoAdapter,
    xbull: xBullAdapter,
  };

  const handleProviderSelect = (info: WalletAdapterInfo) => {
    setSelectedProvider(info);
    setSelectedAdapter(new adapterMap[info.id]());
  };

  const handleConnect = async () => {
    if (!selectedAdapter) return;

    setIsConnectingProvider(true);
    try {
      const publicKey = await selectedAdapter.connect();
      setSelectedAdapter?.disconnect();
      await connect(selectedProvider.id);
      toast({
        title: "Connected",
        description: `Successfully connected with ${selectedProvider.name}`,
      });
    } catch (error: any) {
      console.error("Wallet connection error:", error);
      toast({
        title: "Connection failed",
        description: error.message || "Unknown error",
        variant: "destructive",
      });
    } finally {
      setIsConnectingProvider(false);
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    setSelectedProvider(null);
    setSelectedAdapter(null);
  };

  if (!isModalOpen) return null;

  return (
    <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent
        className="w-full max-w-sm sm:max-w-md p-1 overflow-hidden border-white/10 bg-[#0F1621] rounded-3xl shadow-2xl mx-4 sm:mx-auto"
        aria-modal="true"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />

        <div className="relative bg-[#0F1621] rounded-[22px] p-5 sm:p-8 flex flex-col">
          <DialogHeader className="mb-6 sm:mb-8">
            <DialogTitle className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Connect Wallet
            </DialogTitle>
            <DialogDescription className="mt-1 text-[#92A5A8] text-sm">
              Select your preferred Stellar wallet provider to get started
            </DialogDescription>
          </DialogHeader>

          <div role="radiogroup" aria-label="Choose a wallet provider" className="flex flex-col gap-2 sm:gap-3 mb-6 sm:mb-8">
            {adapterInfo.map((info) => {
              const isSelected = selectedProvider?.id === info.id;
              const Icon = WalletIcons[info.id] ?? DefaultWalletIcon;

              return (
                <button
                  key={info.id}
                  type="button"
                  aria-pressed={isSelected}
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => handleProviderSelect(info)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleProviderSelect(info);
                    }
                  }}
                  disabled={isConnectingProvider}
                  data-testid={`wallet-option-${info.id}`}
                  className={`group relative flex items-center gap-3 sm:gap-4 w-full p-3 sm:p-4 rounded-2xl transition-all duration-200 border outline-none
                    focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1621]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${isSelected
                      ? "bg-white/10 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]"
                      : "bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/15 active:scale-[0.99]"
                    }`}
                >
                  <div
                    className={`shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-200 ${
                      isSelected ? "border-white bg-white" : "border-white/25 bg-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {isSelected && <Check className="w-3 h-3 text-[#0F1621]" strokeWidth={3.5} />}
                  </div>
                  <div
                    className={`shrink-0 rounded-xl transition-opacity duration-200 ${isSelected ? "opacity-100" : "opacity-70 group-hover:opacity-90"}`}
                    aria-hidden="true"
                  >
                    <Icon className="w-8 h-8 sm:w-9 sm:h-9" />
                  </div>
                  <span
                    className={`font-semibold text-sm tracking-wide ${
                      isSelected ? "text-white" : "text-[#92A5A8] group-hover:text-white/80"
                    }`}
                  >
                    {info.name}
                  </span>
                  <p className="text-xs text-[#6B7B8C] mt-1">{info.description}</p>
                </button>
              );
            })}
          </div>

          {selectedProvider && (
            <div className="mb-4 p-3 rounded-xl bg-[#1a2332] border border-white/10">
              <p className="text-sm text-[#92A5A8] mb-1">Selected Provider:</p>
              <p className="font-medium text-white">{selectedProvider.name}</p>
              <p className="text-caption text-[#6B7B8C]">{selectedProvider.description}</p>
            </div>
          )}

          <div className="flex gap-3 sm:gap-4 mt-8 sm:mt-12">
            {isConnectingProvider ? (
              <motion.span
                whileHover={{ scale: 1.02}}
                className="flex-1 py-2.5 sm:py-3 rounded-2xl font-medium text-sm tracking-widest uppercase transition-all duration-200 bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connecting…
              </motion.span>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={!selectedProvider || isConnectingProvider}
                aria-disabled={!selectedProvider || isConnectingProvider}
                className={`relative w-full py-3.5 sm:py-4 rounded-2xl font-bold text-sm tracking-widest uppercase transition-all duration-200 flex items-center justify-center gap-3 overflow-hidden
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F1621]
                  ${selectedProvider && !isConnectingProvider
                    ? "bg-white text-[#0F1621] hover:scale-[1.02] active:scale-[0.98] shadow-lg cursor-pointer"
                    : "bg-white/5 text-white/20 cursor-not-allowed"
                  }`}
                data-testid="connect-now-button"
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isConnectingProvider ? (
                    <motion.span
                      key="loading"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                      <span>Connecting…</span>
                    </motion.span>
                  ) : (
                    <motion.span
                      key="idle"
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="flex items-center gap-2"
                    >
                      <span>Connect Now</span>
                      <Check className="w-4 h-4" aria-hidden="true" />
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleDisconnect}
            disabled={isConnectingProvider}
            className="mt-4 sm:mt-6 py-2 sm:py-3 text-sm text-white/60 hover:text-white transition-colors cursor-pointer"
            aria-label="Disconnect wallet"
          >
            Disconnect
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}