import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { PublicKey, Connection, clusterApiUrl } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wallet, AlertCircle, CheckCircle, ExternalLink } from 'lucide-react';

// Define Solflare wallet interface based on open-source examples
interface SolflareWallet {
  isConnected: boolean;
  publicKey: PublicKey | null;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array, display?: string): Promise<{ signature: Uint8Array }>;
  on(event: string, callback: (data?: any) => void): void;
  off(event: string, callback: (data?: any) => void): void;
}

// Extend window interface for Solflare
declare global {
  interface Window {
    solflare?: SolflareWallet;
  }
}

interface SolflareContextType {
  connection: Connection;
  publicKey: PublicKey | null;
  connected: boolean;
  connecting: boolean;
  balance: number | null;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string | null>;
  isInstalled: boolean;
}

const SolflareContext = createContext<SolflareContextType | null>(null);

export const useSolflare = () => {
  const context = useContext(SolflareContext);
  if (!context) {
    throw new Error('useSolflare must be used within SolflareProvider');
  }
  return context;
};

interface SolflareProviderProps {
  children: ReactNode;
  endpoint?: string;
}

export const SolflareProvider = ({ 
  children, 
  endpoint = clusterApiUrl('mainnet-beta') 
}: SolflareProviderProps) => {
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  
  const connection = new Connection(endpoint);
  const { toast } = useToast();

  // Check if Solflare wallet is installed
  useEffect(() => {
    const checkWalletInstalled = () => {
      if (typeof window !== 'undefined' && window.solflare) {
        setIsInstalled(true);
        
        // Set up event listeners based on open-source examples
        window.solflare.on('connect', (publicKey: PublicKey) => {
          setPublicKey(publicKey);
          setConnected(true);
          setConnecting(false);
        });

        window.solflare.on('disconnect', () => {
          setPublicKey(null);
          setConnected(false);
          setBalance(null);
          setConnecting(false);
        });

        // Auto-connect if previously connected
        if (window.solflare.isConnected && window.solflare.publicKey) {
          setPublicKey(window.solflare.publicKey);
          setConnected(true);
        }
      } else {
        // Retry checking for wallet after a delay
        setTimeout(checkWalletInstalled, 1000);
      }
    };

    checkWalletInstalled();

    return () => {
      // Cleanup event listeners
      if (window.solflare) {
        window.solflare.off('connect', () => {});
        window.solflare.off('disconnect', () => {});
      }
    };
  }, []);

  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (publicKey && connected) {
        try {
          const lamports = await connection.getBalance(publicKey);
          setBalance(lamports / 1e9); // Convert lamports to SOL
        } catch (error) {
          console.error('Error fetching balance:', error);
          setBalance(null);
        }
      }
    };

    fetchBalance();
    
    // Set up periodic balance updates (every 30 seconds)
    const intervalId = setInterval(fetchBalance, 30000);
    return () => clearInterval(intervalId);
  }, [publicKey, connected, connection]);

  const connect = async () => {
    if (!window.solflare) {
      toast({
        title: "Wallet Not Found",
        description: "Please install the Solflare wallet extension to continue.",
        variant: "destructive",
      });
      return;
    }

    setConnecting(true);
    try {
      const response = await window.solflare.connect();
      setPublicKey(response.publicKey);
      setConnected(true);
      
      toast({
        title: "Wallet Connected",
        description: `Connected to ${response.publicKey.toString().slice(0, 8)}...`,
      });
    } catch (error: any) {
      console.error('Connection failed:', error);
      setConnecting(false);
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Solflare wallet.",
        variant: "destructive",
      });
    }
  };

  const disconnect = async () => {
    if (!window.solflare) return;

    try {
      await window.solflare.disconnect();
      setPublicKey(null);
      setConnected(false);
      setBalance(null);
      
      toast({
        title: "Wallet Disconnected",
        description: "Successfully disconnected from Solflare wallet.",
      });
    } catch (error: any) {
      console.error('Disconnection failed:', error);
      
      toast({
        title: "Disconnection Failed",
        description: error.message || "Failed to disconnect from wallet.",
        variant: "destructive",
      });
    }
  };

  // Read-only message signing for verification purposes
  const signMessage = async (message: string): Promise<string | null> => {
    if (!window.solflare || !connected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first.",
        variant: "destructive",
      });
      return null;
    }

    try {
      const messageBytes = new TextEncoder().encode(message);
      const { signature } = await window.solflare.signMessage(messageBytes, 'utf8');
      return Array.from(signature).map(byte => byte.toString(16).padStart(2, '0')).join('');
    } catch (error: any) {
      console.error('Message signing failed:', error);
      
      toast({
        title: "Signing Failed",
        description: error.message || "Failed to sign message.",
        variant: "destructive",
      });
      
      return null;
    }
  };

  const contextValue: SolflareContextType = {
    connection,
    publicKey,
    connected,
    connecting,
    balance,
    connect,
    disconnect,
    signMessage,
    isInstalled,
  };

  return (
    <SolflareContext.Provider value={contextValue}>
      {children}
    </SolflareContext.Provider>
  );
};

