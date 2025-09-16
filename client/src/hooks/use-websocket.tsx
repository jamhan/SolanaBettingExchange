import { useEffect, useState, useRef } from "react";

export function useWebSocket() {
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'Connecting' | 'Open' | 'Closed' | 'Error'>('Connecting');
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws.current = new WebSocket(wsUrl);

    ws.current.onopen = () => {
      setConnectionStatus('Open');
      console.log('WebSocket connected');
    };

    ws.current.onmessage = (event) => {
      setLastMessage(event.data);
    };

    ws.current.onclose = () => {
      setConnectionStatus('Closed');
      console.log('WebSocket disconnected');
    };

    ws.current.onerror = (error) => {
      setConnectionStatus('Error');
      console.error('WebSocket error:', error);
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const sendMessage = (message: any) => {
    if (ws.current && ws.current.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  };

  const subscribeToMarket = (marketId: string) => {
    sendMessage({ type: 'SUBSCRIBE_MARKET', marketId });
  };

  const unsubscribeFromMarket = (marketId: string) => {
    sendMessage({ type: 'UNSUBSCRIBE_MARKET', marketId });
  };

  const subscribeToUser = (userId: string) => {
    sendMessage({ type: 'SUBSCRIBE_USER', userId });
  };

  return {
    lastMessage,
    connectionStatus,
    sendMessage,
    subscribeToMarket,
    unsubscribeFromMarket,
    subscribeToUser,
  };
}
