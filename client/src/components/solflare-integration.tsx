import { useState, useEffect } from 'react';
import { PublicKey } from '@solana/web3.js';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Wallet, ExternalLink, CheckCircle, AlertCircle } from 'lucide-react';

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

// Simple hook to detect and interact with Solflare wallet
export const useSolflareWallet = () => {
  const [isInstalled, setIsInstalled] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [connecting, setConnecting] = useState(false);
  
  const { toast } = useToast();

  // Check if Solflare is installed
  useEffect(() => {
    const checkInstalled = () => {
      if (typeof window !== 'undefined' && window.solflare) {
        setIsInstalled(true);
        setIsConnected(window.solflare.isConnected);
        setPublicKey(window.solflare.publicKey);

        // Set up event listeners
        window.solflare.on('connect', (publicKey: PublicKey) => {
          setPublicKey(publicKey);
          setIsConnected(true);
          setConnecting(false);
        });

        window.solflare.on('disconnect', () => {
          setPublicKey(null);
          setIsConnected(false);
          setConnecting(false);
        });
      } else {
        // Retry checking in 1 second
        setTimeout(checkInstalled, 1000);
      }
    };

    checkInstalled();

    return () => {
      if (window.solflare) {
        window.solflare.off('connect', () => {});
        window.solflare.off('disconnect', () => {});
      }
    };
  }, []);

  const connect = async (): Promise<string | null> => {
    if (!window.solflare) {
      toast({
        title: "Solflare Not Found",
        description: "Please install the Solflare wallet extension.",
        variant: "destructive",
      });
      return null;
    }

    setConnecting(true);
    try {
      const response = await window.solflare.connect();
      const address = response.publicKey.toString();
      
      toast({
        title: "Solflare Connected",
        description: `Connected to ${address.slice(0, 8)}...`,
      });
      
      return address;
    } catch (error: any) {
      console.error('Solflare connection failed:', error);
      setConnecting(false);
      
      toast({
        title: "Connection Failed",
        description: error.message || "Failed to connect to Solflare wallet.",
        variant: "destructive",
      });
      
      return null;
    }
  };

  const disconnect = async () => {
    if (!window.solflare) return;

    try {
      await window.solflare.disconnect();
      toast({
        title: "Solflare Disconnected",
        description: "Wallet disconnected successfully.",
      });
    } catch (error: any) {
      console.error('Solflare disconnection failed:', error);
      toast({
        title: "Disconnection Failed",
        description: error.message || "Failed to disconnect wallet.",
        variant: "destructive",
      });
    }
  };

  // Read-only message signing for verification
  const signMessage = async (message: string): Promise<string | null> => {
    if (!window.solflare || !isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your Solflare wallet first.",
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

  return {
    isInstalled,
    isConnected,
    publicKey,
    connecting,
    connect,
    disconnect,
    signMessage,
  };
};

// Solflare wallet connection component
export const SolflareWalletCard = () => {
  const { 
    isInstalled, 
    isConnected, 
    publicKey, 
    connecting, 
    connect, 
    disconnect 
  } = useSolflareWallet();

  if (!isInstalled) {
    return (
      <Card className="p-4 border-muted" data-testid="solflare-not-installed">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FF6B35'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E" 
              alt="Solflare" 
              className="w-6 h-6"
            />
            <span className="font-medium">Solflare Wallet</span>
            <Badge variant="outline">Not Installed</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mt-2 mb-3">
          Install Solflare for secure read-only wallet connection
        </p>
        <Button
          variant="outline"
          size="sm"
          asChild
          className="w-full"
          data-testid="install-solflare"
        >
          <a
            href="https://solflare.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2"
          >
            <ExternalLink size={16} />
            Install Solflare
          </a>
        </Button>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card className="p-4 border-muted" data-testid="solflare-disconnected">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img 
              src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23FF6B35'%3E%3Cpath d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/%3E%3C/svg%3E" 
              alt="Solflare" 
              className="w-6 h-6"
            />
            <span className="font-medium">Solflare Wallet</span>
            <Badge variant="outline">Available</Badge>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Connect your Solflare wallet for read-only access
        </p>
        <Button
          onClick={connect}
          disabled={connecting}
          className="w-full flex items-center gap-2"
          data-testid="connect-solflare"
        >
          <Wallet size={16} />
          {connecting ? 'Connecting...' : 'Connect Solflare'}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-success/50 bg-success/5" data-testid="solflare-connected">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CheckCircle className="text-success" size={20} />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium">Solflare Connected</span>
              <Badge variant="secondary" className="bg-success/20 text-success">
                Read-only
              </Badge>
            </div>
            <p className="font-mono text-sm text-muted-foreground" data-testid="solflare-address">
              {publicKey?.toString().slice(0, 8)}...{publicKey?.toString().slice(-8)}
            </p>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={disconnect}
          data-testid="disconnect-solflare"
        >
          Disconnect
        </Button>
      </div>
    </Card>
  );
};

// Optional integration button for existing wallet UI
export const SolflareIntegrationButton = ({ onConnect }: { onConnect?: (address: string) => void }) => {
  const { isInstalled, connect } = useSolflareWallet();

  const handleConnect = async () => {
    const address = await connect();
    if (address && onConnect) {
      onConnect(address);
    }
  };

  if (!isInstalled) {
    return (
      <Button
        variant="outline"
        size="sm"
        asChild
        className="flex items-center gap-2"
        data-testid="install-solflare-button"
      >
        <a href="https://solflare.com/" target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} />
          Install Solflare
        </a>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleConnect}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
      data-testid="connect-solflare-button"
    >
      <Wallet size={16} />
      Connect Solflare
    </Button>
  );
};