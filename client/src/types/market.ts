export interface Market {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  expiryDate: string;
  isActive: boolean;
  isResolved: boolean;
  resolution?: boolean;
  yesPrice: string;
  noPrice: string;
  volume: string;
  liquidity: string;
  metadata?: any;
  createdAt: string;
}

export interface OrderBookEntry {
  price: number;
  size: number;
  total: number;
  orders: string[];
}

export interface OrderBook {
  yes: OrderBookEntry[];
  no: OrderBookEntry[];
  spread: number;
}

export interface MarketTrade {
  id: string;
  marketId: string;
  side: 'YES' | 'NO';
  price: number;
  size: number;
  timestamp: string;
}
