import { Card } from "@/components/ui/card";
import { Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "./wallet-connection";
import { Position } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

export function Portfolio() {
  const { walletAddress, isConnected } = useWallet();

  const { data: positions = [], isLoading } = useQuery<Position[]>({
    queryKey: ['/api/users', walletAddress, 'positions'],
    enabled: !!walletAddress && isConnected,
  });

  const { data: user } = useQuery({
    queryKey: ['/api/users', walletAddress],
    enabled: !!walletAddress && isConnected,
  });

  const formatBalance = (balance: string) => {
    return parseFloat(balance).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatShares = (shares: string) => {
    return parseFloat(shares).toLocaleString();
  };

  const formatPrice = (price: string) => {
    return `$${parseFloat(price).toFixed(2)}`;
  };

  const calculateValue = (shares: string, avgPrice: string) => {
    return (parseFloat(shares) * parseFloat(avgPrice)).toFixed(2);
  };

  const calculatePnL = (shares: string, avgPrice: string, currentPrice: number) => {
    const value = parseFloat(shares) * parseFloat(avgPrice);
    const currentValue = parseFloat(shares) * currentPrice;
    return (currentValue - value).toFixed(2);
  };

  // Mock current prices for PnL calculation
  const mockCurrentPrices: { [key: string]: { yes: number; no: number } } = {
    'btc-100k': { yes: 0.67, no: 0.33 },
    'eth-staking': { yes: 0.82, no: 0.18 },
    'sol-tvl': { yes: 0.45, no: 0.55 },
  };

  if (!isConnected) {
    return (
      <Card className="bg-card rounded-lg border border-border" data-testid="portfolio">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Portfolio</h3>
        </div>
        <div className="p-4 text-center text-muted-foreground">
          Connect your wallet to view portfolio
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-lg border border-border" data-testid="portfolio">
      <div className="p-4 border-b border-border">
        <h3 className="text-lg font-semibold" data-testid="portfolio-title">Portfolio</h3>
      </div>
      
      <div className="p-4 space-y-4">
        {/* Balance */}
        <div className="bg-secondary/30 rounded-lg p-4" data-testid="balance-section">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Available Balance</span>
            <Wallet className="text-muted-foreground" size={16} />
          </div>
          <div className="text-2xl font-bold font-mono" data-testid="balance-amount">
            {user && 'balance' in user ? `$${formatBalance(user.balance)}` : '$0.00'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">USDC</div>
        </div>
        
        {/* Active Positions */}
        <div>
          <h4 className="text-sm font-medium mb-3" data-testid="positions-title">Active Positions</h4>
          <div className="space-y-3">
            {isLoading ? (
              Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))
            ) : positions.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4" data-testid="no-positions">
                No active positions
              </div>
            ) : (
              positions.map((position, index) => {
                const mockPrice = mockCurrentPrices['btc-100k']?.[position.side.toLowerCase() as 'yes' | 'no'] || 0.5;
                const pnl = calculatePnL(position.shares, position.avgPrice, mockPrice);
                const isPnlPositive = parseFloat(pnl) >= 0;

                return (
                  <div 
                    key={position.id} 
                    className="border border-border rounded-lg p-3"
                    data-testid={`position-${index}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium truncate" data-testid={`position-market-${index}`}>
                        Market Position #{index + 1}
                      </span>
                      <span 
                        className={`text-xs px-2 py-1 rounded ${
                          position.side === 'YES' 
                            ? 'bg-success/20 text-success' 
                            : 'bg-destructive/20 text-destructive'
                        }`}
                        data-testid={`position-side-${index}`}
                      >
                        {position.side}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">
                        Shares: <span className="font-mono text-foreground" data-testid={`position-shares-${index}`}>
                          {formatShares(position.shares)}
                        </span>
                      </span>
                      <span className="text-muted-foreground">
                        Avg: <span className="font-mono text-foreground" data-testid={`position-avg-price-${index}`}>
                          {formatPrice(position.avgPrice)}
                        </span>
                      </span>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-muted-foreground">Value:</span>
                      <span className="font-mono text-foreground" data-testid={`position-value-${index}`}>
                        ${calculateValue(position.shares, position.avgPrice)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">P&L:</span>
                      <span 
                        className={`font-mono ${isPnlPositive ? 'text-success' : 'text-destructive'}`}
                        data-testid={`position-pnl-${index}`}
                      >
                        {isPnlPositive ? '+' : ''}${pnl}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
