import { storage } from "../server/storage";
import { MatchingEngine } from "../server/services/matching-engine";
import { Order, Market } from "@shared/schema";

interface SimulationConfig {
  marketId?: string;
  numTraders: number;
  ordersPerTrader: number;
  simulationDuration: number; // in milliseconds
  priceRange: { min: number; max: number };
  sizeRange: { min: number; max: number };
  marketOrderRatio: number; // 0.0 to 1.0
}

interface TraderProfile {
  id: string;
  walletAddress: string;
  bias: 'YES' | 'NO' | 'NEUTRAL'; // Trading bias
  aggressiveness: number; // 0.0 to 1.0, affects order timing and pricing
  maxPosition: number; // Maximum position size
}

interface SimulationResults {
  totalOrders: number;
  totalTrades: number;
  totalVolume: number;
  finalYesPrice: number;
  finalNoPrice: number;
  priceHistory: Array<{ timestamp: number; yesPrice: number; noPrice: number }>;
  orderBookDepth: { yes: number; no: number };
  averageSpread: number;
  executionTime: number;
}

class TradingSimulator {
  private matchingEngine: MatchingEngine;
  private config: SimulationConfig;
  private traders: TraderProfile[];
  private results: Partial<SimulationResults>;
  private priceHistory: Array<{ timestamp: number; yesPrice: number; noPrice: number }>;

  constructor(config: SimulationConfig) {
    this.matchingEngine = new MatchingEngine();
    this.config = config;
    this.traders = [];
    this.results = {};
    this.priceHistory = [];
  }

  private generateTraders(): void {
    console.log(`👥 Generating ${this.config.numTraders} traders...`);
    
    const biases: Array<'YES' | 'NO' | 'NEUTRAL'> = ['YES', 'NO', 'NEUTRAL'];
    
    for (let i = 0; i < this.config.numTraders; i++) {
      const walletAddress = `sim_trader_${i.toString().padStart(3, '0')}_${Date.now()}`;
      const bias = biases[i % 3];
      const aggressiveness = Math.random();
      const maxPosition = Math.floor(Math.random() * 10000) + 1000; // $1K to $11K max position
      
      this.traders.push({
        id: `trader_${i}`,
        walletAddress,
        bias,
        aggressiveness,
        maxPosition
      });
    }
    
    console.log(`✅ Generated ${this.traders.length} traders`);
  }

  private async createSimulationUsers(): Promise<void> {
    console.log("👤 Creating simulation users...");
    
    for (const trader of this.traders) {
      try {
        await storage.createUser({
          walletAddress: trader.walletAddress,
          username: trader.id,
          balance: (trader.maxPosition * 2).toString() // Give 2x max position as balance
        });
      } catch (error) {
        // User might already exist, ignore error
      }
    }
    
    console.log("✅ Created simulation users");
  }

