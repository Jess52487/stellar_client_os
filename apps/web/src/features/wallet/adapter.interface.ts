export interface StellarWalletAdapter {
  connect(): Promise<string>;
  signTransaction(xdr: string): Promise<string>;
  signMessage(message: string): Promise<string>;
  disconnect(): Promise<void>;
  getIdentifier(): string;
  isAvailable(): boolean;
}

export type WalletProvider = "freighter" | "albedo" | "xbull" | "hana";

export interface WalletAdapterInfo {
  id: WalletProvider;
  name: string;
  icon: string;
  description: string;
}