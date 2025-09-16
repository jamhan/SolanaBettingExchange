import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "./wallet-connection";
import { useState } from "react";
import { Trade, Order } from "@shared/schema";

type ActivityTab = 'orders' | 'trades' | 'pnl';

export function RecentActivity() {
  const [activeTab, setActiveTab] = useState<ActivityTab>('orders');
  const { walletAddress, isConnected } = useWallet();

  const { data: orders = [] } = useQuery<Order[]>({
    queryKey: ['/api/users', walletAddress, 'orders'],
    enabled: !!walletAddress && isConnected,
  });

  const { data: trades = [] } = useQuery<Trade[]>({
    queryKey: ['/api/users', walletAddress, 'trades'],
    enabled: !!walletAddress && isConnected,
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatPrice = (price: string) => `$${parseFloat(price).toFixed(2)}`;
  const formatSize = (size: string) => parseFloat(size).toLocaleString();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'FILLED': return 'bg-success/20 text-success';
      case 'PENDING': return 'bg-primary/20 text-primary';
      case 'CANCELLED': return 'bg-muted/20 text-muted-foreground';
      case 'PARTIAL': return 'bg-accent/20 text-accent';
      default: return 'bg-muted/20 text-muted-foreground';
    }
  };

  const getSideColor = (side: string) => {
    return side === 'YES' ? 'bg-success/20 text-success' : 'bg-destructive/20 text-destructive';
  };

  // Mock data for demo
  const mockOrders = [
    {
      id: '1',
      createdAt: new Date().toISOString(),
      marketTitle: 'BTC > $100k',
      side: 'YES',
      price: '0.65',
      size: '150',
      status: 'FILLED'
    },
    {
      id: '2',
      createdAt: new Date(Date.now() - 180000).toISOString(),
      marketTitle: 'ETH Staking',
      side: 'NO',
      price: '0.22',
      size: '75',
      status: 'PENDING'
    },
    {
      id: '3',
      createdAt: new Date(Date.now() - 540000).toISOString(),
      marketTitle: 'SOL TVL > $5B',
      side: 'YES',
      price: '0.48',
      size: '200',
      status: 'CANCELLED'
    },
  ];

  const mockTrades = [
    {
      id: '1',
      createdAt: new Date().toISOString(),
      marketTitle: 'BTC > $100k',
      side: 'YES',
      price: '0.65',
      size: '150'
    },
  ];

  const displayOrders = orders.length > 0 ? orders : mockOrders;
  const displayTrades = trades.length > 0 ? trades : mockTrades;

  return (
    <Card className="bg-card rounded-lg border border-border" data-testid="recent-activity">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold" data-testid="activity-title">Recent Activity</h3>
          <div className="flex space-x-2">
            <Button
              variant={activeTab === 'orders' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('orders')}
              data-testid="tab-orders"
            >
              Orders
            </Button>
            <Button
              variant={activeTab === 'trades' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('trades')}
              data-testid="tab-trades"
            >
              Trades
            </Button>
            <Button
              variant={activeTab === 'pnl' ? 'default' : 'secondary'}
              size="sm"
              onClick={() => setActiveTab('pnl')}
              data-testid="tab-pnl"
            >
              P&L
            </Button>
          </div>
        </div>
      </div>
      
      {!isConnected ? (
        <div className="p-8 text-center text-muted-foreground">
          Connect your wallet to view activity
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-secondary/50">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Time</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Market</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Side</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">Size</th>
                <th className="px-4 py-3 text-xs font-medium text-muted-foreground">
                  {activeTab === 'orders' ? 'Status' : 'Total'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeTab === 'orders' ? (
                displayOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground" data-testid="no-orders">
                      No orders found
                    </td>
                  </tr>
                ) : (
                  displayOrders.map((order, index) => (
                    <tr key={order.id} className="hover:bg-secondary/20" data-testid={`order-row-${index}`}>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground" data-testid={`order-time-${index}`}>
                        {formatTime(typeof order.createdAt === 'string' ? order.createdAt : order.createdAt.toISOString())}
                      </td>
                      <td className="px-4 py-3 text-sm" data-testid={`order-market-${index}`}>
                        {'marketTitle' in order ? order.marketTitle : `Market ${order.id}`}
                      </td>
                      <td className="px-4 py-3" data-testid={`order-side-${index}`}>
                        <span className={`text-xs px-2 py-1 rounded ${getSideColor(order.side)}`}>
                          BUY {order.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" data-testid={`order-price-${index}`}>
                        {formatPrice(order.price)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" data-testid={`order-size-${index}`}>
                        {formatSize(order.size)}
                      </td>
                      <td className="px-4 py-3" data-testid={`order-status-${index}`}>
                        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )
              ) : activeTab === 'trades' ? (
                displayTrades.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground" data-testid="no-trades">
                      No trades found
                    </td>
                  </tr>
                ) : (
                  displayTrades.map((trade, index) => (
                    <tr key={trade.id} className="hover:bg-secondary/20" data-testid={`trade-row-${index}`}>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground" data-testid={`trade-time-${index}`}>
                        {formatTime(typeof trade.createdAt === 'string' ? trade.createdAt : trade.createdAt.toISOString())}
                      </td>
                      <td className="px-4 py-3 text-sm" data-testid={`trade-market-${index}`}>
                        {'marketTitle' in trade ? trade.marketTitle : `Market ${trade.id}`}
                      </td>
                      <td className="px-4 py-3" data-testid={`trade-side-${index}`}>
                        <span className={`text-xs px-2 py-1 rounded ${getSideColor(trade.side)}`}>
                          {trade.side}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" data-testid={`trade-price-${index}`}>
                        {formatPrice(trade.price)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" data-testid={`trade-size-${index}`}>
                        {formatSize(trade.size)}
                      </td>
                      <td className="px-4 py-3 text-sm font-mono" data-testid={`trade-total-${index}`}>
                        ${(parseFloat(trade.price) * parseFloat(trade.size)).toFixed(2)}
                      </td>
                    </tr>
                  ))
                )
              ) : (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    P&L tracking coming soon
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
