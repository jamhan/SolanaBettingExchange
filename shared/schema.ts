import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, uuid, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  walletAddress: varchar("wallet_address", { length: 44 }).notNull().unique(),
  username: text("username").unique(),
  balance: decimal("balance", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const markets = pgTable("markets", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  creatorId: uuid("creator_id").notNull().references(() => users.id),
  expiryDate: timestamp("expiry_date").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolution: boolean("resolution"),
  yesPrice: decimal("yes_price", { precision: 5, scale: 4 }).notNull().default("0.5"),
  noPrice: decimal("no_price", { precision: 5, scale: 4 }).notNull().default("0.5"),
  volume: decimal("volume", { precision: 18, scale: 6 }).notNull().default("0"),
  liquidity: decimal("liquidity", { precision: 18, scale: 6 }).notNull().default("0"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid("market_id").notNull().references(() => markets.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  side: varchar("side", { length: 4 }).notNull(), // 'YES' or 'NO'
  type: varchar("type", { length: 10 }).notNull(), // 'MARKET' or 'LIMIT'
  price: decimal("price", { precision: 5, scale: 4 }).notNull(),
  size: decimal("size", { precision: 18, scale: 6 }).notNull(),
  filled: decimal("filled", { precision: 18, scale: 6 }).notNull().default("0"),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"), // 'PENDING', 'FILLED', 'CANCELLED', 'PARTIAL'
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

export const trades = pgTable("trades", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid("market_id").notNull().references(() => markets.id),
  buyOrderId: uuid("buy_order_id").notNull().references(() => orders.id),
  sellOrderId: uuid("sell_order_id").notNull().references(() => orders.id),
  buyerId: uuid("buyer_id").notNull().references(() => users.id),
  sellerId: uuid("seller_id").notNull().references(() => users.id),
  side: varchar("side", { length: 4 }).notNull(), // 'YES' or 'NO'
  price: decimal("price", { precision: 5, scale: 4 }).notNull(),
  size: decimal("size", { precision: 18, scale: 6 }).notNull(),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
});

export const positions = pgTable("positions", {
  id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  marketId: uuid("market_id").notNull().references(() => markets.id),
  userId: uuid("user_id").notNull().references(() => users.id),
  side: varchar("side", { length: 4 }).notNull(), // 'YES' or 'NO'
  shares: decimal("shares", { precision: 18, scale: 6 }).notNull().default("0"),
  avgPrice: decimal("avg_price", { precision: 5, scale: 4 }).notNull().default("0"),
  realizedPnl: decimal("realized_pnl", { precision: 18, scale: 6 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  markets: many(markets),
  orders: many(orders),
  trades: many(trades),
  positions: many(positions),
}));

export const marketsRelations = relations(markets, ({ one, many }) => ({
  creator: one(users, {
    fields: [markets.creatorId],
    references: [users.id],
  }),
  orders: many(orders),
  trades: many(trades),
  positions: many(positions),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  market: one(markets, {
    fields: [orders.marketId],
    references: [markets.id],
  }),
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  buyTrades: many(trades, { relationName: "buyOrder" }),
  sellTrades: many(trades, { relationName: "sellOrder" }),
}));

export const tradesRelations = relations(trades, ({ one }) => ({
  market: one(markets, {
    fields: [trades.marketId],
    references: [markets.id],
  }),
  buyOrder: one(orders, {
    fields: [trades.buyOrderId],
    references: [orders.id],
    relationName: "buyOrder",
  }),
  sellOrder: one(orders, {
    fields: [trades.sellOrderId],
    references: [orders.id],
    relationName: "sellOrder",
  }),
  buyer: one(users, {
    fields: [trades.buyerId],
    references: [users.id],
  }),
  seller: one(users, {
    fields: [trades.sellerId],
    references: [users.id],
  }),
}));

export const positionsRelations = relations(positions, ({ one }) => ({
  market: one(markets, {
    fields: [positions.marketId],
    references: [markets.id],
  }),
  user: one(users, {
    fields: [positions.userId],
    references: [users.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  balance: true,
  createdAt: true,
});

export const insertMarketSchema = createInsertSchema(markets).omit({
  id: true,
  isActive: true,
  isResolved: true,
  resolution: true,
  yesPrice: true,
  noPrice: true,
  volume: true,
  createdAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  filled: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertTradeSchema = createInsertSchema(trades).omit({
  id: true,
  createdAt: true,
});

export const insertPositionSchema = createInsertSchema(positions).omit({
  id: true,
  shares: true,
  avgPrice: true,
  realizedPnl: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Market = typeof markets.$inferSelect;
export type InsertMarket = z.infer<typeof insertMarketSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type Trade = typeof trades.$inferSelect;
export type InsertTrade = z.infer<typeof insertTradeSchema>;

export type Position = typeof positions.$inferSelect;
export type InsertPosition = z.infer<typeof insertPositionSchema>;
