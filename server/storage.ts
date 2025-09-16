import { 
  users, 
  markets, 
  orders, 
  trades, 
  positions,
  type User, 
  type InsertUser,
  type Market,
  type InsertMarket,
  type Order,
  type InsertOrder,
  type Trade,
  type InsertTrade,
  type Position,
  type InsertPosition
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByWallet(walletAddress: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Market methods
  getActiveMarkets(): Promise<Market[]>;
  getMarket(id: string): Promise<Market | undefined>;
  createMarket(market: InsertMarket): Promise<Market>;
  updateMarketPrices(marketId: string, yesPrice: string, noPrice: string): Promise<void>;

  // Order methods
  getMarketOrders(marketId: string): Promise<Order[]>;
  getActiveMarketOrders(marketId: string): Promise<Order[]>;
  getUserOrders(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrderFilled(orderId: string, filled: string): Promise<void>;
  updateOrderStatus(orderId: string, status: string): Promise<Order>;
  cancelOrder(orderId: string): Promise<void>;

  // Trade methods
  getMarketTrades(marketId: string): Promise<Trade[]>;
  getUserTrades(userId: string): Promise<Trade[]>;
  createTrade(trade: InsertTrade): Promise<Trade>;

  // Position methods
  getUserPositions(userId: string): Promise<Position[]>;
  updateOrCreatePosition(positionData: {
    marketId: string;
    userId: string;
    side: string;
    shares: string;
    avgPrice: string;
  }): Promise<Position>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByWallet(walletAddress: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getActiveMarkets(): Promise<Market[]> {
    return await db
      .select()
      .from(markets)
      .where(eq(markets.isActive, true))
      .orderBy(desc(markets.createdAt));
  }

  async getMarket(id: string): Promise<Market | undefined> {
    const [market] = await db.select().from(markets).where(eq(markets.id, id));
    return market || undefined;
  }

  async createMarket(insertMarket: InsertMarket): Promise<Market> {
    const [market] = await db
      .insert(markets)
      .values(insertMarket)
      .returning();
    return market;
  }

  async updateMarketPrices(marketId: string, yesPrice: string, noPrice: string): Promise<void> {
    await db
      .update(markets)
      .set({ yesPrice, noPrice })
      .where(eq(markets.id, marketId));
  }

  async getMarketOrders(marketId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.marketId, marketId))
      .orderBy(desc(orders.createdAt));
  }

  async getActiveMarketOrders(marketId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.marketId, marketId),
          eq(orders.status, 'PENDING')
        )
      )
      .orderBy(desc(orders.createdAt));
  }

  async getUserOrders(userId: string): Promise<Order[]> {
    return await db
      .select()
      .from(orders)
      .where(eq(orders.userId, userId))
      .orderBy(desc(orders.createdAt));
  }

  async createOrder(insertOrder: InsertOrder): Promise<Order> {
    const [order] = await db
      .insert(orders)
      .values(insertOrder)
      .returning();
    return order;
  }

  async updateOrderFilled(orderId: string, filled: string): Promise<void> {
    await db
      .update(orders)
      .set({ 
        filled,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));
  }

  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    const [order] = await db
      .update(orders)
      .set({ 
        status,
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId))
      .returning();
    return order;
  }

  async cancelOrder(orderId: string): Promise<void> {
    await db
      .update(orders)
      .set({ 
        status: 'CANCELLED',
        updatedAt: new Date()
      })
      .where(eq(orders.id, orderId));
  }

  async getMarketTrades(marketId: string): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(eq(trades.marketId, marketId))
      .orderBy(desc(trades.createdAt));
  }

  async getUserTrades(userId: string): Promise<Trade[]> {
    return await db
      .select()
      .from(trades)
      .where(
        and(
          eq(trades.buyerId, userId)
        )
      )
      .orderBy(desc(trades.createdAt));
  }

  async createTrade(insertTrade: InsertTrade): Promise<Trade> {
    const [trade] = await db
      .insert(trades)
      .values(insertTrade)
      .returning();
    return trade;
  }

  async getUserPositions(userId: string): Promise<Position[]> {
    return await db
      .select()
      .from(positions)
      .where(eq(positions.userId, userId))
      .orderBy(desc(positions.updatedAt));
  }

  async updateOrCreatePosition(positionData: {
    marketId: string;
    userId: string;
    side: string;
    shares: string;
    avgPrice: string;
  }): Promise<Position> {
    const { marketId, userId, side, shares, avgPrice } = positionData;
    
    // Try to find existing position
    const [existingPosition] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.marketId, marketId),
          eq(positions.userId, userId),
          eq(positions.side, side)
        )
      );

    if (existingPosition) {
      // Update existing position
      const newShares = (parseFloat(existingPosition.shares) + parseFloat(shares)).toString();
      const newAvgPrice = (
        (parseFloat(existingPosition.shares) * parseFloat(existingPosition.avgPrice) + 
         parseFloat(shares) * parseFloat(avgPrice)) / 
        parseFloat(newShares)
      ).toString();

      const [updatedPosition] = await db
        .update(positions)
        .set({
          shares: newShares,
          avgPrice: newAvgPrice,
          updatedAt: new Date()
        })
        .where(eq(positions.id, existingPosition.id))
        .returning();
      
      return updatedPosition;
    } else {
      // Create new position
      const [newPosition] = await db
        .insert(positions)
        .values({
          marketId,
          userId,
          side,
          shares,
          avgPrice
        })
        .returning();
      
      return newPosition;
    }
  }
}

export const storage = new DatabaseStorage();
