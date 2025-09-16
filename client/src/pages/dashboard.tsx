import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MarketSelector } from "@/components/market-selector";
import { MarketOverview } from "@/components/market-overview";
import { OrderForm } from "@/components/order-form";
import { OrderBook } from "@/components/order-book";
import { Portfolio } from "@/components/portfolio";
import { RecentActivity } from "@/components/recent-activity";
import { CreateMarketModal } from "@/components/create-market-modal";
import { WalletButton } from "@/components/wallet-connection";
import { Market } from "@/types/market";
import { Dice2, RefreshCw, Plus, Circle } from "lucide-react";

export default function Dashboard() {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { data: markets = [], isLoading: marketsLoading } = useQuery<Market[]>({
    queryKey: ['/api/markets'],
  });

  const selectedMarket = markets.find(m => m.id === selectedMarketId) || markets[0];

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="bg-card border-b border-border px-4 py-3" data-testid="header">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2" data-testid="logo">
              <div className="w-8 h-8 gradient-primary rounded-full flex items-center justify-center">
                <Dice2 className="text-white text-sm" size={16} />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                SolBet Exchange
              </h1>
            </div>
            <nav className="hidden md:flex items-center space-x-6" data-testid="navigation">
              <a href="#" className="text-foreground hover:text-primary transition-colors" data-testid="nav-markets">
                Markets
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-portfolio">
                Portfolio
              </a>
              <a href="#" className="text-muted-foreground hover:text-foreground transition-colors" data-testid="nav-history">
                History
              </a>
              <button 
                className="text-muted-foreground hover:text-foreground transition-colors flex items-center space-x-2"
                onClick={() => setIsCreateModalOpen(true)}
                data-testid="button-create-market"
              >
                <Plus size={16} />
                <span>Create Market</span>
              </button>
            </nav>
          </div>
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 text-sm">
              <div className="flex items-center space-x-1 text-muted-foreground" data-testid="network-status">
                <Circle className="text-success text-xs" size={8} fill="currentColor" />
                <span>Mainnet</span>
              </div>
              <div className="text-muted-foreground">|</div>
              <div className="text-muted-foreground font-mono" data-testid="block-height">
                Block: 234,567,890
              </div>
            </div>
            <WalletButton />
          </div>
        </div>
      </header>

      {/* Main Dashboard */}
      <div className="flex-1 max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-12 gap-6 h-[calc(100vh-120px)]">
          
          {/* Market Selector */}
          <div className="col-span-12 lg:col-span-3">
            <MarketSelector
              markets={markets}
              selectedMarketId={selectedMarketId}
              onSelectMarket={setSelectedMarketId}
              isLoading={marketsLoading}
            />
          </div>

          {/* Main Trading Interface */}
          <div className="col-span-12 lg:col-span-6 space-y-6">
            <MarketOverview market={selectedMarket} />
            <OrderForm market={selectedMarket} />
          </div>

          {/* Order Book & Positions */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <OrderBook marketId={selectedMarket?.id} />
            <Portfolio />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-6">
          <RecentActivity />
        </div>
      </div>

      {/* Create Market Modal */}
      <CreateMarketModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
