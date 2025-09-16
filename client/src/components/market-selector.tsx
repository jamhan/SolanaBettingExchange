import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, RefreshCw } from "lucide-react";
import { Market } from "@/types/market";
import { Skeleton } from "@/components/ui/skeleton";

interface MarketSelectorProps {
  markets: Market[];
  selectedMarketId: string | null;
  onSelectMarket: (marketId: string) => void;
  isLoading?: boolean;
}

export function MarketSelector({ 
  markets, 
  selectedMarketId, 
  onSelectMarket, 
  isLoading = false 
}: MarketSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredMarkets = markets.filter(market =>
    market.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    market.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatPrice = (price: string) => `$${parseFloat(price).toFixed(2)}`;
  const formatVolume = (volume: string) => {
    const vol = parseFloat(volume);
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  if (isLoading) {
    return (
      <Card className="bg-card rounded-lg border border-border">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-4" />
          </div>
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-lg border border-border" data-testid="market-selector">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold" data-testid="market-selector-title">Markets</h2>
          <button className="text-muted-foreground hover:text-foreground transition-colors" data-testid="button-refresh-markets">
            <RefreshCw size={16} />
          </button>
        </div>
        <div className="relative">
          <Input
            type="text"
            placeholder="Search markets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-input border border-border rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            data-testid="input-search-markets"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
        {filteredMarkets.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground" data-testid="no-markets-message">
            {searchQuery ? "No markets found" : "No markets available"}
          </div>
        ) : (
          filteredMarkets.map((market) => (
            <div
              key={market.id}
              className={`p-4 border-b border-border hover:bg-secondary/50 cursor-pointer transition-colors ${
                selectedMarketId === market.id ? 'bg-secondary/30' : ''
              }`}
              onClick={() => onSelectMarket(market.id)}
              data-testid={`market-item-${market.id}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm mb-1 truncate" data-testid={`market-title-${market.id}`}>
                    {market.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-2 line-clamp-2" data-testid={`market-description-${market.id}`}>
                    {market.description}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <span 
                        className="bg-success/20 text-success px-2 py-1 rounded font-mono"
                        data-testid={`market-yes-price-${market.id}`}
                      >
                        {formatPrice(market.yesPrice)}
                      </span>
                      <span 
                        className="bg-destructive/20 text-destructive px-2 py-1 rounded font-mono"
                        data-testid={`market-no-price-${market.id}`}
                      >
                        {formatPrice(market.noPrice)}
                      </span>
                    </div>
                    <span 
                      className="text-muted-foreground font-mono"
                      data-testid={`market-volume-${market.id}`}
                    >
                      {formatVolume(market.volume)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
