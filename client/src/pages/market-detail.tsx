import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Calendar, TrendingUp, Users, Clock, Info, ExternalLink } from "lucide-react";
import { Market } from "@/types/market";
import { OrderForm } from "@/components/order-form";
import { OrderBook } from "@/components/order-book";
import { RecentActivity } from "@/components/recent-activity";

export default function MarketDetail() {
  const [, params] = useRoute("/market/:id");
  const marketId = params?.id;

  const { data: market, isLoading, error } = useQuery<Market>({
    queryKey: ['/api/markets', marketId],
    enabled: !!marketId,
  });

  const formatPrice = (price: string) => `$${parseFloat(price).toFixed(2)}`;
  const formatVolume = (volume: string) => {
    const vol = parseFloat(volume);
    if (vol >= 1000000) return `$${(vol / 1000000).toFixed(1)}M`;
    if (vol >= 1000) return `$${(vol / 1000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const formatExpiry = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short'
    });
  };

  const getTimeRemaining = (dateString: string) => {
    const now = new Date();
    const expiry = new Date(dateString);
    const diff = expiry.getTime() - now.getTime();
    
    if (diff <= 0) return "Expired";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (days > 30) {
      return `${Math.floor(days / 30)} months, ${days % 30} days`;
    } else if (days > 7) {
      return `${Math.floor(days / 7)} weeks, ${days % 7} days`;
    } else if (days > 0) {
      return `${days} days, ${hours} hours`;
    } else if (hours > 0) {
      return `${hours} hours, ${minutes} minutes`;
    } else {
      return `${minutes} minutes`;
    }
  };

  const getMarketStatus = (market: Market) => {
    if (market.isResolved) {
      return { 
        status: "Resolved", 
        variant: "secondary" as const,
        description: `Resolved ${market.resolution ? "YES" : "NO"}`
      };
    }
    if (!market.isActive) {
      return { 
        status: "Inactive", 
        variant: "destructive" as const,
        description: "Market is temporarily inactive"
      };
    }
    if (new Date(market.expiryDate) <= new Date()) {
      return { 
        status: "Expired", 
        variant: "outline" as const,
        description: "Market has expired and is awaiting resolution"
      };
    }
    return { 
      status: "Active", 
      variant: "default" as const,
      description: "Market is open for trading"
    };
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-6 w-32 mb-6" />
          <Skeleton className="h-12 w-96 mb-4" />
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-8">
              <Skeleton className="h-96 w-full mb-6" />
              <Skeleton className="h-64 w-full" />
            </div>
            <div className="col-span-4">
              <Skeleton className="h-80 w-full mb-6" />
              <Skeleton className="h-64 w-full" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !market) {
    return (
      <div className="min-h-screen bg-background text-foreground p-6">
        <div className="max-w-7xl mx-auto">
          <Link to="/markets">
            <Button variant="ghost" className="mb-6" data-testid="back-to-markets">
              <ArrowLeft className="mr-2" size={16} />
              Back to Markets
            </Button>
          </Link>
          <Card className="p-12 text-center">
            <h2 className="text-2xl font-semibold mb-2">Market Not Found</h2>
            <p className="text-muted-foreground mb-6">
              The market you're looking for doesn't exist or has been removed.
            </p>
            <Link to="/markets">
              <Button data-testid="browse-markets">Browse Markets</Button>
            </Link>
          </Card>
        </div>
      </div>
    );
  }

  const { status, variant, description } = getMarketStatus(market);
  const timeRemaining = getTimeRemaining(market.expiryDate);

  return (
    <div className="min-h-screen bg-background text-foreground p-6" data-testid="market-detail">
      <div className="max-w-7xl mx-auto">
        {/* Back Navigation */}
        <Link to="/markets">
          <Button variant="ghost" className="mb-6" data-testid="back-to-markets">
            <ArrowLeft className="mr-2" size={16} />
            Back to Markets
          </Button>
        </Link>

        {/* Market Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-3" data-testid="market-title">
                {market.title}
              </h1>
              <div className="flex items-center gap-3 mb-4">
                <Badge variant={variant} data-testid="market-status">
                  {status}
                </Badge>
                <span className="text-muted-foreground text-sm">{description}</span>
              </div>
            </div>
            
            {/* Current Prices */}
            <div className="flex items-center gap-4 ml-6">
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">YES</div>
                <div className="text-2xl font-bold text-green-500" data-testid="current-yes-price">
                  {formatPrice(market.yesPrice)}
                </div>
              </div>
              
              <div className="text-center">
                <div className="text-sm text-muted-foreground mb-1">NO</div>
                <div className="text-2xl font-bold text-red-500" data-testid="current-no-price">
                  {formatPrice(market.noPrice)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Market Info & Trading */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Market Details Card */}
            <Card className="p-6" data-testid="market-details">
              <h2 className="text-xl font-semibold mb-4">Market Details</h2>
              
              <div className="mb-6">
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-muted-foreground leading-relaxed" data-testid="market-description">
                  {market.description}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="text-muted-foreground" size={16} />
                    <span className="font-medium">Expiry Date</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1" data-testid="expiry-date">
                    {formatExpiry(market.expiryDate)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {timeRemaining === "Expired" ? "Expired" : `${timeRemaining} remaining`}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="text-muted-foreground" size={16} />
                    <span className="font-medium">Trading Volume</span>
                  </div>
                  <p className="text-sm" data-testid="market-volume">
                    {formatVolume(market.volume)}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="text-muted-foreground" size={16} />
                    <span className="font-medium">Liquidity</span>
                  </div>
                  <p className="text-sm" data-testid="market-liquidity">
                    {formatVolume(market.liquidity)}
                  </p>
                </div>
              </div>

              {/* Resolution Info if resolved */}
              {market.isResolved && (
                <div className="mt-6 p-4 rounded-lg bg-secondary/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="text-blue-500" size={16} />
                    <span className="font-medium">Market Resolution</span>
                  </div>
                  <p className="text-sm">
                    This market has been resolved as <strong>{market.resolution ? "YES" : "NO"}</strong>.
                    {market.resolution ? " The event occurred." : " The event did not occur."}
                  </p>
                </div>
              )}
            </Card>

            {/* Price Chart Placeholder */}
            <Card className="p-6" data-testid="price-chart">
              <h2 className="text-xl font-semibold mb-4">Price History</h2>
              <div className="h-64 bg-muted/30 rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <TrendingUp size={48} className="mx-auto mb-2 opacity-50" />
                  <p>Price chart coming soon</p>
                </div>
              </div>
            </Card>

            {/* Order Form */}
            <OrderForm market={market} />
          </div>

          {/* Right Column - Order Book & Activity */}
          <div className="col-span-12 lg:col-span-4 space-y-6">
            <OrderBook marketId={market.id} />
            <RecentActivity />
          </div>
        </div>
      </div>
    </div>
  );
}