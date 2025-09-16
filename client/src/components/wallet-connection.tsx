import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletConnectionProviderProps {
  children: ReactNode;
}

export function WalletConnectionProvider({ children }: WalletConnectionProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      // @ts-ignore
      if (window.solana?.isPhantom) {
        // @ts-ignore
        const response = await window.solana.connect({ onlyIfTrusted: true });
        setWalletAddress(response.publicKey.toString());
        setIsConnected(true);
      }
    } catch (error) {
      console.log("Wallet not connected");
    }
  };

  const connect = async () => {
    try {
      // @ts-ignore
      if (window.solana?.isPhantom) {
        // @ts-ignore
        const response = await window.solana.connect();
        setWalletAddress(response.publicKey.toString());
        setIsConnected(true);
      } else {
        window.open("https://phantom.app/", "_blank");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const disconnect = () => {
    try {
      // @ts-ignore
      if (window.solana?.isPhantom) {
        // @ts-ignore
        window.solana.disconnect();
      }
      setWalletAddress(null);
      setIsConnected(false);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  return (
    <WalletContext.Provider value={{ isConnected, walletAddress, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within WalletConnectionProvider");
  }
  return context;
}

export function WalletButton() {
  const { isConnected, walletAddress, connect, disconnect } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Button
      onClick={isConnected ? disconnect : connect}
      className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
      data-testid="button-wallet"
    >
      <Wallet size={16} />
      <span>
        {isConnected && walletAddress ? formatAddress(walletAddress) : "Connect Wallet"}
      </span>
    </Button>
  );
}
