import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { PublicKey } from '@solana/web3.js';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Wallet, TestTube, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { useSolflare } from "./solflare-wallet-connector";
import type { User } from "@shared/schema";

interface UnifiedWalletContextType {
  isConnected: boolean;
  walletAddress: string | null;
  publicKey: PublicKey | null;
  connect: () => Promise<void>;
  connectTest: () => Promise<void>;
  disconnect: () => void;
  user: User | null;
  isTestMode: boolean;
  walletType: 'solflare' | 'test' | null;
  balance: number | null;
}

const UnifiedWalletContext = createContext<UnifiedWalletContextType | null>(null);

interface UnifiedWalletProviderProps {
  children: ReactNode;
}

export function UnifiedWalletProvider({ children }: UnifiedWalletProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isTestMode, setIsTestMode] = useState(false);
  const [walletType, setWalletType] = useState<'solflare' | 'test' | null>(null);
  
  const TEST_WALLET_ADDRESS = "TestWallet1111111111111111111111111111111111";
  
  // Get Solflare wallet context
  const solflare = useSolflare();

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

  // Connect test wallet
  const connectTestWallet = async (address?: string) => {
    const testAddress = address || TEST_WALLET_ADDRESS;
    setWalletAddress(testAddress);
    setIsConnected(true);
    setIsTestMode(true);
    setWalletType('test');
    localStorage.setItem('testWallet', testAddress);
    await bootstrapUser(testAddress);
    console.log('Test wallet connected:', testAddress);
  };

  // Connect Solflare wallet
  const connectSolflareWallet = async () => {
    try {
      await solflare.connect();
      if (solflare.publicKey) {
        const address = solflare.publicKey.toString();
        setWalletAddress(address);
        setIsConnected(true);
        setIsTestMode(false);
        setWalletType('solflare');
        localStorage.removeItem('testWallet'); // Clear test mode
        await bootstrapUser(address);
      }
    } catch (error) {
      console.error('Solflare connection failed:', error);
    }
  };

  // Unified connect function
  const connect = async () => {
    if (import.meta.env.VITE_TEST_MODE === 'true' || !import.meta.env.PROD) {
      await connectTestWallet();
    } else {
      await connectSolflareWallet();
    }
  };

  // Disconnect function
  const disconnect = () => {
    if (walletType === 'solflare') {
      solflare.disconnect();
    }
    
    setIsConnected(false);
    setWalletAddress(null);
    setUser(null);
    setIsTestMode(false);
    setWalletType(null);
    localStorage.removeItem('testWallet');
  };

  // Auto-connect effects
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
    }
  }, []);

  // Sync with Solflare wallet state
  useEffect(() => {
    if (solflare.connected && solflare.publicKey && walletType !== 'test') {
      const address = solflare.publicKey.toString();
      setWalletAddress(address);
      setIsConnected(true);
      setIsTestMode(false);
      setWalletType('solflare');
      bootstrapUser(address);
    } else if (!solflare.connected && walletType === 'solflare') {
      setIsConnected(false);
      setWalletAddress(null);
      setUser(null);
      setWalletType(null);
    }
  }, [solflare.connected, solflare.publicKey, walletType]);

  const contextValue: UnifiedWalletContextType = {
    isConnected,
    walletAddress,
    publicKey: solflare.publicKey,
    connect,
    connectTest: () => connectTestWallet(),
    disconnect,
    user,
    isTestMode,
    walletType,
    balance: solflare.balance,
  };

  return (
    <UnifiedWalletContext.Provider value={contextValue}>
      {children}
    </UnifiedWalletContext.Provider>
  );
}

export const useWallet = () => {
  const context = useContext(UnifiedWalletContext);
  if (!context) {
    throw new Error('useWallet must be used within UnifiedWalletProvider');
  }
  return context;
};

