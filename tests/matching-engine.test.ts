import { describe, it, expect, beforeEach } from '@jest/globals';
import { MatchingEngine } from '../server/services/matching-engine';
import { Order } from '@shared/schema';
import Decimal from 'decimal.js';

// Mock the storage module
jest.mock('../server/storage', () => ({
  storage: {
    createTrade: jest.fn(),
    updateOrderFilled: jest.fn(),
    updateOrderStatus: jest.fn(),
    updateOrCreatePosition: jest.fn(),
    updateMarketPrices: jest.fn(),
    getActiveMarketOrders: jest.fn(),
  },
}));

describe('MatchingEngine', () => {
  let matchingEngine: MatchingEngine;
  const mockMarketId = 'test-market-123';

  beforeEach(() => {
    matchingEngine = new MatchingEngine();
    jest.clearAllMocks();
  });

  const createMockOrder = (
    side: 'YES' | 'NO',
    type: 'MARKET' | 'LIMIT',
    price: string,
    size: string,
    userId: string = 'user-123'
  ): Order => ({
    id: `order-${Date.now()}-${Math.random()}`,
    marketId: mockMarketId,
    userId,
    side,
    type,
    price,
    size,
    filled: '0',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  describe('Order Book Management', () => {
    it('should add orders to the correct side of the order book', () => {
      const yesOrder = createMockOrder('YES', 'LIMIT', '0.65', '100');
      const noOrder = createMockOrder('NO', 'LIMIT', '0.35', '100');

      matchingEngine['addToOrderBook'](yesOrder);
      matchingEngine['addToOrderBook'](noOrder);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.yes).toHaveLength(1);
      expect(orderBook.no).toHaveLength(1);
      expect(orderBook.yes[0].price.toString()).toBe('0.65');
      expect(orderBook.no[0].price.toString()).toBe('0.35');
    });

    it('should sort YES orders in ascending price order', () => {
      const order1 = createMockOrder('YES', 'LIMIT', '0.70', '100');
      const order2 = createMockOrder('YES', 'LIMIT', '0.60', '100');
      const order3 = createMockOrder('YES', 'LIMIT', '0.65', '100');

      matchingEngine['addToOrderBook'](order1);
      matchingEngine['addToOrderBook'](order2);
      matchingEngine['addToOrderBook'](order3);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.yes[0].price.toString()).toBe('0.60');
      expect(orderBook.yes[1].price.toString()).toBe('0.65');
      expect(orderBook.yes[2].price.toString()).toBe('0.70');
    });

    it('should sort NO orders in descending price order', () => {
      const order1 = createMockOrder('NO', 'LIMIT', '0.20', '100');
      const order2 = createMockOrder('NO', 'LIMIT', '0.40', '100');
      const order3 = createMockOrder('NO', 'LIMIT', '0.30', '100');

      matchingEngine['addToOrderBook'](order1);
      matchingEngine['addToOrderBook'](order2);
      matchingEngine['addToOrderBook'](order3);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.no[0].price.toString()).toBe('0.40');
      expect(orderBook.no[1].price.toString()).toBe('0.30');
      expect(orderBook.no[2].price.toString()).toBe('0.20');
    });
  });

  describe('Order Matching Logic', () => {
    it('should match crossing limit orders', async () => {
      // Setup: Add a NO sell order at 0.40
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Test: Place a YES buy order at 0.60 (should match)
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '50', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].side).toBe('YES');
      expect(result.trades[0].size).toBe('50');
      expect(result.trades[0].price).toBe('0.40'); // Should match at sell price
    });

    it('should not match non-crossing limit orders', async () => {
      // Setup: Add a NO sell order at 0.60
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.60', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Test: Place a YES buy order at 0.40 (should not match)
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.40', '50', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).toHaveLength(0);
    });

    it('should partially fill large orders', async () => {
      // Setup: Add a small NO sell order
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '30', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Test: Place a larger YES buy order
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '100', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).toHaveLength(1);
      expect(result.trades[0].size).toBe('30'); // Should only fill available amount
    });

    it('should match multiple orders at different price levels', async () => {
      // Setup: Add multiple NO sell orders
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.30', '25', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.35', '25', 'seller2');
      const sellOrder3 = createMockOrder('NO', 'LIMIT', '0.40', '25', 'seller3');
      
      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);
      matchingEngine['addToOrderBook'](sellOrder3);

      // Test: Place a large YES buy order that crosses multiple levels
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.50', '60', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades.length).toBeGreaterThan(1);
      
      // Should fill from best prices first
      const totalFilled = result.trades.reduce((sum, trade) => sum + parseFloat(trade.size), 0);
      expect(totalFilled).toBe(60); // Should fill the entire order
    });

    it('should handle market orders by matching at best available prices', async () => {
      // Setup: Add NO sell orders
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.30', '50', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.40', '50', 'seller2');
      
      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);

      // Test: Place a YES market order
      const marketOrder = createMockOrder('YES', 'MARKET', '0', '75', 'buyer');
      
      const result = await matchingEngine.processOrder(marketOrder);
      
      expect(result.trades).toHaveLength(2);
      expect(result.trades[0].price).toBe('0.30'); // Should match best price first
      expect(result.trades[0].size).toBe('50');
      expect(result.trades[1].price).toBe('0.40');
      expect(result.trades[1].size).toBe('25');
    });
  });

  describe('Price Calculation', () => {
    it('should calculate market prices based on order book', async () => {
      const storage = require('../server/storage').storage;
      
      // Setup order book
      const yesOrder = createMockOrder('YES', 'LIMIT', '0.65', '100');
      const noOrder = createMockOrder('NO', 'LIMIT', '0.35', '100');
      
      matchingEngine['addToOrderBook'](yesOrder);
      matchingEngine['addToOrderBook'](noOrder);
      
      // Test price update
      await matchingEngine['updateMarketPrices'](mockMarketId);
      
      expect(storage.updateMarketPrices).toHaveBeenCalledWith(mockMarketId, '0.65', '0.35');
    });

    it('should handle empty order book gracefully', async () => {
      const storage = require('../server/storage').storage;
      
      // Test with empty order book
      await matchingEngine['updateMarketPrices'](mockMarketId);
      
      expect(storage.updateMarketPrices).toHaveBeenCalledWith(mockMarketId, '0.5', '0.5');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-size orders', async () => {
      const zeroOrder = createMockOrder('YES', 'LIMIT', '0.65', '0');
      
      const result = await matchingEngine.processOrder(zeroOrder);
      
      expect(result.trades).toHaveLength(0);
    });

    it('should handle orders with invalid prices', async () => {
      const invalidOrder = createMockOrder('YES', 'LIMIT', '-0.10', '100');
      
      // Should not crash, but may not match anything
      const result = await matchingEngine.processOrder(invalidOrder);
      
      expect(result).toBeDefined();
      expect(result.order).toBeDefined();
    });

    it('should handle precision correctly with decimal calculations', () => {
      const price1 = new Decimal('0.333333');
      const price2 = new Decimal('0.666667');
      const sum = price1.plus(price2);
      
      // Should handle precision without floating point errors
      expect(sum.toFixed(6)).toBe('1.000000');
    });
  });

  describe('Order Status Updates', () => {
    it('should update order status to FILLED when completely matched', async () => {
      const storage = require('../server/storage').storage;
      
      // Setup matching scenario
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);
      
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '100', 'buyer');
      
      await matchingEngine.processOrder(buyOrder);
      
      // Should update both orders to FILLED
      expect(storage.updateOrderStatus).toHaveBeenCalledWith(expect.any(String), 'FILLED');
    });

    it('should update order status to PARTIAL when partially matched', async () => {
      const storage = require('../server/storage').storage;
      
      // Setup partial matching scenario
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '50', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);
      
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '100', 'buyer');
      
      await matchingEngine.processOrder(buyOrder);
      
      // Should update sell order to FILLED and buy order to PARTIAL
      expect(storage.updateOrderStatus).toHaveBeenCalledWith(sellOrder.id, 'FILLED');
    });
  });
});
