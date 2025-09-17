import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer } from "ws";
import { storage } from "./storage";
import { insertUserSchema, insertMarketSchema, insertOrderSchema } from "@shared/schema";
import { MatchingEngine } from "./services/matching-engine";
import { setupWebSocket } from "./services/websocket";

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Initialize matching engine
  const matchingEngine = new MatchingEngine();
  
  // Setup WebSocket
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  setupWebSocket(wss, matchingEngine);

  // User routes
  app.post('/api/users', async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.json(user);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.get('/api/users/:walletAddress', async (req, res) => {
    try {
      const user = await storage.getUserByWallet(req.params.walletAddress);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Market routes
  app.get('/api/markets', async (req, res) => {
    try {
      const markets = await storage.getActiveMarkets();
      res.json(markets);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/markets/:id', async (req, res) => {
    try {
      const market = await storage.getMarket(req.params.id);
      if (!market) {
        return res.status(404).json({ error: 'Market not found' });
      }
      res.json(market);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/markets', async (req, res) => {
    try {
      const { title, description, creatorId, expiryDate, liquidity, metadata } = req.body;
      
      // Handle both wallet address and user UUID for creatorId
      let actualCreatorId = creatorId;
      
      // If creatorId looks like a wallet address (longer than typical UUID), find the user
      if (creatorId && (creatorId.length > 36 || !creatorId.includes('-'))) {
        const creator = await storage.getUserByWallet(creatorId);
        if (!creator) {
          return res.status(400).json({ error: 'Creator user not found' });
        }
        actualCreatorId = creator.id;
      }
      
      // Convert expiryDate string to Date object
      const processedExpiryDate = new Date(expiryDate);
      if (isNaN(processedExpiryDate.getTime())) {
        return res.status(400).json({ error: 'Invalid expiry date format' });
      }
      
      // Prepare market data with processed values
      const marketDataToValidate = {
        title,
        description,
        creatorId: actualCreatorId,
        expiryDate: processedExpiryDate,
        liquidity: liquidity || "0",
        metadata
      };
      
      // Now validate with the schema
      const marketData = insertMarketSchema.parse(marketDataToValidate);
      
      const market = await storage.createMarket(marketData);
      res.json(market);
    } catch (error: any) {
      console.error('Market creation error:', error);
      res.status(400).json({ error: error.message });
    }
  });

  // Order routes
  app.get('/api/markets/:marketId/orders', async (req, res) => {
    try {
      const orders = await storage.getMarketOrders(req.params.marketId);
      res.json(orders);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/orders', async (req, res) => {
    try {
      const orderData = insertOrderSchema.parse(req.body);
      const order = await storage.createOrder(orderData);
      
      // Process order through matching engine
      const result = await matchingEngine.processOrder(order);
      
      // Broadcast updates via WebSocket
      wss.clients.forEach((client) => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'ORDER_UPDATE',
            data: result
          }));
        }
      });
      
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.delete('/api/orders/:id', async (req, res) => {
    try {
      await storage.cancelOrder(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Position routes
  app.get('/api/users/:userId/positions', async (req, res) => {
    try {
      let userId = req.params.userId;
      
      // Check if userId is a wallet address (not UUID format)
      // UUIDs have hyphens and are 36 characters, wallet addresses are longer and have no hyphens
      const isWalletAddress = !userId.includes('-') && userId.length > 36;
      
      if (isWalletAddress) {
        // Resolve wallet address to user UUID
        const user = await storage.getUserByWallet(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        userId = user.id;
      }
      
      const positions = await storage.getUserPositions(userId);
      res.json(positions);
    } catch (error: any) {
      console.error('Positions endpoint error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Trade routes
  app.get('/api/markets/:marketId/trades', async (req, res) => {
    try {
      const trades = await storage.getMarketTrades(req.params.marketId);
      res.json(trades);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get('/api/users/:userId/trades', async (req, res) => {
    try {
      let userId = req.params.userId;
      
      // Check if userId is a wallet address (not UUID format)
      // UUIDs have hyphens and are 36 characters, wallet addresses are longer and have no hyphens
      const isWalletAddress = !userId.includes('-') && userId.length > 36;
      
      if (isWalletAddress) {
        // Resolve wallet address to user UUID
        const user = await storage.getUserByWallet(userId);
        if (!user) {
          return res.status(404).json({ error: 'User not found' });
        }
        userId = user.id;
      }
      
      const trades = await storage.getUserTrades(userId);
      res.json(trades);
    } catch (error: any) {
      console.error('Trades endpoint error:', error.message);
      res.status(500).json({ error: error.message });
    }
  });

  return httpServer;
}