export const SolflareWalletButton = () => {
  const { 
    publicKey, 
    connected, 
    connecting, 
    balance, 
    connect, 
    disconnect, 
    isInstalled 
  } = useSolflare();

  if (!isInstalled) {
    return (
      <Card className="p-4 border-destructive/50 bg-destructive/10" data-testid="wallet-not-installed">
        <div className="flex items-center gap-3">
          <AlertCircle className="text-destructive" size={20} />
          <div className="flex-1">
            <h3 className="font-medium">Solflare Wallet Required</h3>
            <p className="text-sm text-muted-foreground">
              Install the Solflare browser extension to connect
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            data-testid="install-wallet-button"
          >
            <a
              href="https://solflare.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <ExternalLink size={16} />
              Install
            </a>
          </Button>
        </div>
      </Card>
    );
  }

  if (!connected) {
    return (
      <Button 
        onClick={connect}
        disabled={connecting}
        className="flex items-center gap-2"
        data-testid="connect-solflare-button"
      >
        <Wallet size={16} />
        {connecting ? 'Connecting...' : 'Connect Solflare'}
      </Button>
    );
  }

  return (
    <Card className="p-4 border-success/50 bg-success/10" data-testid="wallet-connected">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="text-success" size={20} />
            <Badge variant="secondary" className="bg-success/20 text-success">
              Connected
            </Badge>
          </div>
          <div>
            <p className="font-mono text-sm" data-testid="wallet-address">
              {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
            </p>
            <p className="text-xs text-muted-foreground" data-testid="wallet-balance">
              {balance !== null ? `${balance.toFixed(4)} SOL` : 'Loading...'}
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          data-testid="disconnect-wallet-button"
        >
          Disconnect
        </Button>
      </div>
    </Card>
  );
};

// Wallet connect dialog component
export const SolflareConnectDialog = () => {
  const { isInstalled, connected } = useSolflare();
  
  if (connected) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
      <Card className="w-full max-w-md p-6" data-testid="wallet-connect-dialog">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Wallet size={32} className="text-primary" />
          </div>
          
          <div>
            <h2 className="text-2xl font-semibold">Connect Wallet</h2>
            <p className="text-muted-foreground mt-2">
              Connect your Solflare wallet to access the prediction markets
            </p>
          </div>

          {isInstalled ? (
            <SolflareWalletButton />
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-lg border border-muted">
                <div className="flex items-center gap-3 mb-3">
                  <img 
                    src="https://solflare.com/assets/logo.svg" 
                    alt="Solflare" 
                    className="w-8 h-8"
                  />
                  <span className="font-medium">Solflare</span>
                  <Badge>Recommended</Badge>
                </div>
                <p className="text-sm text-muted-foreground mb-3">
                  A secure Solana wallet with advanced features
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="w-full"
                  data-testid="install-solflare"
                >
                  <a
                    href="https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <ExternalLink size={16} />
                    Install from Chrome Store
                  </a>
                </Button>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            <p>This is a read-only connection. You maintain full control of your wallet.</p>
          </div>
        </div>
      </Card>
    </div>
  );
};