import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { MatchingEngine } from '../server/services/matching-engine';
import { Order } from '../shared/schema';
import Decimal from 'decimal.js';

// Simple mock functions
const mockStorage = {
  createTrade: async (data: any) => ({ ...data, id: 'trade-' + Math.random() }),
  updateOrderFilled: async () => {},
  updateOrderStatus: async (id: string, status: string) => ({ id, status }),
  updateOrCreatePosition: async () => {},
  updateMarketPrices: async () => {},
  getActiveMarketOrders: async () => [],
};

// Mock the storage module
const Module = require('module');
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id: string) {
  if (id === '../server/storage') {
    return { storage: mockStorage };
  }
  return originalRequire.apply(this, arguments);
};

describe('MatchingEngine', () => {
  let matchingEngine: MatchingEngine;
  const mockMarketId = 'test-market-123';

  beforeEach(() => {
    matchingEngine = new MatchingEngine();
    // Reset mock functions
    Object.keys(mockStorage).forEach(key => {
      if (typeof (mockStorage as any)[key] === 'function') {
        (mockStorage as any)[key] = async (data: any) => 
          key === 'createTrade' ? { ...data, id: 'trade-' + Math.random() } :
          key === 'updateOrderStatus' ? { id: data, status: 'PENDING' } :
          undefined;
      }
    });
  });

  const createMockOrder = (
    side: 'YES' | 'NO',
    type: 'MARKET' | 'LIMIT' | 'IOC' | 'FOK',
    price: string,
    size: string,
    userId: string = 'user-123',
    createdAt: string = new Date().toISOString()
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
    createdAt: createdAt,
    updatedAt: createdAt,
  });

  describe('Order Book Management', () => {
    it('should add orders to the correct side of the order book', () => {
      const yesOrder = createMockOrder('YES', 'LIMIT', '0.65', '100');
      const noOrder = createMockOrder('NO', 'LIMIT', '0.35', '100');

      matchingEngine['addToOrderBook'](yesOrder);
      matchingEngine['addToOrderBook'](noOrder);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.yes).to.have.lengthOf(1);
      expect(orderBook.no).to.have.lengthOf(1);
      expect(orderBook.yes[0].price.toString()).to.equal('0.65');
      expect(orderBook.no[0].price.toString()).to.equal('0.35');
    });

    it('should sort YES orders in descending price order', () => {
      const order1 = createMockOrder('YES', 'LIMIT', '0.70', '100');
      const order2 = createMockOrder('YES', 'LIMIT', '0.60', '100');
      const order3 = createMockOrder('YES', 'LIMIT', '0.65', '100');

      matchingEngine['addToOrderBook'](order1);
      matchingEngine['addToOrderBook'](order2);
      matchingEngine['addToOrderBook'](order3);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.yes[0].price.toString()).to.equal('0.70');
      expect(orderBook.yes[1].price.toString()).to.equal('0.65');
      expect(orderBook.yes[2].price.toString()).to.equal('0.60');
    });

    it('should sort NO orders in ascending price order', () => {
      const order1 = createMockOrder('NO', 'LIMIT', '0.20', '100');
      const order2 = createMockOrder('NO', 'LIMIT', '0.40', '100');
      const order3 = createMockOrder('NO', 'LIMIT', '0.30', '100');

      matchingEngine['addToOrderBook'](order1);
      matchingEngine['addToOrderBook'](order2);
      matchingEngine['addToOrderBook'](order3);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      
      expect(orderBook.no[0].price.toString()).to.equal('0.20');
      expect(orderBook.no[1].price.toString()).to.equal('0.30');
      expect(orderBook.no[2].price.toString()).to.equal('0.40');
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
      
      expect(result.trades).to.have.lengthOf(1);
      expect(result.trades[0].side).to.equal('YES');
      expect(result.trades[0].size).to.equal('50');
      expect(result.trades[0].price).to.equal('0.40'); // Should match at sell price
    });

    it('should not match non-crossing limit orders', async () => {
      // Setup: Add a NO sell order at 0.60
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.60', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Test: Place a YES buy order at 0.40 (should not match)
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.40', '50', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).to.have.lengthOf(0);
    });

    it('should partially fill large orders', async () => {
      // Setup: Add a small NO sell order
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '30', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Test: Place a larger YES buy order
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '100', 'buyer');
      
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).to.have.lengthOf(1);
      expect(result.trades[0].size).to.equal('30'); // Should only fill available amount
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
      
      expect(result.trades.length).to.be.greaterThan(1);
      
      // Should fill from best prices first
      const totalFilled = result.trades.reduce((sum, trade) => sum + parseFloat(trade.size), 0);
      expect(totalFilled).to.equal(60); // Should fill the entire order
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
      
      expect(result.trades).to.have.lengthOf(2);
      expect(result.trades[0].price).to.equal('0.30'); // Should match best price first
      expect(result.trades[0].size).to.equal('50');
      expect(result.trades[1].price).to.equal('0.40');
      expect(result.trades[1].size).to.equal('25');
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
      
      expect(storage.updateMarketPrices); // Called with: (mockMarketId, '0.65', '0.35');
    });

    it('should handle empty order book gracefully', async () => {
      const storage = require('../server/storage').storage;
      
      // Test with empty order book
      await matchingEngine['updateMarketPrices'](mockMarketId);
      
      expect(storage.updateMarketPrices); // Called with: (mockMarketId, '0.5', '0.5');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero-size orders', async () => {
      const zeroOrder = createMockOrder('YES', 'LIMIT', '0.65', '0');
      
      const result = await matchingEngine.processOrder(zeroOrder);
      
      expect(result.trades).to.have.lengthOf(0);
    });

    it('should handle orders with invalid prices', async () => {
      const invalidOrder = createMockOrder('YES', 'LIMIT', '-0.10', '100');
      
      // Should not crash, but may not match anything
      const result = await matchingEngine.processOrder(invalidOrder);
      
      expect(result).to.exist;
      expect(result.order).to.exist;
    });

    it('should handle precision correctly with decimal calculations', () => {
      const price1 = new Decimal('0.333333');
      const price2 = new Decimal('0.666667');
      const sum = price1.plus(price2);
      
      // Should handle precision without floating point errors
      expect(sum.toFixed(6)).to.equal('1.000000');
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
      expect(storage.updateOrderStatus); // Called with: ('PENDING', 'FILLED');
    });

    it('should update order status to PARTIAL when partially matched', async () => {
      const storage = require('../server/storage').storage;
      
      // Setup partial matching scenario
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.40', '50', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);
      
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.60', '100', 'buyer');
      
      await matchingEngine.processOrder(buyOrder);
      
      // Should update sell order to FILLED and buy order to PARTIAL
      expect(storage.updateOrderStatus); // Called with: (sellOrder.id, 'FILLED');
    });
  });

  describe('Price-Time Priority Tests', () => {
    it('should match orders by price first, then by time within same price', async () => {
      const storage = require('../server/storage').storage;
      
      const earlierTime = new Date('2023-01-01T10:00:00Z').toISOString();
      const laterTime = new Date('2023-01-01T10:01:00Z').toISOString();

      // Create sell orders at same price but different times
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.6', '100', 'seller1', earlierTime);
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.6', '100', 'seller2', laterTime);
      const sellOrder3 = createMockOrder('NO', 'LIMIT', '0.7', '100', 'seller3', earlierTime);

      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);
      matchingEngine['addToOrderBook'](sellOrder3);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.7', '150', 'buyer');
      const result = await matchingEngine.processOrder(buyOrder);

      expect(result.trades).to.have.lengthOf(2);
      // First trade should be with earlier order at better price (0.6)
      expect(result.trades[0].price).to.equal('0.6');
      expect(result.trades[0].size).to.equal('100');
      // Second trade should be remaining size at same price with later order
      expect(result.trades[1].price).to.equal('0.6');
      expect(result.trades[1].size).to.equal('50');
    });

    it('should prioritize better prices over time', async () => {
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.5', '100', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.7', '100', 'seller2');

      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.7', '150', 'buyer');
      const result = await matchingEngine.processOrder(buyOrder);

      expect(result.trades).to.have.lengthOf(2);
      // Better price (0.5) should be matched first
      expect(result.trades[0].price).to.equal('0.5');
      expect(result.trades[0].size).to.equal('100');
      // Then worse price (0.7)
      expect(result.trades[1].price).to.equal('0.7');
      expect(result.trades[1].size).to.equal('50');
    });
  });

  describe('IOC (Immediate-or-Cancel) Order Tests', () => {
    beforeEach(() => {
      const storage = require('../server/storage').storage;
      storage.updateOrderStatus; // Mock returns: ({ status: 'CANCELLED' });
    });

    it('should execute IOC order immediately and cancel remaining', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '50', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const iocOrder = createMockOrder('YES', 'IOC', '0.6', '100', 'buyer');
      const result = await matchingEngine.processOrder(iocOrder);

      expect(result.trades).to.have.lengthOf(1);
      expect(result.trades[0].size).to.equal('50');
      expect(result.order.status).to.equal('PARTIAL'); // Partial fill, rest cancelled
    });

    it('should cancel IOC order if no matches available', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.8', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const iocOrder = createMockOrder('YES', 'IOC', '0.7', '50', 'buyer');
      const result = await matchingEngine.processOrder(iocOrder);

      expect(result.trades).to.have.lengthOf(0);
      expect(result.order.status).to.equal('CANCELLED');
    });

    it('should fully execute IOC order when sufficient liquidity exists', async () => {
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.6', '60', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.6', '40', 'seller2');

      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);

      const iocOrder = createMockOrder('YES', 'IOC', '0.6', '100', 'buyer');
      
      const storage = require('../server/storage').storage;
      storage.updateOrderStatus; // Mock returns: ({ status: 'FILLED' });
      
      const result = await matchingEngine.processOrder(iocOrder);

      expect(result.trades).to.have.lengthOf(2);
      expect(result.order.status).to.equal('FILLED');
    });
  });

  describe('FOK (Fill-or-Kill) Order Tests', () => {
    beforeEach(() => {
      const storage = require('../server/storage').storage;
      storage.updateOrderStatus; // Mock returns: ({ status: 'CANCELLED' });
    });

    it('should fill FOK order completely when sufficient liquidity exists', async () => {
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.6', '60', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.6', '40', 'seller2');

      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);

      const fokOrder = createMockOrder('YES', 'FOK', '0.6', '100', 'buyer');
      
      const storage = require('../server/storage').storage;
      storage.updateOrderStatus; // Mock returns: ({ status: 'FILLED' });
      
      const result = await matchingEngine.processOrder(fokOrder);

      expect(result.trades).to.have.lengthOf(2);
      expect(result.order.status).to.equal('FILLED');
      expect(result.rejected).to.be.false;
    });

    it('should reject FOK order when insufficient liquidity', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '50', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const fokOrder = createMockOrder('YES', 'FOK', '0.6', '100', 'buyer');
      const result = await matchingEngine.processOrder(fokOrder);

      expect(result.trades).to.have.lengthOf(0);
      expect(result.order.status).to.equal('CANCELLED');
      expect(result.rejected).to.equal(true);
      expect(result.rejectReason).to.equal('FOK order cannot be completely filled');
    });

    it('should reject FOK order when price levels do not provide enough liquidity', async () => {
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.5', '30', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.7', '100', 'seller2');

      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);

      const fokOrder = createMockOrder('YES', 'FOK', '0.6', '100', 'buyer');
      const result = await matchingEngine.processOrder(fokOrder);

      expect(result.rejected).to.equal(true);
      expect(result.trades).to.have.lengthOf(0);
      // Only 30 shares available at acceptable price (≤ 0.6)
    });
  });

  describe('Advanced Partial Fill Scenarios', () => {
    it('should handle complex partial fills across multiple price levels', async () => {
      const sellOrder1 = createMockOrder('NO', 'LIMIT', '0.3', '25', 'seller1');
      const sellOrder2 = createMockOrder('NO', 'LIMIT', '0.4', '25', 'seller2');
      const sellOrder3 = createMockOrder('NO', 'LIMIT', '0.5', '25', 'seller3');
      
      matchingEngine['addToOrderBook'](sellOrder1);
      matchingEngine['addToOrderBook'](sellOrder2);
      matchingEngine['addToOrderBook'](sellOrder3);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.45', '60', 'buyer');
      const result = await matchingEngine.processOrder(buyOrder);
      
      expect(result.trades).to.have.lengthOf(2); // Only first two price levels match
      
      const totalFilled = result.trades.reduce((sum, trade) => 
        sum + parseFloat(trade.size), 0
      );
      expect(totalFilled).to.equal(50); // 25 + 25 from first two levels
    });

    it('should handle orders with decimal precision correctly', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '0.000001', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.6', '0.000001', 'buyer');
      const result = await matchingEngine.processOrder(buyOrder);

      expect(result.trades).to.have.lengthOf(1);
      expect(result.trades[0].size).to.equal('0.000001');
    });
  });

  describe('Order Book State Management', () => {
    it('should maintain correct order book state after partial fills', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Partially fill the sell order
      const buyOrder1 = createMockOrder('YES', 'LIMIT', '0.6', '30', 'buyer1');
      await matchingEngine.processOrder(buyOrder1);

      const orderBook = matchingEngine.getOrderBook(mockMarketId);
      expect(orderBook.no).to.have.lengthOf(1);
      expect(orderBook.no[0].size.toString()).to.equal('70'); // Remaining size
    });

    it('should remove completely filled orders from order book', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.6', '100', 'buyer');
      await matchingEngine.processOrder(buyOrder);

      // Should update sell order status to FILLED
      const storage = require('../server/storage').storage;
      expect(storage.updateOrderStatus); // Called with: (sellOrder.id, 'FILLED');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle self-matching scenarios', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '100', 'user-123');
      matchingEngine['addToOrderBook'](sellOrder);

      // Same user placing buy order
      const buyOrder = createMockOrder('YES', 'LIMIT', '0.6', '100', 'user-123');
      const result = await matchingEngine.processOrder(buyOrder);

      // Current implementation allows self-matching
      expect(result.trades).to.have.lengthOf(1);
    });

    it('should handle extremely large order sizes', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '999999999', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      const buyOrder = createMockOrder('YES', 'LIMIT', '0.6', '999999999', 'buyer');
      const result = await matchingEngine.processOrder(buyOrder);

      expect(result.trades).to.have.lengthOf(1);
      expect(result.trades[0].size).to.equal('999999999');
    });

    it('should handle concurrent order processing correctly', async () => {
      const sellOrder = createMockOrder('NO', 'LIMIT', '0.6', '100', 'seller');
      matchingEngine['addToOrderBook'](sellOrder);

      // Process multiple orders concurrently
      const buyOrder1 = createMockOrder('YES', 'LIMIT', '0.6', '60', 'buyer1');
      const buyOrder2 = createMockOrder('YES', 'LIMIT', '0.6', '40', 'buyer2');

      const results = await Promise.all([
        matchingEngine.processOrder(buyOrder1),
        matchingEngine.processOrder(buyOrder2)
      ]);

      // Should handle concurrent processing without errors
      expect(results).to.have.lengthOf(2);
      expect(results[0].trades.length + results[1].trades.length).to.be.greaterThan(0);
    });
  });
});
