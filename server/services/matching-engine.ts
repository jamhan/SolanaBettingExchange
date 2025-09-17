import { Order, Trade, InsertTrade } from "@shared/schema";
import { storage } from "../storage";
import Decimal from "decimal.js";

interface OrderBookEntry {
  price: Decimal;
  size: Decimal;
  orders: Order[];
}

interface MatchResult {
  order: Order;
  trades: Trade[];
  rejected?: boolean;
  rejectReason?: string;
}

export class MatchingEngine {
  private yesOrderBook: Map<string, OrderBookEntry[]> = new Map(); // marketId -> sorted order book
  private noOrderBook: Map<string, OrderBookEntry[]> = new Map();

  async processOrder(order: Order): Promise<MatchResult> {
    const trades: Trade[] = [];
    let remainingSize = new Decimal(order.size);
    const originalSize = new Decimal(order.size);
    
    // Get opposite side order book with proper price-time priority sorting
    const oppositeBook = this.getOrderBookWithPrioritySort(order.marketId, order.side === 'YES' ? 'NO' : 'YES');

    // For FOK orders, check if entire order can be filled first
    if (order.type === 'FOK') {
      const canFillCompletely = this.canFillOrderCompletely(order, oppositeBook);
      if (!canFillCompletely) {
        const rejectedOrder = await storage.updateOrderStatus(order.id, 'CANCELLED');
        return { 
          order: rejectedOrder, 
          trades: [], 
          rejected: true, 
          rejectReason: 'FOK order cannot be completely filled' 
        };
      }
    }

    // Process matching based on order type
    if (['LIMIT', 'IOC', 'FOK'].includes(order.type)) {
      remainingSize = await this.processLimitTypeOrder(order, oppositeBook, remainingSize, trades);
    } else if (order.type === 'MARKET') {
      remainingSize = await this.processMarketOrder(order, oppositeBook, remainingSize, trades);
    }

    // Calculate fill status
    const totalFilled = originalSize.minus(remainingSize);
    let status = this.determineOrderStatus(order.type, totalFilled, originalSize, remainingSize);
    
    // Handle IOC and FOK post-processing
    if (order.type === 'IOC' && !remainingSize.isZero()) {
      status = totalFilled.gt(0) ? 'PARTIAL' : 'CANCELLED';
    }

    const updatedOrder = await storage.updateOrderStatus(order.id, status);

    // Add remaining order to book only for LIMIT orders that aren't fully filled
    if (!remainingSize.isZero() && order.type === 'LIMIT' && status !== 'CANCELLED') {
      this.addToOrderBook(updatedOrder);
    }

    // Update market prices
    await this.updateMarketPrices(order.marketId);

    return { order: updatedOrder, trades };
  }

