import { useContext } from "react";
import { WalletContext } from "@/components/wallet-connection";

// Re-export for backward compatibility

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletConnectionProvider");
  }
  return context;
}