  private generateOrder(trader: TraderProfile, market: Market): Order {
    // Determine order side based on trader bias and randomness
    let side: 'YES' | 'NO';
    if (trader.bias === 'NEUTRAL') {
      side = Math.random() < 0.5 ? 'YES' : 'NO';
    } else if (trader.bias === 'YES') {
      side = Math.random() < 0.7 ? 'YES' : 'NO'; // 70% chance YES
    } else {
      side = Math.random() < 0.7 ? 'NO' : 'YES'; // 70% chance NO
    }

    // Determine order type
    const orderType: 'MARKET' | 'LIMIT' = Math.random() < this.config.marketOrderRatio ? 'MARKET' : 'LIMIT';

    // Generate size
    const sizeRatio = Math.random() * (this.config.sizeRange.max - this.config.sizeRange.min) + this.config.sizeRange.min;
    const size = Math.floor(trader.maxPosition * sizeRatio * trader.aggressiveness).toString();

    // Generate price for limit orders
    let price: string;
    if (orderType === 'MARKET') {
      price = side === 'YES' ? market.yesPrice : market.noPrice;
    } else {
      const basePrice = side === 'YES' ? parseFloat(market.yesPrice) : parseFloat(market.noPrice);
      const priceVariation = (Math.random() - 0.5) * 0.2; // ±10% variation
      const newPrice = Math.max(0.01, Math.min(0.99, basePrice + priceVariation));
      price = newPrice.toFixed(4);
    }

    return {
      id: `sim_order_${Date.now()}_${Math.random()}`,
      marketId: market.id,
      userId: trader.walletAddress,
      side,
      type: orderType,
      price,
      size,
      filled: '0',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  private recordPrices(market: Market): void {
    this.priceHistory.push({
      timestamp: Date.now(),
      yesPrice: parseFloat(market.yesPrice),
      noPrice: parseFloat(market.noPrice)
    });
  }

  private calculateResults(market: Market): SimulationResults {
    const orderBook = this.matchingEngine.getOrderBook(market.id);
    
    const yesDepth = orderBook.yes.reduce((sum, level) => sum + level.size.toNumber(), 0);
    const noDepth = orderBook.no.reduce((sum, level) => sum + level.size.toNumber(), 0);
    
    const spread = orderBook.yes.length > 0 && orderBook.no.length > 0
      ? orderBook.no[0].price.minus(orderBook.yes[0].price).toNumber()
      : 0;

    const averageSpread = this.priceHistory.length > 1
      ? this.priceHistory.reduce((sum, point, index) => {
          if (index === 0) return sum;
          const prevPoint = this.priceHistory[index - 1];
          return sum + Math.abs((1 - point.yesPrice) - point.noPrice);
        }, 0) / (this.priceHistory.length - 1)
      : spread;

    return {
      totalOrders: this.results.totalOrders || 0,
      totalTrades: this.results.totalTrades || 0,
      totalVolume: this.results.totalVolume || 0,
      finalYesPrice: parseFloat(market.yesPrice),
      finalNoPrice: parseFloat(market.noPrice),
      priceHistory: this.priceHistory,
      orderBookDepth: { yes: yesDepth, no: noDepth },
      averageSpread,
      executionTime: this.results.executionTime || 0
    };
  }

  async runSimulation(marketId?: string): Promise<SimulationResults> {
    const startTime = Date.now();
    console.log("🚀 Starting trading simulation...");
    console.log(`📊 Config: ${this.config.numTraders} traders, ${this.config.ordersPerTrader} orders each`);

    // Get or create market
    let market: Market;
    if (marketId) {
      const existingMarket = await storage.getMarket(marketId);
      if (!existingMarket) {
        throw new Error(`Market ${marketId} not found`);
      }
      market = existingMarket;
    } else {
      // Use first available market
      const markets = await storage.getActiveMarkets();
      if (markets.length === 0) {
        throw new Error("No active markets found. Run seed-markets.ts first.");
      }
      market = markets[0];
    }

    console.log(`🎯 Using market: "${market.title}"`);
    
    // Load existing order book
    await this.matchingEngine.loadOrderBook(market.id);

    // Generate traders and users
    this.generateTraders();
    await this.createSimulationUsers();

    // Initialize results
    this.results = {
      totalOrders: 0,
      totalTrades: 0,
      totalVolume: 0,
    };

    // Record initial prices
    this.recordPrices(market);

    // Simulate trading
    const totalOrders = this.config.numTraders * this.config.ordersPerTrader;
    const orderInterval = this.config.simulationDuration / totalOrders;
    
    console.log(`⏱️  Placing ${totalOrders} orders over ${this.config.simulationDuration}ms`);
    console.log(`📈 Order interval: ${orderInterval.toFixed(2)}ms`);

    let orderCount = 0;
    let tradeCount = 0;
    let totalVolume = 0;

    for (let round = 0; round < this.config.ordersPerTrader; round++) {
      console.log(`🔄 Round ${round + 1}/${this.config.ordersPerTrader}`);
      
      // Shuffle traders for random order placement
      const shuffledTraders = [...this.traders].sort(() => Math.random() - 0.5);
      
      for (const trader of shuffledTraders) {
        // Generate and place order
        const order = this.generateOrder(trader, market);
        orderCount++;
        
        try {
          // Process order through matching engine
          const result = await this.matchingEngine.processOrder(order);
          
          // Update statistics
          tradeCount += result.trades.length;
          totalVolume += result.trades.reduce((sum, trade) => 
            sum + (parseFloat(trade.price) * parseFloat(trade.size)), 0
          );
          
          // Update market prices (simulated)
          if (result.trades.length > 0) {
            const lastTrade = result.trades[result.trades.length - 1];
            if (lastTrade.side === 'YES') {
              market.yesPrice = lastTrade.price;
              market.noPrice = (1 - parseFloat(lastTrade.price)).toFixed(4);
            } else {
              market.noPrice = lastTrade.price;
              market.yesPrice = (1 - parseFloat(lastTrade.price)).toFixed(4);
            }
            
            this.recordPrices(market);
          }
          
          // Small delay to simulate realistic timing
          if (orderInterval > 1) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * orderInterval));
          }
          
        } catch (error) {
          console.error(`❌ Error processing order: ${error}`);
        }
      }
      
      // Progress update
      const progress = ((round + 1) / this.config.ordersPerTrader * 100).toFixed(1);
      console.log(`   Progress: ${progress}% (${orderCount} orders, ${tradeCount} trades)`);
    }

