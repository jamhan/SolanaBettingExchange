import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Wallet, TestTube } from "lucide-react";
import type { User } from "@shared/schema";

interface WalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  connect: () => Promise<void>;
  connectTest: () => Promise<void>;
  disconnect: () => void;
  user: User | null;
  isTestMode: boolean;
}

const WalletContext = createContext<WalletContextType | null>(null);

interface WalletConnectionProviderProps {
  children: ReactNode;
}

export function WalletConnectionProvider({ children }: WalletConnectionProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  
  const TEST_WALLET_ADDRESS = "TestWallet1111111111111111111111111111111111";

  // Helper function to bootstrap user (create if doesn't exist)
  const bootstrapUser = async (address: string) => {
    try {
      // Try to get existing user
      const response = await fetch(`/api/users/${address}`);
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else if (response.status === 404) {
        // Create new user
        const createResponse = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress: address,
            username: `User_${address.slice(-8)}`,
            balance: isTestMode ? "100000" : "1000" // Give test users more balance
          })
        });
        
        if (createResponse.ok) {
          const newUser = await createResponse.json();
          setUser(newUser);
        }
      }
    } catch (error) {
      console.error('Failed to bootstrap user:', error);
    }
  };

  useEffect(() => {
    // Check for URL test wallet parameter
    const urlParams = new URLSearchParams(window.location.search);
    const testWallet = urlParams.get('testWallet');
    
    // Check for stored test wallet or URL parameter
    const storedTestWallet = localStorage.getItem('testWallet');
    const shouldUseTestMode = import.meta.env.VITE_TEST_MODE === 'true' || testWallet || storedTestWallet;
    
    if (shouldUseTestMode && !import.meta.env.PROD) {
      const address = testWallet || storedTestWallet || TEST_WALLET_ADDRESS;
      connectTestWallet(address);
    } else {
      checkConnection();
    }
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
      // Try to bootstrap user for existing connection
      if (isConnected && walletAddress) {
        await bootstrapUser(walletAddress);
      }
      console.log("Wallet not connected");
    }
  };

  const connectTestWallet = async (address: string) => {
    try {
      setIsTestMode(true);
      setWalletAddress(address);
      setIsConnected(true);
      localStorage.setItem('testWallet', address);
      
      // Bootstrap or fetch user
      await bootstrapUser(address);
      
      console.log('Test wallet connected:', address);
    } catch (error) {
      console.error('Test wallet connection failed:', error);
    }
  };

  const connectTest = async () => {
    if (import.meta.env.PROD) {
      console.warn('Test wallet disabled in production');
      return;
    }
    await connectTestWallet(TEST_WALLET_ADDRESS);
  };

  const connect = async () => {
    try {
      // @ts-ignore
      if (window.solana?.isPhantom) {
        // @ts-ignore
        const response = await window.solana.connect();
        const address = response.publicKey.toString();
        setWalletAddress(address);
        setIsConnected(true);
        setIsTestMode(false);
        
        // Bootstrap or fetch user for real wallet too
        await bootstrapUser(address);
      } else {
        window.open("https://phantom.app/", "_blank");
      }
    } catch (error) {
      console.error("Failed to connect wallet:", error);
    }
  };

  const disconnect = () => {
    try {
      if (!isTestMode) {
        // @ts-ignore
        if (window.solana?.isPhantom) {
          // @ts-ignore
          window.solana.disconnect();
        }
      } else {
        localStorage.removeItem('testWallet');
      }
      setWalletAddress(null);
      setIsConnected(false);
      setIsTestMode(false);
      setUser(null);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
    }
  };

  return (
    <WalletContext.Provider value={{ 
      isConnected, 
      walletAddress, 
      connect, 
      connectTest,
      disconnect, 
      user,
      isTestMode 
    }}>
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
  const { isConnected, walletAddress, connect, connectTest, disconnect, isTestMode } = useWallet();

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (isConnected && walletAddress) {
    return (
      <Button
        onClick={disconnect}
        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        data-testid="button-wallet"
      >
        <Wallet size={16} />
        <span>
          {isTestMode ? '🧪 ' : ''}{formatAddress(walletAddress)}
        </span>
      </Button>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Button
        onClick={connect}
        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        data-testid="button-wallet"
      >
        <Wallet size={16} />
        <span>Connect Wallet</span>
      </Button>
      
      {!import.meta.env.PROD && (
        <Button
          onClick={connectTest}
          variant="outline"
          className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
          data-testid="button-wallet-test"
        >
          <TestTube size={16} />
          <span>Test Wallet</span>
        </Button>
      )}
    </div>
  );
}
