import { Card } from "@/components/ui/card";
import { Calendar, TrendingUp } from "lucide-react";
import { Market } from "@/types/market";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketOverviewProps {
  market?: Market;
}

export function MarketOverview({ market }: MarketOverviewProps) {
  if (!market) {
    return (
      <Card className="bg-card rounded-lg border border-border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
          <div>
            <Skeleton className="h-8 w-96 mb-2" />
            <Skeleton className="h-5 w-80 mb-3" />
            <div className="flex items-center space-x-4 text-sm">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="flex items-center space-x-3 mt-4 sm:mt-0">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-12 w-20" />
          </div>
        </div>
        <Skeleton className="h-64 w-full" />
      </Card>
    );
  }

  const formatPrice = (price: string) => `$${parseFloat(price).toFixed(2)}`;
  const formatVolume = (volume: string) => {
    const vol = parseFloat(volume);
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatExpiry = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    });
  };

  return (
    <Card className="bg-card rounded-lg border border-border p-6" data-testid="market-overview">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2" data-testid="market-title">
            {market.title}
          </h1>
          <p className="text-muted-foreground mb-3" data-testid="market-description">
            {market.description}
          </p>
          <div className="flex items-center space-x-4 text-sm">
            <div className="flex items-center space-x-2" data-testid="market-expiry">
              <Calendar className="text-muted-foreground" size={16} />
              <span className="text-muted-foreground">Expires:</span>
              <span className="font-mono">{formatExpiry(market.expiryDate)}</span>
            </div>
            <div className="flex items-center space-x-2" data-testid="market-volume">
              <TrendingUp className="text-muted-foreground" size={16} />
              <span className="text-muted-foreground">Volume:</span>
              <span className="font-mono">{formatVolume(market.volume)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center space-x-3 mt-4 sm:mt-0">
          <div className="text-center">
            <div className="text-3xl font-bold text-success mb-1" data-testid="yes-price">
              {formatPrice(market.yesPrice)}
            </div>
            <div className="text-xs text-muted-foreground">YES</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-destructive mb-1" data-testid="no-price">
              {formatPrice(market.noPrice)}
            </div>
            <div className="text-xs text-muted-foreground">NO</div>
          </div>
        </div>
      </div>
      
      {/* Chart Placeholder */}
      <div className="bg-secondary/30 rounded-lg p-6 text-center border border-border" data-testid="price-chart">
        <TrendingUp className="mx-auto text-4xl text-muted-foreground mb-3" size={64} />
        <p className="text-muted-foreground">Price Chart</p>
        <p className="text-xs text-muted-foreground mt-1">Real-time price movements and volume</p>
      </div>
    </Card>
  );
}
