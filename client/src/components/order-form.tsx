import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Market } from "@/types/market";
import { useWallet } from "./wallet-connection";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface OrderFormProps {
  market?: Market;
}

export function OrderForm({ market }: OrderFormProps) {
  const [orderSide, setOrderSide] = useState<'YES' | 'NO'>('YES');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [amount, setAmount] = useState('');
  const [price, setPrice] = useState('');
  
  const { isConnected, walletAddress } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const placeOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await apiRequest('POST', '/api/orders', orderData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Placed",
        description: "Your order has been submitted successfully.",
      });
      setAmount('');
      setPrice('');
      queryClient.invalidateQueries({ queryKey: ['/api/markets'] });
    },
    onError: (error: any) => {
      toast({
        title: "Order Failed",
        description: error.message || "Failed to place order",
        variant: "destructive",
      });
    },
  });

  const handlePlaceOrder = () => {
    if (!isConnected || !walletAddress) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to place orders.",
        variant: "destructive",
      });
      return;
    }

    if (!market) {
      toast({
        title: "No Market Selected",
        description: "Please select a market to place orders.",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount.",
        variant: "destructive",
      });
      return;
    }

    if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0 || parseFloat(price) > 1)) {
      toast({
        title: "Invalid Price",
        description: "Please enter a valid price between 0 and 1.",
        variant: "destructive",
      });
      return;
    }

    const orderData = {
      marketId: market.id,
      userId: walletAddress, // Using wallet address as userId for now
      side: orderSide,
      type: orderType,
      price: orderType === 'MARKET' ? (orderSide === 'YES' ? market.yesPrice : market.noPrice) : price,
      size: amount,
    };

    placeOrderMutation.mutate(orderData);
  };

  const estimatedShares = amount && price ? 
    (parseFloat(amount) / parseFloat(price || (orderSide === 'YES' ? market?.yesPrice || '0.5' : market?.noPrice || '0.5'))).toFixed(2) : 
    '0.00';

  const maxProfit = amount && price ? 
    (parseFloat(amount) * (1 - parseFloat(price || (orderSide === 'YES' ? market?.yesPrice || '0.5' : market?.noPrice || '0.5')))).toFixed(2) : 
    '0.00';

  if (!market) {
    return (
      <Card className="bg-card rounded-lg border border-border p-6">
        <div className="text-center text-muted-foreground">
          Select a market to place orders
        </div>
      </Card>
    );
  }

  return (
    <Card className="bg-card rounded-lg border border-border" data-testid="order-form">
      <div className="flex border-b border-border">
        <button
          className={`flex-1 py-4 px-6 text-center border-r border-border font-medium transition-colors ${
            orderSide === 'YES' 
              ? 'bg-success/10 text-success' 
              : 'bg-secondary/50 text-secondary-foreground hover:bg-success/5'
          }`}
          onClick={() => setOrderSide('YES')}
          data-testid="button-buy-yes"
        >
          Buy YES
        </button>
        <button
          className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
            orderSide === 'NO' 
              ? 'bg-destructive/10 text-destructive' 
              : 'bg-secondary/50 text-secondary-foreground hover:bg-destructive/5'
          }`}
          onClick={() => setOrderSide('NO')}
          data-testid="button-buy-no"
        >
          Buy NO
        </button>
      </div>
      
      <div className="p-6">
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              orderType === 'MARKET' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-primary/10'
            }`}
            onClick={() => setOrderType('MARKET')}
            data-testid="button-market-order"
          >
            Market
          </button>
          <button
            className={`py-2 px-4 rounded-lg font-medium transition-colors ${
              orderType === 'LIMIT' 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary text-secondary-foreground hover:bg-primary/10'
            }`}
            onClick={() => setOrderType('LIMIT')}
            data-testid="button-limit-order"
          >
            Limit
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <Label className="block text-sm font-medium text-muted-foreground mb-2">
              Amount (USDC)
            </Label>
            <Input
              type="number"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-4 py-3 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-ring"
              data-testid="input-order-amount"
            />
          </div>
          
          {orderType === 'LIMIT' && (
            <div>
              <Label className="block text-sm font-medium text-muted-foreground mb-2">
                Price per Share
              </Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="1"
                placeholder={orderSide === 'YES' ? market.yesPrice : market.noPrice}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-input border border-border rounded-lg px-4 py-3 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="input-order-price"
              />
            </div>
          )}
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Est. Shares:</span>
            <span className="font-mono" data-testid="estimated-shares">{estimatedShares}</span>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Max Profit:</span>
            <span className="font-mono text-success" data-testid="max-profit">${maxProfit}</span>
          </div>
          
          <Button
            onClick={handlePlaceOrder}
            disabled={!isConnected || placeOrderMutation.isPending}
            className={`w-full py-4 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
              orderSide === 'YES'
                ? 'bg-success hover:bg-success/90 text-success-foreground'
                : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
            }`}
            data-testid="button-place-order"
          >
            {orderSide === 'YES' ? (
              <ArrowUp size={16} />
            ) : (
              <ArrowDown size={16} />
            )}
            <span>
              {placeOrderMutation.isPending ? 'Placing Order...' : `Place ${orderSide} Order`}
            </span>
          </Button>
        </div>
      </div>
    </Card>
  );
}