export const WalletButton = () => {
  const { 
    isConnected, 
    walletAddress, 
    connect, 
    connectTest, 
    disconnect, 
    isTestMode, 
    walletType,
    balance 
  } = useWallet();
  
  const solflare = useSolflare();

  if (!isConnected) {
    return (
      <div className="flex items-center gap-2" data-testid="wallet-buttons">
        {/* Show test wallet button in development */}
        {(!import.meta.env.PROD || import.meta.env.VITE_TEST_MODE === 'true') && (
          <Button
            variant="outline"
            onClick={connectTest}
            className="flex items-center gap-2"
            data-testid="connect-test-wallet"
          >
            <TestTube size={16} />
            Test Wallet
          </Button>
        )}
        
        {/* Show Solflare button if extension is installed */}
        {solflare.isInstalled ? (
          <Button
            onClick={connect}
            disabled={solflare.connecting}
            className="flex items-center gap-2"
            data-testid="connect-solflare"
          >
            <Wallet size={16} />
            {solflare.connecting ? 'Connecting...' : 'Connect Solflare'}
          </Button>
        ) : (
          <Button
            variant="outline"
            asChild
            className="flex items-center gap-2"
            data-testid="install-solflare"
          >
            <a
              href="https://solflare.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink size={16} />
              Install Solflare
            </a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <Card className="p-3" data-testid="wallet-connected">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="text-success" size={16} />
          <Badge variant={isTestMode ? "secondary" : "default"}>
            {isTestMode ? 'Test Mode' : 'Solflare'}
          </Badge>
        </div>
        
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm truncate" data-testid="wallet-address">
            {walletAddress?.slice(0, 8)}...{walletAddress?.slice(-8)}
          </p>
          {balance !== null && walletType === 'solflare' && (
            <p className="text-xs text-muted-foreground" data-testid="wallet-balance">
              {balance.toFixed(4)} SOL
            </p>
          )}
        </div>
        
        <Button
          variant="ghost"
          size="sm"
          onClick={disconnect}
          data-testid="disconnect-wallet"
        >
          Disconnect
        </Button>
      </div>
    </Card>
  );
};

// Wallet connection modal for first-time users
export const WalletConnectModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const solflare = useSolflare();
  const { connectTest } = useWallet();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6" data-testid="wallet-connect-modal">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet size={32} className="text-primary" />
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold">Connect Your Wallet</h2>
            <p className="text-muted-foreground mt-2">
              Choose how you'd like to connect to start trading
            </p>
          </div>

          <div className="space-y-3">
            {/* Solflare Option */}
            <div className="p-4 rounded-lg border border-muted hover:border-primary/50 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <img 
                  src="https://solflare.com/assets/logo.svg" 
                  alt="Solflare" 
                  className="w-8 h-8"
                  onError={(e) => {
                    // Fallback if image fails to load
                    e.currentTarget.style.display = 'none';
                  }}
                />
                <span className="font-medium">Solflare Wallet</span>
                <Badge>Recommended</Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Read-only connection to your Solana wallet
              </p>
              
              {solflare.isInstalled ? (
                <Button
                  onClick={() => {
                    solflare.connect();
                    onClose();
                  }}
                  disabled={solflare.connecting}
                  className="w-full"
                  data-testid="connect-solflare-modal"
                >
                  <Wallet size={16} className="mr-2" />
                  {solflare.connecting ? 'Connecting...' : 'Connect Solflare'}
                </Button>
              ) : (
                <Button
                  variant="outline"
                  asChild
                  className="w-full"
                  data-testid="install-solflare-modal"
                >
                  <a
                    href="https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={16} className="mr-2" />
                    Install Extension
                  </a>
                </Button>
              )}
            </div>

            {/* Test Wallet Option (Development) */}
            {(!import.meta.env.PROD || import.meta.env.VITE_TEST_MODE === 'true') && (
              <div className="p-4 rounded-lg border border-muted">
                <div className="flex items-center gap-3 mb-3">
                  <TestTube size={24} className="text-primary" />
                  <span className="font-medium">Test Wallet</span>
                  <Badge variant="secondary">Development</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  Use a test wallet for development and testing
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    connectTest();
                    onClose();
                  }}
                  className="w-full"
                  data-testid="connect-test-modal"
                >
                  <TestTube size={16} className="mr-2" />
                  Connect Test Wallet
                </Button>
              </div>
            )}
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>🔒 This is a read-only connection</p>
            <p>You maintain full control of your wallet</p>
          </div>

          <Button
            variant="ghost"
            onClick={onClose}
            className="text-muted-foreground"
            data-testid="close-wallet-modal"
          >
            Maybe Later
          </Button>
        </div>
      </Card>
    </div>
  );
};