import { WebSocketServer, WebSocket } from 'ws';
import { MatchingEngine } from './matching-engine';
import { storage } from '../storage';

interface WebSocketClient extends WebSocket {
  userId?: string;
  subscribedMarkets?: Set<string>;
}

export function setupWebSocket(wss: WebSocketServer, matchingEngine: MatchingEngine) {
  wss.on('connection', (ws: WebSocketClient) => {
    ws.subscribedMarkets = new Set();

    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'SUBSCRIBE_MARKET':
            ws.subscribedMarkets?.add(data.marketId);
            // Send initial order book
            const orderBook = matchingEngine.getOrderBook(data.marketId);
            ws.send(JSON.stringify({
              type: 'ORDER_BOOK_UPDATE',
              marketId: data.marketId,
              data: orderBook
            }));
            break;

          case 'UNSUBSCRIBE_MARKET':
            ws.subscribedMarkets?.delete(data.marketId);
            break;

          case 'SUBSCRIBE_USER':
            ws.userId = data.userId;
            // Send user positions and orders
            const positions = await storage.getUserPositions(data.userId);
            const orders = await storage.getUserOrders(data.userId);
            
            ws.send(JSON.stringify({
              type: 'USER_DATA_UPDATE',
              data: { positions, orders }
            }));
            break;

          case 'PING':
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'ERROR',
          message: 'Invalid message format'
        }));
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to SolBet Exchange'
    }));
  });

  // Broadcast market updates
  const broadcastMarketUpdate = (marketId: string, data: any) => {
    wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN && 
          client.subscribedMarkets?.has(marketId)) {
        client.send(JSON.stringify({
          type: 'MARKET_UPDATE',
          marketId,
          data
        }));
      }
    });
  };

  // Broadcast order book updates
  const broadcastOrderBookUpdate = (marketId: string, orderBook: any) => {
    wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN && 
          client.subscribedMarkets?.has(marketId)) {
        client.send(JSON.stringify({
          type: 'ORDER_BOOK_UPDATE',
          marketId,
          data: orderBook
        }));
      }
    });
  };

  // Broadcast trade updates
  const broadcastTrade = (marketId: string, trade: any) => {
    wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN && 
          client.subscribedMarkets?.has(marketId)) {
        client.send(JSON.stringify({
          type: 'TRADE_UPDATE',
          marketId,
          data: trade
        }));
      }
    });
  };

  // Broadcast user-specific updates
  const broadcastUserUpdate = (userId: string, data: any) => {
    wss.clients.forEach((client: WebSocketClient) => {
      if (client.readyState === WebSocket.OPEN && client.userId === userId) {
        client.send(JSON.stringify({
          type: 'USER_UPDATE',
          data
        }));
      }
    });
  };

  return {
    broadcastMarketUpdate,
    broadcastOrderBookUpdate,
    broadcastTrade,
    broadcastUserUpdate
  };
}
