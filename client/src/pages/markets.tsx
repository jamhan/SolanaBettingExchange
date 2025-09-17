import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Calendar, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { Market } from "@/types/market";

export default function Markets() {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: markets = [], isLoading } = useQuery<Market[]>({
    queryKey: ['/api/markets'],
  });

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

  const getTimeRemaining = (dateString: string) => {
    const now = new Date();
    const expiry = new Date(dateString);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 7) {
      return `${Math.floor(days / 7)}w ${days % 7}d`;
    } else if (days > 0) {
      return `${days}d ${hours}h`;
    } else {
      return `${hours}h`;
    }
  };

  const getMarketStatus = (market: Market) => {
    if (market.isResolved) {
      return { status: "Resolved", variant: "secondary" as const };
    }
    if (!market.isActive) {
      return { status: "Inactive", variant: "destructive" as const };
    }
    if (new Date(market.expiryDate) <= new Date()) {
      return { status: "Expired", variant: "outline" as const };
    }
    return { status: "Active", variant: "default" as const };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-48 mb-4" />
            <Skeleton className="h-12 w-full max-w-md" />
          </div>
          <div className="grid gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6" data-testid="markets-page">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="page-title">
            Prediction Markets
          </h1>
          <p className="text-muted-foreground mb-6">
            Trade on the outcomes of future events with binary prediction markets
          </p>
          
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={20} />
            <Input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="search-markets"
            />
          </div>
        </div>

        {/* Markets Grid */}
        {filteredMarkets.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-muted-foreground">
              {searchQuery ? "No markets found matching your search." : "No markets available."}
            </div>
          </Card>
        ) : (
          <div className="grid gap-4" data-testid="markets-list">
            {filteredMarkets.map((market) => {
              const { status, variant } = getMarketStatus(market);
              const timeRemaining = getTimeRemaining(market.expiryDate);
              
              return (
                <Link 
                  key={market.id} 
                  to={`/market/${market.id}`}
                  data-testid={`market-card-${market.id}`}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer border-l-4 border-l-primary/20 hover:border-l-primary">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Title and Status */}
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-semibold truncate" data-testid="market-title">
                            {market.title}
                          </h3>
                          <Badge variant={variant} data-testid="market-status">
                            {status}
                          </Badge>
                        </div>
                        
                        {/* Description (truncated) */}
                        <p className="text-muted-foreground text-sm mb-4 line-clamp-2" data-testid="market-description">
                          {market.description}
                        </p>
                        
                        {/* Market Stats */}
                        <div className="flex items-center gap-6 text-sm">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="text-muted-foreground" size={16} />
                            <span className="text-muted-foreground">Volume:</span>
                            <span className="font-medium" data-testid="market-volume">
                              {formatVolume(market.volume)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <Clock className="text-muted-foreground" size={16} />
                            <span className="text-muted-foreground">
                              {timeRemaining === "Expired" ? "Expired" : `${timeRemaining} left`}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      {/* Prices */}
                      <div className="flex items-center gap-4 ml-6">
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground mb-1">YES</div>
                          <div className="text-lg font-bold text-green-500" data-testid="market-yes-price">
                            {formatPrice(market.yesPrice)}
                          </div>
                        </div>
                        
                        <div className="text-right">
                          <div className="text-sm text-muted-foreground mb-1">NO</div>
                          <div className="text-lg font-bold text-red-500" data-testid="market-no-price">
                            {formatPrice(market.noPrice)}
                          </div>
                        </div>
                        
                        <ArrowRight className="text-muted-foreground ml-2" size={20} />
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}