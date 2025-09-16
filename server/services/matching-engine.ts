import { Order, Trade, InsertTrade } from "@shared/schema";
import { storage } from "../storage";
import Decimal from "decimal.js";

interface OrderBookEntry {
  price: Decimal;
  size: Decimal;
  orders: Order[];
}

export class MatchingEngine {
  private yesOrderBook: Map<string, OrderBookEntry[]> = new Map(); // marketId -> sorted order book
  private noOrderBook: Map<string, OrderBookEntry[]> = new Map();

  async processOrder(order: Order): Promise<{ order: Order; trades: Trade[] }> {
    const trades: Trade[] = [];
    let remainingSize = new Decimal(order.size);
    
    // Get opposite side order book
    const oppositeBook = order.side === 'YES' ? 
      this.noOrderBook.get(order.marketId) || [] :
      this.yesOrderBook.get(order.marketId) || [];

    // Process matching for limit orders
    if (order.type === 'LIMIT') {
      for (const level of oppositeBook) {
        if (remainingSize.isZero()) break;
        
        // Check if prices cross
        const canMatch = order.side === 'YES' ? 
          new Decimal(order.price).gte(level.price) :
          new Decimal(order.price).lte(level.price);
          
        if (!canMatch) break;

        // Match orders at this price level
        for (const oppositeOrder of level.orders) {
          if (remainingSize.isZero()) break;
          
          const matchSize = Decimal.min(remainingSize, new Decimal(oppositeOrder.size).minus(oppositeOrder.filled));
          
          if (matchSize.gt(0)) {
            // Create trade
            const trade = await this.executeTrade(order, oppositeOrder, matchSize, level.price);
            trades.push(trade);
            
            remainingSize = remainingSize.minus(matchSize);
            
            // Update filled amounts
            await storage.updateOrderFilled(order.id, new Decimal(order.filled).plus(matchSize).toString());
            await storage.updateOrderFilled(oppositeOrder.id, new Decimal(oppositeOrder.filled).plus(matchSize).toString());
            
            // Check if orders are completely filled
            if (new Decimal(oppositeOrder.size).eq(new Decimal(oppositeOrder.filled).plus(matchSize))) {
              await storage.updateOrderStatus(oppositeOrder.id, 'FILLED');
            }
          }
        }
      }
    }

    // Process market orders
    if (order.type === 'MARKET') {
      for (const level of oppositeBook) {
        if (remainingSize.isZero()) break;
        
        for (const oppositeOrder of level.orders) {
          if (remainingSize.isZero()) break;
          
          const matchSize = Decimal.min(remainingSize, new Decimal(oppositeOrder.size).minus(oppositeOrder.filled));
          
          if (matchSize.gt(0)) {
            const trade = await this.executeTrade(order, oppositeOrder, matchSize, level.price);
            trades.push(trade);
            
            remainingSize = remainingSize.minus(matchSize);
            
            await storage.updateOrderFilled(order.id, new Decimal(order.filled).plus(matchSize).toString());
            await storage.updateOrderFilled(oppositeOrder.id, new Decimal(oppositeOrder.filled).plus(matchSize).toString());
            
            if (new Decimal(oppositeOrder.size).eq(new Decimal(oppositeOrder.filled).plus(matchSize))) {
              await storage.updateOrderStatus(oppositeOrder.id, 'FILLED');
            }
          }
        }
      }
    }

    // Update order status
    const totalFilled = new Decimal(order.filled).plus(new Decimal(order.size).minus(remainingSize));
    
    let status = 'PENDING';
    if (totalFilled.eq(order.size)) {
      status = 'FILLED';
    } else if (totalFilled.gt(0)) {
      status = 'PARTIAL';
    }
    
    const updatedOrder = await storage.updateOrderStatus(order.id, status);

    // Add remaining order to book if not fully filled and is limit order
    if (!remainingSize.isZero() && order.type === 'LIMIT') {
      this.addToOrderBook(updatedOrder);
    }

    // Update market prices
    await this.updateMarketPrices(order.marketId);

    return { order: updatedOrder, trades };
  }

  private async executeTrade(buyOrder: Order, sellOrder: Order, size: Decimal, price: Decimal): Promise<Trade> {
    const tradeData: InsertTrade = {
      marketId: buyOrder.marketId,
      buyOrderId: buyOrder.side === 'YES' ? buyOrder.id : sellOrder.id,
      sellOrderId: buyOrder.side === 'YES' ? sellOrder.id : buyOrder.id,
      buyerId: buyOrder.side === 'YES' ? buyOrder.userId : sellOrder.userId,
      sellerId: buyOrder.side === 'YES' ? sellOrder.userId : buyOrder.userId,
      side: buyOrder.side,
      price: price.toString(),
      size: size.toString(),
    };

    const trade = await storage.createTrade(tradeData);
    
    // Update user positions
    await this.updatePositions(trade);
    
    return trade;
  }

  private async updatePositions(trade: Trade): Promise<void> {
    // Update buyer position
    await storage.updateOrCreatePosition({
      marketId: trade.marketId,
      userId: trade.buyerId,
      side: trade.side,
      shares: trade.size,
      avgPrice: trade.price,
    });

    // Update seller position (opposite side)
    const oppositeSide = trade.side === 'YES' ? 'NO' : 'YES';
    await storage.updateOrCreatePosition({
      marketId: trade.marketId,
      userId: trade.sellerId,
      side: oppositeSide,
      shares: `-${trade.size}`, // Negative shares for selling
      avgPrice: trade.price,
    });
  }

  private addToOrderBook(order: Order): void {
    const book = order.side === 'YES' ? 
      this.yesOrderBook.get(order.marketId) || [] :
      this.noOrderBook.get(order.marketId) || [];

    const price = new Decimal(order.price);
    let level = book.find(l => l.price.eq(price));
    
    if (!level) {
      level = { price, size: new Decimal(0), orders: [] };
      book.push(level);
      // Sort book: YES ascending, NO descending
      book.sort((a, b) => order.side === 'YES' ? 
        a.price.minus(b.price).toNumber() :
        b.price.minus(a.price).toNumber()
      );
    }
    
    level.orders.push(order);
    level.size = level.size.plus(new Decimal(order.size).minus(order.filled));
    
    if (order.side === 'YES') {
      this.yesOrderBook.set(order.marketId, book);
    } else {
      this.noOrderBook.set(order.marketId, book);
    }
  }

  private async updateMarketPrices(marketId: string): Promise<void> {
    const yesBook = this.yesOrderBook.get(marketId) || [];
    const noBook = this.noOrderBook.get(marketId) || [];
    
    let yesPrice = "0.5";
    let noPrice = "0.5";
    
    if (yesBook.length > 0) {
      yesPrice = yesBook[0].price.toString();
    }
    
    if (noBook.length > 0) {
      noPrice = noBook[0].price.toString();
    }
    
    await storage.updateMarketPrices(marketId, yesPrice, noPrice);
  }

  async loadOrderBook(marketId: string): Promise<void> {
    const orders = await storage.getActiveMarketOrders(marketId);
    
    for (const order of orders) {
      this.addToOrderBook(order);
    }
  }

  getOrderBook(marketId: string): { yes: OrderBookEntry[]; no: OrderBookEntry[] } {
    return {
      yes: this.yesOrderBook.get(marketId) || [],
      no: this.noOrderBook.get(marketId) || []
    };
  }
}