    // Final results
    this.results.totalOrders = orderCount;
    this.results.totalTrades = tradeCount;
    this.results.totalVolume = totalVolume;
    this.results.executionTime = Date.now() - startTime;

    const finalResults = this.calculateResults(market);
    
    // Print summary
    console.log("\n📊 SIMULATION RESULTS");
    console.log("==========================================");
    console.log(`⏱️  Execution time: ${finalResults.executionTime}ms`);
    console.log(`📝 Total orders: ${finalResults.totalOrders}`);
    console.log(`🤝 Total trades: ${finalResults.totalTrades}`);
    console.log(`💰 Total volume: $${finalResults.totalVolume.toFixed(2)}`);
    console.log(`📈 Final YES price: $${finalResults.finalYesPrice.toFixed(4)}`);
    console.log(`📉 Final NO price: $${finalResults.finalNoPrice.toFixed(4)}`);
    console.log(`📏 Average spread: ${(finalResults.averageSpread * 100).toFixed(2)}%`);
    console.log(`📚 Order book depth: YES=${finalResults.orderBookDepth.yes.toFixed(0)}, NO=${finalResults.orderBookDepth.no.toFixed(0)}`);
    console.log(`🎯 Match rate: ${(finalResults.totalTrades / finalResults.totalOrders * 100).toFixed(1)}%`);

    return finalResults;
  }
}

// CLI interface
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const config: SimulationConfig = {
    numTraders: parseInt(args.find(arg => arg.startsWith('--traders='))?.split('=')[1] || '10'),
    ordersPerTrader: parseInt(args.find(arg => arg.startsWith('--orders='))?.split('=')[1] || '5'),
    simulationDuration: parseInt(args.find(arg => arg.startsWith('--duration='))?.split('=')[1] || '5000'),
    priceRange: { min: 0.1, max: 0.9 },
    sizeRange: { min: 0.01, max: 0.1 }, // 1% to 10% of max position
    marketOrderRatio: parseFloat(args.find(arg => arg.startsWith('--market-ratio='))?.split('=')[1] || '0.3'),
  };

  const marketId = args.find(arg => arg.startsWith('--market='))?.split('=')[1];

  console.log("🎮 SolBet Exchange Trading Simulation");
  console.log("=====================================");
  
  const simulator = new TradingSimulator(config);
  
  try {
    await simulator.runSimulation(marketId);
    console.log("✅ Simulation completed successfully!");
  } catch (error) {
    console.error("❌ Simulation failed:", error);
    process.exit(1);
  }
}

// Example usage functions
export async function runLoadTest(): Promise<void> {
  console.log("🔥 Running load test simulation...");
  
  const config: SimulationConfig = {
    numTraders: 100,
    ordersPerTrader: 20,
    simulationDuration: 30000, // 30 seconds
    priceRange: { min: 0.1, max: 0.9 },
    sizeRange: { min: 0.005, max: 0.05 },
    marketOrderRatio: 0.4,
  };

  const simulator = new TradingSimulator(config);
  return simulator.runSimulation();
}

export async function runQuickTest(): Promise<void> {
  console.log("⚡ Running quick test simulation...");
  
  const config: SimulationConfig = {
    numTraders: 5,
    ordersPerTrader: 3,
    simulationDuration: 2000, // 2 seconds
    priceRange: { min: 0.2, max: 0.8 },
    sizeRange: { min: 0.01, max: 0.05 },
    marketOrderRatio: 0.2,
  };

  const simulator = new TradingSimulator(config);
  return simulator.runSimulation();
}

// Run CLI if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { TradingSimulator, SimulationConfig, SimulationResults };
