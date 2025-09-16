import { Card } from "@/components/ui/card";
import { Circle } from "lucide-react";
import { useWebSocket } from "@/hooks/use-websocket";
import { useEffect, useState } from "react";

interface OrderBookEntry {
  price: string;
  size: string;
  total: string;
}

interface OrderBookData {
  yes: { price: string; size: string; orders: any[] }[];
  no: { price: string; size: string; orders: any[] }[];
}

interface OrderBookProps {
  marketId?: string;
}

export function OrderBook({ marketId }: OrderBookProps) {
  const [orderBook, setOrderBook] = useState<OrderBookData>({ yes: [], no: [] });
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    if (!lastMessage) return;

    try {
      const data = JSON.parse(lastMessage);
      if (data.type === 'ORDER_BOOK_UPDATE' && data.marketId === marketId) {
        setOrderBook(data.data);
      }
    } catch (error) {
      console.error('Error parsing WebSocket message:', error);
    }
  }, [lastMessage, marketId]);

  const formatPrice = (price: string) => `$${parseFloat(price).toFixed(2)}`;
  const formatSize = (size: string) => {
    const sizeNum = parseFloat(size);
    if (sizeNum >= 1000000) return `${(sizeNum / 1000000).toFixed(1)}M`;
    if (sizeNum >= 1000) return `${(sizeNum / 1000).toFixed(1)}K`;
    return sizeNum.toLocaleString();
  };
  const formatTotal = (total: string) => `$${parseFloat(total).toLocaleString()}`;

  // Mock data for demo (replace with real data from WebSocket)
  const mockSellOrders: OrderBookEntry[] = [
    { price: "0.35", size: "1250", total: "437.50" },
    { price: "0.34", size: "2100", total: "714.00" },
    { price: "0.33", size: "890", total: "293.70" },
  ];

  const mockBuyOrders: OrderBookEntry[] = [
    { price: "0.67", size: "3200", total: "2080.00" },
    { price: "0.66", size: "1750", total: "1120.00" },
    { price: "0.65", size: "950", total: "598.50" },
  ];

  const spread = mockSellOrders.length > 0 && mockBuyOrders.length > 0 
    ? (parseFloat(mockSellOrders[mockSellOrders.length - 1].price) - parseFloat(mockBuyOrders[0].price)).toFixed(2)
    : "0.02";

  const sellOrders = orderBook.no.length > 0 ? orderBook.no.map(entry => ({
    price: entry.price,
    size: entry.size,
    total: (parseFloat(entry.price) * parseFloat(entry.size)).toFixed(2)
  })) : mockSellOrders;

  const buyOrders = orderBook.yes.length > 0 ? orderBook.yes.map(entry => ({
    price: entry.price,
    size: entry.size,
    total: (parseFloat(entry.price) * parseFloat(entry.size)).toFixed(2)
  })) : mockBuyOrders;

  return (
    <Card className="bg-card rounded-lg border border-border" data-testid="order-book">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" data-testid="order-book-title">Order Book</h3>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-xs">
              <Circle className="text-success animate-pulse-slow" size={8} fill="currentColor" />
              <span className="text-muted-foreground">Live</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto scrollbar-thin">
        {/* Sell Orders (NO) */}
        <div className="p-3 border-b border-border" data-testid="sell-orders">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Price</span>
            <span>Size</span>
            <span>Total</span>
          </div>
          {sellOrders.map((order, index) => (
            <div 
              key={index} 
              className="flex justify-between text-xs font-mono py-1 hover:bg-destructive/5 cursor-pointer transition-colors"
              data-testid={`sell-order-${index}`}
            >
              <span className="text-destructive" data-testid={`sell-price-${index}`}>
                {formatPrice(order.price)}
              </span>
              <span className="text-muted-foreground" data-testid={`sell-size-${index}`}>
                {formatSize(order.size)}
              </span>
              <span className="text-muted-foreground" data-testid={`sell-total-${index}`}>
                {formatTotal(order.total)}
              </span>
            </div>
          ))}
        </div>
        
        {/* Spread */}
        <div className="p-3 bg-secondary/20 text-center" data-testid="spread">
          <div className="text-xs text-muted-foreground mb-1">Spread</div>
          <div className="text-lg font-mono font-bold" data-testid="spread-value">
            ${spread}
          </div>
        </div>
        
        {/* Buy Orders (YES) */}
        <div className="p-3" data-testid="buy-orders">
          <div className="flex justify-between text-xs text-muted-foreground mb-2">
            <span>Price</span>
            <span>Size</span>
            <span>Total</span>
          </div>
          {buyOrders.map((order, index) => (
            <div 
              key={index} 
              className="flex justify-between text-xs font-mono py-1 hover:bg-success/5 cursor-pointer transition-colors"
              data-testid={`buy-order-${index}`}
            >
              <span className="text-success" data-testid={`buy-price-${index}`}>
                {formatPrice(order.price)}
              </span>
              <span className="text-muted-foreground" data-testid={`buy-size-${index}`}>
                {formatSize(order.size)}
              </span>
              <span className="text-muted-foreground" data-testid={`buy-total-${index}`}>
                {formatTotal(order.total)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