  private getOrderBookWithPrioritySort(marketId: string, side: 'YES' | 'NO'): OrderBookEntry[] {
    const book = side === 'YES' ? 
      this.yesOrderBook.get(marketId) || [] :
      this.noOrderBook.get(marketId) || [];

    // Sort each price level by time (price-time priority)
    return book.map(level => ({
      ...level,
      orders: level.orders.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      )
    }));
  }

  private canFillOrderCompletely(order: Order, oppositeBook: OrderBookEntry[]): boolean {
    let availableSize = new Decimal(0);
    const orderPrice = new Decimal(order.price);
    
    for (const level of oppositeBook) {
      const canMatch = order.side === 'YES' ? 
        orderPrice.gte(level.price) :
        orderPrice.lte(level.price);
        
      if (!canMatch) break;
      
      for (const oppositeOrder of level.orders) {
        const orderSize = new Decimal(oppositeOrder.size).minus(oppositeOrder.filled);
        availableSize = availableSize.plus(orderSize);
        
        if (availableSize.gte(order.size)) {
          return true;
        }
      }
    }
    
    return false;
  }

  private async processLimitTypeOrder(
    order: Order, 
    oppositeBook: OrderBookEntry[], 
    remainingSize: Decimal, 
    trades: Trade[]
  ): Promise<Decimal> {
    const orderPrice = new Decimal(order.price);
    let orderCumulativeFilled = new Decimal(order.filled);
    
    for (const level of oppositeBook) {
      if (remainingSize.isZero()) break;
      
      // Check if prices cross
      const canMatch = order.side === 'YES' ? 
        orderPrice.gte(level.price) :
        orderPrice.lte(level.price);
        
      if (!canMatch) break;

      // Match orders at this price level with time priority
      for (const oppositeOrder of level.orders) {
        if (remainingSize.isZero()) break;
        
        const availableSize = new Decimal(oppositeOrder.size).minus(oppositeOrder.filled);
        const matchSize = Decimal.min(remainingSize, availableSize);
        
        if (matchSize.gt(0)) {
          const trade = await this.executeTrade(order, oppositeOrder, matchSize, level.price);
          trades.push(trade);
          
          remainingSize = remainingSize.minus(matchSize);
          orderCumulativeFilled = orderCumulativeFilled.plus(matchSize);
          
          // Update in-memory filled amounts for proper tracking
          oppositeOrder.filled = new Decimal(oppositeOrder.filled).plus(matchSize).toString();
          
          // Update filled amounts in storage with cumulative values
          await storage.updateOrderFilled(order.id, orderCumulativeFilled.toString());
          await storage.updateOrderFilled(oppositeOrder.id, oppositeOrder.filled);
          
          // Check if opposite order is completely filled
          if (new Decimal(oppositeOrder.size).eq(oppositeOrder.filled)) {
            await storage.updateOrderStatus(oppositeOrder.id, 'FILLED');
          }
        }
      }
    }
    
    return remainingSize;
  }

  private async processMarketOrder(
    order: Order, 
    oppositeBook: OrderBookEntry[], 
    remainingSize: Decimal, 
    trades: Trade[]
  ): Promise<Decimal> {
    let orderCumulativeFilled = new Decimal(order.filled);
    
    for (const level of oppositeBook) {
      if (remainingSize.isZero()) break;
      
      for (const oppositeOrder of level.orders) {
        if (remainingSize.isZero()) break;
        
        const availableSize = new Decimal(oppositeOrder.size).minus(oppositeOrder.filled);
        const matchSize = Decimal.min(remainingSize, availableSize);
        
        if (matchSize.gt(0)) {
          const trade = await this.executeTrade(order, oppositeOrder, matchSize, level.price);
          trades.push(trade);
          
          remainingSize = remainingSize.minus(matchSize);
          orderCumulativeFilled = orderCumulativeFilled.plus(matchSize);
          
          // Update in-memory filled amounts for proper tracking
          oppositeOrder.filled = new Decimal(oppositeOrder.filled).plus(matchSize).toString();
          
          // Update filled amounts in storage with cumulative values
          await storage.updateOrderFilled(order.id, orderCumulativeFilled.toString());
          await storage.updateOrderFilled(oppositeOrder.id, oppositeOrder.filled);
          
          // Check if opposite order is completely filled
          if (new Decimal(oppositeOrder.size).eq(oppositeOrder.filled)) {
            await storage.updateOrderStatus(oppositeOrder.id, 'FILLED');
          }
        }
      }
    }
    
    return remainingSize;
  }

  private determineOrderStatus(
    orderType: string, 
    totalFilled: Decimal, 
    originalSize: Decimal, 
    remainingSize: Decimal
  ): string {
    if (totalFilled.eq(originalSize)) {
      return 'FILLED';
    } else if (totalFilled.gt(0)) {
      return 'PARTIAL';
    } else if (orderType === 'IOC' || orderType === 'FOK') {
      return 'CANCELLED';
    } else {
      return 'PENDING';
    }
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
      // Sort book: YES descending (best bid first), NO ascending (best ask first)
      book.sort((a, b) => order.side === 'YES' ? 
        b.price.minus(a.price).toNumber() :
        a.price.minus(b.price).toNumber()
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
