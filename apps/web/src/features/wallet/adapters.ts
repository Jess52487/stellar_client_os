import { StellarWalletAdapter } from "../features/wallet/adapter.interface";
import { isLockedWalletError, isWalletCancellationError } from "../utils/wallet-errors";
import { notify } from "../utils/notification";

export class FreighterAdapter implements StellarWalletAdapter {
  private readonly publicKey: string | null = null;

  async connect(): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { publicKey } = await (window as any).FreighterAccounts.sign?.();
      if (!publicKey) {
        throw new Error("No account selected");
      }
      return publicKey;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Connection cancelled by user");
      }
      if (isLockedWalletError(error)) {
        notify.error("Your wallet is locked. Please unlock it and try again.");
      }
      throw error;
    }
  }

  async signTransaction(xdr: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedTransaction } = await (window as any).FreighterAccounts.signTransaction?.(xdr);
      if (!signedTransaction) {
        throw new Error("Signing cancelled");
      }
      return signedTransaction;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedMessage } = await (window as any).FreighterAccounts.signMessage?.(message);
      if (!signedMessage) {
        throw new Error("Signing cancelled");
      }
      return signedMessage;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Freighter handles disconnect implicitly
  }

  getIdentifier(): string {
    return "freighter";
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && !! (window as any).FreighterAccounts;
  }
}

export class AlbedoAdapter implements StellarWalletAdapter {
  private readonly publicKey: string | null = null;

  async connect(): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { publicKey } = await (window as any).AlbedoAccounts.sign?.();
      if (!publicKey) {
        throw new Error("No account selected");
      }
      return publicKey;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Connection cancelled by user");
      }
      if (isLockedWalletError(error)) {
        notify.error("Your wallet is locked. Please unlock it and try again.");
      }
      throw error;
    }
  }

  async signTransaction(xdr: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedTransaction } = await (window as any).AlbedoAccounts.signTransaction?.(xdr);
      if (!signedTransaction) {
        throw new Error("Signing cancelled");
      }
      return signedTransaction;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedMessage } = await (window as any).AlbedoAccounts.signMessage?.(message);
      if (!signedMessage) {
        throw new Error("Signing cancelled");
      }
      return signedMessage;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // Albedo handles disconnect implicitly
  }

  getIdentifier(): string {
    return "albedo";
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && !! (window as any).AlbedoAccounts;
  }
}

export class xBullAdapter implements StellarWalletAdapter {
  private readonly publicKey: string | null = null;

  async connect(): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { publicKey } = await (window as any).xBullAccounts.sign?.();
      if (!publicKey) {
        throw new Error("No account selected");
      }
      return publicKey;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Connection cancelled by user");
      }
      if (isLockedWalletError(error)) {
        notify.error("Your wallet is locked. Please unlock it and try again.");
      }
      throw error;
    }
  }

  async signTransaction(xdr: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedTransaction } = await (window as any).xBullAccounts.signTransaction?.(xdr);
      if (!signedTransaction) {
        throw new Error("Signing cancelled");
      }
      return signedTransaction;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async signMessage(message: string): Promise<string> {
    if (typeof window === "undefined") {
      throw new Error("Window not available");
    }

    try {
      const { signedMessage } = await (window as any).xBullAccounts.signMessage?.(message);
      if (!signedMessage) {
        throw new Error("Signing cancelled");
      }
      return signedMessage;
    } catch (error: any) {
      if (isWalletCancellationError(error)) {
        throw new Error("Signing cancelled by user");
      }
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    // xBull handles disconnect implicitly
  }

  getIdentifier(): string {
    return "xbull";
  }

  isAvailable(): boolean {
    return typeof window !== "undefined" && !! (window as any).xBullAccounts;
  }
}